import { useState, useEffect } from "react";
import { invokeWithAuth } from "@/integrations/disparos/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, DollarSign, MessageSquare, TrendingUp, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface ConversationDataPoint {
  start: number; end: number; conversation: number; cost: number; conversation_category?: string;
}
interface Campaign {
  id: string; template_name: string; total_recipients: number; status: string; created_at: string;
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(false);
  const [dataPoints, setDataPoints] = useState<ConversationDataPoint[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [messageCounts, setMessageCounts] = useState<Record<string, number>>({});
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date(); const start = new Date(); start.setDate(start.getDate() - 30);
    return { start: start.toISOString().split("T")[0], end: end.toISOString().split("T")[0] };
  });

  useEffect(() => { fetchAnalytics(); }, []);

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const startTs = Math.floor(new Date(dateRange.start).getTime() / 1000);
      const endTs = Math.floor(new Date(dateRange.end + "T23:59:59").getTime() / 1000);
      const { data, error } = await invokeWithAuth("disparos-fetch-analytics", {
        body: { start: startTs, end: endTs, granularity: "DAILY" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const analytics = data?.conversation_analytics;
      const points: ConversationDataPoint[] = [];
      if (analytics?.data) {
        for (const entry of analytics.data) if (entry.data_points) points.push(...entry.data_points);
      }
      setDataPoints(points);
      setCampaigns(data?.campaigns || []);
      setMessageCounts(data?.message_counts || {});
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setLoading(false);
  };

  const totalConversations = dataPoints.reduce((sum, dp) => sum + (dp.conversation || 0), 0);
  const totalCost = dataPoints.reduce((sum, dp) => sum + (dp.cost || 0), 0);
  const totalMessages = Object.values(messageCounts).reduce((sum, c) => sum + c, 0);

  const byCategory = dataPoints.reduce<Record<string, { conversations: number; cost: number }>>((acc, dp) => {
    const cat = dp.conversation_category || "OTHER";
    if (!acc[cat]) acc[cat] = { conversations: 0, cost: 0 };
    acc[cat].conversations += dp.conversation || 0;
    acc[cat].cost += dp.cost || 0;
    return acc;
  }, {});

  const CATEGORY_LABELS: Record<string, string> = {
    MARKETING: "Marketing", UTILITY: "Utilidade", AUTHENTICATION: "Autenticação",
    SERVICE: "Serviço", OTHER: "Outros",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Analytics e Custos</h1>
        <Button variant="outline" size="sm" onClick={fetchAnalytics} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Atualizar
        </Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-end gap-4 flex-wrap">
            <div><Label className="text-xs">Data Início</Label>
              <Input type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} className="w-44" /></div>
            <div><Label className="text-xs">Data Fim</Label>
              <Input type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} className="w-44" /></div>
            <Button onClick={fetchAnalytics} disabled={loading}>{loading ? "Carregando..." : "Consultar"}</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><MessageSquare className="h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Conversas (Meta)</p></div><p className="text-2xl font-bold">{totalConversations}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><DollarSign className="h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Custo Total (USD)</p></div><p className="text-2xl font-bold">${totalCost.toFixed(4)}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><TrendingUp className="h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Mensagens</p></div><p className="text-2xl font-bold">{totalMessages}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><div className="flex items-center gap-2 mb-1"><AlertCircle className="h-4 w-4 text-muted-foreground" /><p className="text-xs text-muted-foreground">Taxa Entrega</p></div><p className="text-2xl font-bold">{totalMessages > 0 ? Math.round(((messageCounts["delivered"] || 0) + (messageCounts["read"] || 0)) / totalMessages * 100) : 0}%</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Custo por Categoria</CardTitle></CardHeader>
        <CardContent>
          {Object.keys(byCategory).length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-6">{loading ? "Carregando..." : "Sem dados (Meta processa em até 24h)."}</p>
          ) : (
            <Table>
              <TableHeader><TableRow><TableHead>Categoria</TableHead><TableHead className="text-right">Conversas</TableHead><TableHead className="text-right">Custo USD</TableHead><TableHead className="text-right">Médio</TableHead></TableRow></TableHeader>
              <TableBody>
                {Object.entries(byCategory).map(([cat, info]) => (
                  <TableRow key={cat}>
                    <TableCell><Badge variant="secondary" className="text-xs">{CATEGORY_LABELS[cat] || cat}</Badge></TableCell>
                    <TableCell className="text-right font-mono">{info.conversations}</TableCell>
                    <TableCell className="text-right font-mono">${info.cost.toFixed(4)}</TableCell>
                    <TableCell className="text-right font-mono">${info.conversations > 0 ? (info.cost / info.conversations).toFixed(4) : "0.0000"}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right font-mono">{totalConversations}</TableCell>
                  <TableCell className="text-right font-mono">${totalCost.toFixed(4)}</TableCell>
                  <TableCell className="text-right font-mono">${totalConversations > 0 ? (totalCost / totalConversations).toFixed(4) : "0.0000"}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Status das Mensagens</CardTitle></CardHeader>
        <CardContent>
          {totalMessages === 0 ? <p className="text-muted-foreground text-sm text-center py-6">Nenhuma mensagem.</p> : (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {[{ key: "sent", label: "Enviadas", color: "text-blue-600" },
                { key: "delivered", label: "Entregues", color: "text-green-600" },
                { key: "read", label: "Lidas", color: "text-emerald-600" },
                { key: "failed", label: "Falharam", color: "text-red-600" },
                { key: "pending", label: "Pendentes", color: "text-yellow-600" }].map(({ key, label, color }) => (
                <div key={key} className="text-center p-3 border rounded-lg">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{messageCounts[key] || 0}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Campanhas no Período</CardTitle></CardHeader>
        <CardContent>
          {campaigns.length === 0 ? <p className="text-muted-foreground text-sm text-center py-6">Nenhuma campanha.</p> : (
            <Table>
              <TableHeader><TableRow><TableHead>Template</TableHead><TableHead className="text-right">Destinatários</TableHead><TableHead>Status</TableHead><TableHead>Data</TableHead></TableRow></TableHeader>
              <TableBody>
                {campaigns.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-sm">{c.template_name}</TableCell>
                    <TableCell className="text-right">{c.total_recipients}</TableCell>
                    <TableCell><Badge variant={c.status === "completed" ? "default" : "outline"} className="text-xs">{c.status}</Badge></TableCell>
                    <TableCell className="text-sm">{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground text-center">
        Dados de custo fornecidos pela Meta. Podem ter atraso de até 24h. Meta cobra por conversa (janela de 24h).
      </p>
    </div>
  );
}
