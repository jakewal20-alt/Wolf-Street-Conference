-- PART 3: Contacts, touchpoints, data shares, indexes, storage

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  org_name TEXT,
  role TEXT,
  email TEXT,
  phone TEXT,
  linkedin_url TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own contacts"
  ON contacts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS touchpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  date TEXT NOT NULL DEFAULT CURRENT_DATE::TEXT,
  notes TEXT,
  outcome TEXT,
  related_type TEXT,
  related_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE touchpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own touchpoints"
  ON touchpoints FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS user_data_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL DEFAULT 'calendar',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_user_id, shared_with_user_id, share_type)
);

ALTER TABLE user_data_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own data shares"
  ON user_data_shares FOR ALL
  USING (auth.uid() = owner_user_id)
  WITH CHECK (auth.uid() = owner_user_id);

CREATE POLICY "Users can view shares they receive"
  ON user_data_shares FOR SELECT
  USING (auth.uid() = shared_with_user_id);

CREATE POLICY "Users can view shared calendar events"
  ON calendar_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM user_data_shares uds
      WHERE uds.owner_user_id = calendar_events.user_id
        AND uds.shared_with_user_id = auth.uid()
        AND uds.share_type = 'calendar'
    )
  );

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_calendar_events_user ON calendar_events(user_id);
CREATE INDEX IF NOT EXISTS idx_conferences_created_by ON conferences(created_by);
CREATE INDEX IF NOT EXISTS idx_conference_leads_conference ON conference_leads(conference_id);
CREATE INDEX IF NOT EXISTS idx_conference_leads_created_by ON conference_leads(created_by);
CREATE INDEX IF NOT EXISTS idx_conference_collaborators_conference ON conference_collaborators(conference_id);
CREATE INDEX IF NOT EXISTS idx_conference_collaborators_user ON conference_collaborators(user_id);
CREATE INDEX IF NOT EXISTS idx_voice_recaps_conference ON conference_voice_recaps(conference_id);
CREATE INDEX IF NOT EXISTS idx_voice_recaps_lead ON conference_voice_recaps(lead_id);
CREATE INDEX IF NOT EXISTS idx_share_links_token ON conference_share_links(token);
CREATE INDEX IF NOT EXISTS idx_share_links_conference ON conference_share_links(conference_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_contact ON touchpoints(contact_id);

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-transcripts', 'meeting-transcripts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'meeting-transcripts' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can read meeting transcript files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'meeting-transcripts');
