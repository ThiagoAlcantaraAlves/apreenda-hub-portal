import { createFileRoute } from "@tanstack/react-router";
import DisparosDashboard from "@/components/disparos/pages/DisparosDashboard";

export const Route = createFileRoute("/_authenticated/tool/disparos/")({
  component: DisparosDashboard,
});
