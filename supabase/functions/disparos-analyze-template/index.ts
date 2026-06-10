import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { callMiniMaxJSON } from "../_shared/minimax.ts";

// Analisador de templates WhatsApp — IA especialista nas regras Meta 2026.
// Camadas: 1) sintaxe (regex/limites)  2) semântica (MiniMax)  3) links  4) decisão de categoria.
// Extras: duplicatas vs templates da WABA do usuário + plano de disparo seguro por tamanho de lista.

const VERSION = "disparos-analyze-template@2026-06-09_v1";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Regras Meta 2026 ──
const MAX_BODY_LEN = 550; // acima disso a Meta rejeita automaticamente (regra 2026, mais restrita que os 1024 antigos)
const MAX_EMOJIS = 10;
const MIN_WORDS_AROUND_VAR = 3;

type Severity = "erro" | "atencao" | "info";
type Categoria = "MARKETING" | "UTILITY" | "AUTHENTICATION";

interface Issue {
  layer: "sintaxe" | "links" | "politica" | "categoria" | "duplicata" | "ia";
  severity: Severity;
  code: string;
  message: string;
  fix?: string;
  excerpt?: string;
}

interface SafetyItem {
  severity: Severity;
  title: string;
  detail: string;
}

const SHORTENER_DOMAINS = [
  "bit.ly", "bitly.com", "tinyurl.com", "t.co", "goo.gl", "is.gd", "cutt.ly",
  "rb.gy", "rebrand.ly", "shorturl.at", "ow.ly", "buff.ly", "encurtador.com.br",
  "abre.ai", "l1nk.dev", "s.id", "tny.im", "v.gd", "soo.gd",
];

const MARKETING_TRIGGERS: { re: RegExp; label: string }[] = [
  { re: /\baproveit\w*/i, label: "aproveite" },
  { re: /\bdesconto\w*/i, label: "desconto" },
  { re: /\boferta\w*/i, label: "oferta" },
  { re: /\bpromo(ç|c)(ão|oes|ões|ao)\w*/i, label: "promoção" },
  { re: /\bespecial (para|pra) (você|voce)\b/i, label: "especial para você" },
  { re: /\blan(ç|c)amento\b/i, label: "lançamento" },
  { re: /\bnovidade\w*/i, label: "novidade" },
  { re: /\bimperd(í|i)vel\b/i, label: "imperdível" },
  { re: /\bexclusiv\w*/i, label: "exclusivo" },
  { re: /\bgr(á|a)tis\b/i, label: "grátis" },
  { re: /\bcupom\b/i, label: "cupom" },
  { re: /\bfrete gr(á|a)tis\b/i, label: "frete grátis" },
  { re: /\b(ú|u)ltimas vagas\b/i, label: "últimas vagas" },
  { re: /\bvagas limitadas\b/i, label: "vagas limitadas" },
  { re: /\bs(ó|o) hoje\b/i, label: "só hoje" },
  { re: /\bpor tempo limitado\b/i, label: "por tempo limitado" },
  { re: /\bgaranta\b/i, label: "garanta" },
  { re: /\bcompre (agora|j(á|a))\b/i, label: "compre agora" },
  { re: /\bassine (j(á|a)|agora)\b/i, label: "assine já" },
  { re: /\bvisite nosso site\b/i, label: "visite nosso site" },
  { re: /\bn(ã|a)o perca\b/i, label: "não perca" },
  { re: /\bliquida(ç|c)(ã|a)o\b/i, label: "liquidação" },
  { re: /\bblack friday\b/i, label: "black friday" },
  { re: /\b\d+\s*%\s*(off|de desconto)\b/i, label: "% off" },
];

const PROHIBITED_PATTERNS: { re: RegExp; tipo: string }[] = [
  { re: /\b(aposta\w*|cassino|casino|\bbet\b|bet365|jogo do tigrinho|raspadinha|roleta|pr(ê|e)mio em dinheiro)\b/i, tipo: "jogos de azar" },
  { re: /\b(cigarro\w*|tabaco|vape\w*|narguil(é|e))\b/i, tipo: "tabaco" },
  { re: /\b(emagre(ç|c)a r(á|a)pido|perca \d+\s*kg|queima de gordura|cura milagrosa|resultado garantido em \d+ dias|sem dieta)\b/i, tipo: "suplementos/promessas de saúde" },
  { re: /\b(arma\w*|muni(ç|c)(ã|a)o|pistola)\b/i, tipo: "armas" },
  { re: /\b(empr(é|e)stimo (r(á|a)pido|na hora)|dinheiro f(á|a)cil|cr(é|e)dito na hora|payday)\b/i, tipo: "empréstimos de curto prazo" },
  { re: /\b(site de encontros|encontros casuais)\b/i, tipo: "serviços de dating" },
];

const SENSITIVE_REQUEST_PATTERNS: { re: RegExp; tipo: string }[] = [
  { re: /\b(senha|password)\b/i, tipo: "senha" },
  { re: /\bcvv\b/i, tipo: "CVV" },
  { re: /\b(n(ú|u)mero|dados|c(ó|o)digo) do (seu )?cart(ã|a)o\b/i, tipo: "dados de cartão" },
  { re: /\bcpf (completo|e rg)\b/i, tipo: "CPF completo" },
  { re: /\brg completo\b/i, tipo: "RG completo" },
];

const countEmojis = (text: string): number =>
  (text.match(/\p{Extended_Pictographic}/gu) || []).length;

const extractUrls = (text: string): string[] =>
  text.match(/https?:\/\/[^\s<>")]+|www\.[^\s<>")]+/gi) || [];

const domainOf = (url: string): string => {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return url.toLowerCase();
  }
};

const wordCount = (s: string): number => (s.trim().match(/[\p{L}\p{N}]+/gu) || []).length;

// Similaridade Jaccard sobre bigramas de palavras (variáveis normalizadas)
function jaccardSimilarity(a: string, b: string): number {
  const norm = (t: string) =>
    t.toLowerCase().replace(/\{\{\d+\}\}/g, " _var_ ").replace(/[^\p{L}\p{N}_\s]/gu, " ").split(/\s+/).filter(Boolean);
  const bigrams = (words: string[]) => {
    const set = new Set<string>();
    for (let i = 0; i < words.length - 1; i++) set.add(`${words[i]} ${words[i + 1]}`);
    if (words.length === 1) set.add(words[0]);
    return set;
  };
  const sa = bigrams(norm(a));
  const sb = bigrams(norm(b));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  return inter / (sa.size + sb.size - inter);
}

const META_KNOWLEDGE_2026 = `
CONHECIMENTO DE REFERÊNCIA — WhatsApp Business Platform (Meta, edição 2026):

CATEGORIAS E PREÇOS (modelo por mensagem entregue, desde jul/2025):
- MARKETING: promoções, ofertas, lembretes de carrinho, anúncios de produto. Categoria mais CARA.
- UTILITY: atualizações transacionais (pedido enviado, conta atualizada). Barata; GRÁTIS dentro da janela de 24h aberta pelo cliente.
- AUTHENTICATION: apenas códigos OTP/2FA. Deve ser extremamente curto, só o código + menção opcional de segurança ("Não compartilhe este código"). Qualquer texto extra move para UTILITY.
- Free Entry Point: conversa iniciada por anúncio Click-to-WhatsApp tem 72h gratuitas.

REGRA DE CONTEÚDO MISTO: se um template é 90% utilidade e 10% promoção (ex: "Seu pedido saiu! Ganhe 10% na próxima"), a Meta classifica o template INTEIRO como MARKETING. Utilidade exige tom reativo e puramente informativo, sem adjetivos persuasivos nem incentivos.

GATILHOS QUE FORÇAM MARKETING: "aproveite", "desconto", "oferta", "promoção", "especial para você", "novo", "lançamento", CTAs de venda ("compre agora", "visite nosso site", "assine já").

VERTICAIS PROIBIDAS/RESTRITAS: armas, tabaco, drogas, produtos adultos, jogos de azar com dinheiro real, dating, marketing multinível, payday loans, suplementos inseguros/curas milagrosas. Álcool tem restrições mesmo onde é legal. Solicitar senha/CVV/número de cartão/CPF completo = violação grave.

MOTIVOS DE REJEIÇÃO COMUNS: INCORRECT_CATEGORY / TAG_CONTENT_MISMATCH (categoria não bate com o conteúdo), PROMOTIONAL (promo em categoria não-marketing), INVALID_FORMAT (variáveis mal usadas), SCAM, ABUSIVE_CONTENT, duplicata semântica de template já aprovado na mesma WABA.

QUALIDADE E LIMITES (out/2025): limites de envio por PORTFÓLIO de negócios (250 → 2.000 → 10.000 → 100.000 → ilimitado/24h), escalonamento automático em 6h. Qualidade cai com denúncias e bloqueios; listas frias destroem a pontuação. Penalidades: aviso → restrição temporária (1-30 dias) → bloqueio → banimento.

OPT-IN/OPT-OUT: consentimento explícito obrigatório (LGPD no Brasil); o usuário deve saber qual empresa o contata; caminho de opt-out claro e honrado é obrigatório em marketing.

CONTEXTO DA FERRAMENTA: usada por PMEs de diversos segmentos, clientes da Apreenda Digital. Varejo, serviços, educação, saúde e hospitalidade são verticais permitidas. Atenção a promoções de bebidas (álcool é restrito) e a regras específicas de cada vertical.
`;

interface AISemanticResult {
  categoria_detectada: Categoria;
  confianca: number;
  risco_reclassificacao: "baixo" | "medio" | "alto";
  risco_bloqueio: "baixo" | "medio" | "alto";
  conteudo_proibido: { tipo: string; trecho: string; gravidade: "erro" | "atencao" }[];
  problemas: { mensagem: string; gravidade: Severity; correcao?: string }[];
  reescrita_sugerida: string | null;
  resumo: string;
}

async function callSemanticLayer(
  bodyText: string,
  declaredCategory: Categoria,
  headerText: string,
  footerText: string,
  buttons: { text?: string; url?: string }[],
): Promise<AISemanticResult | null> {
  const systemPrompt = `Você é o especialista sênior em templates da WhatsApp Business Platform e em disparos em massa seguros, atualizado com as políticas da Meta de 2026.
${META_KNOWLEDGE_2026}
Sua tarefa: analisar o template recebido, detectar a categoria REAL pela intenção do texto, apontar conteúdo proibido/arriscado considerando o CONTEXTO, avaliar risco de reclassificação e de bloqueio da conta, e sugerir reescrita quando houver problema.

Responda APENAS com JSON válido neste formato exato:
{
  "categoria_detectada": "MARKETING" | "UTILITY" | "AUTHENTICATION",
  "confianca": 0.0 a 1.0,
  "risco_reclassificacao": "baixo" | "medio" | "alto",
  "risco_bloqueio": "baixo" | "medio" | "alto",
  "conteudo_proibido": [{"tipo": "...", "trecho": "...", "gravidade": "erro" | "atencao"}],
  "problemas": [{"mensagem": "...", "gravidade": "erro" | "atencao" | "info", "correcao": "..."}],
  "reescrita_sugerida": "texto completo reescrito mantendo as variáveis {{n}}, ou null se o template está bom",
  "resumo": "1-2 frases em pt-BR sobre o veredito"
}`;

  const userMessage = `CATEGORIA DECLARADA: ${declaredCategory}
${headerText ? `HEADER: ${headerText}\n` : ""}CORPO DO TEMPLATE:
${bodyText}
${footerText ? `\nFOOTER: ${footerText}` : ""}${buttons.length > 0 ? `\nBOTÕES: ${buttons.map((b) => `[${b.text || ""}${b.url ? ` → ${b.url}` : ""}]`).join(" ")}` : ""}`;

  try {
    const { data: parsed } = await callMiniMaxJSON<Record<string, unknown>>({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: 0.2,
      maxTokens: 2000,
    });

    const cat = ["MARKETING", "UTILITY", "AUTHENTICATION"].includes(parsed.categoria_detectada as string)
      ? (parsed.categoria_detectada as Categoria)
      : declaredCategory;

    return {
      categoria_detectada: cat,
      confianca: typeof parsed.confianca === "number" ? Math.min(1, Math.max(0, parsed.confianca)) : 0.5,
      risco_reclassificacao: ["baixo", "medio", "alto"].includes(parsed.risco_reclassificacao as string) ? (parsed.risco_reclassificacao as "baixo" | "medio" | "alto") : "baixo",
      risco_bloqueio: ["baixo", "medio", "alto"].includes(parsed.risco_bloqueio as string) ? (parsed.risco_bloqueio as "baixo" | "medio" | "alto") : "baixo",
      conteudo_proibido: Array.isArray(parsed.conteudo_proibido) ? (parsed.conteudo_proibido as AISemanticResult["conteudo_proibido"]) : [],
      problemas: Array.isArray(parsed.problemas) ? (parsed.problemas as AISemanticResult["problemas"]) : [],
      reescrita_sugerida: typeof parsed.reescrita_sugerida === "string" && (parsed.reescrita_sugerida as string).trim() ? (parsed.reescrita_sugerida as string) : null,
      resumo: typeof parsed.resumo === "string" ? (parsed.resumo as string) : "",
    };
  } catch (err) {
    console.error("[ANALYZE] Semantic layer failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

function buildSafetyPlan(category: Categoria, recipientCount: number | null, fullText: string): SafetyItem[] {
  const plan: SafetyItem[] = [];
  const TIERS = [250, 2000, 10000, 100000];

  if (recipientCount && recipientCount > 0) {
    const tierNeeded = TIERS.find((t) => recipientCount <= t);
    if (recipientCount > 250) {
      plan.push({
        severity: "atencao",
        title: `Confira seu limite de envio antes de disparar pra ${recipientCount.toLocaleString("pt-BR")} contatos`,
        detail: `Desde out/2025 o limite é por portfólio de negócios (250 → 2.000 → 10.000 → 100.000/dia, escala em 6h). Se seu portfólio ainda estiver no tier inicial, divida em ${Math.ceil(recipientCount / 250)} dias ou aguarde a escalada${tierNeeded ? ` (este disparo exige o tier de ${tierNeeded.toLocaleString("pt-BR")})` : ""}.`,
      });
    }
    if (recipientCount > 50) {
      plan.push({
        severity: "info",
        title: "Comece pequeno e monitore",
        detail: "Dispare primeiro pra uma fatia de 10-20% da lista e acompanhe falhas por 30-60 min na aba Analytics. Taxa de falha acima de ~5% ou denúncias = pause e revise lista/copy. Pra listas grandes, prefira a velocidade Seguro.",
      });
    }
  }

  plan.push({
    severity: "atencao",
    title: "Só dispare pra quem deu opt-in",
    detail: "Consentimento explícito é exigência da Meta e da LGPD. Lista fria gera denúncia e bloqueio, derruba a qualidade do número e pode travar o portfólio inteiro.",
  });

  if (category === "MARKETING") {
    const hasOptOut = /\b(sair|parar|descadastr|remover|n(ã|a)o quero (mais )?receber|opt.?out)\b/i.test(fullText);
    if (!hasOptOut) {
      plan.push({
        severity: "atencao",
        title: "Template de marketing sem caminho de opt-out",
        detail: 'Inclua uma saída clara (ex: "Responda SAIR para não receber mais ofertas"). Opt-out fácil reduz denúncias — e denúncia pesa muito mais na qualidade do que um descadastro.',
      });
    }
    plan.push({
      severity: "info",
      title: "Marketing é a categoria mais cara — e a mais vigiada",
      detail: "Cobrança por mensagem entregue. Evite repetir marketing pra mesma lista em menos de 48h (use a exclusão de já enviados). Leads de anúncio Click-to-WhatsApp têm janela de 72h gratuita.",
    });
  }

  if (category === "UTILITY") {
    plan.push({
      severity: "info",
      title: "Utility dentro da janela de 24h é grátis",
      detail: "Se o cliente falou com você nas últimas 24h, este template não é cobrado pela Meta. Fora da janela, é cobrado (barato). Mantenha o texto 100% informativo pra não ser reclassificado.",
    });
  }

  plan.push({
    severity: "info",
    title: "Horário e cadência",
    detail: "Dispare em horário comercial do destinatário e evite rodar várias campanhas simultâneas no mesmo número.",
  });

  return plan;
}

// deno-lint-ignore no-explicit-any
async function getUserId(req: Request, supabase: any) {
  const auth = req.headers.get("Authorization");
  if (!auth) return null;
  const { data } = await supabase.auth.getUser(auth.replace(/^Bearer\s+/i, ""));
  return data?.user?.id || null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const userId = await getUserId(req, supabase);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const input = await req.json();
    const bodyText: string = (input.bodyText || "").toString();
    const declaredCategory: Categoria = ["MARKETING", "UTILITY", "AUTHENTICATION"].includes(input.declaredCategory)
      ? input.declaredCategory
      : "MARKETING";
    const templateName: string | null = input.templateName || null;
    const headerText: string = (input.headerText || "").toString();
    const footerText: string = (input.footerText || "").toString();
    const buttons: { text?: string; url?: string }[] = Array.isArray(input.buttons) ? input.buttons : [];
    const recipientCount: number | null = typeof input.recipientCount === "number" ? input.recipientCount : null;
    const skipAI: boolean = input.skipAI === true;
    const checkDuplicates: boolean = input.checkDuplicates !== false;

    if (!bodyText.trim()) {
      return new Response(JSON.stringify({ error: "bodyText é obrigatório" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    console.log(`[ANALYZE] ${VERSION} user=${userId} len=${bodyText.length} cat=${declaredCategory} skipAI=${skipAI}`);

    const issues: Issue[] = [];
    const fullText = [headerText, bodyText, footerText, ...buttons.map((b) => b.text || "")].filter(Boolean).join("\n");

    // ── Camada 1: validação sintática ──
    if (bodyText.length > MAX_BODY_LEN) {
      issues.push({
        layer: "sintaxe", severity: "erro", code: "BODY_TOO_LONG",
        message: `Corpo com ${bodyText.length} caracteres — o limite 2026 é ${MAX_BODY_LEN} e o excedente causa rejeição automática.`,
        fix: `Corte ${bodyText.length - MAX_BODY_LEN} caracteres. Vá direto ao ponto: 1 ideia, 1 CTA.`,
      });
    }

    const emojiCount = countEmojis(fullText);
    if (emojiCount > MAX_EMOJIS) {
      issues.push({
        layer: "sintaxe", severity: "erro", code: "TOO_MANY_EMOJIS",
        message: `${emojiCount} emojis detectados — máximo de ${MAX_EMOJIS} por template.`,
        fix: "Reduza pra 2-3 emojis estratégicos. Excesso de emoji também aumenta percepção de spam.",
      });
    }

    if (/\n{5,}/.test(bodyText)) {
      issues.push({
        layer: "sintaxe", severity: "atencao", code: "TOO_MANY_LINE_BREAKS",
        message: "Mais de 4 quebras de linha consecutivas.",
        fix: "Compacte os espaços verticais — blocos longos de espaço parecem erro de formatação.",
      });
    }

    const varMatches = [...bodyText.matchAll(/\{\{(\d+)\}\}/g)];
    const varIndexes = varMatches.map((m) => parseInt(m[1]));
    if (varIndexes.length > 0) {
      const sorted = [...new Set(varIndexes)].sort((a, b) => a - b);
      const isSequential = sorted[0] === 1 && sorted.every((v, i) => v === i + 1);
      if (!isSequential) {
        issues.push({
          layer: "sintaxe", severity: "erro", code: "VARS_NOT_SEQUENTIAL",
          message: `Variáveis fora de sequência: {{${sorted.join("}}, {{")}}}. Devem ser {{1}}, {{2}}, {{3}}... sem pular números.`,
          fix: "Renumere as variáveis em ordem de aparição.",
        });
      }

      const trimmed = bodyText.trim();
      if (/^\{\{\d+\}\}/.test(trimmed) || /\{\{\d+\}\}$/.test(trimmed)) {
        issues.push({
          layer: "sintaxe", severity: "erro", code: "VAR_AT_EDGE",
          message: "Variável no início ou no fim absoluto do texto — rejeição automática da Meta.",
          fix: 'Envolva com texto fixo. Ex: "Olá, {{1}}!" em vez de começar com {{1}}, e termine com uma frase fixa.',
        });
      }

      if (/\}\}\s*\{\{/.test(bodyText)) {
        issues.push({
          layer: "sintaxe", severity: "erro", code: "VARS_GLUED",
          message: "Variáveis coladas (ex: {{1}}{{2}}) — rejeição imediata.",
          fix: "Separe com texto: \"{{1}}, seu pedido {{2}}...\"",
        });
      }

      const segments = bodyText.split(/\{\{\d+\}\}/);
      const innerSegments = segments.slice(1, -1);
      const thinGaps = innerSegments.filter((s) => wordCount(s) < MIN_WORDS_AROUND_VAR).length;
      if (thinGaps > 0 && !/\}\}\s*\{\{/.test(bodyText)) {
        issues.push({
          layer: "sintaxe", severity: "atencao", code: "LOW_VAR_DENSITY",
          message: `${thinGaps} variável(is) com menos de ${MIN_WORDS_AROUND_VAR} palavras de contexto ao redor.`,
          fix: "A Meta exige texto suficiente entre variáveis pra entender a mensagem. Escreva frases completas em volta de cada {{n}}.",
        });
      }
    }

    // ── Camada 3: higiene de links ──
    const urls = [...extractUrls(fullText), ...buttons.map((b) => b.url || "").filter(Boolean)];
    for (const url of urls) {
      const domain = domainOf(url);
      if (SHORTENER_DOMAINS.some((s) => domain === s || domain.endsWith(`.${s}`))) {
        issues.push({
          layer: "links", severity: "erro", code: "SHORTENER_LINK",
          message: `Encurtador detectado: ${domain} — proibido em templates (a Meta não consegue validar o destino).`,
          fix: "Use o domínio completo da sua marca (ex: https://suaempresa.com.br/oferta).",
          excerpt: url,
        });
      } else if (/^http:\/\//i.test(url)) {
        issues.push({
          layer: "links", severity: "atencao", code: "NON_HTTPS_LINK",
          message: `Link sem HTTPS: ${url}`,
          fix: "Troque para https:// — links http são sinalizados como inseguros.",
          excerpt: url,
        });
      }
    }

    // ── Política: dados sensíveis + verticais restritas (pré-filtro) ──
    for (const { re, tipo } of SENSITIVE_REQUEST_PATTERNS) {
      const m = fullText.match(re);
      if (m) {
        issues.push({
          layer: "politica", severity: "erro", code: "SENSITIVE_DATA_REQUEST",
          message: `Menção a dado sensível (${tipo}) — solicitar esse dado viola a política da Meta e derruba a conta.`,
          fix: "Nunca peça senha, CVV, número de cartão ou documento completo por WhatsApp.",
          excerpt: m[0],
        });
      }
    }

    const prohibitedFlags: { tipo: string; trecho: string }[] = [];
    for (const { re, tipo } of PROHIBITED_PATTERNS) {
      const m = fullText.match(re);
      if (m) prohibitedFlags.push({ tipo, trecho: m[0] });
    }

    const triggersFound = MARKETING_TRIGGERS.filter((t) => t.re.test(fullText)).map((t) => t.label);

    if (declaredCategory === "AUTHENTICATION") {
      if (bodyText.length > 160 || urls.length > 0 || triggersFound.length > 0) {
        issues.push({
          layer: "categoria", severity: "erro", code: "AUTH_TOO_RICH",
          message: "Template de autenticação deve conter apenas o código e, no máximo, uma menção de segurança. Texto extra, links ou tom promocional movem a categoria.",
          fix: 'Modelo: "Seu código de acesso é {{1}}. Não compartilhe este código."',
        });
      }
    }

    // ── Duplicatas: compara com os templates da WABA do usuário ──
    const duplicates: { name: string; language: string; similarity: number }[] = [];
    if (checkDuplicates) {
      const { data: config } = await supabase
        .from("disparos_api_config").select("waba_id, access_token").eq("user_id", userId).maybeSingle();
      if (config?.waba_id && config?.access_token) {
        try {
          const controller = new AbortController();
          const t = setTimeout(() => controller.abort(), 10000);
          const resp = await fetch(
            `https://graph.facebook.com/v21.0/${config.waba_id}/message_templates?limit=100&fields=name,language,status,components`,
            { headers: { Authorization: `Bearer ${config.access_token}` }, signal: controller.signal },
          );
          clearTimeout(t);
          if (resp.ok) {
            const data = await resp.json();
            for (const tpl of data.data || []) {
              if (templateName && tpl.name === templateName) continue;
              if (tpl.status === "REJECTED") continue;
              const tplBody = (tpl.components || []).find((c: { type: string }) => c.type === "BODY")?.text || "";
              if (!tplBody) continue;
              const sim = jaccardSimilarity(bodyText, tplBody);
              if (sim >= 0.75) duplicates.push({ name: tpl.name, language: tpl.language, similarity: Math.round(sim * 100) / 100 });
            }
            duplicates.sort((a, b) => b.similarity - a.similarity);
            const worst = duplicates[0];
            if (worst && worst.similarity >= 0.9) {
              issues.push({
                layer: "duplicata", severity: "erro", code: "NEAR_DUPLICATE",
                message: `Praticamente idêntico ao template "${worst.name}" (${Math.round(worst.similarity * 100)}% de similaridade) — a Meta rejeita duplicatas semânticas na mesma WABA.`,
                fix: "Reaproveite o template existente ou mude substancialmente o texto.",
              });
            } else if (worst) {
              issues.push({
                layer: "duplicata", severity: "atencao", code: "SIMILAR_TEMPLATE",
                message: `Muito parecido com "${worst.name}" (${Math.round(worst.similarity * 100)}%). Risco de rejeição por duplicidade.`,
                fix: "Diferencie o objetivo e o texto, ou use o template que já existe.",
              });
            }
          }
        } catch (e) {
          console.warn("[ANALYZE] duplicate check skipped:", e instanceof Error ? e.message : e);
        }
      }
    }

    // ── Camada 2: análise semântica via IA ──
    const ai = skipAI ? null : await callSemanticLayer(bodyText, declaredCategory, headerText, footerText, buttons);

    if (ai) {
      for (const p of ai.conteudo_proibido) {
        issues.push({
          layer: "politica", severity: p.gravidade === "erro" ? "erro" : "atencao", code: "PROHIBITED_CONTENT",
          message: `Conteúdo restrito (${p.tipo}): "${p.trecho}"`,
          excerpt: p.trecho,
        });
      }
      for (const p of ai.problemas) {
        issues.push({
          layer: "ia",
          severity: ["erro", "atencao", "info"].includes(p.gravidade) ? p.gravidade : "info",
          code: "AI_FINDING",
          message: p.mensagem,
          fix: p.correcao,
        });
      }
    } else if (prohibitedFlags.length > 0) {
      // Sem IA pra confirmar contexto → flag determinístico vira atenção
      for (const f of prohibitedFlags) {
        issues.push({
          layer: "politica", severity: "atencao", code: "PROHIBITED_KEYWORD",
          message: `Termo de vertical restrita (${f.tipo}): "${f.trecho}". Confirme se o contexto não viola a política da Meta.`,
          excerpt: f.trecho,
        });
      }
    }

    // ── Camada 4: motor de decisão de categoria ──
    const detectedCategory: Categoria = ai?.categoria_detectada
      ?? (triggersFound.length > 0 ? "MARKETING" : declaredCategory);
    const categoryMismatch = detectedCategory !== declaredCategory;

    let reclassificationRisk: "baixo" | "medio" | "alto" = ai?.risco_reclassificacao ?? "baixo";
    if (declaredCategory === "UTILITY" && (triggersFound.length > 0 || detectedCategory === "MARKETING")) {
      reclassificationRisk = "alto";
      issues.push({
        layer: "categoria", severity: "atencao", code: "MIXED_CONTENT",
        message: `Conteúdo promocional em template de UTILIDADE${triggersFound.length ? ` (gatilhos: ${triggersFound.slice(0, 5).join(", ")})` : ""}. Pela regra de conteúdo misto, o template INTEIRO vira MARKETING — risco de rejeição (INCORRECT_CATEGORY) e custo maior.`,
        fix: "Remova qualquer incentivo/oferta do texto, ou registre o template como MARKETING.",
      });
    } else if (declaredCategory === "MARKETING" && triggersFound.length === 0 && detectedCategory === "UTILITY") {
      issues.push({
        layer: "categoria", severity: "info", code: "COULD_BE_UTILITY",
        message: "O texto parece puramente informativo/transacional. Registrado como UTILITY, custaria menos (e é grátis na janela de 24h).",
        fix: "Considere registrar uma versão UTILITY deste template.",
      });
    }

    let score = 100;
    for (const i of issues) {
      if (i.severity === "erro") score -= 25;
      else if (i.severity === "atencao") score -= 10;
      else score -= 2;
    }
    score = Math.max(0, Math.min(100, score));

    const hasError = issues.some((i) => i.severity === "erro");
    const hasWarning = issues.some((i) => i.severity === "atencao");
    const verdict: "APROVADO" | "ATENCAO" | "REPROVADO" = hasError ? "REPROVADO" : hasWarning ? "ATENCAO" : "APROVADO";

    const report = {
      verdict,
      score,
      declaredCategory,
      detectedCategory,
      categoryMismatch,
      reclassificationRisk,
      blockRisk: ai?.risco_bloqueio ?? (hasError ? "alto" : hasWarning ? "medio" : "baixo"),
      stats: {
        chars: bodyText.length,
        maxChars: MAX_BODY_LEN,
        emojis: emojiCount,
        maxEmojis: MAX_EMOJIS,
        variables: varIndexes.length,
        links: urls.length,
      },
      issues,
      duplicates: duplicates.slice(0, 3),
      aiAnalysis: {
        available: !!ai,
        summary: ai?.resumo || null,
        confidence: ai?.confianca ?? null,
        rewriteSuggestion: ai?.reescrita_sugerida || null,
      },
      safetyPlan: buildSafetyPlan(detectedCategory, recipientCount, fullText),
      analyzedAt: new Date().toISOString(),
      version: VERSION,
    };

    console.log(`[ANALYZE] verdict=${verdict} score=${score} issues=${issues.length} ai=${!!ai}`);

    return new Response(JSON.stringify({ success: true, report }), {
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("disparos-analyze-template error", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});

// lovable redeploy nudge — 2026-06-10
