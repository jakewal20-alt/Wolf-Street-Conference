import { useEffect, useState } from "react";
import { CalendarDays, Calendar, UserRound, Settings, LogOut, Shield, Sparkles } from "lucide-react";
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
import { signOutAndClear } from "@/lib/signOut";

const navigationItems = [
  { title: "Today", url: "/", icon: Sparkles },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  { title: "Conferences", url: "/conferences", icon: CalendarDays },
  { title: "Relationships", url: "/contacts", icon: UserRound },
];

const workspaceItems = [{ title: "Settings", url: "/settings", icon: Settings }];

const adminItems = [
  { title: "Users", url: "/admin/users", icon: Shield },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      setIsAdmin(profile?.is_admin ?? false);
    };

    checkAdmin();
  }, []);

  const allWorkspaceItems = isAdmin ? [...workspaceItems, ...adminItems] : workspaceItems;

  return (
    <Sidebar className={isCollapsed ? "w-14 border-r-0" : "w-64 border-r-0"} collapsible="icon">
      <SidebarContent className="bg-sidebar text-sidebar-foreground">
        {/* Branding */}
        <div className="flex items-center justify-center border-b border-sidebar-border p-5">
          {!isCollapsed && (
            <div className="flex w-full items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#0c1522] p-1"><img src="/branding/wolfstreet-mark.png" alt="" className="h-full w-full object-contain" /></div>
              <div>
                <h1 className="font-display text-lg font-semibold tracking-tight text-sidebar-accent-foreground">Hallway</h1>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-primary">A Wolf Street app</p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#0c1522] p-1"><img src="/branding/wolfstreet-mark.png" alt="Hallway" className="h-full w-full object-contain" /></div>
          )}
        </div>

        {/* Navigation */}
        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60">Workday</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => {
                const isActive = item.url === "/"
                  ? location.pathname === "/"
                  : location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
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

        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-sidebar-foreground/60">Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {allWorkspaceItems.map((item) => {
                const isActive = location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink to={item.url} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                        <item.icon className="h-5 w-5" />{!isCollapsed && <span>{item.title}</span>}
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
              onClick={signOutAndClear}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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
