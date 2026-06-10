import { Outlet, Link } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DisparosSidebar } from "@/components/disparos/DisparosSidebar";
import { useCredits } from "@/hooks/useCredits";
import { Coins } from "lucide-react";

export default function DisparosLayout() {
  const { balance, loading } = useCredits();
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <DisparosSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-card">
            <SidebarTrigger />
            <Link
              to="/planos"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Coins className="h-4 w-4 text-accent" />
              <span>
                Créditos: <strong className="text-foreground">{loading ? "…" : balance?.total ?? 0}</strong>
              </span>
            </Link>
          </header>
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
