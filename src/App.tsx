import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageTransition } from "@/components/PageTransition";
import { ThemeToggle } from "@/components/ThemeToggle";
import Conferences from "./pages/Conferences";
import Calendar from "./pages/Calendar";
import Contacts from "./pages/Contacts";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import SharedConference from "./pages/SharedConference";

const queryClient = new QueryClient();

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
                  <div className="flex min-h-screen w-full">
                    <AppSidebar />
                    <div className="flex-1 flex flex-col">
                      <header className="h-14 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-md sticky top-0 z-10">
                        <div className="flex items-center gap-3">
                          <SidebarTrigger />
                          <span className="text-sm font-medium text-muted-foreground hidden sm:inline">
                            Wolf Street Conference
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <ThemeToggle />
                        </div>
                      </header>
                      <main className="flex-1">
                        <PageTransition>
                          <Routes>
                            <Route path="/" element={<Conferences />} />
                            <Route path="/conferences" element={<Navigate to="/" replace />} />
                            <Route path="/calendar" element={<Calendar />} />
                            <Route path="/contacts" element={<Contacts />} />
                            <Route path="/settings" element={<Settings />} />
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
