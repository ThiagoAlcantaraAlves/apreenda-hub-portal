import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { BarChart3, Briefcase, Users, Share2, ExternalLink, ArrowRight, Send } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

type ProductKind = "dashboards" | "gestor" | "crm" | "social";

const PRODUCT_META: Record<ProductKind, { name: string; desc: string; icon: any }> = {
  dashboards: { name: "Dashboard de Marketing", desc: "Métricas e performance em tempo real.", icon: BarChart3 },
  gestor: { name: "Gestor", desc: "Operação e gestão do seu negócio.", icon: Briefcase },
  crm: { name: "CRM", desc: "Relacionamento e funil de vendas.", icon: Users },
  social: { name: "Social Media", desc: "Planejamento e publicações.", icon: Share2 },
};

function HomePage() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  const { data: products, isLoading } = useQuery({
    queryKey: ["tenant-products", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return [];
      const { data, error } = await supabase
        .from("tenant_products")
        .select("id, product, url, enabled")
        .eq("tenant_id", profile.tenant_id)
        .eq("enabled", true);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.tenant_id,
  });

  const firstName = profile?.full_name?.split(" ")[0] ?? "cliente";

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <section>
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Bem-vindo</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl text-foreground">
          Olá, <span className="text-primary">{firstName}</span>.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-xl">
          Acesse abaixo os produtos do seu hub Apreenda.
        </p>
      </section>

      <section className="mt-12">
        {isLoading ? (
          <div className="text-muted-foreground text-sm">Carregando produtos…</div>
        ) : !profile?.tenant_id ? (
          <div className="bg-card gold-border rounded-lg p-8 text-sm text-muted-foreground">
            Você ainda não está vinculado a um tenant. Aguarde a configuração.
          </div>
        ) : !products?.length ? (
          <div className="bg-card gold-border rounded-lg p-8 text-sm text-muted-foreground">
            Nenhum produto disponível no momento.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {products.map((p) => {
              const meta = PRODUCT_META[p.product as ProductKind];
              const Icon = meta.icon;
              const internal = p.product === "dashboards";
              const open = () => {
                if (internal) navigate({ to: "/dashboard" });
                else if (p.url) window.open(p.url, "_blank", "noopener,noreferrer");
              };
              const disabled = !internal && !p.url;
              return (
                <article
                  key={p.id}
                  className="group bg-card gold-border rounded-lg p-6 flex flex-col transition hover:border-primary/70 hover:shadow-[0_0_30px_-12px_var(--gold)]"
                >
                  <div className="w-11 h-11 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 font-display text-xl text-foreground">{meta.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground flex-1">{meta.desc}</p>
                  <Button
                    onClick={open}
                    disabled={disabled}
                    className="mt-6 w-full justify-between"
                    variant="default"
                  >
                    {disabled ? "Em breve" : "Abrir"}
                    {!disabled && (internal ? <ArrowRight className="size-4" /> : <ExternalLink className="size-4" />)}
                  </Button>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-12">
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Ferramentas</p>
        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <article className="group bg-card gold-border rounded-lg p-6 flex flex-col transition hover:border-primary/70 hover:shadow-[0_0_30px_-12px_var(--gold)]">
            <div className="w-11 h-11 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Send className="size-5" />
            </div>
            <h3 className="mt-5 font-display text-xl text-foreground">Disparos WhatsApp</h3>
            <p className="mt-2 text-sm text-muted-foreground flex-1">
              Campanhas e mensagens em massa no WhatsApp, com templates aprovados, agendamento e relatórios.
            </p>
            <Button
              onClick={() => navigate({ to: "/tool/disparos" })}
              className="mt-6 w-full justify-between"
              variant="default"
            >
              Abrir <ArrowRight className="size-4" />
            </Button>
          </article>
        </div>
      </section>
    </div>
  );
}
