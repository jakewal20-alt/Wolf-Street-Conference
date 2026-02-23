-- =====================================================
-- Wolf Street Conference - Clean Database Schema
-- Run this in Supabase SQL Editor (all at once)
-- =====================================================

-- 1. PROFILES (auto-created on user signup)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 2. CALENDAR EVENTS
CREATE TABLE IF NOT EXISTS calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  event_type TEXT NOT NULL DEFAULT 'custom',
  type TEXT,
  type_custom TEXT,
  all_day BOOLEAN DEFAULT false,
  color TEXT,
  color_hex TEXT,
  icon_name TEXT,
  invite_email TEXT,
  registration_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own calendar events"
  ON calendar_events FOR ALL USING (auth.uid() = user_id);

-- 3. CONFERENCES
CREATE TABLE IF NOT EXISTS conferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  location TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  source_url TEXT,
  tags TEXT[],
  website_data JSONB,
  exec_summary JSONB,
  exec_summary_generated_at TIMESTAMPTZ,
  calendar_event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
  calendar_source TEXT,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE conferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conferences"
  ON conferences FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can insert own conferences"
  ON conferences FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own conferences"
  ON conferences FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete own conferences"
  ON conferences FOR DELETE USING (auth.uid() = created_by);

-- Collaborators can view shared conferences
CREATE POLICY "Collaborators can view conferences"
  ON conferences FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conference_collaborators cc
      WHERE cc.conference_id = id AND cc.user_id = auth.uid()
    )
  );

-- 4. CONFERENCE COLLABORATORS
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
  ON conference_collaborators FOR ALL USING (
    EXISTS (
      SELECT 1 FROM conferences c WHERE c.id = conference_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Collaborators can view their own membership"
  ON conference_collaborators FOR SELECT USING (auth.uid() = user_id);

-- 5. CONFERENCE LEADS
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
  ON conference_leads FOR ALL USING (auth.uid() = created_by);

CREATE POLICY "Conference owners can view all leads"
  ON conference_leads FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conferences c WHERE c.id = conference_id AND c.created_by = auth.uid()
    )
  );

CREATE POLICY "Collaborators can view all conference leads"
  ON conference_leads FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conference_collaborators cc
      WHERE cc.conference_id = conference_leads.conference_id AND cc.user_id = auth.uid()
    )
  );

-- 6. CONFERENCE VOICE RECAPS (NEW)
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
  ON conference_voice_recaps FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conferences c WHERE c.id = conference_id AND c.created_by = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM conference_collaborators cc
      WHERE cc.conference_id = conference_voice_recaps.conference_id AND cc.user_id = auth.uid()
    )
  );

-- 7. CONFERENCE SHARE LINKS (NEW)
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

-- Public access via share links for voice recaps
CREATE POLICY "Public can view recaps via share link"
  ON conference_voice_recaps FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conference_share_links sl
      WHERE sl.conference_id = conference_voice_recaps.conference_id
        AND sl.is_active = true
        AND (sl.expires_at IS NULL OR sl.expires_at > now())
    )
  );

-- Public access via share links for leads
CREATE POLICY "Public can view leads via share link"
  ON conference_leads FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM conference_share_links sl
      WHERE sl.conference_id = conference_leads.conference_id
        AND sl.is_active = true
        AND (sl.expires_at IS NULL OR sl.expires_at > now())
    )
  );

-- 8. CONTACTS
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
  ON contacts FOR ALL USING (auth.uid() = user_id);

-- 9. TOUCHPOINTS (contact interaction log)
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
  ON touchpoints FOR ALL USING (auth.uid() = user_id);

-- 10. USER DATA SHARES (calendar sharing between users)
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
  ON user_data_shares FOR ALL USING (auth.uid() = owner_user_id);

CREATE POLICY "Users can view shares they receive"
  ON user_data_shares FOR SELECT USING (auth.uid() = shared_with_user_id);

-- Shared calendar events: users can view events from people who shared with them
CREATE POLICY "Users can view shared calendar events"
  ON calendar_events FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_data_shares uds
      WHERE uds.owner_user_id = calendar_events.user_id
        AND uds.shared_with_user_id = auth.uid()
        AND uds.share_type = 'calendar'
    )
  );

-- =====================================================
-- INDEXES
-- =====================================================
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

-- =====================================================
-- STORAGE BUCKET for audio/images
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('meeting-transcripts', 'meeting-transcripts', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'meeting-transcripts' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can read meeting transcript files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'meeting-transcripts');
