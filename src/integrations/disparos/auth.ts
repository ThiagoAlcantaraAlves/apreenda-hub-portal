// Adapter que expõe o auth do Hub Apreenda no formato que as páginas de Disparos esperam.
// As páginas foram escritas para um modelo multi-tenant `hub_users` com workspaces.
// No Hub Apreenda o escopo de dados é POR USUÁRIO (RLS filtra por auth.uid()), então
// workspaceId é simplesmente o id de auth do usuário.
import { useAuth as useHubAuth } from "@/lib/auth-context";

export interface DisparosUserShape {
  id: string;
  email: string;
  name: string;
  workspace_id: string;
  role: "admin" | "colaborador";
}

export function useAuth() {
  const { user, profile, isAdmin, signOut } = useHubAuth();
  const disparosUser: DisparosUserShape | null = user
    ? {
        id: user.id,
        email: user.email ?? "",
        name: profile?.full_name ?? user.email ?? "Usuário",
        workspace_id: user.id, // single-tenant por usuário no Hub
        role: isAdmin ? "admin" : "colaborador",
      }
    : null;
  return {
    user: disparosUser,
    workspaceId: user?.id ?? null,
    isAdmin,
    isSuperAdmin: isAdmin,
    logout: signOut,
  };
}
