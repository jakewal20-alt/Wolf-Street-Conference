import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { 
  Calendar, 
  Flag, 
  Briefcase, 
  Star, 
  MapPin, 
  Users, 
  Plane, 
  AlertCircle,
  Video,
  Clock,
  Target,
  Presentation
} from "lucide-react";

interface IconSelectorProps {
  value: string | null;
  onChange: (icon: string | null) => void;
}

const ICON_OPTIONS = [
  { name: "calendar", Icon: Calendar, label: "Calendar" },
  { name: "flag", Icon: Flag, label: "Flag" },
  { name: "briefcase", Icon: Briefcase, label: "Briefcase" },
  { name: "star", Icon: Star, label: "Star" },
  { name: "map-pin", Icon: MapPin, label: "Map Pin" },
  { name: "users", Icon: Users, label: "Users" },
  { name: "plane", Icon: Plane, label: "Plane" },
  { name: "alert", Icon: AlertCircle, label: "Alert" },
  { name: "video", Icon: Video, label: "Video" },
  { name: "clock", Icon: Clock, label: "Clock" },
  { name: "target", Icon: Target, label: "Target" },
  { name: "presentation", Icon: Presentation, label: "Presentation" },
];

export function IconSelector({ value, onChange }: IconSelectorProps) {
  return (
    <div className="space-y-2">
      <Label>Icon (Optional)</Label>
      <div className="grid grid-cols-6 gap-2">
        {ICON_OPTIONS.map(({ name, Icon, label }) => (
          <button
            key={name}
            type="button"
            className={cn(
              "h-10 rounded-md border-2 transition-all hover:scale-105 flex items-center justify-center",
              value === name ? "border-foreground bg-accent" : "border-border hover:border-foreground/50"
            )}
            onClick={() => onChange(value === name ? null : name)}
            title={label}
          >
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Clear icon
        </button>
      )}
    </div>
  );
}
