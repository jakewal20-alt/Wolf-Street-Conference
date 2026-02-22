-- Add outcome tracking for historical pattern learning
CREATE TABLE IF NOT EXISTS public.opportunity_outcomes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.bd_opportunities(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('won', 'lost', 'no-bid', 'in-progress')),
  outcome_date DATE,
  win_probability DECIMAL(5,2), -- AI predicted probability
  actual_value DECIMAL(15,2), -- actual contract value if won
  lessons_learned TEXT,
  success_factors TEXT[], -- what worked
  failure_factors TEXT[], -- what didn't work
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add AI insights and recommendations
CREATE TABLE IF NOT EXISTS public.ai_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.bd_opportunities(id) ON DELETE CASCADE,
  recommendation_type TEXT NOT NULL, -- 'action', 'resource', 'timing', 'strategy'
  recommendation TEXT NOT NULL,
  confidence_score DECIMAL(5,2), -- 0-100
  based_on_opportunities UUID[], -- similar past opportunities used
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ -- recommendations can expire
);

-- Weekly insights summary
CREATE TABLE IF NOT EXISTS public.weekly_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  week_of DATE NOT NULL,
  pipeline_health_score DECIMAL(5,2),
  trends JSONB, -- trend analysis
  alerts JSONB, -- important alerts
  top_opportunities UUID[], -- opportunities needing attention
  insights_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.opportunity_outcomes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_insights ENABLE ROW LEVEL SECURITY;

-- RLS Policies for opportunity_outcomes
CREATE POLICY "Users can manage outcomes for their opportunities"
  ON public.opportunity_outcomes
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities 
      WHERE bd_opportunities.id = opportunity_outcomes.opportunity_id 
      AND bd_opportunities.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities 
      WHERE bd_opportunities.id = opportunity_outcomes.opportunity_id 
      AND bd_opportunities.user_id = auth.uid()
    )
  );

-- RLS Policies for ai_recommendations
CREATE POLICY "Users can view recommendations for their opportunities"
  ON public.ai_recommendations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.bd_opportunities 
      WHERE bd_opportunities.id = ai_recommendations.opportunity_id 
      AND bd_opportunities.user_id = auth.uid()
    )
  );

CREATE POLICY "System can insert AI recommendations"
  ON public.ai_recommendations
  FOR INSERT
  WITH CHECK (true);

-- RLS Policies for weekly_insights
CREATE POLICY "Users can manage their weekly insights"
  ON public.weekly_insights
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_opportunity_outcomes_opportunity ON public.opportunity_outcomes(opportunity_id);
CREATE INDEX idx_ai_recommendations_opportunity ON public.ai_recommendations(opportunity_id);
CREATE INDEX idx_weekly_insights_user_week ON public.weekly_insights(user_id, week_of);

-- Add trigger for updated_at
CREATE TRIGGER update_opportunity_outcomes_updated_at
  BEFORE UPDATE ON public.opportunity_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();