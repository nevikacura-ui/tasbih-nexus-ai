
-- Enums
create type public.app_role as enum ('member', 'mentor', 'admin');
create type public.profile_status as enum ('explorer', 'member');

-- profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  city text,
  avatar_url text,
  status public.profile_status not null default 'explorer',
  referrals_received int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
alter table public.user_roles enable row level security;

-- has_role (security definer to avoid RLS recursion)
create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- referrals
create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  invitee_id uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (inviter_id, invitee_id)
);
create index referrals_inviter_idx on public.referrals(inviter_id);
alter table public.referrals enable row level security;

-- Generate random short code
create or replace function public.generate_referral_code()
returns text language plpgsql as $$
declare
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..8 loop
    result := result || substr(chars, 1 + floor(random()*length(chars))::int, 1);
  end loop;
  return result;
end;
$$;

-- Auto-create profile + initial invite code on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_code text;
  attempts int := 0;
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Issue an initial referral code (retry on rare collision)
  loop
    attempts := attempts + 1;
    new_code := public.generate_referral_code();
    begin
      insert into public.referrals (code, inviter_id) values (new_code, new.id);
      exit;
    exception when unique_violation then
      if attempts > 5 then raise; end if;
    end;
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- updated_at trigger for profiles
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Redeem a referral code (called by authenticated invitee)
create or replace function public.redeem_referral(_code text)
returns json language plpgsql security definer set search_path = public as $$
declare
  v_referral public.referrals%rowtype;
  v_uid uuid := auth.uid();
  v_count int;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'not_authenticated');
  end if;

  select * into v_referral from public.referrals where code = _code limit 1;
  if not found then
    return json_build_object('ok', false, 'error', 'invalid_code');
  end if;

  if v_referral.inviter_id = v_uid then
    return json_build_object('ok', false, 'error', 'self_referral');
  end if;

  -- Already redeemed this exact code?
  if v_referral.invitee_id is not null then
    return json_build_object('ok', false, 'error', 'already_redeemed');
  end if;

  -- Already redeemed a different code from same inviter?
  if exists (
    select 1 from public.referrals
    where inviter_id = v_referral.inviter_id and invitee_id = v_uid
  ) then
    return json_build_object('ok', false, 'error', 'duplicate_inviter');
  end if;

  update public.referrals
    set invitee_id = v_uid, redeemed_at = now()
    where id = v_referral.id;

  -- Count distinct inviters who referred this user
  select count(distinct inviter_id) into v_count
    from public.referrals where invitee_id = v_uid;

  update public.profiles
    set referrals_received = v_count,
        status = case when v_count >= 2 then 'member'::public.profile_status else status end
    where id = v_uid;

  if v_count >= 2 and not exists (select 1 from public.user_roles where user_id = v_uid and role = 'member') then
    insert into public.user_roles (user_id, role) values (v_uid, 'member')
      on conflict do nothing;
  end if;

  return json_build_object('ok', true, 'count', v_count, 'unlocked', v_count >= 2);
end;
$$;

-- RLS: profiles — signed-in users can read all (community discovery); only self can edit
create policy "Authenticated can read profiles"
  on public.profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- RLS: user_roles — users can read own; only admins can write (manual seeding for now)
create policy "Users read own roles"
  on public.user_roles for select to authenticated using (auth.uid() = user_id);

create policy "Admins manage roles"
  on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- RLS: referrals
-- Inviter can see their own codes + status; invitees can see codes they've redeemed
create policy "Inviter reads own referrals"
  on public.referrals for select to authenticated
  using (auth.uid() = inviter_id or auth.uid() = invitee_id);

-- Members can create new invite codes for themselves
create policy "Members create own invites"
  on public.referrals for insert to authenticated
  with check (
    auth.uid() = inviter_id
    and invitee_id is null
    and redeemed_at is null
    and exists (select 1 from public.profiles where id = auth.uid() and status = 'member')
  );

-- Redemption happens via the security-definer RPC; no direct updates allowed.
