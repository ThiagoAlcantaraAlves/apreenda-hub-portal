import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface CreditBalance {
  subscription_credits: number;
  pack_credits: number;
  total: number;
  plan_name: string | null;
  status: string | null;
  trial_ends_at: string | null;
  period_end: string | null;
}

export function useCredits() {
  const [balance, setBalance] = useState<CreditBalance | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_credit_balance" as any);
    if (!error && data && !(data as any).error) {
      setBalance(data as unknown as CreditBalance);
    }
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { balance, loading, refresh };
}
