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
      <SidebarContent className="bg-[#071522] text-sidebar-foreground">
        {/* Branding */}
        <div className="flex items-center justify-center border-b border-white/10 p-5">
          {!isCollapsed && (
            <div className="flex w-full items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/95 p-1 shadow-lg"><img src="/branding/intel-hero-wolfstreet.png" alt="" className="h-full w-full rounded-lg" /></div>
              <div>
                <h1 className="font-display text-lg font-semibold tracking-tight text-white">Wolf Street</h1>
                <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/80">BD intelligence</p>
              </div>
            </div>
          )}
          {isCollapsed && (
            <img src="/branding/intel-hero-wolfstreet.png" alt="Wolf Street" className="h-9 w-9 rounded-lg" />
          )}
        </div>

        {/* Navigation */}
        <SidebarGroup>
          {!isCollapsed && <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workday</SidebarGroupLabel>}
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
                        className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
                        activeClassName="bg-cyan-300/10 text-cyan-200 font-medium"
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
          {!isCollapsed && <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Workspace</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {allWorkspaceItems.map((item) => {
                const isActive = location.pathname.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild isActive={isActive}>
                      <NavLink to={item.url} className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white" activeClassName="bg-cyan-300/10 text-cyan-200 font-medium">
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
        <div className="mt-auto border-t border-white/10 p-2">
          <SidebarMenuButton asChild>
            <button
              onClick={signOutAndClear}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-slate-400 transition-colors hover:bg-white/[0.06] hover:text-white"
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
