import { createFileRoute } from "@tanstack/react-router";
import Analytics from "@/components/disparos/pages/Analytics";

export const Route = createFileRoute("/_authenticated/tool/disparos/analytics")({
  component: Analytics,
});
