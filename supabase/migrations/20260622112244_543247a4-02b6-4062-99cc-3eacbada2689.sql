
CREATE OR REPLACE FUNCTION public.submit_defi_run(_defi_id uuid, _missions_completed integer, _elapsed_sec integer)
 RETURNS defis
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  max_missions integer;
  computed_score bigint := 0;
  i integer;
  fare integer;
  s bigint;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _missions_completed IS NULL OR _missions_completed < 0 OR _missions_completed > 10000 THEN
    RAISE EXCEPTION 'Invalid mission count';
  END IF;
  IF _elapsed_sec IS NULL OR _elapsed_sec < 5 THEN
    RAISE EXCEPTION 'Invalid elapsed time';
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

  -- Plafond temps : pas plus que duration + 10s de tolérance réseau
  IF _elapsed_sec > d.duration_sec + 10 THEN
    _elapsed_sec := d.duration_sec + 10;
  END IF;

  -- Plafond physique : au mieux 1 mission toutes les 8 secondes
  max_missions := GREATEST(0, _elapsed_sec / 8);
  IF _missions_completed > max_missions THEN
    _missions_completed := max_missions;
  END IF;

  -- Score déterministe calculé serveur depuis le seed (le client ne fournit pas de €)
  -- Tarif par course dans [25, 95] €, dépendant du seed et de l'index de la course.
  s := d.seed;
  FOR i IN 0.._missions_completed - 1 LOOP
    fare := 25 + (((s + (i::bigint * 2654435761))::bigint % 71 + 71) % 71)::integer;
    computed_score := computed_score + fare;
  END LOOP;

  IF computed_score > 10000000 THEN
    computed_score := 10000000;
  END IF;

  IF is_creator THEN
    IF d.creator_score IS NOT NULL THEN
      RAISE EXCEPTION 'Score already submitted';
    END IF;
    c_score := computed_score::integer;
    o_score := d.opponent_score;
  ELSE
    IF d.opponent_score IS NOT NULL THEN
      RAISE EXCEPTION 'Score already submitted';
    END IF;
    c_score := d.creator_score;
    o_score := computed_score::integer;
  END IF;

  IF c_score IS NOT NULL AND o_score IS NOT NULL THEN
    new_status := 'completed';
    new_completed_at := now();
    IF c_score > o_score THEN new_winner := d.creator_id;
    ELSIF o_score > c_score THEN new_winner := d.opponent_id;
    ELSE new_winner := NULL;
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
$function$;

-- Verrouille l'ancien chemin "score brut côté client" pour empêcher la triche.
CREATE OR REPLACE FUNCTION public.submit_defi_score(_defi_id uuid, _score integer)
 RETURNS defis
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'submit_defi_score is disabled, use submit_defi_run';
END;
$function$;
