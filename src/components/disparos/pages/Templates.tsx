import { useEffect, useState } from "react";
import { invokeWithAuth } from "@/integrations/disparos/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, Plus, Search, AlertCircle, Wrench } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "@tanstack/react-router";

interface Template {
  id?: string; name: string; language: string; category: string;
  status: string; rejected_reason?: string | null; components: any[];
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  APPROVED: { label: "Aprovado", variant: "default" },
  PENDING: { label: "Em análise", variant: "secondary" },
  REJECTED: { label: "Rejeitado", variant: "destructive" },
  PAUSED: { label: "Pausado", variant: "outline" },
  DISABLED: { label: "Desativado", variant: "outline" },
  IN_APPEAL: { label: "Em recurso", variant: "secondary" },
  PENDING_DELETION: { label: "Exclusão pendente", variant: "destructive" },
};

const REJECTION_REASON_MAP: Record<string, string> = {
  ABUSIVE_CONTENT: "Conteúdo abusivo ou ofensivo",
  INCORRECT_CATEGORY: "Categoria incorreta",
  INVALID_FORMAT: "Formato inválido (variáveis, exemplos ou estrutura)",
  SCAM: "Conteúdo identificado como golpe",
  TAG_CONTENT_MISMATCH: "Conteúdo não corresponde à categoria",
  PROMOTIONAL: "Conteúdo promocional em categoria não-marketing",
  NONE: "Sem motivo específico",
};

const describeRejection = (reason?: string | null) =>
  !reason || reason === "NONE" ? null : REJECTION_REASON_MAP[reason] || reason;

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => { fetchTemplates(); }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await invokeWithAuth("disparos-fetch-templates");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setTemplates(data?.templates || []);
    } catch (err: any) {
      toast.error("Erro ao buscar templates: " + err.message);
    }
    setLoading(false);
  };

  const getBodyPreview = (t: Template): string => {
    const body = t.components?.find((c: any) => c.type === "BODY");
    if (!body?.text) return "—";
    return body.text.length > 80 ? body.text.slice(0, 80) + "..." : body.text;
  };

  const filteredTemplates = templates.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return t.name.toLowerCase().includes(q) || t.category.toLowerCase().includes(q);
  });

  const statusCounts = templates.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1; return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Templates</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchTemplates} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Atualizar Status
          </Button>
          <Button size="sm" onClick={() => navigate({ to: "/tool/disparos/templates/novo" })}>
            <Plus className="h-4 w-4 mr-2" /> Cadastrar Template
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-bold">{templates.length}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground">Aprovados</p><p className="text-2xl font-bold text-green-600">{statusCounts["APPROVED"] || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground">Em análise</p><p className="text-2xl font-bold text-yellow-600">{statusCounts["PENDING"] || 0}</p></CardContent></Card>
        <Card><CardContent className="pt-4 pb-3 px-4"><p className="text-xs text-muted-foreground">Rejeitados</p><p className="text-2xl font-bold text-red-600">{statusCounts["REJECTED"] || 0}</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Todos os Templates</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-center py-8">Carregando templates...</p>
          ) : filteredTemplates.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              {search ? "Nenhum template encontrado." : "Nenhum template. Configure a API ou cadastre um."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead><TableHead>Categoria</TableHead><TableHead>Idioma</TableHead>
                  <TableHead>Status</TableHead><TableHead>Preview</TableHead><TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTemplates.map((t) => {
                  const statusInfo = STATUS_MAP[t.status] || { label: t.status, variant: "outline" as const };
                  const rejectionText = describeRejection(t.rejected_reason);
                  const isRejected = t.status === "REJECTED";
                  return (
                    <TableRow key={`${t.name}-${t.language}`} className={isRejected ? "bg-destructive/5" : undefined}>
                      <TableCell className="font-medium font-mono text-sm align-top">{t.name}</TableCell>
                      <TableCell className="align-top"><Badge variant="secondary" className="text-xs">{t.category}</Badge></TableCell>
                      <TableCell className="text-sm align-top">{t.language}</TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
                          {isRejected && (
                            <div className="flex items-start gap-1 text-xs text-destructive max-w-[220px]">
                              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                              <span>{rejectionText || "Motivo não informado"}</span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate align-top">{getBodyPreview(t)}</TableCell>
                      <TableCell className="align-top">
                        {isRejected && (
                          <Button size="sm" variant="outline" onClick={() => navigate({ to: "/tool/disparos/templates/novo", state: { fixTemplate: t } as never })}>
                            <Wrench className="h-3 w-3 mr-1" /> Corrigir
                          </Button>
                        )}
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
