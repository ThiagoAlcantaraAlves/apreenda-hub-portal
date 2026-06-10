import { Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  ArrowLeft,
  BookOpen,
  Coins,
  Send,
  Users,
  Calendar,
  FileText,
  BarChart3,
  ShieldCheck,
  PlugZap,
  Clock,
  CheckCircle2,
  Sparkles,
} from "lucide-react";
import { useCredits } from "@/hooks/useCredits";

const cinzel = { fontFamily: "Cinzel, serif" };

const CREDITS_PER_DISPARO = 1;

const FEATURES = [
  {
    icon: Users,
    title: "Base de contatos",
    body: "Importe sua base por CSV, organize com tags (aniversariantes, recorrentes, inativos) e mantenha tudo no padrão LGPD com opt-in.",
  },
  {
    icon: FileText,
    title: "Templates aprovados pela Meta",
    body: "Crie, edite e submeta templates direto da ferramenta. Acompanhe o status de aprovação sem precisar abrir o Meta Business.",
  },
  {
    icon: Send,
    title: "Campanhas em massa",
    body: "Dispare para milhares de contatos de uma vez com variáveis personalizadas ({{nome}}, {{cidade}}, etc).",
  },
  {
    icon: Calendar,
    title: "Agendamento",
    body: "Programe campanhas para o melhor horário — quinta à noite, sábado de manhã, aniversário do cliente. A ferramenta dispara sozinha.",
  },
  {
    icon: BarChart3,
    title: "Relatórios em tempo real",
    body: "Veja quantas mensagens foram entregues, lidas e respondidas. Identifique o que funciona e otimize as próximas.",
  },
  {
    icon: ShieldCheck,
    title: "API Oficial WhatsApp",
    body: "Sem risco de banimento. Tudo roda pela WhatsApp Business Cloud API da Meta, com seu próprio número e BM.",
  },
];

const STEPS = [
  {
    num: 1,
    title: "Configure sua conta Meta",
    body: "Siga o manual passo a passo para criar a Business Manager, ativar a WhatsApp Business API e gerar o token de acesso permanente.",
    cta: { label: "Abrir manual de configuração", to: "/tool/disparos/manual" },
  },
  {
    num: 2,
    title: "Importe sua base de contatos",
    body: "Suba seu CSV com nome, telefone e tags. A ferramenta valida os números e organiza tudo automaticamente.",
  },
  {
    num: 3,
    title: "Crie e aprove seus templates",
    body: "Monte mensagens com variáveis (nome do cliente, oferta, etc) e envie para aprovação da Meta direto pela ferramenta. Aprovação leva de minutos a 24h.",
  },
  {
    num: 4,
    title: "Dispare ou agende a campanha",
    body: "Escolha o template, selecione o público pela tag, defina o horário (agora ou agendado) e confirme. Cada disparo consome 1 crédito do seu saldo, independente de quantos contatos recebem.",
  },
  {
    num: 5,
    title: "Acompanhe os resultados",
    body: "Dashboard em tempo real mostra entregue / lida / respondida. Use isso pra decidir quem ligar, quem reabordar e o que mudar na próxima.",
  },
];

const DisparosPage = () => {
  const navigate = useNavigate();
  const { balance, loading } = useCredits();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate({ to: "/home" })}
          className="mb-2 -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar ao Hub
        </Button>

        <Breadcrumb className="mb-6">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/home">Hub</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Ferramenta de Disparos</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* HERO */}
        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5">
          <CardContent className="p-6 sm:p-10">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-md">
                <Send className="h-9 w-9" />
              </div>
              <div className="flex-1 space-y-3">
                <Badge className="bg-accent/15 text-accent hover:bg-accent/20">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Premium
                </Badge>
                <h1 className="text-3xl sm:text-4xl font-semibold leading-tight" style={cinzel}>
                  Sua base de contatos vale ouro. <span className="text-accent">Faça ela trabalhar.</span>
                </h1>
                <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
                  Dispare campanhas de WhatsApp pela API oficial da Meta, com templates aprovados,
                  agendamento, segmentação por tags e relatórios em tempo real — sem risco de banimento.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* CRÉDITOS */}
        <Card className="mt-6 border-accent/30">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent/10">
                  <Coins className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold" style={cinzel}>
                    Como funciona o consumo de créditos
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                    Cada disparo consome{" "}
                    <strong className="text-foreground">{CREDITS_PER_DISPARO} crédito</strong> do seu saldo do Hub —
                    uma campanha inteira = 1 crédito, independente de quantos contatos recebem.
                    O desconto acontece uma única vez, no momento em que você confirma o disparo.
                    Os custos da Meta (cobrados em USD por conversa) seguem direto no seu cartão cadastrado lá.
                  </p>
                </div>
              </div>
              <div className="shrink-0 rounded-lg border bg-muted/30 p-4 text-center sm:text-right">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Seu saldo</p>
                <p className="text-2xl font-semibold text-foreground">
                  {loading ? "..." : balance?.total ?? 0}
                </p>
                <Link to="/planos" className="text-xs text-accent hover:underline">
                  Comprar mais créditos →
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* O QUE A FERRAMENTA FAZ */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold mb-6" style={cinzel}>
            O que a ferramenta faz
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <Card key={f.title} className="border-border/60">
                <CardContent className="p-5 space-y-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <f.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground">{f.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{f.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* PASSO A PASSO */}
        <section className="mt-10">
          <h2 className="text-2xl font-semibold mb-2" style={cinzel}>
            Como começar
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            5 passos pra sair do zero e disparar sua primeira campanha.
          </p>
          <div className="space-y-3">
            {STEPS.map((s) => (
              <Card key={s.num} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex gap-4">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground font-semibold"
                      style={cinzel}
                    >
                      {s.num}
                    </div>
                    <div className="flex-1 space-y-2">
                      <h3 className="font-semibold text-foreground">{s.title}</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
                      {s.cta && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate({ to: s.cta!.to })}
                          className="mt-2"
                        >
                          <BookOpen className="mr-2 h-4 w-4" />
                          {s.cta.label}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* STATUS / EM BREVE */}
        <Card className="mt-10 border-primary/20 bg-primary/5">
          <CardContent className="p-6 sm:p-8 text-center space-y-3">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
              <PlugZap className="h-6 w-6 text-primary" />
            </div>
            <h3 className="text-xl font-semibold" style={cinzel}>
              Liberação da área de operação
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Você já tem acesso liberado. A área de operação (contatos, templates, campanhas e relatórios)
              está sendo integrada ao Hub. Enquanto isso, adiante a parte chata:{" "}
              <strong className="text-foreground">configure sua Meta Business Manager e o WhatsApp Business API</strong>{" "}
              seguindo o manual. Quando a operação for liberada, é só conectar e disparar.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
              <Button
                onClick={() => navigate({ to: "/tool/disparos/manual" })}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
              >
                <BookOpen className="mr-2 h-4 w-4" />
                Abrir manual de configuração
              </Button>
              <Button variant="outline" disabled>
                <Clock className="mr-2 h-4 w-4" />
                Área de operação em breve
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* GARANTIAS */}
        <section className="mt-10 mb-6 grid gap-4 sm:grid-cols-3">
          {[
            { icon: ShieldCheck, t: "API Oficial", b: "Zero risco de banimento" },
            { icon: CheckCircle2, t: "LGPD-friendly", b: "Opt-in e descadastro nativos" },
            { icon: Coins, t: "1 crédito por disparo", b: "Cobrado uma vez por campanha" },
          ].map((g) => (
            <div key={g.t} className="flex items-center gap-3 rounded-lg border bg-card p-4">
              <g.icon className="h-5 w-5 text-accent shrink-0" />
              <div>
                <p className="text-sm font-semibold text-foreground">{g.t}</p>
                <p className="text-xs text-muted-foreground">{g.b}</p>
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
};

export default DisparosPage;
