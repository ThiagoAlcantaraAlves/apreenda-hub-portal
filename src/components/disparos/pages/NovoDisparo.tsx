import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/integrations/disparos/api";
import { useAuth } from "@/integrations/disparos/auth";
import { useCredits } from "@/hooks/useCredits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Send, Upload, Search, Coins, Loader2, Sparkles, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { classifyTags, FRANCHISE_UNITS, KNOWN_UNITS } from "@/lib/disparos/contactTags";
import { useTemplateAnalysis, TemplateCategory } from "@/hooks/useTemplateAnalysis";
import { TemplateAnalysisReport, SafetyPlanList } from "@/components/disparos/TemplateAnalysisReport";

interface Template { name: string; language: string; category: string; components: any[]; status: string; }
interface Recipient { phone: string; name?: string; }
interface PastCampaign { id: string; template_name: string; created_at: string; total_recipients: number; }

const normalizePhone = (p: string) => {
  const digits = (p || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) return digits;
  if (digits.length === 10 || digits.length === 11) return "55" + digits;
  return digits;
};

const STEPS = ["Selecionar Template", "Destinatários", "Confirmar e Disparar"];

export default function NovoDisparo() {
  const { user, workspaceId } = useAuth();
  const { balance, refresh: refreshCredits } = useCredits();
  const [step, setStep] = useState(0);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);

  const [contacts, setContacts] = useState<any[]>([]);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [contactSearch, setContactSearch] = useState("");
  const [contactUnitFilter, setContactUnitFilter] = useState("");
  const [contactRoleFilter, setContactRoleFilter] = useState("");

  const [clients, setClients] = useState<any[]>([]);
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set());
  const [clientSearch, setClientSearch] = useState("");
  const [clientUnitFilter, setClientUnitFilter] = useState("");

  const [dispatching, setDispatching] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, total: 0 });
  const [sendSpeed, setSendSpeed] = useState<"fast" | "normal" | "safe">("normal");

  const [pastCampaigns, setPastCampaigns] = useState<PastCampaign[]>([]);
  const [excludeMode, setExcludeMode] = useState<"none" | "all" | "selected">("none");
  const [excludeCampaignIds, setExcludeCampaignIds] = useState<Set<string>>(new Set());
  const [excludedPhones, setExcludedPhones] = useState<Set<string>>(new Set());
  const [loadingExclusions, setLoadingExclusions] = useState(false);

  // IA especialista: laudo do template (passo 1) + pré-voo de segurança com tamanho da lista (passo 3)
  const aiAnalysis = useTemplateAnalysis();
  const preflight = useTemplateAnalysis();

  useEffect(() => {
    fetchTemplates(); fetchContacts(); fetchClients(); fetchPastCampaigns();
  }, []);

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await invokeWithAuth("disparos-fetch-templates");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTemplates(data?.templates || []);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setLoadingTemplates(false);
  };

  const fetchContacts = async () => {
    const { data } = await supabase.from("disparos_contacts" as any).select("*").order("name");
    setContacts((data || []) as any[]);
  };
  const fetchClients = async () => {
    const { data } = await supabase.from("disparos_clients" as any).select("*").order("name");
    setClients((data || []) as any[]);
  };
  const fetchPastCampaigns = async () => {
    const { data } = await supabase.from("disparos_campaigns" as any)
      .select("id, template_name, created_at, total_recipients")
      .order("created_at", { ascending: false }).limit(200);
    setPastCampaigns(((data || []) as any[]) as PastCampaign[]);
  };

  useEffect(() => {
    const loadExcluded = async () => {
      if (excludeMode === "none") { setExcludedPhones(new Set()); return; }
      setLoadingExclusions(true);
      try {
        let query: any = supabase.from("disparos_messages" as any)
          .select("contact_phone").in("status", ["sent", "delivered", "read"]);
        if (excludeMode === "selected") {
          const ids = Array.from(excludeCampaignIds);
          if (ids.length === 0) { setExcludedPhones(new Set()); setLoadingExclusions(false); return; }
          query = query.in("campaign_id", ids);
        }
        const { data } = await query.limit(50000);
        const set = new Set<string>();
        ((data || []) as any[]).forEach((m: any) => {
          const n = normalizePhone(m.contact_phone); if (n) set.add(n);
        });
        setExcludedPhones(set);
      } finally { setLoadingExclusions(false); }
    };
    loadExcluded();
  }, [excludeMode, excludeCampaignIds]);

  const clientUnits = [...new Set(clients.map((c) => c.unit).filter(Boolean))].sort();

  const getHeaderVariableSlots = (template: Template): string[] => {
    const headerComp = template.components?.find((c: any) => c.type === "HEADER");
    if (headerComp?.format !== "TEXT" || !headerComp?.text) return [];
    const matches = headerComp.text.match(/\{\{(\d+)\}\}/g) || [];
    return [...new Set(matches.map((m: string) => `header_${m}`))] as string[];
  };
  const getVariableSlots = (template: Template): string[] => {
    const bodyComp = template.components?.find((c: any) => c.type === "BODY");
    if (!bodyComp?.text) return [];
    return [...new Set(bodyComp.text.match(/\{\{(\d+)\}\}/g) || [])] as string[];
  };
  const getButtonVariableSlots = (template: Template): { buttonIndex: number; slot: string }[] => {
    const result: { buttonIndex: number; slot: string }[] = [];
    const btnComp = template.components?.find((c: any) => c.type === "BUTTONS");
    if (!btnComp?.buttons) return result;
    btnComp.buttons.forEach((btn: any, idx: number) => {
      if (btn.type === "URL" && btn.url) {
        (btn.url.match(/\{\{(\d+)\}\}/g) || []).forEach((m: string) => {
          result.push({ buttonIndex: idx, slot: `btn_${idx}_${m}` });
        });
      }
    });
    return result;
  };

  const getPreviewText = (template: Template): string => {
    const bodyComp = template.components?.find((c: any) => c.type === "BODY");
    if (!bodyComp?.text) return "";
    let text = bodyComp.text;
    Object.entries(variables).forEach(([key, val]) => { text = text.replace(key, val || key); });
    return text;
  };

  // Monta o input da análise IA a partir dos components do template
  const buildAnalysisInput = (template: Template) => {
    const headerComp = template.components?.find((c: any) => c.type === "HEADER");
    const bodyComp = template.components?.find((c: any) => c.type === "BODY");
    const footerComp = template.components?.find((c: any) => c.type === "FOOTER");
    const buttonsComp = template.components?.find((c: any) => c.type === "BUTTONS");
    return {
      bodyText: bodyComp?.text || "",
      declaredCategory: (template.category as TemplateCategory) || "MARKETING",
      templateName: template.name,
      headerText: headerComp?.format === "TEXT" ? headerComp.text || "" : "",
      footerText: footerComp?.text || "",
      buttons: (buttonsComp?.buttons || []).map((b: any) => ({ text: b.text, url: b.url })),
      checkDuplicates: false, // template já aprovado na WABA
    };
  };

  const handleSelectTemplate = (t: Template) => {
    setSelectedTemplate(t);
    setVariables(initVariablesForTemplate(t));
    const input = buildAnalysisInput(t);
    if (input.bodyText) aiAnalysis.analyze(input);
    else aiAnalysis.reset();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const raw = evt.target?.result;
      const wb = XLSX.read(raw, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any>(ws);
      const pickPhone = (r: any) => r.telefone || r.phone || r.Telefone || r.Phone || r.whatsapp || r.WhatsApp || r.Whatsapp || r.celular || r.Celular || "";
      const pickName = (r: any) => r.nome || r.name || r.Nome || r.Name || "";
      let parsed: Recipient[] = data.map((r: any) => ({
        phone: normalizePhone(String(pickPhone(r))), name: pickName(r) || "",
      })).filter((r) => r.phone.length >= 12);

      if (parsed.length === 0) {
        const text = typeof raw === "string" ? raw : new TextDecoder().decode(new Uint8Array(raw as ArrayBuffer));
        const lines = text.split(/\r?\n/).slice(1);
        const seen = new Set<string>();
        for (const line of lines) {
          if (!line.trim()) continue;
          let l = line.trim();
          if (l.startsWith('"') && l.endsWith('"')) l = l.slice(1, -1);
          l = l.replace(/""/g, '"');
          const fields = [...l.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
          let name = fields[0] || "";
          let phoneRaw = fields[1] || "";
          if (!/\d/.test(phoneRaw)) {
            const m = l.match(/\(?\d{2,3}\)?\s*\d{4,5}-?\d{4}/);
            phoneRaw = m?.[0] || "";
          }
          const phone = normalizePhone(phoneRaw);
          if (phone.length >= 12 && !seen.has(phone)) { seen.add(phone); parsed.push({ phone, name }); }
        }
      }
      setRecipients(parsed);
      if (parsed.length === 0) toast.error("Nenhum número válido encontrado");
      else toast.success(`${parsed.length} números carregados`);
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const getSelectedFromContacts = (): Recipient[] =>
    contacts.filter((c) => selectedContactIds.has(c.id)).map((c) => ({ phone: c.phone, name: c.name }));
  const getSelectedFromClients = (): Recipient[] =>
    clients.filter((c) => selectedClientIds.has(c.id)).map((c) => ({ phone: c.phone, name: c.name }));

  const allRecipients = step >= 1 ? [...recipients, ...getSelectedFromContacts(), ...getSelectedFromClients()] : [];
  const dedupedRecipients = Array.from(new Map(allRecipients.map((r) => [normalizePhone(r.phone), r])).values());
  const excludedCount = dedupedRecipients.filter((r) => excludedPhones.has(normalizePhone(r.phone))).length;
  const uniqueRecipients = dedupedRecipients.filter((r) => !excludedPhones.has(normalizePhone(r.phone)));

  // Pré-voo no passo de confirmação: regras determinísticas + plano calibrado pelo tamanho da lista
  useEffect(() => {
    if (step !== 2 || !selectedTemplate) return;
    const input = buildAnalysisInput(selectedTemplate);
    if (!input.bodyText) return;
    preflight.analyze({ ...input, skipAI: true, recipientCount: uniqueRecipients.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, selectedTemplate, uniqueRecipients.length]);

  const SPEED_PRESETS = {
    fast:   { concurrency: 10, batchDelay: 0,   rate: 10 },
    normal: { concurrency: 5,  batchDelay: 200, rate: 5  },
    safe:   { concurrency: 3,  batchDelay: 500, rate: 1.5 },
  } as const;
  const speedCfg = SPEED_PRESETS[sendSpeed];
  const CONCURRENCY = speedCfg.concurrency;

  const initVariablesForTemplate = (t: Template): Record<string, string> => {
    const init: Record<string, string> = {};
    const body = getVariableSlots(t);
    const header = getHeaderVariableSlots(t);
    if (body.length > 0) init[body[0]] = "{{primeiro_nome}}";
    if (header.length > 0) init[header[0]] = "{{primeiro_nome}}";
    return init;
  };

  const resolveValue = (raw: string, recipient: Recipient): string => {
    const firstName = (recipient.name || "").trim().split(/\s+/)[0] || "";
    const fullName = (recipient.name || "").trim();
    return raw
      .replace(/\{\{\s*primeiro_nome\s*\}\}/gi, firstName || "cliente")
      .replace(/\{\{\s*nome\s*\}\}/gi, fullName || "cliente")
      .replace(/\{\{\s*telefone\s*\}\}/gi, recipient.phone || "");
  };

  const buildComponentsForRecipient = (recipient: Recipient) => {
    if (!selectedTemplate) return [];
    const headerSlots = getHeaderVariableSlots(selectedTemplate);
    const varSlots = getVariableSlots(selectedTemplate);
    const btnSlots = getButtonVariableSlots(selectedTemplate);
    const components: any[] = [];
    if (headerSlots.length > 0) {
      components.push({ type: "header", parameters: headerSlots.map((slot) => ({ type: "text", text: resolveValue(variables[slot] || "", recipient) })) });
    }
    if (varSlots.length > 0) {
      components.push({ type: "body", parameters: varSlots.map((slot) => ({ type: "text", text: resolveValue(variables[slot] || "", recipient) })) });
    }
    if (btnSlots.length > 0) {
      const byButton = new Map<number, string[]>();
      btnSlots.forEach(({ buttonIndex, slot }) => {
        if (!byButton.has(buttonIndex)) byButton.set(buttonIndex, []);
        byButton.get(buttonIndex)!.push(slot);
      });
      byButton.forEach((slots, idx) => {
        components.push({
          type: "button", sub_type: "url", index: String(idx),
          parameters: slots.map((slot) => ({ type: "text", text: resolveValue(variables[slot] || "", recipient) })),
        });
      });
    }
    return components;
  };

  const handleDispatch = async () => {
    if (!selectedTemplate || uniqueRecipients.length === 0) return;
    const headerSlots = getHeaderVariableSlots(selectedTemplate);
    const varSlots = getVariableSlots(selectedTemplate);
    const btnSlots = getButtonVariableSlots(selectedTemplate);
    const allSlots = [...headerSlots, ...varSlots, ...btnSlots.map((b) => b.slot)];
    const missing = allSlots.filter((s) => !variables[s]?.trim());
    if (missing.length > 0) { toast.error(`Preencha as variáveis: ${missing.join(", ")}`); return; }

    setDispatching(true);
    setProgress({ sent: 0, total: uniqueRecipients.length });
    const campaignStart = performance.now();

    try {
      if (!workspaceId) throw new Error("Sessão inválida");
      const { data: campaign, error: campError } = await (supabase.from("disparos_campaigns" as any) as any).insert({
        user_id: workspaceId,
        template_name: selectedTemplate.name,
        template_language: selectedTemplate.language,
        variables,
        total_recipients: uniqueRecipients.length,
        status: "in_progress",
      }).select().single();
      if (campError) throw campError;

      const messageRecords = uniqueRecipients.map((r) => ({
        user_id: workspaceId,
        campaign_id: campaign.id,
        contact_phone: r.phone,
        contact_name: r.name || null,
        status: "pending",
      }));
      await (supabase.from("disparos_messages" as any) as any).insert(messageRecords);

      let sentCount = 0;
      const sendTimes: number[] = [];
      let creditConsumed = false; // ensure consume happens only once (first message)

      const sendOne = async (recipient: Recipient, isFirst: boolean) => {
        const started = performance.now();
        try {
          const components = buildComponentsForRecipient(recipient);
          const { data, error } = await invokeWithAuth("disparos-send-whatsapp", {
            body: {
              phone: recipient.phone,
              template_name: selectedTemplate.name,
              language: selectedTemplate.language,
              components,
              campaign_id: campaign.id,
            },
          });
          if (isFirst && !error && !data?.error) creditConsumed = true;


          const elapsed = Math.round(performance.now() - started);
          sendTimes.push(elapsed);
          const status = error || data?.error ? "failed" : "sent";
          const errorMessage = error?.message || data?.error || null;
          const messageId = data?.message_id || null;

          await (supabase.from("disparos_messages" as any) as any).update({
            status, error_message: errorMessage, whatsapp_message_id: messageId,
            sent_at: status === "sent" ? new Date().toISOString() : null,
            send_time_ms: elapsed,
          }).eq("campaign_id", campaign.id).eq("contact_phone", recipient.phone);
        } catch {
          const elapsed = Math.round(performance.now() - started);
          sendTimes.push(elapsed);
          await (supabase.from("disparos_messages" as any) as any).update({
            status: "failed", error_message: "Erro de rede", send_time_ms: elapsed,
          }).eq("campaign_id", campaign.id).eq("contact_phone", recipient.phone);
        }
        sentCount++;
        setProgress({ sent: sentCount, total: uniqueRecipients.length });
      };

      // First message alone (so the credit consume runs and can fail-fast)
      await sendOne(uniqueRecipients[0], true);

      for (let i = 1; i < uniqueRecipients.length; i += CONCURRENCY) {
        const batch = uniqueRecipients.slice(i, i + CONCURRENCY);
        await Promise.all(batch.map((r) => sendOne(r, false)));
        if (speedCfg.batchDelay > 0 && i + CONCURRENCY < uniqueRecipients.length) {
          await new Promise((r) => setTimeout(r, speedCfg.batchDelay));
        }
      }

      const totalDuration = Math.round(performance.now() - campaignStart);
      const avgSendTime = sendTimes.length > 0 ? Math.round(sendTimes.reduce((a, b) => a + b, 0) / sendTimes.length) : null;

      await (supabase.from("disparos_campaigns" as any) as any).update({
        status: "completed", completed_at: new Date().toISOString(),
        avg_send_time_ms: avgSendTime, total_duration_ms: totalDuration,
      }).eq("id", campaign.id);

      toast.success(`Disparo concluído em ${(totalDuration / 1000).toFixed(1)}s. 1 crédito consumido.`);
      refreshCredits();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setDispatching(false);
  };

  const { units: knownUnits, roles: knownRoles } = classifyTags(contacts);

  const filteredContacts = contacts.filter((c) => {
    const tags = c.tags || [];
    const matchSearch = !contactSearch || c.name.toLowerCase().includes(contactSearch.toLowerCase()) || c.phone.includes(contactSearch);
    let matchUnit = true;
    if (contactUnitFilter === "__own") matchUnit = tags.some((t: string) => KNOWN_UNITS.has(t) && !FRANCHISE_UNITS.has(t));
    else if (contactUnitFilter === "__franchise") matchUnit = tags.some((t: string) => FRANCHISE_UNITS.has(t));
    else if (contactUnitFilter) matchUnit = tags.includes(contactUnitFilter);
    const matchRole = !contactRoleFilter || tags.includes(contactRoleFilter);
    return matchSearch && matchUnit && matchRole;
  });

  const filteredClients = clients.filter((c) => {
    const matchSearch = !clientSearch || c.name.toLowerCase().includes(clientSearch.toLowerCase()) || c.phone.includes(clientSearch);
    const matchUnit = !clientUnitFilter || c.unit === clientUnitFilter;
    return matchSearch && matchUnit;
  });

  const totalSelected = recipients.length + selectedContactIds.size + selectedClientIds.size;
  const currentBalance = balance?.total ?? 0;
  const insufficientCredits = currentBalance < 1;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Novo Disparo</h1>

      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
            <span className={`text-sm ${i <= step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <Separator className="w-8" />}
          </div>
        ))}
      </div>

      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Selecionar Template</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {loadingTemplates ? <p className="text-muted-foreground">Carregando templates...</p> : templates.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Nenhum template encontrado. Configure a API primeiro.</p>
                <Button variant="outline" className="mt-2" onClick={fetchTemplates}>Tentar novamente</Button>
              </div>
            ) : (
              <div className="grid gap-3">
                {templates.map((t) => (
                  <div key={`${t.name}-${t.language}`}
                    onClick={() => handleSelectTemplate(t)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${selectedTemplate?.name === t.name ? "border-primary bg-primary/5" : "hover:border-muted-foreground/30"}`}>
                    <p className="font-medium">{t.name}</p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary" className="text-xs">{t.language}</Badge>
                      <Badge variant="secondary" className="text-xs">{t.category}</Badge>
                      <Badge variant={t.status === "APPROVED" ? "default" : "outline"} className="text-xs">{t.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedTemplate && (
              <>
                <Separator />
                <div>
                  <Label className="text-sm font-medium mb-2 block">Preview</Label>
                  <div className="bg-muted rounded-lg p-4 max-w-sm">
                    <div className="bg-card rounded-lg p-3 shadow-sm">
                      <p className="text-sm whitespace-pre-wrap">{getPreviewText(selectedTemplate)}</p>
                    </div>
                  </div>
                </div>

                {[...getHeaderVariableSlots(selectedTemplate), ...getVariableSlots(selectedTemplate)].length > 0 && (
                  <div className="bg-muted/40 border rounded-md p-3 text-xs text-muted-foreground">
                    Tokens: <code className="bg-background px-1 rounded">{"{{primeiro_nome}}"}</code>, <code className="bg-background px-1 rounded">{"{{nome}}"}</code>, <code className="bg-background px-1 rounded">{"{{telefone}}"}</code>.
                  </div>
                )}

                {getHeaderVariableSlots(selectedTemplate).map((slot) => (
                  <div key={slot}>
                    <Label className="text-xs text-muted-foreground">Cabeçalho {slot.replace(/^header_/, "")}</Label>
                    <Input value={variables[slot] || ""} onChange={(e) => setVariables({ ...variables, [slot]: e.target.value })} />
                  </div>
                ))}
                {getVariableSlots(selectedTemplate).map((slot) => (
                  <div key={slot}>
                    <Label className="text-xs text-muted-foreground">{slot}</Label>
                    <Input value={variables[slot] || ""} onChange={(e) => setVariables({ ...variables, [slot]: e.target.value })} />
                  </div>
                ))}

                {/* Análise IA do template selecionado */}
                {aiAnalysis.isAnalyzing && (
                  <div className="border rounded-lg p-4 flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <Sparkles className="h-4 w-4 text-primary" />
                    IA analisando o template (regras Meta 2026, categoria e riscos)...
                  </div>
                )}
                {!aiAnalysis.isAnalyzing && aiAnalysis.report && (
                  <TemplateAnalysisReport report={aiAnalysis.report} hideSafetyPlan />
                )}
              </>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setStep(1)} disabled={!selectedTemplate}>Próximo <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Selecionar Destinatários</CardTitle>
              {totalSelected > 0 && (
                <div className="flex items-center gap-2">
                  <Badge>{uniqueRecipients.length} a enviar</Badge>
                  {excludedCount > 0 && <Badge variant="secondary">{excludedCount} excluído(s)</Badge>}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-md p-3 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <Label className="text-sm font-medium">Excluir já enviados</Label>
                <select className="border rounded-md px-3 py-2 text-sm bg-card" value={excludeMode}
                  onChange={(e) => {
                    const v = e.target.value as any; setExcludeMode(v);
                    if (v !== "selected") setExcludeCampaignIds(new Set());
                  }}>
                  <option value="none">Não excluir ninguém</option>
                  <option value="all">Excluir quem já recebeu qualquer campanha</option>
                  <option value="selected">Excluir de campanhas específicas</option>
                </select>
              </div>
              {excludeMode === "selected" && (
                <div className="max-h-48 overflow-y-auto border rounded-md bg-card">
                  {pastCampaigns.length === 0 ? <p className="text-sm text-muted-foreground p-3">Nenhuma campanha anterior.</p> :
                    pastCampaigns.map((c) => (
                      <label key={c.id} className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer border-b last:border-b-0">
                        <Checkbox checked={excludeCampaignIds.has(c.id)}
                          onCheckedChange={(checked) => {
                            const next = new Set(excludeCampaignIds);
                            if (checked) next.add(c.id); else next.delete(c.id);
                            setExcludeCampaignIds(next);
                          }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{c.template_name}</p>
                          <p className="text-xs text-muted-foreground">{new Date(c.created_at).toLocaleString("pt-BR")} · {c.total_recipients}</p>
                        </div>
                      </label>
                    ))
                  }
                </div>
              )}
              {excludeMode !== "none" && (
                <p className="text-xs text-muted-foreground">
                  {loadingExclusions ? "Carregando..." : `${excludedPhones.size} telefone(s) na exclusão. ${excludedCount} removidos do disparo.`}
                </p>
              )}
            </div>

            <Tabs defaultValue="upload">
              <TabsList>
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="contacts">Contatos</TabsTrigger>
                <TabsTrigger value="clients">Clientes</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-4">
                <label>
                  <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
                  <Button variant="outline" asChild><span><Upload className="h-4 w-4 mr-2" />Upload CSV/XLSX</span></Button>
                </label>
                {recipients.length > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">{recipients.length} números carregados</p>
                    <Table>
                      <TableHeader><TableRow><TableHead>Telefone</TableHead><TableHead>Nome</TableHead></TableRow></TableHeader>
                      <TableBody>
                        {recipients.slice(0, 10).map((r, i) => (
                          <TableRow key={i}><TableCell className="font-mono text-sm">{r.phone}</TableCell><TableCell>{r.name || "—"}</TableCell></TableRow>
                        ))}
                        {recipients.length > 10 && <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground">... e mais {recipients.length - 10}</TableCell></TableRow>}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="contacts" className="space-y-4">
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar..." value={contactSearch} onChange={(e) => setContactSearch(e.target.value)} className="pl-10" />
                  </div>
                  <select className="border rounded-md px-3 py-2 text-sm bg-card" value={contactUnitFilter} onChange={(e) => setContactUnitFilter(e.target.value)}>
                    <option value="">Todas as unidades</option>
                    <option value="__own">Próprias</option>
                    <option value="__franchise">Franquias</option>
                    {knownUnits.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select className="border rounded-md px-3 py-2 text-sm bg-card" value={contactRoleFilter} onChange={(e) => setContactRoleFilter(e.target.value)}>
                    <option value="">Todas funções</option>
                    {knownRoles.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <Button variant="outline" size="sm" onClick={() => {
                    const filteredIds = new Set(filteredContacts.map((c) => c.id));
                    const allSelected = filteredContacts.length > 0 && filteredContacts.every((c) => selectedContactIds.has(c.id));
                    if (allSelected) { const next = new Set(selectedContactIds); filteredIds.forEach((id) => next.delete(id)); setSelectedContactIds(next); }
                    else { const next = new Set(selectedContactIds); filteredIds.forEach((id) => next.add(id)); setSelectedContactIds(next); }
                  }}>
                    {filteredContacts.length > 0 && filteredContacts.every((c) => selectedContactIds.has(c.id)) ? "Desmarcar" : "Selecionar todos"}
                  </Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Tags</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredContacts.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Checkbox checked={selectedContactIds.has(c.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedContactIds);
                              if (checked) next.add(c.id); else next.delete(c.id);
                              setSelectedContactIds(next);
                            }} />
                        </TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                        <TableCell><div className="flex gap-1">{(c.tags || []).map((t: string) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}</div></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="clients" className="space-y-4">
                <div className="flex gap-2 items-center flex-wrap">
                  <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Buscar cliente..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="pl-10" />
                  </div>
                  <select className="border rounded-md px-3 py-2 text-sm bg-card" value={clientUnitFilter} onChange={(e) => setClientUnitFilter(e.target.value)}>
                    <option value="">Todas unidades</option>
                    {clientUnits.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                  <Button variant="outline" size="sm" onClick={() => {
                    const filteredIds = new Set(filteredClients.map((c) => c.id));
                    const allSelected = filteredClients.length > 0 && filteredClients.every((c) => selectedClientIds.has(c.id));
                    if (allSelected) { const next = new Set(selectedClientIds); filteredIds.forEach((id) => next.delete(id)); setSelectedClientIds(next); }
                    else { const next = new Set(selectedClientIds); filteredIds.forEach((id) => next.add(id)); setSelectedClientIds(next); }
                  }}>
                    {filteredClients.length > 0 && filteredClients.every((c) => selectedClientIds.has(c.id)) ? "Desmarcar" : "Selecionar todos"}
                  </Button>
                </div>
                <Table>
                  <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Unidade</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {filteredClients.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <Checkbox checked={selectedClientIds.has(c.id)}
                            onCheckedChange={(checked) => {
                              const next = new Set(selectedClientIds);
                              if (checked) next.add(c.id); else next.delete(c.id);
                              setSelectedClientIds(next);
                            }} />
                        </TableCell>
                        <TableCell>{c.name}</TableCell>
                        <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                        <TableCell><Badge variant="secondary" className="text-xs">{c.unit}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(0)}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
              <Button onClick={() => setStep(2)} disabled={totalSelected === 0}>Próximo <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Confirmar e Disparar</CardTitle></CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div><Label className="text-muted-foreground text-xs">Template</Label><p className="font-medium">{selectedTemplate?.name}</p></div>
                <div><Label className="text-muted-foreground text-xs">Idioma</Label><p>{selectedTemplate?.language}</p></div>
                <div><Label className="text-muted-foreground text-xs">Destinatários</Label><p className="font-medium text-lg">{uniqueRecipients.length}</p></div>
                <div><Label className="text-muted-foreground text-xs">Tempo estimado</Label><p>~{Math.ceil(uniqueRecipients.length / speedCfg.rate)} segundos</p></div>
                <div className="flex items-center gap-2 rounded-md border border-accent/30 bg-accent/5 p-3">
                  <Coins className="h-5 w-5 text-accent shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-foreground">Este disparo consome <strong>1 crédito</strong>.</p>
                    <p className="text-xs text-muted-foreground">Saldo atual: {currentBalance} · Cobrado uma vez por campanha, independente do número de contatos.</p>
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground text-xs mb-1 block">Velocidade de envio</Label>
                  <Select value={sendSpeed} onValueChange={(v) => setSendSpeed(v as any)} disabled={dispatching}>
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fast">Rápido — ~10 msg/s</SelectItem>
                      <SelectItem value="normal">Normal — ~5 msg/s (recomendado)</SelectItem>
                      <SelectItem value="safe">Seguro — ~1,5 msg/s</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs mb-2 block">Preview</Label>
                <div className="bg-muted rounded-lg p-4">
                  <div className="bg-card rounded-lg p-3 shadow-sm">
                    <p className="text-sm whitespace-pre-wrap">{selectedTemplate ? getPreviewText(selectedTemplate) : ""}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Pré-voo de segurança da IA */}
            {aiAnalysis.report && aiAnalysis.report.verdict !== "APROVADO" && (
              <div className={`p-4 rounded-lg border flex gap-3 ${aiAnalysis.report.verdict === "REPROVADO" ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30" : "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30"}`}>
                <ShieldAlert className={`h-5 w-5 shrink-0 mt-0.5 ${aiAnalysis.report.verdict === "REPROVADO" ? "text-red-600 dark:text-red-400" : "text-yellow-600 dark:text-yellow-400"}`} />
                <div className="text-sm min-w-0">
                  <p className="font-medium mb-1">
                    {aiAnalysis.report.verdict === "REPROVADO"
                      ? "A IA encontrou riscos sérios neste template"
                      : "A IA encontrou pontos de atenção neste template"}
                  </p>
                  <ul className="list-disc list-inside space-y-0.5 text-xs opacity-90">
                    {aiAnalysis.report.issues.filter((i) => i.severity !== "info").slice(0, 3).map((issue, i) => (
                      <li key={i}>{issue.message}</li>
                    ))}
                  </ul>
                  <p className="text-xs mt-1.5 opacity-75">Disparar assim pode derrubar a qualidade do número. Veja o laudo completo no passo 1.</p>
                </div>
              </div>
            )}

            {preflight.report && preflight.report.safetyPlan.length > 0 && (
              <div className="p-4 border rounded-lg space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" />
                  Antes de disparar — checklist do especialista
                </p>
                <SafetyPlanList items={preflight.report.safetyPlan} max={4} />
              </div>
            )}

            {dispatching && (
              <div className="space-y-2">
                <Progress value={(progress.sent / progress.total) * 100} />
                <p className="text-sm text-center text-muted-foreground">
                  {progress.sent} de {progress.total} enviadas ({Math.round((progress.sent / progress.total) * 100)}%)
                </p>
              </div>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} disabled={dispatching}><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button disabled={dispatching || insufficientCredits}>
                    <Send className="mr-2 h-4 w-4" />
                    {dispatching ? "Enviando..." : insufficientCredits ? "Sem créditos" : "Iniciar Disparo"}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Este disparo vai consumir 1 crédito. Confirmar?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Serão enviadas <strong>{uniqueRecipients.length} mensagens</strong> usando o template
                      "<strong>{selectedTemplate?.name}</strong>". O custo no Hub é de <strong>1 crédito</strong>{" "}
                      (cobrado uma única vez para a campanha inteira).<br /><br />
                      Saldo atual: <strong>{currentBalance}</strong> → após disparo: <strong>{currentBalance - 1}</strong>.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDispatch}>Confirmar e Disparar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
