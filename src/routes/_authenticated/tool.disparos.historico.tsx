import { createFileRoute } from "@tanstack/react-router";
import Historico from "@/components/disparos/pages/Historico";

export const Route = createFileRoute("/_authenticated/tool/disparos/historico")({
  component: Historico,
});
