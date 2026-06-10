import { createFileRoute } from "@tanstack/react-router";
import NovoDisparo from "@/components/disparos/pages/NovoDisparo";

export const Route = createFileRoute("/_authenticated/tool/disparos/disparar")({
  component: NovoDisparo,
});
