import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeWithAuth } from "@/integrations/disparos/api";
import { useAuth } from "@/integrations/disparos/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Template { name: string; language: string; category: string; components: any[]; status: string; }

const STATUS_LABEL: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "secondary" },
  processing: { label: "Processando", variant: "default" },
  completed: { label: "Concluído", variant: "outline" },
  cancelled: { label: "Cancelado", variant: "outline" },
  failed: { label: "Falhou", variant: "destructive" },
};

function toLocalInputValue(iso?: string) {
  const d = iso ? new Date(iso) : new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function parsePhones(text: string) {
  return text.split(/[\n,;]/).map((l) => l.trim()).filter(Boolean).map((line) => {
    const [rawPhone, ...rest] = line.split(/[\t|]/);
    const phone = (rawPhone || "").replace(/\D/g, "");
    return { phone, name: rest.join(" ").trim() || undefined };
  }).filter((r) => r.phone.length >= 10);
}

export default function Agendamentos() {
  const { workspaceId } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateKey, setTemplateKey] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [recipientsText, setRecipientsText] = useState("");
  const [scheduledFor, setScheduledFor] = useState(toLocalInputValue());

  useEffect(() => { if (workspaceId) { fetchAll(); fetchTemplates(); } }, [workspaceId]);

  const fetchAll = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("disparos_scheduled_campaigns" as any).select("*").order("scheduled_for", { ascending: true });
    if (error) toast.error("Erro: " + error.message);
    else setItems((data || []) as any[]);
    setLoading(false);
  };

  const fetchTemplates = async () => {
    try {
      const { data } = await invokeWithAuth("disparos-fetch-templates");
      setTemplates((data?.templates || []).filter((t: Template) => t.status === "APPROVED"));
    } catch {}
  };

  const selectedTemplate = templates.find((t) => `${t.name}|${t.language}` === templateKey) || null;
  const variableSlots = (() => {
    if (!selectedTemplate) return [];
    const body = selectedTemplate.components?.find((c: any) => c.type === "BODY");
    if (!body?.text) return [];
    return Array.from(new Set(body.text.match(/\{\{\d+\}\}/g) || [])) as string[];
  })();

  const resetForm = () => {
    setTemplateKey(""); setVariables({}); setRecipientsText(""); setScheduledFor(toLocalInputValue());
  };

  const handleSave = async () => {
    if (!selectedTemplate) { toast.error("Selecione um template"); return; }
    const recipients = parsePhones(recipientsText);
    if (recipients.length === 0) { toast.error("Adicione destinatários"); return; }
    const when = new Date(scheduledFor);
    if (isNaN(when.getTime()) || when.getTime() < Date.now() - 60_000) {
      toast.error("Data inválida ou no passado"); return;
    }
    const missing = variableSlots.filter((s) => !variables[s]?.trim());
    if (missing.length > 0) { toast.error(`Preencha: ${missing.join(", ")}`); return; }

    const { error } = await (supabase.from("disparos_scheduled_campaigns" as any) as any).insert({
      user_id: workspaceId,
      template_name: selectedTemplate.name,
      template_language: selectedTemplate.language,
      variables, recipients,
      scheduled_for: when.toISOString(), status: "pending",
    });
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Agendamento criado. Cobrança de 1 crédito ocorrerá quando disparar.");
    setDialogOpen(false); resetForm(); fetchAll();
  };

  const cancelItem = async (id: string) => {
    await (supabase.from("disparos_scheduled_campaigns" as any) as any)
      .update({ status: "cancelled" }).eq("id", id).eq("status", "pending");
    toast.success("Cancelado"); fetchAll();
  };

  const deleteItem = async (id: string) => {
    await (supabase.from("disparos_scheduled_campaigns" as any) as any).delete().eq("id", id);
    toast.success("Removido"); fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><CalendarClock className="h-6 w-6" /> Agendamentos</h1>
          <p className="text-muted-foreground text-sm">Programe disparos. 1 crédito é cobrado quando a campanha for executada.</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Novo agendamento</Button></DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Novo agendamento</DialogTitle>
              <DialogDescription>Selecione template, defina variáveis, destinatários e horário.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Template</Label>
                <Select value={templateKey} onValueChange={(v) => { setTemplateKey(v); setVariables({}); }}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {templates.length === 0 ? <div className="px-2 py-3 text-xs text-muted-foreground">Nenhum template aprovado.</div> :
                      templates.map((t) => <SelectItem key={`${t.name}|${t.language}`} value={`${t.name}|${t.language}`}>{t.name} ({t.language})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {variableSlots.length > 0 && (
                <div className="space-y-2">
                  <Label>Variáveis</Label>
                  {variableSlots.map((slot) => (
                    <div key={slot} className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono">{slot}</Badge>
                      <Input value={variables[slot] || ""} onChange={(e) => setVariables((v) => ({ ...v, [slot]: e.target.value }))}
                        placeholder="Texto ou {{primeiro_nome}}" />
                    </div>
                  ))}
                </div>
              )}
              <div>
                <Label>Destinatários (um por linha: <code>telefone nome</code>)</Label>
                <Textarea value={recipientsText} onChange={(e) => setRecipientsText(e.target.value)} rows={6}
                  placeholder={"5511999999999 João\n5511888888888 Maria"} />
              </div>
              <div>
                <Label>Data e hora</Label>
                <Input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave}>Agendar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Agendados</CardTitle></CardHeader>
        <CardContent>
          {loading ? <p className="text-muted-foreground">Carregando...</p> :
            items.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhum agendamento.</p> : (
              <Table>
                <TableHeader><TableRow><TableHead>Quando</TableHead><TableHead>Template</TableHead><TableHead>Destinatários</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                <TableBody>
                  {items.map((item) => {
                    const status = STATUS_LABEL[item.status] || { label: item.status, variant: "secondary" as const };
                    const canCancel = item.status === "pending";
                    return (
                      <TableRow key={item.id}>
                        <TableCell className="whitespace-nowrap">{new Date(item.scheduled_for).toLocaleString("pt-BR")}</TableCell>
                        <TableCell><div className="font-medium">{item.template_name}</div><div className="text-xs text-muted-foreground">{item.template_language}</div></TableCell>
                        <TableCell>{(item.recipients || []).length}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {item.error_message && <div className="text-xs text-destructive mt-1 max-w-[240px] truncate">{item.error_message}</div>}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          {canCancel && <Button size="sm" variant="ghost" onClick={() => cancelItem(item.id)}>Cancelar</Button>}
                          <Button size="sm" variant="ghost" onClick={() => deleteItem(item.id)}><Trash2 className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
