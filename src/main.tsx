import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider defaultTheme="system" storageKey="wolf-street-theme">
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </ThemeProvider>
);
