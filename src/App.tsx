import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageTransition } from "@/components/PageTransition";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WolfStreetBar } from "@/components/WolfStreetBar";
import Conferences from "./pages/Conferences";
import Calendar from "./pages/Calendar";
import Contacts from "./pages/Contacts";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import SharedConference from "./pages/SharedConference";
import AdminUsers from "./pages/AdminUsers";
import Today from "./pages/Today";

const queryClient = new QueryClient();

/** New page, new scroll: open each page at the top instead of the previous page's scroll position. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<Auth />} />
          <Route path="/shared/:token" element={<SharedConference />} />

          {/* Protected routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <SidebarProvider>
                  <div className="flex min-h-screen w-full bg-background">
                    <AppSidebar />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <ScrollToTop />
                      {/* Suite bar + header stay pinned together, so the bar is on every page. */}
                      <div className="sticky top-0 z-20">
                      <WolfStreetBar />
                      <header className="flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6">
                        <div className="flex items-center gap-3">
                          <SidebarTrigger />
                          <span className="hidden text-sm font-semibold text-foreground sm:inline">Relationship intelligence</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ThemeToggle />
                        </div>
                      </header>
                      </div>
                      <main className="flex-1">
                        <PageTransition>
                          <Routes>
                            <Route path="/" element={<Today />} />
                            <Route path="/conferences" element={<Conferences />} />
                            <Route path="/calendar" element={<Calendar />} />
                            <Route path="/contacts" element={<Contacts />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/admin/users" element={<AdminUsers />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </PageTransition>
                      </main>
                    </div>
                  </div>
                </SidebarProvider>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
