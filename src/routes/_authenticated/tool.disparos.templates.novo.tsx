import { createFileRoute } from "@tanstack/react-router";
import CadastrarTemplate from "@/components/disparos/pages/CadastrarTemplate";

export const Route = createFileRoute("/_authenticated/tool/disparos/templates/novo")({
  component: CadastrarTemplate,
});
