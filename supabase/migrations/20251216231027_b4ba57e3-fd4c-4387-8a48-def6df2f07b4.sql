-- Drop the overly permissive public SELECT policy on bd_transcripts
DROP POLICY IF EXISTS "Public can view bd_transcripts" ON bd_transcripts;

-- The existing "Users can manage their BD transcripts" policy already handles proper access control
-- with USING (auth.uid() = user_id)