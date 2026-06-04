// Lovable Cloud managed OAuth broker.
import { createLovableAuth, type OAuthProvider, type SignInWithOAuthOptions } from "@lovable.dev/cloud-auth-js";
import { supabase } from "@/integrations/supabase/client";

const broker = createLovableAuth();

export const lovable = {
  auth: {
    async signInWithOAuth(provider: OAuthProvider, opts?: SignInWithOAuthOptions) {
      const result = await broker.signInWithOAuth(provider, opts);
      if (result.error) return result;
      if (result.redirected) return result;
      // Set Supabase session from broker tokens
      await supabase.auth.setSession({
        access_token: result.tokens.access_token,
        refresh_token: result.tokens.refresh_token,
      });
      return result;
    },
  },
};
