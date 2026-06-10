import { supabase } from "@/integrations/supabase/client";

// The supabase JS client auto-attaches the user's JWT in the Authorization header
// when invoking edge functions, so the edge fn can resolve auth.uid() from it.
export async function invokeWithAuth(
  functionName: string,
  options?: { body?: any; method?: string }
) {
  return supabase.functions.invoke(functionName, {
    body: options?.body,
    method: options?.method as any,
  });
}
