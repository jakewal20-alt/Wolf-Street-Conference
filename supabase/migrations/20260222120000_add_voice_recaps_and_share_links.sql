-- Voice recaps table for conference conversation recordings
CREATE TABLE IF NOT EXISTS conference_voice_recaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES conference_leads(id) ON DELETE SET NULL,
  recorded_by UUID NOT NULL REFERENCES auth.users(id),
  audio_url TEXT,
  transcript TEXT,
  ai_summary TEXT,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Share links table for public read-only conference access
CREATE TABLE IF NOT EXISTS conference_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_voice_recaps_conference ON conference_voice_recaps(conference_id);
CREATE INDEX IF NOT EXISTS idx_voice_recaps_lead ON conference_voice_recaps(lead_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON conference_share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_conference ON conference_share_links(conference_id);

-- Enable RLS
ALTER TABLE conference_voice_recaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE conference_share_links ENABLE ROW LEVEL SECURITY;

-- RLS for conference_voice_recaps:
-- Users can insert their own recaps
CREATE POLICY "Users can insert own voice recaps"
  ON conference_voice_recaps FOR INSERT
  WITH CHECK (auth.uid() = recorded_by);

-- Users can view recaps if they are the conference owner or a collaborator
CREATE POLICY "Users can view recaps for their conferences"
  ON conference_voice_recaps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conferences c WHERE c.id = conference_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM conference_collaborators cc WHERE cc.conference_id = conference_voice_recaps.conference_id AND cc.user_id = auth.uid()
    )
  );

-- Public read access via valid share token (for the /shared/:token route)
-- This requires the anon key to query - we handle token validation in the app
CREATE POLICY "Public can view recaps via share link"
  ON conference_voice_recaps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conference_share_links sl
      WHERE sl.conference_id = conference_voice_recaps.conference_id
        AND sl.is_active = true
        AND (sl.expires_at IS NULL OR sl.expires_at > now())
    )
  );

-- RLS for conference_share_links:
-- Only conference owner can manage share links
CREATE POLICY "Conference owner can manage share links"
  ON conference_share_links FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Anyone can read active share links (needed for public /shared/:token route)
CREATE POLICY "Public can read active share links"
  ON conference_share_links FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Update conference_leads RLS to allow collaborators to see all leads
-- Drop existing restrictive policy if it exists and create a broader one
DO $$
BEGIN
  -- Add policy for collaborators to see all leads in shared conferences
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Collaborators can view all conference leads' AND tablename = 'conference_leads'
  ) THEN
    CREATE POLICY "Collaborators can view all conference leads"
      ON conference_leads FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM conference_collaborators cc
          WHERE cc.conference_id = conference_leads.conference_id AND cc.user_id = auth.uid()
        )
      );
  END IF;

  -- Add policy for public share link access to leads
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'Public can view leads via share link' AND tablename = 'conference_leads'
  ) THEN
    CREATE POLICY "Public can view leads via share link"
      ON conference_leads FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM conference_share_links sl
          WHERE sl.conference_id = conference_leads.conference_id
            AND sl.is_active = true
            AND (sl.expires_at IS NULL OR sl.expires_at > now())
        )
      );
  END IF;
END $$;
