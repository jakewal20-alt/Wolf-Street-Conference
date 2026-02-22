-- Add event type, custom type, color, and icon fields to calendar_events
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS type text,
ADD COLUMN IF NOT EXISTS type_custom text,
ADD COLUMN IF NOT EXISTS color_hex text,
ADD COLUMN IF NOT EXISTS icon_name text;

-- Add check constraint for color_hex format (optional but good practice)
ALTER TABLE calendar_events
ADD CONSTRAINT color_hex_format CHECK (color_hex IS NULL OR color_hex ~ '^#[0-9A-Fa-f]{6}$');

-- Create index for faster type queries
CREATE INDEX IF NOT EXISTS idx_calendar_events_type ON calendar_events(type);