import {
  LayoutDashboard, Send, Users, UserCheck, History, Settings,
  FileText, BarChart3, CalendarClock, ArrowLeft,
} from "lucide-react";
import { NavLink } from "@/components/disparos/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard", url: "/tool/disparos", icon: LayoutDashboard, end: true },
  { title: "Novo Disparo", url: "/tool/disparos/disparar", icon: Send },
  { title: "Agendamentos", url: "/tool/disparos/agendamentos", icon: CalendarClock },
  { title: "Templates", url: "/tool/disparos/templates", icon: FileText },
  { title: "Analytics", url: "/tool/disparos/analytics", icon: BarChart3 },
  { title: "Contatos", url: "/tool/disparos/contatos", icon: Users },
  { title: "Clientes", url: "/tool/disparos/clientes", icon: UserCheck },
  { title: "Histórico", url: "/tool/disparos/historico", icon: History },
  { title: "Configurações", url: "/tool/disparos/configuracoes", icon: Settings },
];

export function DisparosSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-md bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0">
            <Send className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div>
              <h1 className="text-sm font-bold text-sidebar-foreground">Disparos WhatsApp</h1>
              <p className="text-[10px] text-sidebar-foreground/60">Hub Apreenda</p>
            </div>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.end}
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground"
                    >
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/home"
                className="text-sidebar-foreground/70 hover:text-sidebar-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                {!collapsed && <span className="text-xs">Voltar ao Hub</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
