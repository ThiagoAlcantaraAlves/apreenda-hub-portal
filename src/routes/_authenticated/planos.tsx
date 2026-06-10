import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCredits } from "@/hooks/useCredits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Coins, Check, Loader2, Sparkles, Crown, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/planos")({
  component: PlanosPage,
});

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  interval: string;
  monthly_credits: number;
  trial_days: number;
}
interface Pack {
  id: string;
  name: string;
  description: string | null;
  price_cents: number;
  credits: number;
}

const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function PlanosPage() {
  const navigate = useNavigate();
  const { balance, loading: balLoading, refresh } = useCredits();
  const [checkout, setCheckout] = useState<{ kind: "plan" | "pack"; id: string; name: string } | null>(null);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: plans } = useQuery({
    queryKey: ["subscription_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans" as any)
        .select("*")
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as Plan[];
    },
  });

  const { data: packs } = useQuery({
    queryKey: ["credit_packs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("credit_packs" as any)
        .select("*")
        .eq("active", true)
        .order("display_order");
      if (error) throw error;
      return (data ?? []) as unknown as Pack[];
    },
  });

  const startCheckout = async () => {
    if (!checkout) return;
    if (!cpfCnpj.trim()) {
      toast.error("Informe seu CPF ou CNPJ para gerar a cobrança.");
      return;
    }
    setSubmitting(true);
    try {
      const fn = checkout.kind === "plan" ? "asaas-create-subscription" : "asaas-buy-credits";
      const body =
        checkout.kind === "plan"
          ? { plan_id: checkout.id, cpfCnpj, phone }
          : { pack_id: checkout.id, cpfCnpj, phone };
      const { data, error } = await supabase.functions.invoke(fn, { body });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      const url = (data as any)?.invoice_url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        toast.success("Redirecionando para o checkout…");
      } else {
        toast.success("Solicitação criada. Verifique seu e-mail / cobrança.");
      }
      setCheckout(null);
      setCpfCnpj("");
      setPhone("");
      refresh();
    } catch (e: any) {
      const raw = e?.message || "";
      const msg = raw.includes("already_subscribed")
        ? "Você já tem uma assinatura ativa."
        : raw || "Falha ao iniciar o checkout.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate({ to: "/home" })}
        className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" /> Voltar ao Hub
      </Button>

      <section>
        <p className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Planos &amp; Créditos</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl text-foreground">
          Disparos com <span className="text-primary">crédito</span>.
        </h1>
        <p className="mt-3 text-sm text-muted-foreground max-w-xl">
          Cada crédito equivale a 1 mensagem de WhatsApp enviada. Assine um plano para créditos
          mensais ou compre pacotes avulsos quando precisar de volume.
        </p>
      </section>

      {/* Saldo atual */}
      <Card className="mt-8 gold-border bg-card">
        <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
              <Coins className="size-5" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Seu saldo</p>
              <p className="font-display text-2xl text-foreground">
                {balLoading ? "…" : (balance?.total ?? 0)} <span className="text-sm text-muted-foreground">créditos</span>
              </p>
            </div>
          </div>
          {balance?.plan_name && (
            <Badge className="bg-primary/15 text-primary border border-primary/30">{balance.plan_name}</Badge>
          )}
        </CardContent>
      </Card>

      {/* Planos */}
      <section className="mt-12">
        <div className="flex items-center gap-2">
          <Crown className="size-4 text-primary" />
          <h2 className="font-display text-xl text-foreground">Assinaturas</h2>
        </div>
        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(plans ?? []).map((p) => (
            <article key={p.id} className="bg-card gold-border rounded-lg p-6 flex flex-col">
              <h3 className="font-display text-lg text-foreground">{p.name}</h3>
              {p.description && <p className="mt-1 text-sm text-muted-foreground flex-1">{p.description}</p>}
              <p className="mt-4 font-display text-3xl text-primary">
                {brl(p.price_cents)}
                <span className="text-xs text-muted-foreground font-sans">
                  /{p.interval === "yearly" ? "ano" : "mês"}
                </span>
              </p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> {p.monthly_credits.toLocaleString("pt-BR")} créditos/mês</li>
                {p.trial_days > 0 && <li className="flex items-center gap-2"><Check className="size-4 text-primary" /> {p.trial_days} dias de teste</li>}
              </ul>
              <Button className="mt-6 w-full" onClick={() => setCheckout({ kind: "plan", id: p.id, name: p.name })}>
                Assinar
              </Button>
            </article>
          ))}
          {!plans?.length && <p className="text-sm text-muted-foreground">Nenhum plano disponível.</p>}
        </div>
      </section>

      {/* Pacotes avulsos */}
      <section className="mt-12">
        <div className="flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="font-display text-xl text-foreground">Pacotes avulsos</h2>
        </div>
        <div className="mt-5 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {(packs ?? []).map((p) => (
            <article key={p.id} className="bg-card gold-border rounded-lg p-6 flex flex-col">
              <h3 className="font-display text-lg text-foreground">{p.name}</h3>
              {p.description && <p className="mt-1 text-sm text-muted-foreground flex-1">{p.description}</p>}
              <p className="mt-4 font-display text-3xl text-primary">{brl(p.price_cents)}</p>
              <p className="mt-1 text-sm text-muted-foreground">{p.credits.toLocaleString("pt-BR")} créditos</p>
              <Button variant="outline" className="mt-6 w-full" onClick={() => setCheckout({ kind: "pack", id: p.id, name: p.name })}>
                Comprar
              </Button>
            </article>
          ))}
          {!packs?.length && <p className="text-sm text-muted-foreground">Nenhum pacote disponível.</p>}
        </div>
      </section>

      {/* Dialog de checkout */}
      <Dialog open={!!checkout} onOpenChange={(o) => !o && setCheckout(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{checkout?.name}</DialogTitle>
            <DialogDescription>
              Geramos a cobrança via ASAAS (PIX, cartão ou boleto). Informe os dados de cobrança.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="cpfCnpj">CPF ou CNPJ *</Label>
              <Input id="cpfCnpj" value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} placeholder="Somente números" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="DDD + número" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCheckout(null)} disabled={submitting}>Cancelar</Button>
            <Button onClick={startCheckout} disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : "Ir para o checkout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
