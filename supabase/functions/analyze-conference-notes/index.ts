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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const { conference_id, notes } = await req.json();

    if (!conference_id || !notes) {
      throw new Error("conference_id and notes are required");
    }

    console.log(`Analyzing conference notes for conference ${conference_id}...`);

    // Fetch leads for this conference
    const { data: leads, error: leadsError } = await supabase
      .from("conference_leads")
      .select("*")
      .eq("conference_id", conference_id)
      .eq("created_by", user.id);

    if (leadsError) {
      throw leadsError;
    }

    const personaContext = getPersonaPromptPrefix();

    // Analyze notes and score leads
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: personaContext
          },
          {
            role: "user",
            content: `Analyze these conference notes and score the leads based on fit with my BD persona.

Conference Notes:
${notes}

Current Leads:
${leads.map(l => `- ${l.contact_name} at ${l.company} (${l.title || 'N/A'}): ${l.notes || 'No notes'}`).join('\n')}

Return a JSON object with:
1. summary: Brief summary of key themes from the conference notes (2-3 sentences)
2. lead_scores: Array of objects with:
   - lead_id: UUID of the lead
   - contact_name: name for reference
   - ai_fit_score: integer 0-100 based on BD persona alignment
   - ai_reason: One sentence explaining the score

Focus on front-end solutioning, operator interfaces, C2, training, AI-ML, and software capabilities.`
          }
        ],
        response_format: { type: "json_object" }
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI analysis error:", aiResponse.status, errorText);
      throw new Error(`AI analysis failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const analysisText = aiData.choices?.[0]?.message?.content;
    
    if (!analysisText) {
      throw new Error("No content in AI response");
    }

    const analysis = JSON.parse(analysisText);

    console.log("Conference notes analysis:", analysis);

    // Update leads with AI scores
    const updatePromises = analysis.lead_scores.map(async (score: any) => {
      return supabase
        .from("conference_leads")
        .update({
          ai_fit_score: score.ai_fit_score,
          ai_reason: score.ai_reason,
          updated_at: new Date().toISOString()
        })
        .eq("id", score.lead_id)
        .eq("created_by", user.id);
    });

    await Promise.all(updatePromises);

    console.log(`Updated ${analysis.lead_scores.length} leads with AI scores`);

    return new Response(
      JSON.stringify({
        success: true,
        summary: analysis.summary,
        leads_scored: analysis.lead_scores.length
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error analyzing conference notes:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500 
      }
    );
  }
});