import { Link } from "@tanstack/react-router";
import { Coins } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { cn } from "@/lib/utils";

export const CreditBalanceBadge = ({ className }: { className?: string }) => {
  const { balance, loading } = useCredits();
  const unlimited = (balance as any)?.unlimited === true;
  const total = balance?.total ?? 0;
  const low = !unlimited && total <= 5;

  return (
    <Link
      to="/planos"
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        low
          ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
          : "border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
        className
      )}
      title={
        balance?.plan_name
          ? `${balance.plan_name} • ${balance.subscription_credits} da assinatura + ${balance.pack_credits} avulsos\nCréditos da assinatura renovam todo mês e não acumulam. Pacotes avulsos não expiram.`
          : "Comprar créditos"
      }
    >
      <Coins className="h-3.5 w-3.5" />
      <span>{loading ? "…" : unlimited ? "∞ créd." : `${total} créd.`}</span>
    </Link>
  );
};

export default CreditBalanceBadge;
