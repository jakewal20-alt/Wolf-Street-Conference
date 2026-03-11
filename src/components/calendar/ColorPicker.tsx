import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ColorPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
}

const PRESET_COLORS = [
  { name: "Red", hex: "#EF4444" },
  { name: "Orange", hex: "#F97316" },
  { name: "Amber", hex: "#F59E0B" },
  { name: "Yellow", hex: "#EAB308" },
  { name: "Lime", hex: "#84CC16" },
  { name: "Green", hex: "#22C55E" },
  { name: "Emerald", hex: "#10B981" },
  { name: "Teal", hex: "#14B8A6" },
  { name: "Cyan", hex: "#06B6D4" },
  { name: "Sky", hex: "#0EA5E9" },
  { name: "Blue", hex: "#3B82F6" },
  { name: "Indigo", hex: "#6366F1" },
  { name: "Violet", hex: "#8B5CF6" },
  { name: "Purple", hex: "#A855F7" },
  { name: "Fuchsia", hex: "#D946EF" },
  { name: "Pink", hex: "#EC4899" },
  { name: "Rose", hex: "#F43F5E" },
  { name: "Slate", hex: "#64748B" },
  { name: "Brown", hex: "#92400E" },
  { name: "Navy", hex: "#1E3A5F" },
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
              "h-7 w-7 rounded-full border-2 transition-all hover:scale-110",
              value === color.hex ? "border-foreground ring-2 ring-offset-2 ring-primary scale-110" : "border-transparent hover:border-muted-foreground/50"
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
          style={{ backgroundColor: value || "#e5e7eb" }}
        />
        <Input
          type="text"
          placeholder="#4F46E5"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          className="font-mono"
        />
        <input
          type="color"
          value={value || "#3B82F6"}
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
