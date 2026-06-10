import { createFileRoute } from "@tanstack/react-router";
import Agendamentos from "@/components/disparos/pages/Agendamentos";

export const Route = createFileRoute("/_authenticated/tool/disparos/agendamentos")({
  component: Agendamentos,
});
