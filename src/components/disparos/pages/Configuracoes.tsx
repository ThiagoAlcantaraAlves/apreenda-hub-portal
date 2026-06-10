import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, EyeOff, TestTube } from "lucide-react";
import { invokeWithAuth } from "@/integrations/disparos/api";
import { logAction } from "@/integrations/disparos/auditLog";

export default function Configuracoes() {
  const [config, setConfig] = useState({ waba_id: "", phone_number_id: "", access_token: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [testPhone, setTestPhone] = useState("");

  useEffect(() => { fetchConfig(); }, []);

  const fetchConfig = async () => {
    try {
      const { data, error } = await invokeWithAuth("disparos-manage-config", { body: { action: "get" } });
      if (error) throw error;
      if (data?.config) {
        setConfig({
          waba_id: data.config.waba_id || "",
          phone_number_id: data.config.phone_number_id || "",
          access_token: data.config.access_token || "",
        });
      }
    } catch {
      toast.error("Erro ao carregar configurações");
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!config.waba_id || !config.phone_number_id || !config.access_token) {
      toast.error("Todos os campos são obrigatórios"); return;
    }
    setSaving(true);
    try {
      const { error } = await invokeWithAuth("disparos-manage-config", { body: { action: "save", ...config } });
      if (error) throw error;
      toast.success("Configurações salvas");
      logAction({ action: "config_saved", entityType: "disparos_api_config" });
    } catch {
      toast.error("Erro ao salvar");
    }
    setSaving(false);
  };

  const handleTest = async () => {
    if (!testPhone) { toast.error("Informe um número"); return; }
    setTesting(true);
    try {
      const { data, error } = await invokeWithAuth("disparos-send-whatsapp", {
        body: { phone: testPhone, template_name: "hello_world", language: "en_US", components: [], skip_credit: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Mensagem de teste enviada!");
    } catch (err: any) {
      toast.error("Erro no teste: " + (err.message || "Erro desconhecido"));
    }
    setTesting(false);
  };

  if (loading) return <p className="text-muted-foreground">Carregando...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Configurações</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">API do WhatsApp Business</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>WhatsApp Business Account ID</Label>
            <Input value={config.waba_id} onChange={(e) => setConfig({ ...config, waba_id: e.target.value })} placeholder="Ex: 2416661482006066" /></div>
          <div><Label>Phone Number ID</Label>
            <Input value={config.phone_number_id} onChange={(e) => setConfig({ ...config, phone_number_id: e.target.value })} placeholder="Ex: 1250447707246334" /></div>
          <div>
            <Label>Access Token (Permanente)</Label>
            <div className="relative">
              <Input type={showToken ? "text" : "password"} value={config.access_token}
                onChange={(e) => setConfig({ ...config, access_token: e.target.value })} />
              <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2" onClick={() => setShowToken(!showToken)}>
                {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Não sabe onde encontrar? Veja o <a href="/tool/disparos/manual" className="underline">manual de configuração</a>.
            </p>
          </div>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar Configurações"}</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Teste de Conexão</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Número para teste (internacional)</Label>
            <Input value={testPhone} onChange={(e) => setTestPhone(e.target.value)} placeholder="5551999999999" /></div>
          <Button variant="outline" onClick={handleTest} disabled={testing}>
            <TestTube className="h-4 w-4 mr-2" />{testing ? "Enviando..." : "Enviar Mensagem de Teste"}
          </Button>
          <p className="text-xs text-muted-foreground">Envia o template padrão "hello_world" (en_US) — gratuito e disponível em toda conta nova. Teste não consome crédito do Hub.</p>
        </CardContent>
      </Card>
    </div>
  );
}
