import { useState } from "react";
import {
  ShieldCheck, ShieldAlert, ShieldX, AlertTriangle, Info, XCircle,
  Sparkles, Copy, Check, ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { TemplateAnalysisReportData, AnalysisIssue, AnalysisSeverity, SafetyItem } from "@/hooks/useTemplateAnalysis";

const VERDICT_CONFIG = {
  APROVADO: {
    icon: ShieldCheck,
    label: "Aprovado",
    badge: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800",
    bar: "bg-green-500",
  },
  ATENCAO: {
    icon: ShieldAlert,
    label: "Atenção",
    badge: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-800",
    bar: "bg-yellow-500",
  },
  REPROVADO: {
    icon: ShieldX,
    label: "Alto risco",
    badge: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800",
    bar: "bg-red-500",
  },
} as const;

const RISK_LABEL: Record<string, string> = { baixo: "baixo", medio: "médio", alto: "ALTO" };

const SEVERITY_ICON: Record<AnalysisSeverity, typeof Info> = {
  erro: XCircle,
  atencao: AlertTriangle,
  info: Info,
};

const SEVERITY_STYLE: Record<AnalysisSeverity, string> = {
  erro: "text-red-600 dark:text-red-400",
  atencao: "text-yellow-600 dark:text-yellow-400",
  info: "text-muted-foreground",
};

function IssueRow({ issue }: { issue: AnalysisIssue }) {
  const Icon = SEVERITY_ICON[issue.severity];
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY_STYLE[issue.severity]}`} />
      <div className="min-w-0">
        <p>{issue.message}</p>
        {issue.fix && <p className="text-xs text-muted-foreground mt-0.5">💡 {issue.fix}</p>}
      </div>
    </div>
  );
}

/** Lista compacta de recomendações de disparo seguro (usada também no passo de confirmação). */
export function SafetyPlanList({ items, max }: { items: SafetyItem[]; max?: number }) {
  const list = max ? items.slice(0, max) : items;
  return (
    <div className="space-y-3">
      {list.map((item, i) => {
        const Icon = SEVERITY_ICON[item.severity];
        return (
          <div key={i} className="flex items-start gap-2 text-sm">
            <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${SEVERITY_STYLE[item.severity]}`} />
            <div>
              <p className="font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface TemplateAnalysisReportProps {
  report: TemplateAnalysisReportData;
  /** Esconde o plano de disparo seguro (quando ele é mostrado em outro passo) */
  hideSafetyPlan?: boolean;
  /** Aplica o texto sugerido pela IA no formulário */
  onApplyRewrite?: (text: string) => void;
}

export function TemplateAnalysisReport({ report, hideSafetyPlan = false, onApplyRewrite }: TemplateAnalysisReportProps) {
  const [copied, setCopied] = useState(false);
  const [safetyOpen, setSafetyOpen] = useState(false);

  const config = VERDICT_CONFIG[report.verdict];
  const VerdictIcon = config.icon;

  const errors = report.issues.filter((i) => i.severity === "erro");
  const warnings = report.issues.filter((i) => i.severity === "atencao");
  const infos = report.issues.filter((i) => i.severity === "info");

  const handleCopyRewrite = async () => {
    if (!report.aiAnalysis.rewriteSuggestion) return;
    try {
      await navigator.clipboard.writeText(report.aiAnalysis.rewriteSuggestion);
      setCopied(true);
      toast.success("Sugestão copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Cabeçalho do laudo */}
      <div className="p-4 bg-muted/30 border-b space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-medium text-sm">Análise da IA — Especialista em Templates</span>
          </div>
          <Badge variant="outline" className={config.badge}>
            <VerdictIcon className="h-3.5 w-3.5 mr-1" />
            {config.label}
          </Badge>
        </div>

        {/* Score */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Pontuação de conformidade</span>
            <span className="font-medium">{report.score}/100</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${config.bar}`} style={{ width: `${report.score}%` }} />
          </div>
        </div>

        {/* Categoria e riscos */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Categoria: <strong className="text-foreground">{report.declaredCategory}</strong>
            {report.categoryMismatch && (
              <span className="text-yellow-700 dark:text-yellow-400"> → IA detectou {report.detectedCategory}</span>
            )}
          </span>
          <span>
            Risco de reclassificação:{" "}
            <strong className={report.reclassificationRisk === "alto" ? "text-red-600 dark:text-red-400" : report.reclassificationRisk === "medio" ? "text-yellow-700 dark:text-yellow-400" : "text-foreground"}>
              {RISK_LABEL[report.reclassificationRisk]}
            </strong>
          </span>
          <span>
            {report.stats.chars}/{report.stats.maxChars} caracteres · {report.stats.emojis}/{report.stats.maxEmojis} emojis · {report.stats.variables} variáveis
          </span>
        </div>

        {report.aiAnalysis.summary && <p className="text-sm">{report.aiAnalysis.summary}</p>}
        {!report.aiAnalysis.available && (
          <p className="text-xs text-muted-foreground">
            Análise semântica da IA indisponível — laudo baseado apenas nas regras determinísticas da Meta.
          </p>
        )}
      </div>

      {/* Problemas */}
      {report.issues.length > 0 ? (
        <div className="p-4 space-y-2.5">
          {errors.map((issue, i) => <IssueRow key={`e-${i}`} issue={issue} />)}
          {warnings.map((issue, i) => <IssueRow key={`w-${i}`} issue={issue} />)}
          {infos.map((issue, i) => <IssueRow key={`i-${i}`} issue={issue} />)}
        </div>
      ) : (
        <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
          Nenhum problema encontrado. Template dentro das regras da Meta 2026.
        </div>
      )}

      {/* Sugestão de reescrita */}
      {report.aiAnalysis.rewriteSuggestion && (
        <div className="px-4 pb-4">
          <div className="p-3 rounded-lg border border-primary/30 bg-primary/5 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-1">
              <span className="text-xs font-medium flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Versão sugerida pela IA
              </span>
              <div className="flex gap-1">
                {onApplyRewrite && (
                  <Button
                    variant="ghost" size="sm" className="h-7 px-2 text-xs"
                    onClick={() => onApplyRewrite(report.aiAnalysis.rewriteSuggestion!)}
                  >
                    <Check className="h-3.5 w-3.5 mr-1" />
                    Aplicar no formulário
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopyRewrite}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  <span className="ml-1">{copied ? "Copiado" : "Copiar"}</span>
                </Button>
              </div>
            </div>
            <p className="text-sm whitespace-pre-wrap">{report.aiAnalysis.rewriteSuggestion}</p>
          </div>
        </div>
      )}

      {/* Duplicatas */}
      {report.duplicates.length > 0 && (
        <div className="px-4 pb-4">
          <p className="text-xs text-muted-foreground">
            Templates parecidos na sua WABA:{" "}
            {report.duplicates.map((d) => `${d.name} (${Math.round(d.similarity * 100)}%)`).join(", ")}
          </p>
        </div>
      )}

      {/* Plano de disparo seguro */}
      {!hideSafetyPlan && report.safetyPlan.length > 0 && (
        <Collapsible open={safetyOpen} onOpenChange={setSafetyOpen}>
          <CollapsibleTrigger asChild>
            <button className="w-full px-4 py-3 border-t flex items-center justify-between text-sm font-medium hover:bg-muted/50 transition-colors">
              <span className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Plano de disparo seguro ({report.safetyPlan.length} recomendações)
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${safetyOpen ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 pt-1">
              <SafetyPlanList items={report.safetyPlan} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      <div className="px-4 py-2 border-t bg-muted/20">
        <p className="text-[11px] text-muted-foreground">
          Análise automática (regras Meta 2026 + IA). Não substitui a revisão oficial da Meta.
        </p>
      </div>
    </div>
  );
}
