import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useAuth } from "@/integrations/disparos/auth";

export default function Clientes() {
  const { workspaceId } = useAuth();
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [unitFilter, setUnitFilter] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { if (workspaceId) fetchClients(); }, [workspaceId]);

  const fetchClients = async () => {
    setLoading(true);
    const { data } = await supabase.from("disparos_clients" as any).select("*").order("name");
    setClients((data || []) as any[]);
    setLoading(false);
  };

  const units = [...new Set(clients.map((c) => c.unit).filter(Boolean))].sort();
  const filtered = clients.filter((c) => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    const matchUnit = !unitFilter || c.unit === unitFilter;
    return matchSearch && matchUnit;
  });

  const handleDelete = async () => {
    if (selectedIds.size === 0) return;
    const { error } = await (supabase.from("disparos_clients" as any) as any).delete().in("id", [...selectedIds]);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success(`${selectedIds.size} cliente(s) excluído(s)`);
    setSelectedIds(new Set()); fetchClients();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any>(ws);
      const rows = data.map((r: any) => ({
        name: String(r.nome || r.name || "").trim(),
        phone: String(r.telefone || r.phone || "").replace(/\D/g, ""),
        unit: String(r.Grupo || r.grupo || r.unit || r.unidade || "").trim(),
      })).filter((r) => r.name && r.phone.length >= 10 && r.unit);
      if (rows.length === 0) { toast.error("Nenhum registro válido encontrado"); return; }
      const unique = Array.from(new Map(rows.map((r) => [r.phone, r])).values());
      if (!workspaceId) { toast.error("Sessão inválida"); return; }
      const { error } = await (supabase.from("disparos_clients" as any) as any)
        .insert(unique.map((r) => ({ ...r, user_id: workspaceId })));
      if (error) { toast.error("Erro ao importar: " + error.message); return; }
      toast.success(`${unique.length} clientes importados`);
      fetchClients();
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((c) => selectedIds.has(c.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clientes</h1>
        <div className="flex gap-2">
          <label>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleFileUpload} />
            <Button variant="outline" asChild><span><Upload className="h-4 w-4 mr-2" />Importar CSV/XLSX</span></Button>
          </label>
          {selectedIds.size > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive"><Trash2 className="h-4 w-4 mr-2" />Excluir ({selectedIds.size})</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir clientes</AlertDialogTitle>
                  <AlertDialogDescription>Tem certeza? Esta ação não pode ser desfeita.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">{filtered.length} clientes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <select className="border rounded-md px-3 py-2 text-sm bg-card" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
              <option value="">Todas as unidades</option>
              {units.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={() => {
              if (allFilteredSelected) setSelectedIds(new Set());
              else setSelectedIds(new Set(filtered.map((c) => c.id)));
            }}>
              {allFilteredSelected ? "Desmarcar todos" : "Selecionar todos"}
            </Button>
          </div>

          {loading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum cliente encontrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Unidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <Checkbox checked={selectedIds.has(c.id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selectedIds);
                          if (checked) next.add(c.id); else next.delete(c.id);
                          setSelectedIds(next);
                        }} />
                    </TableCell>
                    <TableCell>{c.name}</TableCell>
                    <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-xs">{c.unit}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
