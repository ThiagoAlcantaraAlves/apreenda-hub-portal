import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Coins } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";

interface ConfirmCreditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cost: number;
  actionLabel?: string;
  description?: string;
  onConfirm: () => void;
}

/**
 * Confirmation dialog shown BEFORE any action that consumes credits.
 * Always displays the exact cost and the user's current balance.
 */
export function ConfirmCreditDialog({
  open,
  onOpenChange,
  cost,
  actionLabel = "Confirmar",
  description,
  onConfirm,
}: ConfirmCreditDialogProps) {
  const { balance } = useCredits();
  const total = balance?.total ?? 0;
  const insufficient = total < cost;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-accent/10">
            <Coins className="h-6 w-6 text-accent" />
          </div>
          <AlertDialogTitle className="text-center">
            Esta ação vai consumir {cost} crédito{cost === 1 ? "" : "s"}. Continuar?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-2">
            {description && <div>{description}</div>}
            <div className="text-sm">
              Saldo atual:{" "}
              <span className={`font-semibold ${insufficient ? "text-destructive" : "text-foreground"}`}>
                {total} crédito{total === 1 ? "" : "s"}
              </span>
              {insufficient && (
                <div className="text-destructive text-xs mt-1">
                  Créditos insuficientes para esta ação.
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={insufficient}
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
