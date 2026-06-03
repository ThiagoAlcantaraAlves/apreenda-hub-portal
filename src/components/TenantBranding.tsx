import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

type Branding = {
  primary_color: string | null;
  accent_color: string | null;
  radius: string | null;
};

// Heurística simples: a cor primária é "escura"? (precisa de texto claro por cima)
function isDark(color: string): boolean {
  const c = color.trim().toLowerCase();
  const ok = c.match(/^oklch\(\s*([\d.]+)/); // oklch(L ...) → L em 0..1
  if (ok) return parseFloat(ok[1]) < 0.6;
  const hex = c.match(/^#([0-9a-f]{6})$/);
  if (hex) {
    const n = parseInt(hex[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return lum < 0.6;
  }
  return false;
}

/**
 * Aplica o tema do tenant logado nas CSS vars do :root.
 * Sem branding (ou demo) → mantém o tema Apreenda padrão (dark + ouro).
 */
export function TenantBranding() {
  const { profile } = useAuth();

  const { data } = useQuery({
    queryKey: ["tenant-branding", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return null;
      const { data, error } = await (supabase as any)
        .from("tenant_branding")
        .select("primary_color, accent_color, radius")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();
      if (error) throw error;
      return data as Branding | null;
    },
    enabled: !!profile?.tenant_id,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const root = document.documentElement;
    if (!data) return;
    if (data.primary_color) {
      root.style.setProperty("--primary", data.primary_color);
      root.style.setProperty("--ring", data.primary_color);
      root.style.setProperty(
        "--primary-foreground",
        isDark(data.primary_color) ? "oklch(0.98 0 0)" : "oklch(0.16 0 0)",
      );
    }
    if (data.accent_color) root.style.setProperty("--accent", data.accent_color);
    if (data.radius) root.style.setProperty("--radius", data.radius);

    return () => {
      // restaura ao padrão Apreenda ao desmontar/trocar de tenant
      root.style.removeProperty("--primary");
      root.style.removeProperty("--ring");
      root.style.removeProperty("--primary-foreground");
      root.style.removeProperty("--accent");
      root.style.removeProperty("--radius");
    };
  }, [data]);

  return null;
}
