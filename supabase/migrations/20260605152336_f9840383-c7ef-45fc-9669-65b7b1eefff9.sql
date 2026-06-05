CREATE TABLE public.meta_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ad_account_id TEXT,
  ad_account_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

GRANT SELECT ON public.meta_tokens TO authenticated;
GRANT ALL ON public.meta_tokens TO service_role;

ALTER TABLE public.meta_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meta tokens"
  ON public.meta_tokens FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER trg_meta_tokens_updated_at
  BEFORE UPDATE ON public.meta_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_google_tokens_updated_at();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;