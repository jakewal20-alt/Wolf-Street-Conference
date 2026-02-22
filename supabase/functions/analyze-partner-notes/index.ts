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

    console.log(`Analyzing partner notes for conference ${conference_id}...`);

    // Fetch existing leads for this conference
    const { data: existingLeads, error: leadsError } = await supabase
      .from("conference_leads")
      .select("*")
      .eq("conference_id", conference_id)
      .eq("created_by", user.id);

    if (leadsError) {
      throw leadsError;
    }

    // Fetch conference to store partner notes
    const { data: conference, error: confError } = await supabase
      .from("conferences")
      .select("*")
      .eq("id", conference_id)
      .single();

    if (confError) {
      throw confError;
    }

    const personaContext = getPersonaPromptPrefix();

    // Analyze partner notes to extract leads and insights
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
            content: `Analyze these partner notes from a conference/event and extract actionable BD intelligence.

Partner Notes:
${notes}

Existing Leads in System (for matching/updating):
${existingLeads.map(l => `- ID: ${l.id} | ${l.contact_name} at ${l.company} (${l.title || 'N/A'})`).join('\n') || 'None yet'}

Return a JSON object with:
1. new_leads: Array of new contacts to add (not matching existing leads):
   - contact_name: Full name
   - company: Company/organization name
   - title: Job title if mentioned
   - email: Email if mentioned
   - phone: Phone if mentioned
   - notes: Key insights about this person/opportunity
   - ai_fit_score: 0-100 based on BD persona fit
   - ai_reason: Brief reason for the score

2. lead_updates: Array of updates to existing leads:
   - lead_id: UUID of existing lead to update
   - additional_notes: New information to append
   - ai_fit_score: Updated score if partner notes change assessment
   - ai_reason: Updated reason

3. partner_insights: Object with:
   - key_themes: Array of 3-5 key themes from partner observations
   - strategic_opportunities: Array of specific opportunities identified
   - competitor_intel: Any competitor information mentioned
   - recommended_followups: Specific follow-up actions suggested

Focus on defense, front-end solutioning, C2, training, AI-ML, and software capabilities when scoring.`
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
    console.log("Partner notes analysis:", analysis);

    let leadsAdded = 0;
    let leadsUpdated = 0;

    // Add new leads
    if (analysis.new_leads && analysis.new_leads.length > 0) {
      for (const lead of analysis.new_leads) {
        const { error: insertError } = await supabase
          .from("conference_leads")
          .insert({
            conference_id,
            created_by: user.id,
            contact_name: lead.contact_name,
            company: lead.company,
            title: lead.title || null,
            email: lead.email || null,
            phone: lead.phone || null,
            notes: lead.notes || null,
            ai_fit_score: lead.ai_fit_score,
            ai_reason: lead.ai_reason,
            source: "partner_notes",
            status: "new"
          });

        if (!insertError) {
          leadsAdded++;
        } else {
          console.error("Error inserting lead:", insertError);
        }
      }
    }

    // Update existing leads
    if (analysis.lead_updates && analysis.lead_updates.length > 0) {
      for (const update of analysis.lead_updates) {
        const existingLead = existingLeads.find(l => l.id === update.lead_id);
        if (existingLead) {
          const updatedNotes = existingLead.notes 
            ? `${existingLead.notes}\n\n[Partner Notes]: ${update.additional_notes}`
            : `[Partner Notes]: ${update.additional_notes}`;

          const { error: updateError } = await supabase
            .from("conference_leads")
            .update({
              notes: updatedNotes,
              ai_fit_score: update.ai_fit_score || existingLead.ai_fit_score,
              ai_reason: update.ai_reason || existingLead.ai_reason,
              updated_at: new Date().toISOString()
            })
            .eq("id", update.lead_id)
            .eq("created_by", user.id);

          if (!updateError) {
            leadsUpdated++;
          } else {
            console.error("Error updating lead:", updateError);
          }
        }
      }
    }

    // Store partner insights in conference for executive summary
    const existingWebsiteData = conference.website_data || {};
    const updatedWebsiteData = {
      ...existingWebsiteData,
      partner_notes: notes,
      partner_insights: analysis.partner_insights,
      partner_notes_analyzed_at: new Date().toISOString()
    };

    await supabase
      .from("conferences")
      .update({ 
        website_data: updatedWebsiteData,
        updated_at: new Date().toISOString()
      })
      .eq("id", conference_id);

    console.log(`Added ${leadsAdded} leads, updated ${leadsUpdated} leads`);

    return new Response(
      JSON.stringify({
        success: true,
        leads_added: leadsAdded,
        leads_updated: leadsUpdated,
        insights: analysis.partner_insights
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200 
      }
    );

  } catch (error) {
    console.error("Error analyzing partner notes:", error);
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
