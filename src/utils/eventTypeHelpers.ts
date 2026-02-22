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
    defaultColor: "#8B5CF6", // purple
    defaultIcon: "presentation",
  },
  meeting: {
    label: "Meeting",
    defaultColor: "#3B82F6", // blue
    defaultIcon: "users",
  },
  deadline: {
    label: "Deadline",
    defaultColor: "#EF4444", // red
    defaultIcon: "alert",
  },
  travel: {
    label: "Travel",
    defaultColor: "#14B8A6", // teal
    defaultIcon: "plane",
  },
  webinar: {
    label: "Webinar",
    defaultColor: "#6366F1", // indigo
    defaultIcon: "video",
  },
  reminder: {
    label: "Reminder",
    defaultColor: "#F59E0B", // orange
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

export function getEventTypeLabel(type: string | null, typeCustom: string | null): string {
  if (typeCustom) return typeCustom;
  if (!type) return "Meeting"; // default
  return EVENT_TYPE_MAP[type]?.label || type.charAt(0).toUpperCase() + type.slice(1);
}

export function getEventColor(
  colorHex: string | null, 
  type: string | null
): string {
  if (colorHex) return colorHex;
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
