ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_kind text NOT NULL DEFAULT 'man',
  ADD COLUMN IF NOT EXISTS avatar_url text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_avatar_kind_check
  CHECK (avatar_kind IN ('man','woman','photo'));