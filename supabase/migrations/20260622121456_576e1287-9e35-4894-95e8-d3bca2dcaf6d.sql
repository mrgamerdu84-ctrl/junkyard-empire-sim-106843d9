
-- 1) Attribuer le rôle admin au compte indiqué
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'admin'::public.app_role
FROM auth.users u
WHERE u.email = 'mrgamerdu84@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Table admin_state (1 ligne par user)
CREATE TABLE public.admin_state (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  competitors jsonb NOT NULL DEFAULT '[]'::jsonb,
  custom_vehicles jsonb NOT NULL DEFAULT '[]'::jsonb,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_state TO authenticated;
GRANT ALL ON public.admin_state TO service_role;

ALTER TABLE public.admin_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own admin state"
  ON public.admin_state FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own admin state"
  ON public.admin_state FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own admin state"
  ON public.admin_state FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own admin state"
  ON public.admin_state FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER admin_state_set_updated_at
  BEFORE UPDATE ON public.admin_state
  FOR EACH ROW EXECUTE FUNCTION public.tt_set_updated_at();
