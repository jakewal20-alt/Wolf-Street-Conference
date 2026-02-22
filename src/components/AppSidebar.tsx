import { LayoutDashboard, Radar, Calendar, FileText, Settings, LogOut, Bell, FolderOpen, TrendingUp, Shield, Brain, Target, Zap, RefreshCw, Presentation, Users, Award, Crosshair, UserRound, ClipboardList } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

const navigationItems = [
  { title: "Dashboard (Home)", url: "/intelligence", icon: Brain },
  { title: "Awards & Sub Dashboard", url: "/today", icon: Crosshair },
  { title: "Opportunities Table", url: "/matches", icon: Target },
  { title: "Radar by Hunt", url: "/radar", icon: Radar },
  { title: "Awards & Subs", url: "/awards", icon: Award },
  { title: "Contacts", url: "/contacts", icon: UserRound },
  { title: "Conferences", url: "/conferences", icon: Users },
  { title: "Documents", url: "/documents", icon: FolderOpen },
  { title: "Intel Feed", url: "/intel", icon: Zap },
  { title: "Calendar", url: "/calendar", icon: Calendar },
  
  { title: "BD Meeting Pipeline", url: "/bd-meeting-pipeline", icon: ClipboardList },
  { title: "Notifications", url: "/notifications", icon: Bell },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const isCollapsed = state === "collapsed";

  // Check if current user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ['user-is-admin'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      return !!data;
    },
  });

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
                Business Intelligence
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

        {/* Admin Section */}
        {isAdmin && (
          <SidebarGroup>
            {!isCollapsed && <SidebarGroupLabel>Advanced</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/admin'}>
                    <NavLink
                      to="/admin"
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <Shield className="h-5 w-5" />
                      {!isCollapsed && <span>Admin Panel</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={location.pathname === '/admin/sync'}>
                    <NavLink
                      to="/admin/sync"
                      className="flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                    >
                      <RefreshCw className="h-5 w-5" />
                      {!isCollapsed && <span>Manual Sync</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

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
