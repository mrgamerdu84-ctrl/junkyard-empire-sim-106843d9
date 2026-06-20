
CREATE TABLE public.game_saves (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.game_saves TO authenticated;
GRANT ALL ON public.game_saves TO service_role;

ALTER TABLE public.game_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players read their own save"
  ON public.game_saves FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Players insert their own save"
  ON public.game_saves FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players update their own save"
  ON public.game_saves FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Players delete their own save"
  ON public.game_saves FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER tt_game_saves_updated_at
  BEFORE UPDATE ON public.game_saves
  FOR EACH ROW EXECUTE FUNCTION public.tt_set_updated_at();
