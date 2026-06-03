import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) navigate({ to: "/home", replace: true });
  }, [loading, session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta.");
      } else if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: window.location.origin + "/auth",
          },
        });
        if (error) throw error;
        toast.success("Cadastro criado. Aguarde aprovação.");
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + "/reset-password",
        });
        if (error) throw error;
        toast.success("Enviamos um link para seu email.");
        setMode("login");
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erro ao processar.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="font-display text-5xl text-primary tracking-[0.15em]">APREENDA</h1>
          <div className="mt-2 mx-auto h-px w-16 bg-primary/60" />
          <p className="mt-3 text-sm uppercase tracking-[0.3em] text-muted-foreground">
            Portal do Cliente
          </p>
        </div>

        <form
          onSubmit={submit}
          className="bg-card gold-border rounded-lg p-8 space-y-5 shadow-2xl"
        >
          <h2 className="font-display text-xl text-foreground">
            {mode === "login" && "Entrar"}
            {mode === "signup" && "Criar conta"}
            {mode === "forgot" && "Recuperar senha"}
          </h2>

          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo</Label>
              <Input
                id="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          {mode !== "forgot" && (
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
              />
            </div>
          )}

          <Button type="submit" disabled={busy} className="w-full">
            {busy ? "Aguarde..." : mode === "login" ? "Entrar" : mode === "signup" ? "Criar conta" : "Enviar link"}
          </Button>

          <div className="text-xs text-muted-foreground text-center space-y-2 pt-2">
            {mode === "login" && (
              <>
                <button type="button" className="hover:text-primary transition" onClick={() => setMode("forgot")}>
                  Esqueci minha senha
                </button>
                <div>
                  Não tem conta?{" "}
                  <button type="button" className="text-primary hover:underline" onClick={() => setMode("signup")}>
                    Criar conta
                  </button>
                </div>
              </>
            )}
            {mode !== "login" && (
              <button type="button" className="hover:text-primary transition" onClick={() => setMode("login")}>
                Voltar para entrar
              </button>
            )}
          </div>
        </form>

        <p className="mt-6 text-center text-[10px] tracking-[0.3em] uppercase text-muted-foreground">
          Apreenda Digital
        </p>
      </div>
    </main>
  );
}
