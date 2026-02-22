-- Create conference_collaborators table for sharing conferences with partners
CREATE TABLE public.conference_collaborators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conference_id UUID NOT NULL REFERENCES public.conferences(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    invited_by UUID NOT NULL,
    role TEXT NOT NULL DEFAULT 'partner',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(conference_id, user_id)
);

-- Enable RLS
ALTER TABLE public.conference_collaborators ENABLE ROW LEVEL SECURITY;

-- Owner can manage collaborators
CREATE POLICY "Conference owners can manage collaborators"
ON public.conference_collaborators
FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.conferences 
        WHERE id = conference_collaborators.conference_id 
        AND created_by = auth.uid()
    )
);

-- Collaborators can view their own collaborations
CREATE POLICY "Users can view their collaborations"
ON public.conference_collaborators
FOR SELECT
USING (user_id = auth.uid());

-- Update conference_leads RLS to allow collaborators to view all leads
DROP POLICY IF EXISTS "Users can view own leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can insert own leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can update own leads" ON public.conference_leads;
DROP POLICY IF EXISTS "Users can delete own leads" ON public.conference_leads;

-- View: Owner or collaborator can see all leads for shared conferences
CREATE POLICY "Users can view leads for owned or shared conferences"
ON public.conference_leads
FOR SELECT
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.conference_collaborators
        WHERE conference_id = conference_leads.conference_id
        AND user_id = auth.uid()
    )
    OR EXISTS (
        SELECT 1 FROM public.conferences
        WHERE id = conference_leads.conference_id
        AND created_by = auth.uid()
    )
);

-- Insert: Owner or collaborator can add leads
CREATE POLICY "Users can insert leads for owned or shared conferences"
ON public.conference_leads
FOR INSERT
WITH CHECK (
    created_by = auth.uid()
    AND (
        EXISTS (
            SELECT 1 FROM public.conferences
            WHERE id = conference_leads.conference_id
            AND created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.conference_collaborators
            WHERE conference_id = conference_leads.conference_id
            AND user_id = auth.uid()
        )
    )
);

-- Update: Only edit your own leads
CREATE POLICY "Users can update their own leads"
ON public.conference_leads
FOR UPDATE
USING (created_by = auth.uid());

-- Delete: Only delete your own leads
CREATE POLICY "Users can delete their own leads"
ON public.conference_leads
FOR DELETE
USING (created_by = auth.uid());

-- Allow collaborators to view the conference itself
DROP POLICY IF EXISTS "Users can view own conferences" ON public.conferences;

CREATE POLICY "Users can view owned or shared conferences"
ON public.conferences
FOR SELECT
USING (
    created_by = auth.uid()
    OR EXISTS (
        SELECT 1 FROM public.conference_collaborators
        WHERE conference_id = conferences.id
        AND user_id = auth.uid()
    )
);