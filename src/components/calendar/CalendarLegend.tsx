import { useState } from "react";
import { cn } from "@/lib/utils";
import {
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
  className?: string;
}

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
  className
}: CalendarLegendProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <div className={cn("space-y-2", className)}>
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
