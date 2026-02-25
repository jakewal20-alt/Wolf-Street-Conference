import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPersonaPromptPrefix } from "../_shared/bd-persona.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conferenceId } = await req.json();

    if (!conferenceId) {
      return new Response(
        JSON.stringify({ success: false, error: "Conference ID is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth user from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load conference data
    const { data: conference, error: confError } = await supabase
      .from('conferences')
      .select('*')
      .eq('id', conferenceId)
      .single();

    if (confError || !conference) {
      console.error('Error loading conference:', confError);
      return new Response(
        JSON.stringify({ success: false, error: "Conference not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load all leads for this conference
    const { data: leads, error: leadsError } = await supabase
      .from('conference_leads')
      .select('*')
      .eq('conference_id', conferenceId);

    if (leadsError) {
      console.error('Error loading leads:', leadsError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to load leads" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Auto-score any leads that don't have an ai_fit_score yet
    const unscoredLeads = (leads || []).filter(l => l.ai_fit_score == null);
    if (unscoredLeads.length > 0) {
      console.log(`Auto-scoring ${unscoredLeads.length} unscored leads...`);
      const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
      if (openaiApiKey) {
        const personaContext = getPersonaPromptPrefix();
        const scoringPrompt = `${personaContext}

Score each conference lead below on a scale of 0-100 for how well they fit our BD persona and company capabilities.

Scoring guidance:
- 80-100: Direct alignment with our core domains (C2, Training, AI/ML, operator interfaces, readiness)
- 60-79: Strong adjacent fit, good partnership or teaming potential
- 40-59: Moderate fit, worth tracking
- Below 40: Weak fit

For each lead, consider:
- Their role and organization
- The notes from the conversation (what was discussed, interest shown, next steps)
- Alignment with our technology stack and mission areas
- Revenue potential and timeline

Leads to score:
${unscoredLeads.map((l, i) => `${i+1}. ${l.contact_name} at ${l.company || 'Unknown'}
   Title: ${l.title || 'N/A'}
   Notes: ${(l.notes || 'No notes').substring(0, 500)}`).join('\n\n')}

Return a JSON array where each element has:
- "contact_name": exact name as provided
- "ai_fit_score": integer 0-100
- "ai_reason": 1-2 sentence explanation of score`;

        try {
          const scoreResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              max_tokens: 2000,
              messages: [
                { role: 'system', content: 'You are a BD scoring assistant. Return valid JSON only.' },
                { role: 'user', content: scoringPrompt }
              ],
              response_format: { type: 'json_object' }
            }),
          });

          if (scoreResponse.ok) {
            const scoreData = await scoreResponse.json();
            const scoreText = scoreData.choices?.[0]?.message?.content;
            if (scoreText) {
              const parsed = JSON.parse(scoreText);
              const scores = Array.isArray(parsed) ? parsed : (parsed.scores || parsed.leads || parsed.results || []);
              
              for (const score of scores) {
                const matchingLead = unscoredLeads.find(l => 
                  l.contact_name.toLowerCase() === score.contact_name?.toLowerCase()
                );
                if (matchingLead && score.ai_fit_score != null) {
                  await supabase
                    .from('conference_leads')
                    .update({ 
                      ai_fit_score: score.ai_fit_score, 
                      ai_reason: score.ai_reason,
                      updated_at: new Date().toISOString()
                    })
                    .eq('id', matchingLead.id);
                  
                  // Update in-memory too
                  const inMemoryLead = leads?.find(l => l.id === matchingLead.id);
                  if (inMemoryLead) {
                    inMemoryLead.ai_fit_score = score.ai_fit_score;
                    inMemoryLead.ai_reason = score.ai_reason;
                  }
                }
              }
              console.log(`Successfully scored ${scores.length} leads`);
            }
          } else {
            console.error('Lead scoring API error:', scoreResponse.status);
          }
        } catch (scoreError) {
          console.error('Error auto-scoring leads:', scoreError);
          // Continue with summary generation even if scoring fails
        }
      }
    }

    const linkedOpportunityIds = leads
      ?.filter(l => l.linked_opportunity_id)
      .map(l => l.linked_opportunity_id) || [];

    let opportunities: any[] = [];
    if (linkedOpportunityIds.length > 0) {
      const { data: opps, error: oppsError } = await supabase
        .from('opportunities')
        .select('id, title, status, pursuit_status')
        .in('id', linkedOpportunityIds);

      if (!oppsError && opps) {
        opportunities = opps;
      }
    }

    // Prepare data for LLM - sort leads by ai_fit_score descending so top leads are first
    const leadsSummary = (leads || [])
      .map(l => ({
        contact_name: l.contact_name,
        company: l.company,
        title: l.title || 'N/A',
        status: l.status,
        ai_fit_score: l.ai_fit_score ?? 0,
        ai_reason: l.ai_reason,
        notes: l.notes || '',
        linked_opportunity: l.linked_opportunity_id ? 'Yes' : 'No',
        source: l.source || 'manual'
      }))
      .sort((a, b) => (b.ai_fit_score || 0) - (a.ai_fit_score || 0));

    const opportunitiesSummary = opportunities.map(o => ({
      title: o.title,
      status: o.status || o.pursuit_status,
      id: o.id
    }));

    // Extract partner insights if available
    const websiteData = conference.website_data || {};
    const partnerInsights = websiteData.partner_insights || null;
    const partnerNotes = websiteData.partner_notes || null;

    let partnerContext = '';
    if (partnerInsights || partnerNotes) {
      partnerContext = `
Partner Intelligence:
${partnerNotes ? `Raw Partner Notes: ${partnerNotes.substring(0, 2000)}...` : ''}
${partnerInsights ? `
Partner Analysis:
- Key Themes: ${partnerInsights.key_themes?.join(', ') || 'N/A'}
- Strategic Opportunities: ${partnerInsights.strategic_opportunities?.join(', ') || 'N/A'}
- Competitor Intel: ${partnerInsights.competitor_intel || 'N/A'}
- Recommended Followups: ${partnerInsights.recommended_followups?.join(', ') || 'N/A'}
` : ''}
`;
    }

    const prompt = `You are an executive assistant preparing a conference summary for senior leadership. Generate a concise, metrics-driven executive summary for the following conference.

Conference Details:
- Name: ${conference.name}
- Dates: ${conference.start_date} to ${conference.end_date}
- Location: ${conference.location}
- Tags: ${conference.tags?.join(', ') || 'None'}

Leads Captured (${leadsSummary.length} total):
${JSON.stringify(leadsSummary, null, 2)}

Opportunities Created (${opportunitiesSummary.length} total):
${JSON.stringify(opportunitiesSummary, null, 2)}
${partnerContext}
Generate a JSON response with this exact structure:
{
  "headline": "1-2 sentence headline capturing the key outcome (e.g., 'I/ITSEC 2025 generated 12 high-value leads in AI training and C2 solutioning with 3 immediate opportunities.')",
  "conference_overview": "2-3 sentence paragraph explaining what this event is and why it matters to the business",
  "key_metrics": {
     "total_leads": ${leadsSummary.length},
    "high_fit_leads": ${leadsSummary.filter(l => (l.ai_fit_score || 0) >= 70).length},
    "meetings_scheduled": null,
    "new_opportunities_created": ${opportunitiesSummary.length},
    "est_pipeline_value": null
  },
  "strategic_themes": ["List 3-5 key strategic themes or technology areas that emerged, such as 'AI training dashboards', 'Front-end C2 solutioning', 'Digital twin training'${partnerInsights ? " - incorporate partner observations" : ""}"],
  "top_leads": "EXACTLY 5 leads (or all leads if fewer than 5 exist). Pick the 5 most impactful based on ai_fit_score, strategic relevance, and business potential. Each entry must have: contact_name, company, title, ai_fit_score, status, reason (1 sentence: why this lead matters). Format as array of objects.",
  "opportunity_rollup": [
    {
      "title": "Opportunity title",
      "stage": "Status or stage",
      "source": "Conference",
      "link": null
    }
  ],
  "exec_recommendations": [
    "5-10 specific, action-oriented bullets for leadership, such as:",
    "• Prioritize partnership discussion with XYZ Corp for Q2 AI training demo",
    "• Resource proposal team for ABC opportunity - due date approaching",
    "• Schedule follow-up meeting with DEF Company within 2 weeks",
    "• Green-light proof-of-concept for GHI technology integration"${partnerInsights ? ",\n    \"• Include partner-recommended follow-ups\"" : ""}
  ]${partnerInsights ? `,
  "partner_intel_summary": "1-2 sentences summarizing key partner observations and competitive intelligence"` : ''}
}

CRITICAL RULES:
1. "top_leads" MUST contain EXACTLY 5 leads (or all if fewer than 5 exist). Select the most impactful ones based on highest ai_fit_score AND strategic business value. Each must be a JSON object with: contact_name, company, title, ai_fit_score, status, reason.
2. Leads are provided pre-sorted by ai_fit_score descending — use the top ones but also consider strategic relevance.
3. Focus on business impact and revenue potential
4. Specific, actionable next steps
5. Clear prioritization guidance
6. Strategic themes that align with company capabilities${partnerInsights ? '\n7. Incorporate partner insights and competitive intelligence' : ''}`;

    // Call OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 2000,
        messages: [
          {
            role: 'system',
            content: 'You are an executive assistant creating concise, metrics-driven summaries for senior leadership. Always return valid JSON that matches the requested structure.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        response_format: { type: 'json_object' }
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.status, await aiResponse.text());
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate summary" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    const summaryText = aiData.choices[0].message.content;
    const summary = JSON.parse(summaryText);

    // Add opportunity links
    if (summary.opportunity_rollup) {
      summary.opportunity_rollup = summary.opportunity_rollup.map((opp: any) => {
        const matchingOpp = opportunities.find(o => 
          o.title.toLowerCase().includes(opp.title.toLowerCase()) ||
          opp.title.toLowerCase().includes(o.title.toLowerCase())
        );
        return {
          ...opp,
          link: matchingOpp ? `/opportunity/${matchingOpp.id}` : null
        };
      });
    }

    // Update conference with the summary
    const { error: updateError } = await supabase
      .from('conferences')
      .update({
        exec_summary: summary,
        exec_summary_generated_at: new Date().toISOString()
      })
      .eq('id', conferenceId);

    if (updateError) {
      console.error('Error updating conference:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to save summary" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, summary }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in summarize-conference-exec:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "Unknown error" 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});