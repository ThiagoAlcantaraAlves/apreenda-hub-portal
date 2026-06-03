import { createFileRoute, Outlet, redirect, Link, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { LogOut, Shield } from "lucide-react";
import { TenantBranding } from "@/components/TenantBranding";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { profile, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <TenantBranding />
      <header className="border-b border-border/60 bg-card/60 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/home" className="flex items-baseline gap-3">
            <span className="font-display text-2xl text-primary tracking-[0.2em]">APREENDA</span>
            <span className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">Hub</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin"><Shield className="size-4 mr-1.5" /> Admin</Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="size-4 mr-1.5" /> Sair
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Carregando…</div>
        ) : !profile ? (
          <div className="p-12 text-center text-muted-foreground">Perfil não encontrado.</div>
        ) : !profile.approved && !isAdmin ? (
          <PendingScreen email={profile.email} />
        ) : (
          <Outlet />
        )}
      </main>
      <footer className="py-6 text-center text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
        Apreenda Digital
      </footer>
    </div>
  );
}

function PendingScreen({ email }: { email: string }) {
  return (
    <div className="max-w-lg mx-auto px-6 py-24 text-center">
      <div className="mx-auto w-16 h-16 rounded-full gold-border flex items-center justify-center mb-6">
        <Shield className="size-7 text-primary" />
      </div>
      <h1 className="font-display text-3xl text-primary">Acesso em análise</h1>
      <div className="mt-3 mx-auto h-px w-12 bg-primary/60" />
      <p className="mt-6 text-sm text-muted-foreground leading-relaxed">
        Sua conta <span className="text-foreground">{email}</span> foi criada com sucesso.
        Estamos validando seu acesso ao Apreenda Hub. Você receberá um aviso assim que for liberado.
      </p>
    </div>
  );
}
