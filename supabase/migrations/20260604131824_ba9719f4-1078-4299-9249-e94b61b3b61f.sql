
-- Atualiza trigger para conceder admin automático ao email do fundador
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  demo_id UUID;
  is_founder BOOLEAN;
BEGIN
  SELECT id INTO demo_id FROM public.tenants WHERE slug = 'demo' LIMIT 1;
  is_founder := lower(NEW.email) = 'talcalves@gmail.com';

  INSERT INTO public.profiles (id, email, full_name, approved, tenant_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    true,
    demo_id
  );

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, CASE WHEN is_founder THEN 'admin'::app_role ELSE 'user'::app_role END);

  RETURN NEW;
END;
$function$;

-- Caso o usuário já exista, garantir admin + aprovado
DO $$
DECLARE
  uid UUID;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE lower(email) = 'talcalves@gmail.com' LIMIT 1;
  IF uid IS NOT NULL THEN
    UPDATE public.profiles SET approved = true WHERE id = uid;
    INSERT INTO public.user_roles (user_id, role)
    VALUES (uid, 'admin'::app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END$$;
