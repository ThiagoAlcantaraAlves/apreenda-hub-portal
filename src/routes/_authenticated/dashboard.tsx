import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BarChart3, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link to="/home"><ArrowLeft className="size-4 mr-1.5" /> Voltar</Link>
      </Button>
      <div className="bg-card gold-border rounded-lg p-12 text-center">
        <div className="mx-auto w-14 h-14 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
          <BarChart3 className="size-6" />
        </div>
        <h1 className="mt-6 font-display text-3xl text-primary">Dashboard de Marketing</h1>
        <div className="mt-3 mx-auto h-px w-12 bg-primary/60" />
        <p className="mt-6 text-sm text-muted-foreground max-w-md mx-auto">
          Esta área receberá em breve seus indicadores de performance, campanhas e canais.
        </p>
      </div>
    </div>
  );
}
