import { createFileRoute } from "@tanstack/react-router";
import Clientes from "@/components/disparos/pages/Clientes";

export const Route = createFileRoute("/_authenticated/tool/disparos/clientes")({
  component: Clientes,
});
