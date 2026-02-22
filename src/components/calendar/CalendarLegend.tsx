import { useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { 
  AlertCircle, 
  AlertTriangle, 
  Clock, 
  CheckCircle, 
  XCircle,
  Calendar,
  Users,
  Plane,
  Video,
  Presentation
} from "lucide-react";

interface LegendItem {
  id: string;
  label: string;
  description: string;
  color: string;
  icon: React.ReactNode;
}

interface CalendarLegendProps {
  urgencyFilters: Record<string, boolean>;
  onToggleFilter: (key: string) => void;
  className?: string;
}

const urgencyItems: LegendItem[] = [
  {
    id: "critical",
    label: "Critical",
    description: "0-3 days",
    color: "bg-urgent",
    icon: <AlertCircle className="h-3.5 w-3.5" />,
  },
  {
    id: "high",
    label: "High Priority",
    description: "4-7 days",
    color: "bg-warning",
    icon: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  {
    id: "upcoming",
    label: "Upcoming",
    description: "8-14 days",
    color: "bg-success",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  {
    id: "normal",
    label: "Normal",
    description: "14+ days",
    color: "bg-muted",
    icon: <CheckCircle className="h-3.5 w-3.5" />,
  },
  {
    id: "expired",
    label: "Expired",
    description: "Past due",
    color: "bg-expired",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
];

const eventTypeItems: LegendItem[] = [
  {
    id: "conference",
    label: "Conference",
    description: "Events & expos",
    color: "bg-purple-500",
    icon: <Presentation className="h-3.5 w-3.5" />,
  },
  {
    id: "meeting",
    label: "Meeting",
    description: "Calls & meetings",
    color: "bg-blue-500",
    icon: <Users className="h-3.5 w-3.5" />,
  },
  {
    id: "travel",
    label: "Travel",
    description: "Trips & travel",
    color: "bg-teal-500",
    icon: <Plane className="h-3.5 w-3.5" />,
  },
  {
    id: "webinar",
    label: "Webinar",
    description: "Online events",
    color: "bg-indigo-500",
    icon: <Video className="h-3.5 w-3.5" />,
  },
];

export function CalendarLegend({ 
  urgencyFilters, 
  onToggleFilter,
  className 
}: CalendarLegendProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Urgency Section */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5" />
          Deadline Urgency
        </h4>
        <div className="flex flex-wrap gap-2">
          {urgencyItems.map((item) => {
            const isActive = urgencyFilters[item.id];
            const isHovered = hoveredItem === item.id;
            
            return (
              <button
                key={item.id}
                onClick={() => onToggleFilter(item.id)}
                onMouseEnter={() => setHoveredItem(item.id)}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn(
                  "group relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
                  "transition-all duration-300 ease-out",
                  "border-2",
                  isActive 
                    ? "border-transparent shadow-md" 
                    : "border-dashed border-muted-foreground/30 opacity-50 hover:opacity-100",
                  isHovered && isActive && "scale-105 shadow-lg",
                  isHovered && !isActive && "border-primary/50"
                )}
                style={{
                  backgroundColor: isActive ? `hsl(var(--${item.id === 'normal' ? 'muted' : item.id}))` : 'transparent',
                }}
              >
                {/* Dot indicator */}
                <span 
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-all duration-300",
                    item.color,
                    isHovered && "scale-125"
                  )}
                />
                
                {/* Label */}
                <span className={cn(
                  "transition-colors duration-200",
                  isActive ? "text-foreground" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
                
                {/* Tooltip on hover */}
                <span 
                  className={cn(
                    "absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px]",
                    "bg-popover text-popover-foreground shadow-lg border",
                    "transition-all duration-200 whitespace-nowrap",
                    isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                  )}
                >
                  {item.description}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Event Types Section */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />
          Event Types
        </h4>
        <div className="flex flex-wrap gap-2">
          {eventTypeItems.map((item) => {
            const isHovered = hoveredItem === `event-${item.id}`;
            
            return (
              <div
                key={item.id}
                onMouseEnter={() => setHoveredItem(`event-${item.id}`)}
                onMouseLeave={() => setHoveredItem(null)}
                className={cn(
                  "relative flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
                  "bg-card border shadow-sm",
                  "transition-all duration-300 ease-out",
                  isHovered && "scale-105 shadow-md border-primary/30"
                )}
              >
                <span 
                  className={cn(
                    "w-2.5 h-2.5 rounded-full transition-transform duration-300",
                    item.color,
                    isHovered && "scale-125"
                  )}
                />
                <span className="text-foreground/80">{item.label}</span>
                
                {/* Tooltip */}
                <span 
                  className={cn(
                    "absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-[10px]",
                    "bg-popover text-popover-foreground shadow-lg border",
                    "transition-all duration-200 whitespace-nowrap",
                    isHovered ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
                  )}
                >
                  {item.description}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
