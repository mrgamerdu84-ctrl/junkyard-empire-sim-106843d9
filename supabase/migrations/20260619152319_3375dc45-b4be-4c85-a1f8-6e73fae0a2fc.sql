
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS driver_name text,
  ADD COLUMN IF NOT EXISTS license_level int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS license_xp int NOT NULL DEFAULT 0;

-- Fonction sécurisée : ajoute de l'XP au joueur connecté et recalcule son niveau.
CREATE OR REPLACE FUNCTION public.add_license_xp(_amount int)
RETURNS TABLE(level int, xp int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_xp int;
  new_level int;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 200 THEN
    RAISE EXCEPTION 'Invalid XP amount';
  END IF;

  -- S'assure que le profil existe
  INSERT INTO public.profiles (id) VALUES (uid)
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.profiles
     SET license_xp = license_xp + _amount,
         updated_at = now()
   WHERE id = uid
   RETURNING license_xp INTO new_xp;

  -- Paliers : 0, 200, 600, 1500, 3500
  new_level := CASE
    WHEN new_xp >= 3500 THEN 5
    WHEN new_xp >= 1500 THEN 4
    WHEN new_xp >= 600  THEN 3
    WHEN new_xp >= 200  THEN 2
    ELSE 1
  END;

  UPDATE public.profiles
     SET license_level = new_level
   WHERE id = uid;

  RETURN QUERY SELECT new_level, new_xp;
END;
$$;

REVOKE ALL ON FUNCTION public.add_license_xp(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_license_xp(int) TO authenticated;
