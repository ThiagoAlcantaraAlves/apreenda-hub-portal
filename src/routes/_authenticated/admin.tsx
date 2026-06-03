import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { ArrowLeft, Plus, Check, X } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

const PRODUCTS = ["dashboards", "gestor", "crm", "social"] as const;
const PRODUCT_LABEL: Record<(typeof PRODUCTS)[number], string> = {
  dashboards: "Dashboard de Marketing",
  gestor: "Gestor",
  crm: "CRM",
  social: "Social Media",
};

function AdminPage() {
  const { isAdmin, loading } = useAuth();

  if (loading) return <div className="p-12 text-center text-muted-foreground">Carregando…</div>;
  if (!isAdmin) {
    return (
      <div className="max-w-md mx-auto p-12 text-center">
        <h1 className="font-display text-2xl text-primary">Acesso restrito</h1>
        <p className="mt-3 text-sm text-muted-foreground">Esta área é exclusiva para administradores.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/home"><ArrowLeft className="size-4 mr-1.5" /> Voltar</Link>
      </Button>
      <h1 className="font-display text-3xl text-primary">Painel Administrativo</h1>
      <p className="mt-2 text-sm text-muted-foreground">Gerencie tenants, produtos e usuários.</p>

      <Tabs defaultValue="tenants" className="mt-8">
        <TabsList>
          <TabsTrigger value="tenants">Tenants</TabsTrigger>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
        </TabsList>
        <TabsContent value="tenants" className="mt-6"><TenantsTab /></TabsContent>
        <TabsContent value="products" className="mt-6"><ProductsTab /></TabsContent>
        <TabsContent value="users" className="mt-6"><UsersTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function TenantsTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState<"demo" | "trial" | "active">("demo");

  const { data: tenants } = useQuery({
    queryKey: ["admin-tenants"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("tenants").insert({ name, slug, status });
    if (error) return toast.error(error.message);
    toast.success("Tenant criado.");
    setName(""); setSlug("");
    qc.invalidateQueries({ queryKey: ["admin-tenants"] });
  };

  const updateStatus = async (id: string, s: string) => {
    const { error } = await supabase.from("tenants").update({ status: s as any }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-tenants"] });
  };

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <form onSubmit={create} className="bg-card gold-border rounded-lg p-6 space-y-4 lg:col-span-1">
        <h3 className="font-display text-lg text-primary">Novo tenant</h3>
        <div className="space-y-2"><Label>Nome</Label><Input value={name} onChange={(e) => setName(e.target.value)} required /></div>
        <div className="space-y-2"><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase())} required /></div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="demo">Demo</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="active">Active</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" className="w-full"><Plus className="size-4 mr-1" /> Criar</Button>
      </form>

      <div className="lg:col-span-2 bg-card gold-border rounded-lg p-6">
        <h3 className="font-display text-lg text-primary mb-4">Tenants existentes</h3>
        <div className="space-y-2">
          {tenants?.map((t) => (
            <div key={t.id} className="flex items-center justify-between border border-border/40 rounded-md px-4 py-3">
              <div>
                <div className="text-foreground font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">{t.slug}</div>
              </div>
              <Select value={t.status} onValueChange={(v) => updateStatus(t.id, v)}>
                <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Demo</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
          {!tenants?.length && <p className="text-sm text-muted-foreground">Nenhum tenant.</p>}
        </div>
      </div>
    </div>
  );
}

function ProductsTab() {
  const qc = useQueryClient();
  const [tenantId, setTenantId] = useState<string>("");

  const { data: tenants } = useQuery({
    queryKey: ["admin-tenants-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tps } = useQuery({
    queryKey: ["admin-tenant-products", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase.from("tenant_products").select("*").eq("tenant_id", tenantId);
      if (error) throw error;
      return data;
    },
    enabled: !!tenantId,
  });

  const upsertProduct = async (
    product: (typeof PRODUCTS)[number],
    patch: { url?: string | null; enabled?: boolean }
  ) => {
    const existing = tps?.find((p) => p.product === product);
    if (existing) {
      const { error } = await supabase.from("tenant_products").update(patch).eq("id", existing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("tenant_products").insert({
        tenant_id: tenantId,
        product,
        url: patch.url ?? null,
        enabled: patch.enabled ?? true,
      });
      if (error) return toast.error(error.message);
    }
    qc.invalidateQueries({ queryKey: ["admin-tenant-products", tenantId] });
  };

  return (
    <div className="bg-card gold-border rounded-lg p-6 space-y-6">
      <div className="space-y-2 max-w-md">
        <Label>Tenant</Label>
        <Select value={tenantId} onValueChange={setTenantId}>
          <SelectTrigger><SelectValue placeholder="Selecione um tenant" /></SelectTrigger>
          <SelectContent>
            {tenants?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {tenantId && (
        <div className="space-y-4">
          {PRODUCTS.map((p) => {
            const row = tps?.find((x) => x.product === p);
            return (
              <ProductRow
                key={p}
                product={p}
                url={row?.url ?? ""}
                enabled={row?.enabled ?? false}
                onSave={(url, enabled) => upsertProduct(p, { url: url || null, enabled })}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProductRow({
  product, url, enabled, onSave,
}: { product: (typeof PRODUCTS)[number]; url: string; enabled: boolean; onSave: (url: string, enabled: boolean) => void }) {
  const [u, setU] = useState(url);
  const [e, setE] = useState(enabled);
  return (
    <div className="border border-border/40 rounded-md p-4 grid md:grid-cols-[1fr_2fr_auto_auto] gap-3 items-end">
      <div>
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Produto</Label>
        <div className="text-foreground mt-1">{PRODUCT_LABEL[product]}</div>
      </div>
      <div>
        <Label className="text-xs">URL</Label>
        <Input value={u} onChange={(ev) => setU(ev.target.value)} placeholder="https://..." />
      </div>
      <div className="flex items-center gap-2 pb-2">
        <Switch checked={e} onCheckedChange={setE} />
        <span className="text-xs text-muted-foreground">{e ? "Ativo" : "Inativo"}</span>
      </div>
      <Button onClick={() => onSave(u, e)} size="sm">Salvar</Button>
    </div>
  );
}

function UsersTab() {
  const qc = useQueryClient();
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, approved, tenant_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: tenants } = useQuery({
    queryKey: ["admin-tenants-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenants").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const update = async (id: string, patch: { approved?: boolean; tenant_id?: string | null }) => {
    const { error } = await supabase.from("profiles").update(patch).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin-users"] });
  };

  return (
    <div className="bg-card gold-border rounded-lg p-6 space-y-3">
      {users?.map((u) => (
        <div key={u.id} className="border border-border/40 rounded-md p-4 grid md:grid-cols-[2fr_1.5fr_auto] gap-3 items-center">
          <div>
            <div className="text-foreground">{u.full_name || "—"}</div>
            <div className="text-xs text-muted-foreground">{u.email}</div>
          </div>
          <Select value={u.tenant_id ?? "__none"} onValueChange={(v) => update(u.id, { tenant_id: v === "__none" ? null : v })}>
            <SelectTrigger><SelectValue placeholder="Tenant" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— sem tenant —</SelectItem>
              {tenants?.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div>
            {u.approved ? (
              <Button variant="outline" size="sm" onClick={() => update(u.id, { approved: false })}>
                <X className="size-4 mr-1" /> Revogar
              </Button>
            ) : (
              <Button size="sm" onClick={() => update(u.id, { approved: true })}>
                <Check className="size-4 mr-1" /> Aprovar
              </Button>
            )}
          </div>
        </div>
      ))}
      {!users?.length && <p className="text-sm text-muted-foreground">Nenhum usuário.</p>}
    </div>
  );
}
