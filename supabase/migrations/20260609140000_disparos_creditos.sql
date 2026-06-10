-- =====================================================================
-- Disparos WhatsApp + Subsistema de Créditos (ASAAS) — Hub Apreenda
-- Port da Escola de Motelaria adaptado ao modelo do hub:
--   - roles via public.user_roles + public.has_role() (não profiles.role)
--   - escopo de dados POR USUÁRIO (RLS auth.uid() = user_id)
-- Idempotente: pode rodar mais de uma vez no SQL Editor do Lovable.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Helpers
-- ---------------------------------------------------------------------

-- Trigger genérico updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- "staff" = admin do hub (wrapper sobre has_role, pra copiar o SQL de disparos 1:1)
CREATE OR REPLACE FUNCTION public.is_staff(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_uid, 'admin'::public.app_role);
$$;

-- =====================================================================
-- 1. TABELAS DE DISPAROS (escopo por usuário)
-- =====================================================================

-- ---- config da API (WABA / phone_number_id / token) por usuário ----
CREATE TABLE IF NOT EXISTS public.disparos_api_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  waba_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL,
  access_token TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disparos_api_config TO authenticated;
GRANT ALL ON public.disparos_api_config TO service_role;
ALTER TABLE public.disparos_api_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "disparos_api_config: owner" ON public.disparos_api_config;
CREATE POLICY "disparos_api_config: owner" ON public.disparos_api_config
  FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));
DROP TRIGGER IF EXISTS trg_disparos_api_config_updated_at ON public.disparos_api_config;
CREATE TRIGGER trg_disparos_api_config_updated_at
  BEFORE UPDATE ON public.disparos_api_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- contatos ----
CREATE TABLE IF NOT EXISTS public.disparos_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_disparos_contacts_user_phone ON public.disparos_contacts(user_id, phone);
CREATE INDEX IF NOT EXISTS idx_disparos_contacts_user ON public.disparos_contacts(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disparos_contacts TO authenticated;
GRANT ALL ON public.disparos_contacts TO service_role;
ALTER TABLE public.disparos_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "disparos_contacts: owner" ON public.disparos_contacts;
CREATE POLICY "disparos_contacts: owner" ON public.disparos_contacts
  FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));
DROP TRIGGER IF EXISTS trg_disparos_contacts_updated_at ON public.disparos_contacts;
CREATE TRIGGER trg_disparos_contacts_updated_at
  BEFORE UPDATE ON public.disparos_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- clientes (lista importada por unidade) ----
CREATE TABLE IF NOT EXISTS public.disparos_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  unit TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disparos_clients_user ON public.disparos_clients(user_id);
CREATE INDEX IF NOT EXISTS idx_disparos_clients_unit ON public.disparos_clients(unit);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disparos_clients TO authenticated;
GRANT ALL ON public.disparos_clients TO service_role;
ALTER TABLE public.disparos_clients ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "disparos_clients: owner" ON public.disparos_clients;
CREATE POLICY "disparos_clients: owner" ON public.disparos_clients
  FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- ---- campanhas ----
CREATE TABLE IF NOT EXISTS public.disparos_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL DEFAULT 'pt_BR',
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  total_recipients INT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  credits_consumed INT NOT NULL DEFAULT 0,
  credit_consumed_at TIMESTAMPTZ,
  avg_send_time_ms INT,
  total_duration_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_disparos_campaigns_user ON public.disparos_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_disparos_campaigns_status ON public.disparos_campaigns(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disparos_campaigns TO authenticated;
GRANT ALL ON public.disparos_campaigns TO service_role;
ALTER TABLE public.disparos_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "disparos_campaigns: owner" ON public.disparos_campaigns;
CREATE POLICY "disparos_campaigns: owner" ON public.disparos_campaigns
  FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- ---- mensagens (1 linha por destinatário) ----
CREATE TABLE IF NOT EXISTS public.disparos_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.disparos_campaigns(id) ON DELETE CASCADE,
  contact_phone TEXT NOT NULL,
  contact_name TEXT,
  whatsapp_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  send_time_ms INT,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disparos_messages_user ON public.disparos_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_disparos_messages_campaign ON public.disparos_messages(campaign_id);
CREATE INDEX IF NOT EXISTS idx_disparos_messages_status ON public.disparos_messages(status);
CREATE INDEX IF NOT EXISTS idx_disparos_messages_wamid ON public.disparos_messages(whatsapp_message_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disparos_messages TO authenticated;
GRANT ALL ON public.disparos_messages TO service_role;
ALTER TABLE public.disparos_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "disparos_messages: owner" ON public.disparos_messages;
CREATE POLICY "disparos_messages: owner" ON public.disparos_messages
  FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));

-- ---- campanhas agendadas ----
CREATE TABLE IF NOT EXISTS public.disparos_scheduled_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_language TEXT NOT NULL DEFAULT 'pt_BR',
  variables JSONB NOT NULL DEFAULT '{}'::jsonb,
  recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  campaign_id UUID,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disparos_sched_user ON public.disparos_scheduled_campaigns(user_id);
CREATE INDEX IF NOT EXISTS idx_disparos_sched_due ON public.disparos_scheduled_campaigns(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_disparos_sched_status ON public.disparos_scheduled_campaigns(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.disparos_scheduled_campaigns TO authenticated;
GRANT ALL ON public.disparos_scheduled_campaigns TO service_role;
ALTER TABLE public.disparos_scheduled_campaigns ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "disparos_sched: owner" ON public.disparos_scheduled_campaigns;
CREATE POLICY "disparos_sched: owner" ON public.disparos_scheduled_campaigns
  FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()))
  WITH CHECK (auth.uid() = user_id OR public.is_staff(auth.uid()));
DROP TRIGGER IF EXISTS trg_disparos_sched_updated_at ON public.disparos_scheduled_campaigns;
CREATE TRIGGER trg_disparos_sched_updated_at
  BEFORE UPDATE ON public.disparos_scheduled_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- audit logs ----
CREATE TABLE IF NOT EXISTS public.disparos_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_disparos_audit_user ON public.disparos_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_disparos_audit_created ON public.disparos_audit_logs(created_at DESC);
GRANT SELECT, INSERT ON public.disparos_audit_logs TO authenticated;
GRANT ALL ON public.disparos_audit_logs TO service_role;
ALTER TABLE public.disparos_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "disparos_audit: owner select" ON public.disparos_audit_logs;
CREATE POLICY "disparos_audit: owner select" ON public.disparos_audit_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "disparos_audit: owner insert" ON public.disparos_audit_logs;
CREATE POLICY "disparos_audit: owner insert" ON public.disparos_audit_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 2. SUBSISTEMA DE CRÉDITOS (ASAAS)
-- =====================================================================

-- ---- catálogo ----
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  interval text NOT NULL CHECK (interval IN ('monthly','yearly')),
  monthly_credits integer NOT NULL DEFAULT 0 CHECK (monthly_credits >= 0),
  trial_days integer NOT NULL DEFAULT 7,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.credit_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  price_cents integer NOT NULL CHECK (price_cents >= 0),
  credits integer NOT NULL CHECK (credits > 0),
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Plans readable by authenticated" ON public.subscription_plans;
CREATE POLICY "Plans readable by authenticated" ON public.subscription_plans
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Plans manageable by admin" ON public.subscription_plans;
CREATE POLICY "Plans manageable by admin" ON public.subscription_plans
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Packs readable by authenticated" ON public.credit_packs;
CREATE POLICY "Packs readable by authenticated" ON public.credit_packs
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Packs manageable by admin" ON public.credit_packs;
CREATE POLICY "Packs manageable by admin" ON public.credit_packs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ---- assinaturas ----
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.subscription_plans(id),
  status text NOT NULL CHECK (status IN ('trialing','active','past_due','canceled','expired')),
  trial_ends_at timestamptz,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL,
  credits_remaining integer NOT NULL DEFAULT 0,
  asaas_customer_id text,
  asaas_subscription_id text UNIQUE,
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_subscriptions_one_active
  ON public.user_subscriptions(user_id)
  WHERE status IN ('trialing','active','past_due');

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own subscription" ON public.user_subscriptions;
CREATE POLICY "Users read own subscription" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins read all subscriptions" ON public.user_subscriptions;
CREATE POLICY "Admins read all subscriptions" ON public.user_subscriptions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- ---- wallet + transactions ----
CREATE TABLE IF NOT EXISTS public.credit_wallets (
  user_id uuid PRIMARY KEY,
  pack_credits integer NOT NULL DEFAULT 0 CHECK (pack_credits >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.credit_wallets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own wallet" ON public.credit_wallets;
CREATE POLICY "Users read own wallet" ON public.credit_wallets
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('grant_subscription','grant_pack','consume','refund','reset')),
  amount integer NOT NULL,
  source text NOT NULL CHECK (source IN ('subscription','pack')),
  tool_slug text,
  reference text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS credit_transactions_user_idx ON public.credit_transactions(user_id, created_at DESC);
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own transactions" ON public.credit_transactions;
CREATE POLICY "Users read own transactions" ON public.credit_transactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- ---- log de eventos ASAAS (só service role acessa) ----
CREATE TABLE IF NOT EXISTS public.asaas_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text UNIQUE NOT NULL,
  event_type text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.asaas_events ENABLE ROW LEVEL SECURITY;

-- ---- triggers updated_at ----
DROP TRIGGER IF EXISTS trg_plans_updated ON public.subscription_plans;
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_packs_updated ON public.credit_packs;
CREATE TRIGGER trg_packs_updated BEFORE UPDATE ON public.credit_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_subs_updated ON public.user_subscriptions;
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_wallet_updated ON public.credit_wallets;
CREATE TRIGGER trg_wallet_updated BEFORE UPDATE ON public.credit_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---- auto-criar wallet ao criar profile + backfill ----
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.credit_wallets(user_id) VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_profile_wallet ON public.profiles;
CREATE TRIGGER trg_profile_wallet AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();

INSERT INTO public.credit_wallets (user_id)
SELECT id FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- =====================================================================
-- 3. RPCs DE CRÉDITO (admin do hub = bypass ilimitado)
-- =====================================================================

-- Saldo atual
CREATE OR REPLACE FUNCTION public.get_credit_balance()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _sub_credits int := 0;
  _pack_credits int := 0;
  _plan_name text;
  _period_end timestamptz;
  _status text;
  _trial_ends timestamptz;
BEGIN
  IF _uid IS NULL THEN
    RETURN jsonb_build_object('error','not_authenticated');
  END IF;

  IF public.has_role(_uid,'admin') THEN
    RETURN jsonb_build_object(
      'subscription_credits', 999999,
      'pack_credits', 0,
      'total', 999999,
      'plan_name', 'Staff (ilimitado)',
      'status', 'active',
      'trial_ends_at', NULL,
      'period_end', NULL,
      'bypass', true,
      'unlimited', true
    );
  END IF;

  SELECT s.credits_remaining, p.name, s.current_period_end, s.status, s.trial_ends_at
    INTO _sub_credits, _plan_name, _period_end, _status, _trial_ends
  FROM user_subscriptions s
  JOIN subscription_plans p ON p.id = s.plan_id
  WHERE s.user_id = _uid AND s.status IN ('trialing','active','past_due')
  LIMIT 1;

  SELECT COALESCE(pack_credits,0) INTO _pack_credits
  FROM credit_wallets WHERE user_id = _uid;

  RETURN jsonb_build_object(
    'subscription_credits', COALESCE(_sub_credits,0),
    'pack_credits', COALESCE(_pack_credits,0),
    'total', COALESCE(_sub_credits,0) + COALESCE(_pack_credits,0),
    'plan_name', _plan_name,
    'status', _status,
    'trial_ends_at', _trial_ends,
    'period_end', _period_end
  );
END;
$$;

-- Consumir créditos do próprio usuário (atômico)
CREATE OR REPLACE FUNCTION public.consume_credits(p_tool_slug text, p_amount int)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid();
  _sub user_subscriptions%ROWTYPE;
  _wallet credit_wallets%ROWTYPE;
  _from_sub int := 0;
  _from_pack int := 0;
  _remaining int;
BEGIN
  IF _uid IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not_authenticated'); END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RETURN jsonb_build_object('ok',false,'error','invalid_amount'); END IF;

  IF public.has_role(_uid,'admin') THEN
    RETURN jsonb_build_object('ok',true,'consumed',0,'bypass','admin');
  END IF;

  SELECT * INTO _wallet FROM credit_wallets WHERE user_id = _uid FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO credit_wallets(user_id) VALUES (_uid) RETURNING * INTO _wallet;
  END IF;

  SELECT * INTO _sub FROM user_subscriptions
   WHERE user_id = _uid AND status IN ('trialing','active')
   FOR UPDATE LIMIT 1;

  _remaining := p_amount;

  IF FOUND AND _sub.credits_remaining > 0 THEN
    _from_sub := LEAST(_sub.credits_remaining, _remaining);
    _remaining := _remaining - _from_sub;
  END IF;

  IF _remaining > 0 AND _wallet.pack_credits > 0 THEN
    _from_pack := LEAST(_wallet.pack_credits, _remaining);
    _remaining := _remaining - _from_pack;
  END IF;

  IF _remaining > 0 THEN
    RETURN jsonb_build_object('ok',false,'error','insufficient_credits',
      'available', COALESCE(_sub.credits_remaining,0) + _wallet.pack_credits);
  END IF;

  IF _from_sub > 0 THEN
    UPDATE user_subscriptions SET credits_remaining = credits_remaining - _from_sub
      WHERE id = _sub.id;
    INSERT INTO credit_transactions(user_id,type,amount,source,tool_slug)
      VALUES (_uid,'consume',-_from_sub,'subscription',p_tool_slug);
  END IF;
  IF _from_pack > 0 THEN
    UPDATE credit_wallets SET pack_credits = pack_credits - _from_pack
      WHERE user_id = _uid;
    INSERT INTO credit_transactions(user_id,type,amount,source,tool_slug)
      VALUES (_uid,'consume',-_from_pack,'pack',p_tool_slug);
  END IF;

  RETURN jsonb_build_object('ok',true,'consumed',p_amount,
    'from_subscription',_from_sub,'from_pack',_from_pack);
END;
$$;

-- Consumir créditos de um usuário via service role (usado pelo disparos-send-whatsapp)
CREATE OR REPLACE FUNCTION public.admin_consume_credits(_user_id uuid, _tool_slug text, _amount integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sub user_subscriptions%ROWTYPE;
  _wallet credit_wallets%ROWTYPE;
  _from_sub int := 0;
  _from_pack int := 0;
  _remaining int;
BEGIN
  IF _user_id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_user'); END IF;
  IF _amount IS NULL OR _amount <= 0 THEN RETURN jsonb_build_object('ok',false,'error','invalid_amount'); END IF;

  IF public.has_role(_user_id,'admin') THEN
    RETURN jsonb_build_object('ok',true,'consumed',0,'bypass','admin');
  END IF;

  SELECT * INTO _wallet FROM credit_wallets WHERE user_id = _user_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO credit_wallets(user_id) VALUES (_user_id) RETURNING * INTO _wallet;
  END IF;

  SELECT * INTO _sub FROM user_subscriptions
   WHERE user_id = _user_id AND status IN ('trialing','active')
   FOR UPDATE LIMIT 1;

  _remaining := _amount;
  IF FOUND AND _sub.credits_remaining > 0 THEN
    _from_sub := LEAST(_sub.credits_remaining, _remaining);
    _remaining := _remaining - _from_sub;
  END IF;
  IF _remaining > 0 AND _wallet.pack_credits > 0 THEN
    _from_pack := LEAST(_wallet.pack_credits, _remaining);
    _remaining := _remaining - _from_pack;
  END IF;

  IF _remaining > 0 THEN
    RETURN jsonb_build_object('ok',false,'error','insufficient_credits',
      'available', COALESCE(_sub.credits_remaining,0) + _wallet.pack_credits);
  END IF;

  IF _from_sub > 0 THEN
    UPDATE user_subscriptions SET credits_remaining = credits_remaining - _from_sub WHERE id = _sub.id;
    INSERT INTO credit_transactions(user_id,type,amount,source,tool_slug)
      VALUES (_user_id,'consume',-_from_sub,'subscription',_tool_slug);
  END IF;
  IF _from_pack > 0 THEN
    UPDATE credit_wallets SET pack_credits = pack_credits - _from_pack WHERE user_id = _user_id;
    INSERT INTO credit_transactions(user_id,type,amount,source,tool_slug)
      VALUES (_user_id,'consume',-_from_pack,'pack',_tool_slug);
  END IF;

  RETURN jsonb_build_object('ok',true,'consumed',_amount,'from_subscription',_from_sub,'from_pack',_from_pack);
END;
$$;
REVOKE ALL ON FUNCTION public.admin_consume_credits(uuid, text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_consume_credits(uuid, text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.admin_consume_credits(uuid, text, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.admin_consume_credits(uuid, text, integer) TO service_role;

-- Refund (chamado pelo edge em erro de envio)
CREATE OR REPLACE FUNCTION public.refund_credits(p_user_id uuid, p_amount int, p_tool_slug text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE credit_wallets SET pack_credits = pack_credits + p_amount WHERE user_id = p_user_id;
  INSERT INTO credit_transactions(user_id,type,amount,source,tool_slug)
    VALUES (p_user_id,'refund',p_amount,'pack',p_tool_slug);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.refund_credits(uuid,int,text) FROM public, anon, authenticated;

-- =====================================================================
-- 4. SEED (placeholders — ajuste nomes/preços/créditos pela realidade Apreenda)
-- 1 crédito = 1 mensagem de WhatsApp enviada.
-- =====================================================================
INSERT INTO public.subscription_plans (name, description, price_cents, interval, monthly_credits, trial_days, display_order)
SELECT * FROM (VALUES
  ('Disparos Essencial', 'Para começar a disparar no WhatsApp.', 9700, 'monthly', 2000, 7, 1),
  ('Disparos Profissional', 'Volume recorrente para a operação.', 19700, 'monthly', 8000, 7, 2),
  ('Disparos Pro Anual', 'Profissional com 2 meses grátis.', 197000, 'yearly', 8000, 7, 3)
) AS v(name, description, price_cents, interval, monthly_credits, trial_days, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.subscription_plans);

INSERT INTO public.credit_packs (name, description, price_cents, credits, display_order)
SELECT * FROM (VALUES
  ('Pacote 2.000 disparos', 'Recarga rápida.', 7900, 2000, 1),
  ('Pacote 8.000 disparos', 'Melhor custo-benefício.', 24900, 8000, 2),
  ('Pacote 20.000 disparos', 'Para campanhas grandes.', 54900, 20000, 3)
) AS v(name, description, price_cents, credits, display_order)
WHERE NOT EXISTS (SELECT 1 FROM public.credit_packs);
