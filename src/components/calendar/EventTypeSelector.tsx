import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface EventTypeSelectorProps {
  type: string | null;
  typeCustom: string | null;
  onChange: (type: string | null, typeCustom: string | null) => void;
}

const EVENT_TYPES = [
  { value: "meeting", label: "Meeting", icon: "👥" },
  { value: "deadline", label: "Deadline", icon: "⏰" },
  { value: "conference", label: "Conference", icon: "🎯" },
  { value: "travel", label: "Travel", icon: "✈️" },
  { value: "reminder", label: "Reminder", icon: "🔔" },
  { value: "webinar", label: "Webinar", icon: "💻" },
  { value: "custom", label: "Custom...", icon: "📝" },
];

export function EventTypeSelector({ type, typeCustom, onChange }: EventTypeSelectorProps) {
  const [showCustom, setShowCustom] = useState(!!typeCustom);
  const currentValue = typeCustom ? "custom" : type || "meeting";

  const handleTypeChange = (value: string) => {
    if (value === "custom") {
      setShowCustom(true);
      onChange(null, typeCustom || "");
    } else {
      setShowCustom(false);
      onChange(value, null);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Event Type</Label>
      <Select value={currentValue} onValueChange={handleTypeChange}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {EVENT_TYPES.map((eventType) => (
            <SelectItem key={eventType.value} value={eventType.value}>
              {eventType.icon} {eventType.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showCustom && (
        <Input
          placeholder="Enter custom event type"
          value={typeCustom || ""}
          onChange={(e) => onChange(null, e.target.value)}
        />
      )}
    </div>
  );
}
