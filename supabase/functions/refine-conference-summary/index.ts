import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conferenceId, feedback, currentSummary } = await req.json();
    console.log(`[refine-conference-summary] Processing feedback for conference: ${conferenceId}`);
    console.log(`[refine-conference-summary] Feedback: ${feedback}`);

    if (!conferenceId || !feedback || !currentSummary) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: conferenceId, feedback, currentSummary' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Call Lovable AI to refine the summary
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an executive communications specialist helping refine conference executive summaries.
You will be given the current summary JSON and user feedback. Your job is to update the summary based on the feedback.

RULES:
- Only modify sections the user specifically asks about
- Maintain the same JSON structure
- Keep the professional, defense-sector tone
- Be concise and impactful
- If the user asks something unclear, respond with a clarifying question instead of making changes

Current summary structure has these fields:
- headline: A punchy one-liner summary
- conference_overview: 2-3 sentence overview
- key_metrics: Object with total_leads, high_fit_leads, new_opportunities_created, est_pipeline_value
- strategic_themes: Array of theme strings
- top_leads: Array of {contact_name, company, title, reason, ai_fit_score}
- opportunity_rollup: Array of {title, stage, source, link}
- exec_recommendations: Array of recommendation strings

Respond with a JSON object containing:
- "updated": true/false (whether you made changes)
- "summary": the updated summary object (only if updated is true)
- "message": a brief message to the user explaining what you did`;

    const userPrompt = `Current Summary:
${JSON.stringify(currentSummary, null, 2)}

User Feedback:
${feedback}

Please process this feedback and return your response as JSON.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error(`[refine-conference-summary] AI API error: ${aiResponse.status} - ${errorText}`);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || '';
    console.log(`[refine-conference-summary] AI response: ${content.substring(0, 500)}...`);

    // Parse the AI response
    let result;
    try {
      // Extract JSON from the response (handle markdown code blocks)
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1].trim();
      }
      result = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error(`[refine-conference-summary] Failed to parse AI response: ${parseError}`);
      return new Response(
        JSON.stringify({ 
          message: content,
          updatedSummary: null 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If AI made updates, save to database
    if (result.updated && result.summary) {
      const { error: updateError } = await supabaseClient
        .from('conferences')
        .update({ exec_summary: result.summary })
        .eq('id', conferenceId);

      if (updateError) {
        console.error(`[refine-conference-summary] Database update error: ${updateError.message}`);
        throw updateError;
      }

      console.log(`[refine-conference-summary] Summary updated successfully`);
      return new Response(
        JSON.stringify({
          message: result.message || "Summary updated successfully.",
          updatedSummary: result.summary
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // No updates made, just return the message
    return new Response(
      JSON.stringify({
        message: result.message || "No changes were made. Please provide more specific feedback.",
        updatedSummary: null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[refine-conference-summary] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
