import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  children: ReactNode;
  className?: string;
  maxWidth?: "full" | "7xl" | "6xl" | "5xl";
}

/**
 * Consistent page layout wrapper for all Wolf Street pages
 * Provides standardized spacing, max-width, and responsive behavior
 */
export function PageLayout({ children, className, maxWidth = "7xl" }: PageLayoutProps) {
  const maxWidthClass = {
    full: "max-w-full",
    "7xl": "max-w-7xl",
    "6xl": "max-w-6xl",
    "5xl": "max-w-5xl",
  }[maxWidth];

  return (
    <div className={cn(
      "min-h-screen w-full bg-gradient-to-br from-background via-background to-muted/20 p-4 sm:p-6",
      "animate-page-enter"
    )}>
      <div className={cn("mx-auto space-y-6", maxWidthClass, className)}>
        {children}
      </div>
    </div>
  );
}

interface PageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}

/**
 * Consistent page header for all Wolf Street pages
 */
export function PageHeader({ title, description, action, icon }: PageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-fade-in">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="p-2 bg-primary/10 rounded-lg">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            {title}
          </h1>
          {description && (
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              {description}
            </p>
          )}
        </div>
      </div>
      {action && <div className="w-full sm:w-auto">{action}</div>}
    </div>
  );
}
