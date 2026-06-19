
-- 1) Roles enum + user_roles table
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- 2) Security definer role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 3) Replace permissive apks write policies with admin-only
DROP POLICY IF EXISTS "Anyone can upload apks" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can update apks" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can delete apks" ON storage.objects;

CREATE POLICY "Admins can upload apks"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'apks' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update apks"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'apks' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'apks' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete apks"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'apks' AND public.has_role(auth.uid(), 'admin'));
