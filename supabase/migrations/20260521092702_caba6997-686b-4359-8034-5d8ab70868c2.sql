
-- Pin search_path on remaining functions
create or replace function public.generate_referral_code()
returns text language plpgsql set search_path = public as $$
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

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at := now(); return new; end;
$$;

-- Lock down execute privileges on SECURITY DEFINER functions
revoke all on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.redeem_referral(text) from public, anon;
grant execute on function public.redeem_referral(text) to authenticated;
revoke all on function public.generate_referral_code() from public, anon, authenticated;
