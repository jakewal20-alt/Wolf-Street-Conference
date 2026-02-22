-- Allow public read access to bd_opportunities when no auth
CREATE POLICY "Public can view bd_opportunities"
ON public.bd_opportunities
FOR SELECT
USING (true);

-- Allow public read access to bd_opportunity_status when no auth
CREATE POLICY "Public can view bd_opportunity_status"
ON public.bd_opportunity_status
FOR SELECT
USING (true);

-- Allow public read access to bd_transcripts when no auth
CREATE POLICY "Public can view bd_transcripts"
ON public.bd_transcripts
FOR SELECT
USING (true);