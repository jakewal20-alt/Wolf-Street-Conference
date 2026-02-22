import { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center justify-center py-16 px-4 text-center", className)}>
      {/* Animated Icon Container */}
      <div className="relative mb-6">
        {/* Background circles with pulsing animation */}
        <div className="absolute inset-0 -m-8">
          <div className="absolute inset-0 rounded-full bg-primary/5 animate-pulse" 
               style={{ animationDuration: "3s" }} />
          <div className="absolute inset-4 rounded-full bg-primary/10 animate-pulse" 
               style={{ animationDuration: "2.5s", animationDelay: "0.5s" }} />
        </div>
        
        {/* Floating icon with subtle movement */}
        <div 
          className="relative bg-gradient-to-br from-primary/10 to-primary/5 p-8 rounded-full animate-float"
          style={{
            animation: "float 3s ease-in-out infinite",
          }}
        >
          <Icon className="h-12 w-12 text-primary/70" />
        </div>
      </div>

      {/* Content */}
      <h3 className="text-xl font-semibold text-foreground mb-2 animate-fade-in">
        {title}
      </h3>
      <p 
        className="text-muted-foreground max-w-md mb-6 animate-fade-in"
        style={{ animationDelay: "0.1s" }}
      >
        {description}
      </p>

      {/* Action Button */}
      {action && (
        <Button
          onClick={action.onClick}
          className="animate-fade-in"
          style={{ animationDelay: "0.2s" }}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
