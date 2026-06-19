
-- =========================================
-- TABLE: defis (challenges 1v1 asynchrones)
-- =========================================
CREATE TABLE public.defis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  opponent_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seed bigint NOT NULL,
  duration_sec integer NOT NULL DEFAULT 300,
  creator_score integer,
  opponent_score integer,
  status text NOT NULL DEFAULT 'pending', -- pending | completed | expired
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  completed_at timestamptz,
  CONSTRAINT defis_distinct_players CHECK (creator_id <> opponent_id),
  CONSTRAINT defis_status_valid CHECK (status IN ('pending','completed','expired'))
);

CREATE INDEX defis_creator_idx ON public.defis(creator_id);
CREATE INDEX defis_opponent_idx ON public.defis(opponent_id);
CREATE INDEX defis_status_idx ON public.defis(status);

GRANT SELECT ON public.defis TO authenticated;
GRANT ALL ON public.defis TO service_role;

ALTER TABLE public.defis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players view their own defis"
  ON public.defis FOR SELECT
  TO authenticated
  USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- Pas de policy INSERT/UPDATE/DELETE : tout passe par les fonctions SECURITY DEFINER

CREATE TRIGGER defis_set_updated_at
  BEFORE UPDATE ON public.defis
  FOR EACH ROW EXECUTE FUNCTION public.tt_set_updated_at();

-- =========================================
-- FUNCTION: find_user_by_pseudo
-- Recherche minimale d'un joueur par pseudo (case-insensitive), sans exposer profiles
-- =========================================
CREATE OR REPLACE FUNCTION public.find_user_by_pseudo(_pseudo text)
RETURNS TABLE(id uuid, pseudo text, avatar_kind text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.pseudo, p.avatar_kind
  FROM public.profiles p
  WHERE lower(p.pseudo) = lower(_pseudo)
    AND p.id <> auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_user_by_pseudo(text) TO authenticated;

-- =========================================
-- FUNCTION: create_defi
-- Crée un défi contre un adversaire trouvé par pseudo
-- =========================================
CREATE OR REPLACE FUNCTION public.create_defi(_opponent_pseudo text, _duration_sec integer DEFAULT 300)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  opp_id uuid;
  new_id uuid;
  new_seed bigint;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _duration_sec IS NULL OR _duration_sec < 60 OR _duration_sec > 1800 THEN
    RAISE EXCEPTION 'Invalid duration';
  END IF;

  SELECT id INTO opp_id
  FROM public.profiles
  WHERE lower(pseudo) = lower(trim(_opponent_pseudo))
    AND id <> uid
  LIMIT 1;

  IF opp_id IS NULL THEN
    RAISE EXCEPTION 'Opponent not found';
  END IF;

  -- seed positive sur 53 bits (safe en JS Number)
  new_seed := (floor(random() * 9007199254740992))::bigint;

  INSERT INTO public.defis (creator_id, opponent_id, seed, duration_sec)
  VALUES (uid, opp_id, new_seed, _duration_sec)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_defi(text, integer) TO authenticated;

-- =========================================
-- FUNCTION: submit_defi_score
-- Le joueur appelant enregistre son propre score; calcul auto du gagnant
-- =========================================
CREATE OR REPLACE FUNCTION public.submit_defi_score(_defi_id uuid, _score integer)
RETURNS public.defis
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  d public.defis;
  is_creator boolean;
  is_opponent boolean;
  c_score integer;
  o_score integer;
  new_status text;
  new_winner uuid;
  new_completed_at timestamptz;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _score IS NULL OR _score < 0 OR _score > 10000000 THEN
    RAISE EXCEPTION 'Invalid score';
  END IF;

  SELECT * INTO d FROM public.defis WHERE id = _defi_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Defi not found';
  END IF;

  is_creator := (d.creator_id = uid);
  is_opponent := (d.opponent_id = uid);
  IF NOT (is_creator OR is_opponent) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  IF d.status = 'completed' THEN
    RAISE EXCEPTION 'Defi already completed';
  END IF;
  IF d.expires_at < now() THEN
    UPDATE public.defis SET status = 'expired' WHERE id = _defi_id;
    RAISE EXCEPTION 'Defi expired';
  END IF;

  IF is_creator THEN
    IF d.creator_score IS NOT NULL THEN
      RAISE EXCEPTION 'Score already submitted';
    END IF;
    c_score := _score;
    o_score := d.opponent_score;
  ELSE
    IF d.opponent_score IS NOT NULL THEN
      RAISE EXCEPTION 'Score already submitted';
    END IF;
    c_score := d.creator_score;
    o_score := _score;
  END IF;

  IF c_score IS NOT NULL AND o_score IS NOT NULL THEN
    new_status := 'completed';
    new_completed_at := now();
    IF c_score > o_score THEN new_winner := d.creator_id;
    ELSIF o_score > c_score THEN new_winner := d.opponent_id;
    ELSE new_winner := NULL; -- égalité
    END IF;
  ELSE
    new_status := 'pending';
    new_completed_at := NULL;
    new_winner := NULL;
  END IF;

  UPDATE public.defis
     SET creator_score = c_score,
         opponent_score = o_score,
         status = new_status,
         winner_id = new_winner,
         completed_at = COALESCE(new_completed_at, completed_at)
   WHERE id = _defi_id
   RETURNING * INTO d;

  RETURN d;
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_defi_score(uuid, integer) TO authenticated;

-- =========================================
-- Realtime
-- =========================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.defis;
ALTER TABLE public.defis REPLICA IDENTITY FULL;
