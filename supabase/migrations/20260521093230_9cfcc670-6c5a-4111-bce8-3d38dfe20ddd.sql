
DO $$ BEGIN
  CREATE TYPE public.report_target_type AS ENUM ('post','comment','user','message','community','event');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_reason AS ENUM (
    'harassment','hate_speech','spam','sexual_content','self_harm',
    'misinformation','impersonation','privacy','other'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.report_status AS ENUM ('open','reviewing','resolved','dismissed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.moderator_action AS ENUM ('warn','hide','remove','ban','dismiss','noop');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL,
  target_type public.report_target_type NOT NULL,
  target_id text NOT NULL,
  reason public.report_reason NOT NULL,
  details text,
  status public.report_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_target ON public.reports(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON public.reports(reporter_id);

CREATE TRIGGER reports_touch_updated_at
BEFORE UPDATE ON public.reports
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_mod_or_admin(_uid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_uid, 'moderator'::app_role) OR public.has_role(_uid, 'admin'::app_role)
$$;
REVOKE EXECUTE ON FUNCTION public.is_mod_or_admin(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_mod_or_admin(uuid) TO authenticated;

CREATE POLICY "Users submit reports"
ON public.reports FOR INSERT TO authenticated
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporter reads own reports"
ON public.reports FOR SELECT TO authenticated
USING (auth.uid() = reporter_id);

CREATE POLICY "Mods read all reports"
ON public.reports FOR SELECT TO authenticated
USING (public.is_mod_or_admin(auth.uid()));

CREATE POLICY "Mods update reports"
ON public.reports FOR UPDATE TO authenticated
USING (public.is_mod_or_admin(auth.uid()))
WITH CHECK (public.is_mod_or_admin(auth.uid()));

CREATE TABLE IF NOT EXISTS public.moderator_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
  moderator_id uuid NOT NULL,
  action public.moderator_action NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_modactions_report ON public.moderator_actions(report_id);

ALTER TABLE public.moderator_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Mods insert actions"
ON public.moderator_actions FOR INSERT TO authenticated
WITH CHECK (public.is_mod_or_admin(auth.uid()) AND moderator_id = auth.uid());

CREATE POLICY "Mods read actions"
ON public.moderator_actions FOR SELECT TO authenticated
USING (public.is_mod_or_admin(auth.uid()));
