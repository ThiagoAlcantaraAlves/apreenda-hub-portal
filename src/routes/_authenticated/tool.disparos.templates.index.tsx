import { createFileRoute } from "@tanstack/react-router";
import Templates from "@/components/disparos/pages/Templates";

export const Route = createFileRoute("/_authenticated/tool/disparos/templates/")({
  component: Templates,
});
