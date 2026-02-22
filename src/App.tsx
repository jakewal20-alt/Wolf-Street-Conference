import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AICopilot } from "@/components/AICopilot";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { PageTransition } from "@/components/PageTransition";
import { NavigationProgress } from "@/components/NavigationProgress";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Shield } from "lucide-react";
import Notifications from "./pages/Notifications";
import Intelligence from "./pages/Intelligence";
import Capabilities from "./pages/Capabilities";
import DocumentLibrary from "./pages/DocumentLibrary";
import Index from "./pages/Index";
import OpportunityDetail from "./pages/OpportunityDetail";
import ProposalBuilder from "./pages/ProposalBuilder";
import Radar from "./pages/Radar";
import Calendar from "./pages/Calendar";
import Settings from "./pages/Settings";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import AdminPanel from "./pages/AdminPanel";
import Matches from "./pages/Matches";
import AdminSync from "./pages/AdminSync";
import IntelFeed from "./pages/IntelFeed";
import MeetingPipeline from "./pages/MeetingPipeline";

import BDMeetingPipeline from "./pages/BDMeetingPipeline";
import CompanyHealthReport from "./pages/CompanyHealthReport";
import Conferences from "./pages/Conferences";
import AwardedContracts from "./pages/AwardedContracts";
import TodayTargets from "./pages/TodayTargets";
import Contacts from "./pages/Contacts";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <NavigationProgress />
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<Auth />} />
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
                            Gov/Defense Cockpit
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-success/10 text-success text-xs font-medium">
                            <Shield className="h-3 w-3" />
                            <span className="hidden sm:inline">Secure workspace</span>
                          </div>
                          <ThemeToggle />
                        </div>
                      </header>
                      <main className="flex-1">
                        <PageTransition>
                          <Routes>
                            <Route path="/" element={<Navigate to="/intelligence" replace />} />
                            <Route path="/documents" element={<DocumentLibrary />} />
                            <Route path="/opportunity/:id" element={<OpportunityDetail />} />
                            <Route path="/proposal/:proposalId" element={<ProposalBuilder />} />
                            <Route path="/radar" element={<Radar />} />
                            <Route path="/matches" element={<Matches />} />
                            <Route path="/intel" element={<IntelFeed />} />
                            <Route path="/conferences" element={<Conferences />} />
                            <Route path="/awards" element={<AwardedContracts />} />
                            <Route path="/contacts" element={<Contacts />} />
                            <Route path="/calendar" element={<Calendar />} />
                            <Route path="/meeting-pipeline" element={<MeetingPipeline />} />
                            
                            <Route path="/bd-meeting-pipeline" element={<BDMeetingPipeline />} />
                            <Route path="/company-health-report" element={<CompanyHealthReport />} />
                            <Route path="/notifications" element={<Notifications />} />
                            <Route path="/today" element={<TodayTargets />} />
                            <Route path="/capabilities" element={<Capabilities />} />
                            <Route path="/intelligence" element={<Intelligence />} />
                            <Route path="/settings" element={<Settings />} />
                            <Route path="/admin" element={<AdminPanel />} />
                            <Route path="/admin/sync" element={<AdminSync />} />
                            <Route path="*" element={<NotFound />} />
                          </Routes>
                        </PageTransition>
                      </main>
                    </div>
                    <AICopilot />
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
