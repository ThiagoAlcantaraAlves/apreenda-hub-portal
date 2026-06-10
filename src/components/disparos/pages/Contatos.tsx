import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Upload, Download, Search } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { classifyTags, FRANCHISE_UNITS, KNOWN_UNITS } from "@/lib/disparos/contactTags";
import { useAuth } from "@/integrations/disparos/auth";

interface Contact {
  id: string; name: string; phone: string; tags: string[]; created_at: string;
}

export default function Contatos() {
  const { workspaceId } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", tags: "" });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => { if (workspaceId) fetchContacts(); }, [workspaceId]);

  const fetchContacts = async () => {
    const { data, error } = await supabase
      .from("disparos_contacts" as any).select("*")
      .order("created_at", { ascending: false });
    if (!error) setContacts((data || []) as any);
    setLoading(false);
  };

  const { units: knownUnits, roles: knownRoles } = classifyTags(contacts);
  const [unitFilter, setUnitFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const filtered = contacts.filter((c) => {
    const tags = c.tags || [];
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone.includes(search);
    let matchUnit = true;
    if (unitFilter === "__own") matchUnit = tags.some((t) => KNOWN_UNITS.has(t) && !FRANCHISE_UNITS.has(t));
    else if (unitFilter === "__franchise") matchUnit = tags.some((t) => FRANCHISE_UNITS.has(t));
    else if (unitFilter) matchUnit = tags.includes(unitFilter);
    const matchRole = !roleFilter || tags.includes(roleFilter);
    return matchSearch && matchUnit && matchRole;
  });

  const openCreate = () => { setEditContact(null); setForm({ name: "", phone: "", tags: "" }); setDialogOpen(true); };
  const openEdit = (c: Contact) => {
    setEditContact(c); setForm({ name: c.name, phone: c.phone, tags: (c.tags || []).join(", ") }); setDialogOpen(true);
  };

  const handleSave = async () => {
    const tags = form.tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (!form.name || !form.phone) { toast.error("Nome e telefone são obrigatórios"); return; }
    if (editContact) {
      const { error } = await (supabase.from("disparos_contacts" as any) as any)
        .update({ name: form.name, phone: form.phone, tags }).eq("id", editContact.id);
      if (error) { toast.error("Erro ao atualizar: " + error.message); return; }
      toast.success("Contato atualizado");
    } else {
      if (!workspaceId) { toast.error("Sessão inválida"); return; }
      const { error } = await (supabase.from("disparos_contacts" as any) as any)
        .insert({ name: form.name, phone: form.phone, tags, user_id: workspaceId });
      if (error) { toast.error("Erro ao criar: " + error.message); return; }
      toast.success("Contato criado");
    }
    setDialogOpen(false); fetchContacts();
  };

  const handleDelete = async (id: string) => {
    const { error } = await (supabase.from("disparos_contacts" as any) as any).delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Contato excluído"); fetchContacts();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target?.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<any>(ws);
      const toInsert = data.filter((r: any) => r.telefone || r.phone).map((r: any) => ({
        name: r.nome || r.name || "Sem nome",
        phone: String(r.telefone || r.phone).replace(/\D/g, ""),
        tags: r.tags ? String(r.tags).split(",").map((t: string) => t.trim()) : [],
      })).filter((r) => r.phone.length >= 10);
      if (toInsert.length === 0) { toast.error("Nenhum contato válido encontrado"); return; }
      if (!workspaceId) { toast.error("Sessão inválida"); return; }
      const withUser = toInsert.map((r) => ({ ...r, user_id: workspaceId }));
      const { error } = await (supabase.from("disparos_contacts" as any) as any)
        .upsert(withUser, { onConflict: "user_id,phone" });
      if (error) { toast.error("Erro na importação: " + error.message); return; }
      toast.success(`${toInsert.length} contatos importados`);
      fetchContacts();
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleExport = () => {
    const ws = XLSX.utils.json_to_sheet(contacts.map((c) => ({
      nome: c.name, telefone: c.phone, tags: (c.tags || []).join(", "),
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contatos");
    XLSX.writeFile(wb, "contatos.xlsx");
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Contatos</h1>
        <div className="flex gap-2">
          <label>
            <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={handleImport} />
            <Button variant="outline" size="sm" asChild><span><Upload className="h-4 w-4 mr-1" />Importar</span></Button>
          </label>
          <Button variant="outline" size="sm" onClick={handleExport}><Download className="h-4 w-4 mr-1" />Exportar</Button>
          <Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" />Novo Contato</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4 mb-4 flex-wrap items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
            </div>
            <select className="border rounded-md px-3 py-2 text-sm bg-card" value={unitFilter} onChange={(e) => setUnitFilter(e.target.value)}>
              <option value="">Todas as unidades</option>
              <option value="__own">Unidades próprias</option>
              <option value="__franchise">Franquias</option>
              {knownUnits.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="border rounded-md px-3 py-2 text-sm bg-card" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
              <option value="">Todas as funções</option>
              {knownRoles.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={() => {
              if (selectedIds.size === filtered.length) setSelectedIds(new Set());
              else setSelectedIds(new Set(filtered.map((c) => c.id)));
            }}>
              {selectedIds.size === filtered.length && filtered.length > 0 ? "Desmarcar todos" : "Selecionar todos"}
            </Button>
          </div>
          {selectedIds.size > 0 && (<div className="mb-4"><Badge>{selectedIds.size} contato(s) selecionado(s)</Badge></div>)}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={(checked) => {
                      if (checked) setSelectedIds(new Set(filtered.map((c) => c.id)));
                      else setSelectedIds(new Set());
                    }} />
                </TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Grupos</TableHead>
                <TableHead className="w-24">Ações</TableHead>
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
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-sm">{c.phone}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 flex-wrap">
                      {(c.tags || []).map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum contato encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editContact ? "Editar Contato" : "Novo Contato"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Telefone (formato internacional)</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="5551999999999" /></div>
            <div><Label>Grupos/Tags (separados por vírgula)</Label><Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Gestores, Recepção" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
