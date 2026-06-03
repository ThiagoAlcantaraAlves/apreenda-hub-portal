DROP POLICY IF EXISTS "Users update own profile basic" ON public.profiles;

CREATE POLICY "Users update own profile basic"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (
  id = auth.uid()
  AND approved = (SELECT p.approved FROM public.profiles p WHERE p.id = auth.uid())
  AND tenant_id IS NOT DISTINCT FROM (SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid())
);