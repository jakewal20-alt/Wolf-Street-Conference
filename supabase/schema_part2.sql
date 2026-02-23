-- PART 2: Conference sub-tables (collaborators, leads, voice recaps, share links)

CREATE TABLE IF NOT EXISTS conference_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES auth.users(id),
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(conference_id, user_id)
);

ALTER TABLE conference_collaborators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conference owners can manage collaborators"
  ON conference_collaborators FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM conferences c WHERE c.id = conference_id AND c.created_by = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conferences c WHERE c.id = conference_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Collaborators can view their own membership"
  ON conference_collaborators FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Collaborators can view conferences"
  ON conferences FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conference_collaborators cc
      WHERE cc.conference_id = id AND cc.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS conference_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  contact_name TEXT NOT NULL,
  company TEXT NOT NULL,
  title TEXT,
  email TEXT,
  phone TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  source TEXT NOT NULL DEFAULT 'manual',
  card_image_url TEXT,
  ai_fit_score NUMERIC,
  ai_reason TEXT,
  linked_opportunity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE conference_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own conference leads"
  ON conference_leads FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Conference owners can view all leads"
  ON conference_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conferences c WHERE c.id = conference_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Collaborators can view all conference leads"
  ON conference_leads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conference_collaborators cc
      WHERE cc.conference_id = conference_leads.conference_id AND cc.user_id = auth.uid()
    )
  );

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

ALTER TABLE conference_voice_recaps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own voice recaps"
  ON conference_voice_recaps FOR INSERT
  WITH CHECK (auth.uid() = recorded_by);

CREATE POLICY "Users can view recaps for their conferences"
  ON conference_voice_recaps FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM conferences c WHERE c.id = conference_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM conference_collaborators cc
      WHERE cc.conference_id = conference_voice_recaps.conference_id AND cc.user_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS conference_share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conference_id UUID NOT NULL REFERENCES conferences(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE conference_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Conference owner can manage share links"
  ON conference_share_links FOR ALL
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Public can read active share links"
  ON conference_share_links FOR SELECT
  USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

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
