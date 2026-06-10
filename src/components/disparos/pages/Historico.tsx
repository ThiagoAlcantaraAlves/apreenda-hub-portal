import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Download, Search } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import * as XLSX from "xlsx";
import { useAuth } from "@/integrations/disparos/auth";

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  failed: "bg-destructive/15 text-destructive",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  read: "bg-primary/15 text-primary",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente", in_progress: "Em andamento", completed: "Concluída", failed: "Falhou",
  sent: "Enviado", delivered: "Entregue", read: "Lido",
};

const ERROR_HINTS: { match: RegExp; label: string }[] = [
  { match: /spam rate limit/i, label: "Limite anti-spam da Meta — reduza a velocidade" },
  { match: /message undeliverable/i, label: "Número inválido ou sem WhatsApp" },
  { match: /healthy ecosystem/i, label: "Bloqueado por qualidade — denúncias ou poucos opt-ins" },
  { match: /part of an experiment/i, label: "Número em experimento da Meta (ignorável)" },
  { match: /business eligibility|payment issue/i, label: "Problema de pagamento na WhatsApp Business" },
  { match: /re-?engagement|24 hour|24h/i, label: "Fora da janela de 24h — só templates aprovados" },
];

const explainError = (err: string) => ERROR_HINTS.find((h) => h.match.test(err))?.label;

export default function Historico() {
  const { workspaceId } = useAuth();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [messages, setMessages] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { if (workspaceId) fetchCampaigns(); }, [workspaceId]);

  const fetchCampaigns = async () => {
    const { data } = await supabase.from("disparos_campaigns" as any).select("*").order("created_at", { ascending: false });
    setCampaigns((data || []) as any[]);
    setLoading(false);
  };

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    if (!messages[id]) {
      const { data } = await supabase.from("disparos_messages" as any).select("*").eq("campaign_id", id).order("created_at");
      setMessages((prev) => ({ ...prev, [id]: (data || []) as any[] }));
    }
  };

  const exportCampaign = (campaign: any) => {
    const msgs = messages[campaign.id] || [];
    const ws = XLSX.utils.json_to_sheet(msgs.map((m) => ({
      telefone: m.contact_phone, nome: m.contact_name,
      status: statusLabels[m.status] || m.status,
      erro: m.error_message || "",
      enviado_em: m.sent_at ? format(new Date(m.sent_at), "dd/MM/yyyy HH:mm") : "",
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mensagens");
    XLSX.writeFile(wb, `campanha_${campaign.template_name}_${format(new Date(campaign.created_at), "yyyyMMdd")}.xlsx`);
  };

  const filtered = campaigns.filter((c) => !search || c.template_name.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="space-y-4"><h1 className="text-2xl font-bold">Histórico</h1><Skeleton className="h-64" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Histórico de Disparos</h1>
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar por template..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      <div className="space-y-3">
        {filtered.map((campaign) => (
          <Card key={campaign.id}>
            <Collapsible open={expandedId === campaign.id} onOpenChange={() => toggleExpand(campaign.id)}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div>
                        <CardTitle className="text-base">{campaign.template_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                      </div>
                      <Badge className={statusColors[campaign.status] || ""}>{statusLabels[campaign.status] || campaign.status}</Badge>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground">{campaign.total_recipients} destinatários · {campaign.credits_consumed ?? 0} crédito(s)</span>
                      <ChevronDown className={`h-4 w-4 transition-transform ${expandedId === campaign.id ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent>
                  <div className="flex justify-end mb-3">
                    <Button variant="outline" size="sm" onClick={() => exportCampaign(campaign)} disabled={!messages[campaign.id]?.length}>
                      <Download className="h-4 w-4 mr-1" />Exportar CSV
                    </Button>
                  </div>
                  {(() => {
                    const msgs = messages[campaign.id] || [];
                    const failed = msgs.filter((m) => m.status === "failed" && m.error_message);
                    if (failed.length === 0) return null;
                    const grouped = failed.reduce<Record<string, number>>((acc, m) => {
                      acc[m.error_message] = (acc[m.error_message] || 0) + 1; return acc;
                    }, {});
                    const sorted = Object.entries(grouped).sort((a, b) => b[1] - a[1]);
                    return (
                      <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
                        <p className="text-sm font-medium mb-2">Resumo de falhas ({failed.length})</p>
                        <div className="space-y-2">
                          {sorted.map(([err, count]) => {
                            const hint = explainError(err);
                            return (
                              <div key={err} className="flex items-start gap-2 text-sm">
                                <Badge variant="destructive" className="shrink-0 font-mono">{count}</Badge>
                                <div className="flex-1">
                                  <p className="font-mono text-xs text-muted-foreground">{err}</p>
                                  {hint && <p className="text-xs mt-0.5">{hint}</p>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Enviado em</TableHead>
                        <TableHead>Erro</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(messages[campaign.id] || []).map((msg) => (
                        <TableRow key={msg.id}>
                          <TableCell className="font-mono text-sm">{msg.contact_phone}</TableCell>
                          <TableCell>{msg.contact_name || "—"}</TableCell>
                          <TableCell><Badge className={statusColors[msg.status] || ""}>{statusLabels[msg.status] || msg.status}</Badge></TableCell>
                          <TableCell className="text-sm">{msg.sent_at ? format(new Date(msg.sent_at), "HH:mm:ss") : "—"}</TableCell>
                          <TableCell className="text-sm text-destructive">{msg.error_message || "—"}</TableCell>
                        </TableRow>
                      ))}
                      {(!messages[campaign.id] || messages[campaign.id].length === 0) && (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-4">Carregando...</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-muted-foreground py-10">Nenhuma campanha encontrada</p>
        )}
      </div>
    </div>
  );
}
