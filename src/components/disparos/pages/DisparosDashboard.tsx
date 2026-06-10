import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Send, CheckCheck, Eye, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/integrations/disparos/auth";

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  delivered: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  read: "bg-primary/15 text-primary",
  failed: "bg-destructive/15 text-destructive",
};

const statusLabels: Record<string, string> = {
  pending: "Pendente", sent: "Enviado", delivered: "Entregue",
  read: "Lido", failed: "Falhou",
};

const PIE_COLORS = [
  "hsl(199, 89%, 48%)", "hsl(142, 71%, 45%)", "hsl(213, 52%, 24%)",
  "hsl(0, 84%, 60%)", "hsl(38, 92%, 50%)",
];

export default function DisparosDashboard() {
  const { workspaceId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ todaySent: 0, monthSent: 0, deliveryRate: 0, readRate: 0, failures: 0 });
  const [recentMessages, setRecentMessages] = useState<any[]>([]);
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);

  useEffect(() => { if (workspaceId) fetchDashboardData(); }, [workspaceId]);

  const fetchDashboardData = async () => {
    try {
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const thirtyDaysAgo = subDays(now, 30).toISOString();

      const t = supabase.from("disparos_messages" as any);
      const [todayRes, monthRes, recentRes, allMsgsRes] = await Promise.all([
        t.select("id", { count: "exact" }).gte("created_at", todayStart),
        t.select("id", { count: "exact" }).gte("created_at", monthStart),
        t.select("*").order("created_at", { ascending: false }).limit(20),
        t.select("status, created_at").gte("created_at", thirtyDaysAgo),
      ]);

      const allMsgs = (allMsgsRes.data || []) as any[];
      const total = allMsgs.length;
      const delivered = allMsgs.filter((m) => ["sent", "delivered", "read"].includes(m.status)).length;
      const reads = allMsgs.filter((m) => m.status === "read").length;
      const failures = allMsgs.filter((m) => m.status === "failed").length;

      setStats({
        todaySent: todayRes.count || 0,
        monthSent: monthRes.count || 0,
        deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
        readRate: total > 0 ? Math.round((reads / total) * 100) : 0,
        failures,
      });
      setRecentMessages((recentRes.data || []) as any[]);

      const dailyMap: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) dailyMap[format(subDays(now, i), "dd/MM")] = 0;
      allMsgs.forEach((m) => {
        const d = format(new Date(m.created_at), "dd/MM");
        if (dailyMap[d] !== undefined) dailyMap[d]++;
      });
      setDailyData(Object.entries(dailyMap).map(([date, count]) => ({ date, count })));

      const statusMap: Record<string, number> = {};
      allMsgs.forEach((m) => { statusMap[m.status] = (statusMap[m.status] || 0) + 1; });
      setStatusDistribution(
        Object.entries(statusMap).map(([name, value]) => ({ name: statusLabels[name] || name, value }))
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  const kpis = [
    { title: "Enviadas Hoje", value: stats.todaySent, sub: `${stats.monthSent} este mês`, icon: Send, color: "text-blue-600" },
    { title: "Taxa de Entrega", value: `${stats.deliveryRate}%`, sub: "últimos 30 dias", icon: CheckCheck, color: "text-emerald-600" },
    { title: "Taxa de Leitura", value: `${stats.readRate}%`, sub: "últimos 30 dias", icon: Eye, color: "text-primary" },
    { title: "Falhas", value: stats.failures, sub: "últimos 30 dias", icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard de Disparos</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <Card key={kpi.title}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  <p className="text-3xl font-bold mt-1">{kpi.value}</p>
                  <p className="text-xs text-muted-foreground mt-1">{kpi.sub}</p>
                </div>
                <kpi.icon className={`h-8 w-8 ${kpi.color} opacity-80`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Envios por dia (30 dias)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" fontSize={11} />
                <YAxis fontSize={11} />
                <Tooltip />
                <Line type="monotone" dataKey="count" stroke="hsl(213, 52%, 24%)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição de Status</CardTitle></CardHeader>
          <CardContent>
            {statusDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={statusDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                    {statusDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-10">Nenhum dado disponível</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimos Disparos</CardTitle></CardHeader>
        <CardContent>
          {recentMessages.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Destinatário</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data/Hora</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentMessages.map((msg) => (
                  <TableRow key={msg.id}>
                    <TableCell className="font-mono text-sm">{msg.contact_phone}</TableCell>
                    <TableCell>{msg.contact_name || "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[msg.status] || ""}>
                        {statusLabels[msg.status] || msg.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(msg.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem enviada ainda</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
