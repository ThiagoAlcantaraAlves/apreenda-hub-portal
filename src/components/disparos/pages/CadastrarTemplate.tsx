import { useState } from "react";
import { invokeWithAuth } from "@/integrations/disparos/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Send, ArrowLeft, Info, AlertCircle, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation, useRouter } from "@tanstack/react-router";
import { useTemplateAnalysis, TemplateCategory, AnalysisIssue } from "@/hooks/useTemplateAnalysis";
import { TemplateAnalysisReport } from "@/components/disparos/TemplateAnalysisReport";

// Limite 2026 da Meta pro corpo do template (acima disso = rejeição automática)
const MAX_BODY_LEN = 550;

type ButtonType = { type: "URL"; text: string; url: string } | { type: "QUICK_REPLY"; text: string };

type FixTemplate = {
  name: string; language: string; category: string;
  status?: string; rejected_reason?: string | null; components?: any[];
};

const REJECTION_LABELS: Record<string, string> = {
  ABUSIVE_CONTENT: "Conteúdo abusivo ou ofensivo",
  INCORRECT_CATEGORY: "Categoria incorreta",
  INVALID_FORMAT: "Formato inválido",
  SCAM: "Conteúdo identificado como golpe",
  TAG_CONTENT_MISMATCH: "Conteúdo não corresponde à categoria",
  PROMOTIONAL: "Conteúdo promocional em categoria não-marketing",
  NONE: "Sem motivo específico",
};

const parseComponents = (components: any[]) => {
  const header = components.find((c) => c.type === "HEADER");
  const body = components.find((c) => c.type === "BODY");
  const footer = components.find((c) => c.type === "FOOTER");
  const buttonsComp = components.find((c) => c.type === "BUTTONS");
  const buttons: ButtonType[] = (buttonsComp?.buttons || []).map((b: any) =>
    b.type === "URL" ? { type: "URL", text: b.text || "", url: b.url || "" } : { type: "QUICK_REPLY", text: b.text || "" }
  );
  const bodyVars = (body?.text?.match(/\{\{(\d+)\}\}/g) || []) as string[];
  const uniqueNums = Array.from(new Set(bodyVars.map((m) => m.replace(/[^\d]/g, ""))));
  const exampleValues: string[] = body?.example?.body_text?.[0] || [];
  const examples: Record<string, string> = {};
  uniqueNums.forEach((n, i) => { if (exampleValues[i]) examples[n] = exampleValues[i]; });
  return {
    header: header?.format === "TEXT" ? header.text || "" : "",
    body: body?.text || "", footer: footer?.text || "", buttons, examples,
  };
};

export default function CadastrarTemplate() {
  const navigate = useNavigate();
  const router = useRouter();
  const location = useLocation();
  const fix: FixTemplate | undefined = (location.state as any)?.fixTemplate;
  const initial = fix?.components ? parseComponents(fix.components) : null;

  const bumpVersion = (original: string) => {
    const match = original.match(/^(.*)_v(\d+)$/);
    if (match) return `${match[1]}_v${Number(match[2]) + 1}`;
    return `${original}_v2`;
  };

  const [name, setName] = useState(fix?.name ? bumpVersion(fix.name) : "");
  const [language, setLanguage] = useState(fix?.language || "pt_BR");
  const [category, setCategory] = useState(fix?.category || "MARKETING");
  const [headerText, setHeaderText] = useState(initial?.header || "");
  const [bodyText, setBodyText] = useState(initial?.body || "");
  const [footerText, setFooterText] = useState(initial?.footer || "");
  const [buttons, setButtons] = useState<ButtonType[]>(initial?.buttons || []);
  const [submitting, setSubmitting] = useState(false);
  const [bodyExamples, setBodyExamples] = useState<Record<string, string>>(initial?.examples || {});

  // Análise IA (laudo exibido) + pré-voo silencioso do submit
  const aiAnalysis = useTemplateAnalysis();
  const preflight = useTemplateAnalysis();
  const [overrideIssues, setOverrideIssues] = useState<AnalysisIssue[] | null>(null);

  const rejectionLabel = fix?.rejected_reason ? REJECTION_LABELS[fix.rejected_reason] || fix.rejected_reason : null;

  const extractVariableNumbers = (text: string) =>
    Array.from(new Set((text.match(/\{\{(\d+)\}\}/g) || []).map((m) => m.replace(/[^\d]/g, ""))))
      .sort((a, b) => Number(a) - Number(b));

  const sanitizeName = (val: string) =>
    val.toLowerCase().replace(/[^a-z0-9_]/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");

  const hasTemplateVariable = (text: string) => /\{\{\d+\}\}/.test(text);
  const startsOrEndsWithVariable = (text: string) =>
    /^\s*\{\{\d+\}\}/.test(text) || /\{\{\d+\}\}\s*$/.test(text);
  const hasSequentialVariables = (numbers: string[]) =>
    numbers.every((n, index) => Number(n) === index + 1);

  const addButton = (type: "URL" | "QUICK_REPLY") => {
    if (buttons.length >= 3) { toast.error("Máximo de 3 botões"); return; }
    setButtons([...buttons, type === "URL" ? { type: "URL", text: "", url: "" } : { type: "QUICK_REPLY", text: "" }]);
  };

  const updateButton = (index: number, field: string, value: string) => {
    const updated = [...buttons]; (updated[index] as any)[field] = value; setButtons(updated);
  };
  const removeButton = (index: number) => setButtons(buttons.filter((_, i) => i !== index));

  const buildComponents = () => {
    const components: any[] = [];
    if (headerText.trim()) components.push({ type: "HEADER", format: "TEXT", text: headerText.trim() });
    const bodyComponent: any = { type: "BODY", text: bodyText.trim() };
    const bodyVarNumbers = extractVariableNumbers(bodyText);
    if (bodyVarNumbers.length > 0) {
      bodyComponent.example = { body_text: [bodyVarNumbers.map((n) => bodyExamples[n]?.trim() || "")] };
    }
    components.push(bodyComponent);
    if (footerText.trim()) components.push({ type: "FOOTER", text: footerText.trim() });
    if (buttons.length > 0) {
      components.push({
        type: "BUTTONS",
        buttons: buttons.map((btn) => btn.type === "URL"
          ? { type: "URL", text: btn.text.trim(), url: btn.url.trim() }
          : { type: "QUICK_REPLY", text: btn.text.trim() }),
      });
    }
    return components;
  };

  const bodyVariableNumbers = extractVariableNumbers(bodyText);
  const bodyExampleNeeded = bodyVariableNumbers.length > 0;

  const buildAnalysisInput = () => ({
    bodyText: bodyText.trim(),
    declaredCategory: category as TemplateCategory,
    templateName: sanitizeName(name) || undefined,
    headerText: headerText.trim(),
    footerText: footerText.trim(),
    buttons: buttons.map((b) => ({ text: b.text, url: b.type === "URL" ? (b as any).url : undefined })),
  });

  const handleAnalyze = () => {
    if (!bodyText.trim()) { toast.error("Escreva o corpo da mensagem primeiro"); return; }
    aiAnalysis.analyze(buildAnalysisInput());
  };

  const validateForm = (): string | null => {
    const finalName = sanitizeName(name);
    if (!finalName) return "Informe o nome do template";
    if (finalName.length > 512) return "Nome muito longo";
    if (!bodyText.trim()) return "Corpo da mensagem é obrigatório";
    if (category === "AUTHENTICATION") return "Use Marketing ou Utilidade nesta tela.";
    if (headerText.trim() && hasTemplateVariable(headerText)) return "Variáveis no cabeçalho não suportadas.";
    if (bodyVariableNumbers.length > 0 && !hasSequentialVariables(bodyVariableNumbers)) return "Variáveis precisam ser sequenciais: {{1}}, {{2}}...";
    if (startsOrEndsWithVariable(bodyText)) return "Mensagem não pode começar/terminar com variável.";
    for (const n of bodyVariableNumbers) {
      if (!bodyExamples[n]?.trim()) return `Informe exemplo para {{${n}}}`;
    }
    for (const btn of buttons) {
      if (!btn.text.trim()) return "Todos os botões precisam de texto";
      if (btn.type === "URL") {
        const url = (btn as any).url?.trim();
        if (!url) return "Botões URL precisam de link";
        if (!/^https:\/\//i.test(url)) return "URL deve começar com https://";
      }
    }
    return null;
  };

  const doSubmit = async () => {
    setSubmitting(true);
    try {
      const components = buildComponents();
      const { data, error } = await invokeWithAuth("disparos-create-template", {
        body: { name: sanitizeName(name), language, category, components },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Template enviado para aprovação da Meta!");
      navigate({ to: "/tool/disparos/templates" });
    } catch (err: any) {
      toast.error("Erro: " + (err.message || "Erro desconhecido"));
    }
    setSubmitting(false);
  };

  const handleSubmit = async () => {
    const validationError = validateForm();
    if (validationError) { toast.error(validationError); return; }

    // Pré-voo: regras determinísticas da Meta 2026 (rápido, sem custo de IA).
    // Bloqueia envio com erro fatal — evita queimar o nome do template com rejeição.
    setSubmitting(true);
    const result = await preflight.analyze({ ...buildAnalysisInput(), skipAI: true });
    setSubmitting(false);

    if (result && result.verdict === "REPROVADO") {
      setOverrideIssues(result.issues.filter((i) => i.severity === "erro"));
      return;
    }
    await doSubmit();
  };

  const getPreviewText = () => {
    let text = bodyText;
    (text.match(/\{\{(\d+)\}\}/g) || []).forEach((v) => { text = text.replace(v, `[Variável ${v}]`); });
    return text;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.history.back()}><ArrowLeft className="h-4 w-4" /></Button>
        <h1 className="text-2xl font-bold">{fix ? "Corrigir e Reenviar Template" : "Cadastrar Template"}</h1>
      </div>

      {fix && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
          <div className="text-sm text-destructive">
            <p className="font-medium mb-1">Template rejeitado pela Meta</p>
            <p className="mb-1"><strong>Motivo:</strong> {rejectionLabel || "Não informado"}</p>
            <p className="text-xs opacity-90">
              Ajuste e reenvie. Nome incrementado: <code className="bg-destructive/20 px-1 rounded">{fix.name}</code> → <code className="bg-destructive/20 px-1 rounded">{bumpVersion(fix.name)}</code>
            </p>
          </div>
        </div>
      )}

      <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
        <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
        <div className="text-sm text-blue-800 dark:text-blue-300">
          <p className="font-medium mb-1">Como funciona?</p>
          <p>O template é enviado à Meta para aprovação (minutos a 24h para marketing). Após aprovado fica disponível em Novo Disparo.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Informações Básicas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Nome do Template</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: promocao_fim_de_semana" />
                {name && <p className="text-xs text-muted-foreground mt-1">Nome final: <code className="bg-muted px-1 rounded">{sanitizeName(name)}</code></p>}
              </div>
              <div>
                <Label>Categoria</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="MARKETING">Marketing</option>
                  <option value="UTILITY">Utilidade</option>
                  <option value="AUTHENTICATION">Autenticação</option>
                </select>
              </div>
              <div>
                <Label>Idioma</Label>
                <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="pt_BR">Português (Brasil)</option>
                  <option value="en_US">English (US)</option>
                  <option value="es">Español</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Conteúdo</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Cabeçalho (opcional)</Label>
                <Input value={headerText} onChange={(e) => setHeaderText(e.target.value)} maxLength={60} />
                <p className="text-xs text-muted-foreground mt-1">{headerText.length}/60</p>
              </div>
              <div>
                <Label>Corpo *</Label>
                <Textarea value={bodyText} onChange={(e) => setBodyText(e.target.value)} rows={5} maxLength={MAX_BODY_LEN}
                  placeholder={"Ex: Olá! Use {{1}}, {{2}}... para variáveis."} />
                <div className="flex justify-between mt-1">
                  <p className="text-xs text-muted-foreground">Use {"{{1}}"}, {"{{2}}"}... · Limite 2026: {MAX_BODY_LEN} caracteres</p>
                  <p className="text-xs text-muted-foreground">{bodyText.length}/{MAX_BODY_LEN}</p>
                </div>
                {bodyExampleNeeded && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <p className="text-xs text-muted-foreground">Exemplo para cada variável (obrigatório):</p>
                    {bodyVariableNumbers.map((n) => (
                      <div key={n} className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs shrink-0">{`{{${n}}}`}</Badge>
                        <Input value={bodyExamples[n] || ""}
                          onChange={(e) => setBodyExamples({ ...bodyExamples, [n]: e.target.value })}
                          placeholder={`Exemplo para {{${n}}}`} className="h-8 text-sm" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <Label>Rodapé (opcional)</Label>
                <Input value={footerText} onChange={(e) => setFooterText(e.target.value)} maxLength={60} />
                <p className="text-xs text-muted-foreground mt-1">{footerText.length}/60</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Botões (opcional)</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => addButton("QUICK_REPLY")} disabled={buttons.length >= 3}>
                    <Plus className="h-3 w-3 mr-1" /> Resposta Rápida
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => addButton("URL")} disabled={buttons.length >= 3}>
                    <Plus className="h-3 w-3 mr-1" /> Link URL
                  </Button>
                </div>
              </div>
            </CardHeader>
            {buttons.length > 0 && (
              <CardContent className="space-y-4">
                {buttons.map((btn, idx) => (
                  <div key={idx} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="text-xs">{btn.type === "URL" ? "Link URL" : "Resposta Rápida"}</Badge>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeButton(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                    <div>
                      <Label className="text-xs">Texto do Botão</Label>
                      <Input value={btn.text} onChange={(e) => updateButton(idx, "text", e.target.value)} maxLength={25} />
                    </div>
                    {btn.type === "URL" && (
                      <div>
                        <Label className="text-xs">URL</Label>
                        <Input value={(btn as any).url || ""} onChange={(e) => updateButton(idx, "url", e.target.value)} placeholder="https://..." />
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            )}
          </Card>

          <Button variant="outline" onClick={handleAnalyze} disabled={aiAnalysis.isAnalyzing || !bodyText.trim()} className="w-full">
            {aiAnalysis.isAnalyzing ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />IA analisando (regras Meta 2026, categoria, duplicatas)...</>
            ) : (
              <><Sparkles className="h-4 w-4 mr-2" />Analisar com IA antes de enviar</>
            )}
          </Button>

          <Button onClick={handleSubmit} disabled={submitting} className="w-full">
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Enviando..." : fix ? "Reenviar para Aprovação" : "Cadastrar Template"}
          </Button>
        </div>

        <div>
          <Card className="sticky top-6">
            <CardHeader><CardTitle className="text-base">Preview</CardTitle></CardHeader>
            <CardContent>
              <div className="bg-muted rounded-lg p-4 max-w-sm mx-auto">
                <div className="bg-card rounded-lg p-3 shadow-sm space-y-2">
                  {headerText.trim() && <p className="font-bold text-sm">{headerText}</p>}
                  {bodyText.trim() ? <p className="text-sm whitespace-pre-wrap">{getPreviewText()}</p> :
                    <p className="text-sm text-muted-foreground italic">Digite o corpo...</p>}
                  {footerText.trim() && (<><Separator /><p className="text-xs text-muted-foreground">{footerText}</p></>)}
                  {buttons.length > 0 && (
                    <div className="pt-2 border-t space-y-1">
                      {buttons.map((btn, i) => (
                        <p key={i} className="text-sm text-blue-600 dark:text-blue-400 text-center">{btn.text || `Botão ${i + 1}`}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <Separator className="my-4" />
              <div className="space-y-2 text-xs text-muted-foreground">
                <p><strong>Nome:</strong> {sanitizeName(name) || "—"}</p>
                <p><strong>Categoria:</strong> {category}</p>
                <p><strong>Idioma:</strong> {language}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Laudo da IA */}
      {aiAnalysis.error && (
        <div className="border rounded-lg p-4 text-sm text-muted-foreground flex items-center justify-between gap-2">
          <span>Não foi possível analisar agora: {aiAnalysis.error}</span>
          <Button variant="outline" size="sm" onClick={handleAnalyze}>Tentar de novo</Button>
        </div>
      )}
      {aiAnalysis.report && !aiAnalysis.isAnalyzing && (
        <TemplateAnalysisReport
          report={aiAnalysis.report}
          onApplyRewrite={(text) => {
            setBodyText(text.slice(0, MAX_BODY_LEN));
            toast.success("Texto sugerido aplicado no corpo do template");
          }}
        />
      )}

      {/* Pré-voo reprovado: confirmar envio mesmo assim */}
      <AlertDialog open={overrideIssues !== null} onOpenChange={(open) => { if (!open) setOverrideIssues(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>A verificação encontrou erros que causam rejeição</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <ul className="list-disc list-inside space-y-1 text-sm mt-1">
                  {(overrideIssues || []).slice(0, 5).map((issue, i) => (
                    <li key={i}>{issue.message}</li>
                  ))}
                </ul>
                <p className="mt-3 text-xs">
                  Enviar assim provavelmente queima o nome do template (cada reenvio precisa de um nome novo).
                  Recomendado: corrigir antes, ou usar "Analisar com IA" pra ver a sugestão de reescrita.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e corrigir</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setOverrideIssues(null); doSubmit(); }}>
              Enviar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
