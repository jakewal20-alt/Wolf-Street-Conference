import { Users, Calendar, UserRound, Settings, LogOut } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  { title: "Conferences", url: "/", icon: Users },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Contacts", url: "/contacts", icon: UserRound },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-60"} collapsible="icon">
      <SidebarContent>
        {/* Branding */}
        <div className="flex items-center justify-center p-6 border-b border-sidebar-border">
          {!isCollapsed && (
            <div className="text-center">
              <h1 className="text-2xl font-display font-bold text-sidebar-foreground tracking-tight">
                Wolf Street
              </h1>
              <p className="text-xs text-sidebar-foreground/60 mt-1 font-medium">
                Conference Intelligence
              </p>
            </div>
          )}
          {isCollapsed && (
            <span className="text-xl font-display font-bold text-sidebar-primary">WS</span>
          )}
        </div>

        {/* Navigation */}
        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel>Navigation</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        end
                        className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="h-5 w-5" />
                        {!isCollapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout */}
        <div className="mt-auto border-t border-sidebar-border p-2">
          <SidebarMenuButton asChild>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = '/auth';
              }}
              className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent w-full text-left"
            >
              <LogOut className="h-5 w-5" />
              {!isCollapsed && <span>Logout</span>}
            </button>
          </SidebarMenuButton>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
