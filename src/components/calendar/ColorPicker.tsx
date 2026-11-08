import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
}

// Muted, readable on cards and as a 4px edge; matches the event-type defaults.
const PRESET_COLORS = [
  { name: "Navy", hex: "#1d2b3e" },
  { name: "Blue", hex: "#3a5a7e" },
  { name: "Indigo", hex: "#4d5fa3" },
  { name: "Violet", hex: "#7a5c9e" },
  { name: "Rose", hex: "#a3546e" },
  { name: "Red", hex: "#9a3934" },
  { name: "Copper", hex: "#9a5f2c" },
  { name: "Olive", hex: "#7a7a3a" },
  { name: "Green", hex: "#3f7d5c" },
  { name: "Teal", hex: "#2f7d78" },
];

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const [hexInput, setHexInput] = useState(value || "");

  const handleHexChange = (raw: string) => {
    // Auto-prepend # if user types without it
    let v = raw.trim();
    if (v && !v.startsWith("#")) {
      v = "#" + v;
    }
    setHexInput(v);

    // Apply if it's a valid 3 or 6 char hex
    if (/^#[0-9A-Fa-f]{6}$/.test(v) || /^#[0-9A-Fa-f]{3}$/.test(v)) {
      onChange(v);
    } else if (v === "" || v === "#") {
      onChange(null);
    }
  };

  const handlePresetClick = (hex: string) => {
    setHexInput(hex);
    onChange(hex);
  };

  return (
    <div className="space-y-2">
      <Label>Display Color</Label>
      <div className="grid grid-cols-10 gap-1.5">
        {PRESET_COLORS.map((color) => (
          <button
            key={color.hex}
            type="button"
            className={cn(
              "h-7 w-7 rounded-full border-2 transition-colors",
              value === color.hex ? "border-foreground ring-2 ring-offset-2 ring-primary" : "border-transparent hover:border-muted-foreground/50"
            )}
            style={{ backgroundColor: color.hex }}
            onClick={() => handlePresetClick(color.hex)}
            title={color.name}
          />
        ))}
      </div>
      <div className="flex gap-2 items-center">
        <div
          className="h-9 w-9 rounded-md border shrink-0"
          style={{ backgroundColor: value || "hsl(var(--muted))" }}
        />
        <Input
          type="text"
          placeholder="#3a5a7e"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          className="font-mono"
        />
        <input
          type="color"
          value={value || "#3a5a7e"}
          onChange={(e) => {
            setHexInput(e.target.value);
            onChange(e.target.value);
          }}
          className="h-9 w-12 rounded border cursor-pointer shrink-0"
          title="Pick any color"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setHexInput("");
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline whitespace-nowrap"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}
