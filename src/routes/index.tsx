import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  BarChart3, Facebook, Target, LineChart, ShieldCheck, Clock, ArrowRight, Plug, MousePointerClick,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const FEATURES = [
  {
    icon: Target,
    title: "Meta Ads em tempo real",
    desc: "Investimento, alcance, CTR, CPC, conversas e ROAS das suas campanhas de Facebook e Instagram — atualizados automaticamente.",
  },
  {
    icon: Plug,
    title: "Conecte em 1 clique",
    desc: "Faça login com o Facebook, escolha a conta de anúncios e pronto. Sem planilha, sem exportar relatório, sem complicação.",
  },
  {
    icon: LineChart,
    title: "Visão consolidada",
    desc: "Gasto diário, evolução por período e comparativo — tudo num painel limpo, feito pra você entender o que importa.",
  },
  {
    icon: BarChart3,
    title: "Campanhas detalhadas",
    desc: "Abra campanha por campanha e veja o desempenho de cada uma, com os números que realmente movem o resultado.",
  },
  {
    icon: ShieldCheck,
    title: "Acesso seguro",
    desc: "Conexão somente leitura: nunca alteramos, pausamos ou publicamos nada nas suas contas. Seus dados ficam protegidos.",
  },
  {
    icon: Clock,
    title: "30 dias grátis",
    desc: "Teste o painel completo por 30 dias, sem cartão de crédito. Se fizer sentido, a gente conversa.",
  },
];

const STEPS = [
  { icon: Facebook, title: "Conecte o Facebook", desc: "Login rápido e seguro pela própria Meta." },
  { icon: MousePointerClick, title: "Escolha a conta", desc: "Selecione qual conta de anúncios acompanhar." },
  { icon: BarChart3, title: "Veja tudo", desc: "Seu painel carrega com os dados em tempo real." },
];

function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/60 bg-card/40 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="flex items-baseline gap-3">
            <span className="font-display text-2xl text-primary tracking-[0.2em]">APREENDA</span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Dashboards</span>
          </span>
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Entrar</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="max-w-3xl mx-auto px-6 pt-20 pb-16 text-center">
          <p className="text-[11px] uppercase tracking-[0.35em] text-primary">Painel de marketing</p>
          <h1 className="mt-5 font-display text-4xl md:text-6xl leading-tight text-foreground">
            Suas campanhas,
            <br />
            <span className="text-primary">em um só lugar.</span>
          </h1>
          <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
            O Apreenda Dashboard conecta suas contas de anúncios e mostra o desempenho real das suas
            campanhas em tempo real — sem planilha, sem achismo.
          </p>
          <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link to="/auth">Começar teste grátis <ArrowRight className="size-4" /></Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link to="/auth">Já tenho conta</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">30 dias grátis · sem cartão de crédito</p>
        </section>

        {/* Como funciona */}
        <section className="max-w-5xl mx-auto px-6 py-12">
          <div className="grid sm:grid-cols-3 gap-5">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="text-center px-4">
                  <div className="mx-auto w-12 h-12 rounded-full gold-border flex items-center justify-center text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-4 font-display text-lg text-foreground">
                    <span className="text-primary">{i + 1}.</span> {s.title}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Funcionalidades */}
        <section className="max-w-6xl mx-auto px-6 py-12">
          <div className="text-center mb-10">
            <h2 className="font-display text-3xl text-foreground">O que você vê no painel</h2>
            <div className="mt-3 mx-auto h-px w-12 bg-primary/60" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.title} className="bg-card gold-border rounded-lg p-6">
                  <div className="w-11 h-11 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                    <Icon className="size-5" />
                  </div>
                  <h3 className="mt-5 font-display text-xl text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* CTA final */}
        <section className="max-w-3xl mx-auto px-6 py-16 text-center">
          <h2 className="font-display text-3xl md:text-4xl text-foreground">
            Pronto pra ver tudo claro?
          </h2>
          <p className="mt-4 text-muted-foreground">
            Conecte sua conta e comece seu teste grátis de 30 dias agora.
          </p>
          <Button asChild size="lg" className="mt-8">
            <Link to="/auth">Começar agora <ArrowRight className="size-4" /></Link>
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="font-display text-sm text-primary tracking-[0.2em]">APREENDA</span>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <a href="/privacidade" className="hover:text-foreground transition-colors">Privacidade</a>
            <a href="/termos" className="hover:text-foreground transition-colors">Termos</a>
            <a href="/exclusao-de-dados" className="hover:text-foreground transition-colors">Exclusão de dados</a>
            <span>© {new Date().getFullYear()} Apreenda Digital</span>
          </nav>
        </div>
      </footer>
    </div>
  );
}
