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
import Sso from "./pages/Sso";

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
          <Route path="/sso" element={<Sso />} />

          {/* Protected routes */}
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                {/* Wolf Street suite bar: full width above sidebar + content, like Forecast and SAMklr. */}
                <WolfStreetBar />
                <SidebarProvider className="min-h-[calc(100svh-var(--suite-bar-h,0px))]">
                  <div className="flex min-h-[calc(100svh-var(--suite-bar-h,0px))] w-full bg-background">
                    <AppSidebar />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <ScrollToTop />
                      {/* Header pins just below the suite bar. */}
                      <div className="sticky top-[var(--suite-bar-h,0px)] z-20">
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
