import { createFileRoute } from "@tanstack/react-router";
import DisparosManualPage from "@/components/disparos/pages/DisparosManualPage";

// `disparos_` opta por sair do layout (sidebar) de /tool/disparos — página standalone,
// mantendo a URL /tool/disparos/manual dentro do header do hub.
export const Route = createFileRoute("/_authenticated/tool/disparos_/manual")({
  component: DisparosManualPage,
});
