import { useNavigate, useRouter } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Phone,
  FileText,
  KeyRound,
  Smartphone,
  MessageSquare,
  Building2,
  PlugZap,
  Sparkles,
  LifeBuoy,
} from "lucide-react";

const cinzel = { fontFamily: "Cinzel, serif" };

interface Section {
  id: string;
  num: number;
  title: string;
  icon: typeof BookOpen;
  body: React.ReactNode;
}

const SECTIONS: Section[] = [
  {
    id: "pre-requisitos",
    num: 1,
    title: "Pré-requisitos",
    icon: CheckCircle2,
    body: (
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <p>Antes de começar, separe:</p>
        <ul className="list-disc pl-5 space-y-2">
          <li><strong className="text-foreground">Um Facebook pessoal seu</strong> — vai ser o admin da Business Manager. Use o seu, não da recepção.</li>
          <li><strong className="text-foreground">Um telefone NOVO</strong>, que NÃO esteja em nenhum WhatsApp (nem comum, nem Business). Se já estiver, precisa apagar a conta antes. Pode ser fixo ou celular — desde que receba SMS ou ligação.</li>
          <li><strong className="text-foreground">CNPJ do motel</strong> (ou MEI) — Razão Social, endereço e comprovante.</li>
          <li><strong className="text-foreground">Site ou redes sociais</strong> do motel — a Meta usa pra confirmar que o negócio existe.</li>
          <li><strong className="text-foreground">Cartão de crédito internacional</strong> — a Meta cobra por conversa, em USD. Pode ser pessoal ou da empresa.</li>
        </ul>
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
          <p className="text-sm"><strong className="text-foreground">Atenção ao número:</strong> uma vez vinculado à API, ele NÃO volta pro WhatsApp normal. Use um número dedicado pro motel.</p>
        </div>
      </div>
    ),
  },
  {
    id: "criar-bm",
    num: 2,
    title: "Criar a Meta Business Manager (BM)",
    icon: Building2,
    body: (
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Acesse <a href="https://business.facebook.com" target="_blank" rel="noopener noreferrer" className="text-accent underline inline-flex items-center gap-1">business.facebook.com <ExternalLink className="h-3 w-3" /></a> logado no seu Facebook pessoal.</li>
          <li>Clique em <strong className="text-foreground">"Criar conta"</strong> no canto superior direito.</li>
          <li>Preencha: <strong className="text-foreground">Nome da empresa</strong> (igual no CNPJ — ex.: "Motel Estrela LTDA"), <strong className="text-foreground">seu nome</strong>, <strong className="text-foreground">e-mail comercial</strong>.</li>
          <li>Confirme o e-mail que chegar.</li>
        </ol>
        <p>Pronto, você tem uma BM vazia. Agora precisa povoar com os dados do motel.</p>
      </div>
    ),
  },
  {
    id: "verificar-negocio",
    num: 3,
    title: "Verificar o negócio na Meta",
    icon: ShieldCheck,
    body: (
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <p>Dentro da BM, vá em <strong className="text-foreground">Configurações do negócio → Centro de segurança → Verificação do negócio</strong>.</p>
        <p>Você vai enviar:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Cartão CNPJ atualizado (baixe no site da Receita).</li>
          <li>Comprovante de endereço da empresa (conta de luz, água, contrato social).</li>
          <li>Telefone fixo comercial — eles ligam ou mandam código.</li>
        </ul>
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-sm"><strong className="text-foreground">Prazo:</strong> entre 1 e 5 dias úteis. Se der "rejeitado", quase sempre é endereço que não bate. Reenvie com documento mais claro.</p>
        </div>
      </div>
    ),
  },
  {
    id: "criar-waba",
    num: 4,
    title: "Criar a conta WhatsApp Business API (WABA)",
    icon: MessageSquare,
    body: (
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Na BM, vá em <strong className="text-foreground">Configurações do negócio → Contas → Contas do WhatsApp</strong>.</li>
          <li>Clique <strong className="text-foreground">"Adicionar" → "Criar uma nova conta do WhatsApp"</strong>.</li>
          <li>Dê um nome (ex.: "Motel Estrela — Marketing").</li>
          <li>Selecione a Página do Facebook do motel (precisa existir; crie uma se não tiver).</li>
          <li>Defina o fuso (Brasília) e a moeda (BRL).</li>
        </ol>
        <p>Agora você tem uma WABA pronta pra receber o número.</p>
      </div>
    ),
  },
  {
    id: "adicionar-numero",
    num: 5,
    title: "Adicionar e validar o número",
    icon: Phone,
    body: (
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <ol className="list-decimal pl-5 space-y-2">
          <li>Dentro da WABA, clique <strong className="text-foreground">"Adicionar número"</strong>.</li>
          <li>Digite no formato internacional: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">+55 62 99999 9999</code>.</li>
          <li>Escolha receber código por <strong className="text-foreground">SMS</strong> ou <strong className="text-foreground">chamada</strong> (se for fixo, use chamada).</li>
          <li>Digite o código de 6 dígitos que chegar.</li>
        </ol>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
          <p className="text-sm"><strong className="text-foreground">Se der erro:</strong> 99% das vezes é porque o número ainda tem WhatsApp comum/Business ativo. Abra o app, vá em Configurações → Conta → Excluir minha conta, e tente de novo em 5 minutos.</p>
        </div>
      </div>
    ),
  },
  {
    id: "display-name",
    num: 6,
    title: "Cadastrar o Display Name",
    icon: Sparkles,
    body: (
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <p>Display Name é o nome que aparece pro cliente. Regras da Meta:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Tem que bater com seu negócio real ("Motel Estrela", não "Promoções Top").</li>
          <li>Não pode ser genérico ("Motel", "Marketing").</li>
          <li>Não pode conter "WhatsApp", "Meta", "Facebook".</li>
          <li>Sem emojis nem caracteres especiais.</li>
        </ul>
        <p>Aprovação leva de 1 hora a 2 dias. Se rejeitar, ajusta o nome e reenvia.</p>
      </div>
    ),
  },
  {
    id: "token-system-user",
    num: 7,
    title: "Gerar o Token permanente (System User)",
    icon: KeyRound,
    body: (
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <p><strong className="text-foreground">Passo crítico.</strong> O token comum expira em 24h — você precisa de um permanente (System User).</p>
        <ol className="list-decimal pl-5 space-y-2">
          <li>BM → <strong className="text-foreground">Configurações do negócio → Usuários → Usuários do sistema</strong>.</li>
          <li><strong className="text-foreground">"Adicionar"</strong> → nome: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">disparos-motel</code> → função: <strong className="text-foreground">Admin</strong>.</li>
          <li>Clique no usuário criado → <strong className="text-foreground">"Adicionar Ativos"</strong> → selecione a WABA e a Página do Facebook do motel, com <strong className="text-foreground">Acesso Total</strong>.</li>
          <li>Volte ao usuário → <strong className="text-foreground">"Gerar Token"</strong>.</li>
          <li>Selecione o app (se não tiver, crie um em <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-accent underline inline-flex items-center gap-1">developers.facebook.com <ExternalLink className="h-3 w-3" /></a> com produto "WhatsApp").</li>
          <li>Validade: <strong className="text-foreground">Nunca expira</strong>.</li>
          <li>Permissões: marque <code className="rounded bg-muted px-1.5 py-0.5 text-xs">whatsapp_business_management</code> e <code className="rounded bg-muted px-1.5 py-0.5 text-xs">whatsapp_business_messaging</code>.</li>
          <li><strong className="text-foreground">Copie o token e guarde em lugar seguro</strong>. Ele NÃO aparece de novo.</li>
        </ol>
        <p>Você também vai precisar do <strong className="text-foreground">Phone Number ID</strong> e do <strong className="text-foreground">WABA ID</strong> — ambos ficam na tela do número, em <strong className="text-foreground">API Setup</strong>.</p>
      </div>
    ),
  },
  {
    id: "conectar-hub",
    num: 8,
    title: "Conectar no Hub",
    icon: PlugZap,
    body: (
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <p>Dentro do Hub, abra a <strong className="text-foreground">Ferramenta de Disparos → Configurações</strong> e cole os três valores:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Token permanente</strong> (o do passo 7)</li>
          <li><strong className="text-foreground">Phone Number ID</strong></li>
          <li><strong className="text-foreground">WABA ID</strong></li>
        </ul>
        <p>Salve. A ferramenta valida na hora; se tudo certo, aparece "Conectado ✓".</p>
        <div className="rounded-lg border bg-muted/40 p-4">
          <p className="text-sm"><strong className="text-foreground">Segurança:</strong> seu token fica criptografado no nosso banco. Cada motel só enxerga e usa o próprio número — nada cruza entre contas.</p>
        </div>
      </div>
    ),
  },
  {
    id: "templates",
    num: 9,
    title: "Criar e enviar templates pra aprovação",
    icon: FileText,
    body: (
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <p>Pela API, você não manda texto livre — manda <strong className="text-foreground">templates aprovados</strong> pela Meta. Categorias:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong className="text-foreground">Marketing</strong> — promoções, datas comemorativas. Mais caro, mas é o que vende.</li>
          <li><strong className="text-foreground">Utility</strong> — confirmações, lembretes ("sua reserva pra hoje 22h"). Mais barato.</li>
          <li><strong className="text-foreground">Authentication</strong> — códigos de verificação. Pouco usado em motel.</li>
        </ul>
        <p>Use variáveis <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{`{{1}}`}</code>, <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{`{{2}}`}</code> pra personalizar (nome do cliente, valor da diária, etc.). Aprovação leva de minutos a 24h.</p>
        <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning mt-0.5" />
          <p className="text-sm"><strong className="text-foreground">Cuidado:</strong> a Meta rejeita templates muito comerciais agressivos, com promessas vagas ("a melhor noite da sua vida"), e qualquer coisa explícita. Vá direto e elegante.</p>
        </div>
      </div>
    ),
  },
  {
    id: "boas-praticas",
    num: 10,
    title: "Boas práticas — não queime sua conta",
    icon: ShieldCheck,
    body: (
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <ul className="list-disc pl-5 space-y-2">
          <li><strong className="text-foreground">Opt-in real:</strong> só dispare pra quem aceitou receber. Coloque um campo no check-in / cadastro do site.</li>
          <li><strong className="text-foreground">Frequência sem ser chato:</strong> 2-4 disparos por mês por cliente é o teto. Mais que isso vira spam, e cliente bloqueia.</li>
          <li><strong className="text-foreground">Descadastramento fácil:</strong> sempre tenha um "responda SAIR pra parar de receber". Não é só LGPD — é cuidar da reputação do número.</li>
          <li><strong className="text-foreground">Quality Rating:</strong> a Meta dá nota Verde / Amarelo / Vermelho ao seu número. Bloqueios e "marcar como spam" derrubam a nota. Nota vermelha = limite reduzido. Acompanhe na BM.</li>
          <li><strong className="text-foreground">Aqueça aos poucos:</strong> nos primeiros 7 dias, dispare pra grupos pequenos (50, 100, 500) antes de escalar pra 5.000.</li>
        </ul>
      </div>
    ),
  },
  {
    id: "troubleshooting",
    num: 11,
    title: "Troubleshooting — erros comuns",
    icon: LifeBuoy,
    body: (
      <div className="space-y-3 text-sm sm:text-base text-muted-foreground leading-relaxed">
        <Accordion type="multiple" className="w-full">
          <AccordionItem value="t1">
            <AccordionTrigger className="text-left">"Template rejected"</AccordionTrigger>
            <AccordionContent>
              Texto comercial demais, promessa exagerada ou variável sem contexto. Refaça mais objetivo, sem prometer experiência sensorial. Reenvio é grátis.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="t2">
            <AccordionTrigger className="text-left">"Quality rating low" / nota vermelha</AccordionTrigger>
            <AccordionContent>
              Muita gente bloqueou seu número. Pare disparos de marketing por 7 dias, mande só utility (confirmações), e a nota volta. Revise seu opt-in.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="t3">
            <AccordionTrigger className="text-left">"Phone number not registered"</AccordionTrigger>
            <AccordionContent>
              Você ainda não validou o número (passo 5) ou ele perdeu o registro. Volte na BM, vá no número e clique "Register".
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="t4">
            <AccordionTrigger className="text-left">Número bloqueado pela Meta</AccordionTrigger>
            <AccordionContent>
              Acontece com volume alto e quality rating ruim. Abra ticket no suporte da Meta (dentro da BM) explicando que é negócio legítimo. Costuma desbloquear em 24-72h. Enquanto isso, reduza disparos.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="t5">
            <AccordionTrigger className="text-left">Cliente respondeu — e agora?</AccordionTrigger>
            <AccordionContent>
              A janela de 24h abre: você pode responder texto livre, sem template. Use isso pra atender, qualificar e fechar a reserva. Depois das 24h, só template de novo.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    ),
  },
];

const DisparosManualPage = () => {
  const navigate = useNavigate();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.history.back()}
          className="mb-4 -ml-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        {/* HERO */}
        <section className="rounded-3xl border bg-card p-8 sm:p-12 shadow-sm mb-10">
          <Badge className="mb-4 bg-accent/15 text-accent border-0">
            <BookOpen className="h-3 w-3 mr-1" />
            Manual
          </Badge>
          <h1 className="text-3xl sm:text-5xl font-bold text-foreground mb-4 leading-tight" style={cinzel}>
            Como conectar o WhatsApp Business na BM
          </h1>
          <p className="text-lg text-muted-foreground max-w-3xl leading-relaxed">
            Guia passo-a-passo pra deixar a Ferramenta de Disparos pronta pra usar.
            Da criação da Meta Business Manager até o disparo do primeiro template aprovado — em 11 passos.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Badge variant="secondary"><Smartphone className="h-3 w-3 mr-1" />API Oficial Meta</Badge>
            <Badge variant="secondary"><ShieldCheck className="h-3 w-3 mr-1" />Sem risco de ban</Badge>
            <Badge variant="secondary">~30 min de setup</Badge>
          </div>
        </section>

        <div className="grid lg:grid-cols-[260px_1fr] gap-8">
          {/* Sumário */}
          <aside className="hidden lg:block">
            <div className="sticky top-24">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Sumário</p>
              <nav className="space-y-1">
                {SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="block text-sm text-muted-foreground hover:text-accent transition-colors py-1.5 border-l-2 border-transparent hover:border-accent pl-3"
                  >
                    <span className="text-accent font-medium mr-1.5">{s.num}.</span>
                    {s.title}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Conteúdo */}
          <div className="space-y-6">
            {SECTIONS.map((s) => {
              const SIcon = s.icon;
              return (
                <Card key={s.id} id={s.id} className="scroll-mt-24">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
                        <SIcon className="h-5 w-5 text-accent" />
                      </div>
                      <div>
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Passo {s.num}
                        </span>
                        <h2 className="text-xl sm:text-2xl font-semibold text-foreground leading-tight" style={cinzel}>
                          {s.title}
                        </h2>
                      </div>
                    </div>
                    <div className="pt-2">{s.body}</div>
                  </CardContent>
                </Card>
              );
            })}

            {/* CTA FINAL */}
            <section className="rounded-3xl bg-primary p-8 sm:p-12 text-center text-primary-foreground shadow-lg mt-10">
              <h2 className="text-2xl sm:text-3xl font-bold mb-3" style={cinzel}>
                Setup pronto? Hora de disparar.
              </h2>
              <p className="opacity-90 max-w-xl mx-auto mb-6">
                Se você já é assinante, abra a ferramenta. Se ainda não, contrate e ganhe acesso imediato.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  onClick={() => navigate({ to: "/planos" })}
                  className="bg-accent text-accent-foreground hover:bg-accent/90 px-8"
                >
                  Contratar agora
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate({ to: "/tool/disparos" })}
                  className="border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  Abrir ferramenta
                </Button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DisparosManualPage;
