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
  Presentation,
  LucideIcon
} from "lucide-react";

export interface EventTypeConfig {
  label: string;
  defaultColor: string;
  defaultIcon: string;
}

const EVENT_TYPE_MAP: Record<string, EventTypeConfig> = {
  conference: {
    label: "Conference",
    defaultColor: "#7a5c9e", // muted violet
    defaultIcon: "presentation",
  },
  meeting: {
    label: "Meeting",
    defaultColor: "#3a5a7e", // info blue
    defaultIcon: "users",
  },
  deadline: {
    label: "Deadline",
    defaultColor: "#9a3934", // danger
    defaultIcon: "alert",
  },
  travel: {
    label: "Travel",
    defaultColor: "#2f7d78", // muted teal
    defaultIcon: "plane",
  },
  webinar: {
    label: "Webinar",
    defaultColor: "#4d5fa3", // slate indigo
    defaultIcon: "video",
  },
  reminder: {
    label: "Reminder",
    defaultColor: "#9a5f2c", // copper
    defaultIcon: "clock",
  },
};

const ICON_MAP: Record<string, LucideIcon> = {
  calendar: Calendar,
  flag: Flag,
  briefcase: Briefcase,
  star: Star,
  "map-pin": MapPin,
  users: Users,
  plane: Plane,
  alert: AlertCircle,
  video: Video,
  clock: Clock,
  target: Target,
  presentation: Presentation,
};

// Event-type colours, in Wolf Street's palette. The legend reads from here too.
export const EVENT_TYPES = EVENT_TYPE_MAP;

// Defaults saved before the palette change (Tailwind 500s). Events stored with one of these show
// the current default for their type instead, so old and new events match.
const LEGACY_DEFAULTS = new Set(["#8b5cf6", "#3b82f6", "#ef4444", "#14b8a6", "#6366f1", "#f59e0b", "#10b981"]);

export function getEventTypeLabel(type: string | null, typeCustom: string | null): string {
  if (typeCustom) return typeCustom;
  if (!type) return "Meeting"; // default
  return EVENT_TYPE_MAP[type]?.label || type.charAt(0).toUpperCase() + type.slice(1);
}

export function getEventColor(
  colorHex: string | null, 
  type: string | null
): string {
  if (colorHex && !LEGACY_DEFAULTS.has(colorHex.toLowerCase())) return colorHex;
  if (!type) return EVENT_TYPE_MAP.meeting.defaultColor;
  return EVENT_TYPE_MAP[type]?.defaultColor || EVENT_TYPE_MAP.meeting.defaultColor;
}

export function getEventIcon(
  iconName: string | null,
  type: string | null
): LucideIcon {
  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName];
  if (!type) return ICON_MAP[EVENT_TYPE_MAP.meeting.defaultIcon];
  const defaultIcon = EVENT_TYPE_MAP[type]?.defaultIcon;
  return ICON_MAP[defaultIcon] || ICON_MAP.calendar;
}

export function getEventIconName(
  iconName: string | null,
  type: string | null
): string {
  if (iconName) return iconName;
  if (!type) return EVENT_TYPE_MAP.meeting.defaultIcon;
  return EVENT_TYPE_MAP[type]?.defaultIcon || "calendar";
}
