import { createFileRoute } from "@tanstack/react-router";
import Configuracoes from "@/components/disparos/pages/Configuracoes";

export const Route = createFileRoute("/_authenticated/tool/disparos/configuracoes")({
  component: Configuracoes,
});
