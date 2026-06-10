import { useState, useCallback, useRef } from "react";
import { invokeWithAuth } from "@/integrations/disparos/api";

export type AnalysisSeverity = "erro" | "atencao" | "info";
export type AnalysisVerdict = "APROVADO" | "ATENCAO" | "REPROVADO";
export type TemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";

export interface AnalysisIssue {
  layer: "sintaxe" | "links" | "politica" | "categoria" | "duplicata" | "ia";
  severity: AnalysisSeverity;
  code: string;
  message: string;
  fix?: string;
  excerpt?: string;
}

export interface SafetyItem {
  severity: AnalysisSeverity;
  title: string;
  detail: string;
}

export interface TemplateAnalysisReportData {
  verdict: AnalysisVerdict;
  score: number;
  declaredCategory: TemplateCategory;
  detectedCategory: TemplateCategory;
  categoryMismatch: boolean;
  reclassificationRisk: "baixo" | "medio" | "alto";
  blockRisk: "baixo" | "medio" | "alto";
  stats: {
    chars: number;
    maxChars: number;
    emojis: number;
    maxEmojis: number;
    variables: number;
    links: number;
  };
  issues: AnalysisIssue[];
  duplicates: { name: string; language: string; similarity: number }[];
  aiAnalysis: {
    available: boolean;
    summary: string | null;
    confidence: number | null;
    rewriteSuggestion: string | null;
  };
  safetyPlan: SafetyItem[];
  analyzedAt: string;
}

export interface TemplateAnalysisInput {
  bodyText: string;
  declaredCategory: TemplateCategory;
  templateName?: string;
  headerText?: string;
  footerText?: string;
  buttons?: { text?: string; url?: string }[];
  recipientCount?: number;
  /** true = só regras determinísticas (rápido, sem custo de IA) */
  skipAI?: boolean;
  /** false = pula a busca de duplicatas na WABA */
  checkDuplicates?: boolean;
}

// Cache por conteúdo — evita re-chamar a IA ao navegar entre passos
const analysisCache = new Map<string, TemplateAnalysisReportData>();

export function useTemplateAnalysis() {
  const [report, setReport] = useState<TemplateAnalysisReportData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);

  const analyze = useCallback(async (input: TemplateAnalysisInput): Promise<TemplateAnalysisReportData | null> => {
    const cacheKey = JSON.stringify(input);
    const cached = analysisCache.get(cacheKey);
    if (cached) {
      setReport(cached);
      setError(null);
      return cached;
    }

    const seq = ++requestSeq.current;
    setIsAnalyzing(true);
    setError(null);

    try {
      const { data, error: fnError } = await invokeWithAuth("disparos-analyze-template", { body: input });
      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);
      if (!data?.success || !data?.report) throw new Error("Falha na análise");

      const result = data.report as TemplateAnalysisReportData;
      analysisCache.set(cacheKey, result);

      // Ignora respostas de seleções antigas (usuário trocou de template no meio)
      if (seq === requestSeq.current) setReport(result);
      return result;
    } catch (err: any) {
      if (seq === requestSeq.current) {
        setError(err.message || "Erro ao analisar template");
        setReport(null);
      }
      return null;
    } finally {
      if (seq === requestSeq.current) setIsAnalyzing(false);
    }
  }, []);

  const reset = useCallback(() => {
    requestSeq.current++;
    setReport(null);
    setError(null);
    setIsAnalyzing(false);
  }, []);

  return { report, isAnalyzing, error, analyze, reset };
}
