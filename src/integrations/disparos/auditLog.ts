import { supabase } from "@/integrations/supabase/client";

interface LogParams {
  action: string;
  entityType?: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export async function logAction({ action, entityType, entityId, details }: LogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase.from("disparos_audit_logs" as any) as any).insert({
      user_id: user.id,
      user_name: (user.user_metadata as any)?.name ?? user.email ?? "",
      user_email: user.email ?? "",
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      details: details ?? {},
    });
  } catch {
    // logging never breaks the app
  }
}
