import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
}

const PRESET_COLORS = [
  { name: "Purple", hex: "#8B5CF6" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Green", hex: "#10B981" },
  { name: "Red", hex: "#EF4444" },
  { name: "Orange", hex: "#F59E0B" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Teal", hex: "#14B8A6" },
  { name: "Indigo", hex: "#6366F1" },
];

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="space-y-2">
      <Label>Display Color (Optional)</Label>
      <div className="grid grid-cols-4 gap-2 mb-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color.hex}
            type="button"
            className={cn(
              "h-10 rounded-md border-2 transition-all hover:scale-105",
              value === color.hex ? "border-foreground ring-2 ring-offset-2" : "border-border"
            )}
            style={{ backgroundColor: color.hex }}
            onClick={() => onChange(color.hex)}
            title={color.name}
          />
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <Input
          type="text"
          placeholder="#4F46E5"
          value={value || ""}
          onChange={(e) => onChange(e.target.value || null)}
          pattern="^#[0-9A-Fa-f]{6}$"
          className="font-mono"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
