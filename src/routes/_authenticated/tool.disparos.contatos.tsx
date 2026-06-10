import { createFileRoute } from "@tanstack/react-router";
import Contatos from "@/components/disparos/pages/Contatos";

export const Route = createFileRoute("/_authenticated/tool/disparos/contatos")({
  component: Contatos,
});
