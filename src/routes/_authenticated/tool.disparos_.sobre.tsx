import { createFileRoute } from "@tanstack/react-router";
import DisparosPage from "@/components/disparos/pages/DisparosPage";

// Página "sobre" standalone (fora do layout com sidebar), URL /tool/disparos/sobre.
export const Route = createFileRoute("/_authenticated/tool/disparos_/sobre")({
  component: DisparosPage,
});
