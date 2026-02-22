import React from "react";
import { ErrorBoundaryFallback } from "@/components/ErrorBoundaryFallback";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Keep logs concise but useful in production.
    console.error("[AppErrorBoundary] Uncaught error:", error, errorInfo);
  }

  private reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <ErrorBoundaryFallback
          error={this.state.error}
          resetErrorBoundary={this.reset}
        />
      );
    }

    return this.props.children;
  }
}
