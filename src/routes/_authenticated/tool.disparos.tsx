import { createFileRoute } from "@tanstack/react-router";
import DisparosLayout from "@/components/disparos/DisparosLayout";

export const Route = createFileRoute("/_authenticated/tool/disparos")({
  component: DisparosLayout,
});
