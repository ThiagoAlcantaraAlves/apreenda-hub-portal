import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada.");
      navigate({ to: "/home", replace: true });
    } catch (err: any) {
      toast.error(err?.message ?? "Erro.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md bg-card gold-border rounded-lg p-8 space-y-5">
        <h1 className="font-display text-2xl text-primary">Definir nova senha</h1>
        <div className="space-y-2">
          <Label htmlFor="pw">Nova senha</Label>
          <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
        </div>
        <Button type="submit" disabled={busy} className="w-full">Atualizar</Button>
      </form>
    </main>
  );
}
