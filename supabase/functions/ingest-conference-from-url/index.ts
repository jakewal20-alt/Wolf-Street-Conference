import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    console.log("=== Starting conference ingestion ===");
    console.log("Input URL:", url);

    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: "URL is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user first
    console.log("Step 1: Authenticating user...");
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ success: false, error: "Not authenticated" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Extract JWT token from Authorization header
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ success: false, error: "Authentication failed" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    console.log("User authenticated:", user.id);

    // Helper function to derive conference name from URL
    const deriveNameFromUrl = (urlString: string): string => {
      try {
        const parsedUrl = new URL(urlString);
        const hostname = parsedUrl.hostname.toLowerCase();
        
        // Special case for I/ITSEC
        if (hostname.includes('iitsec')) {
          return 'I/ITSEC';
        }
        
        // General case: extract domain name
        const domainParts = hostname.replace('www.', '').split('.');
        const domainName = domainParts[0];
        
        // Capitalize and clean up
        return domainName.toUpperCase().replace(/[^A-Z0-9]/g, '');
      } catch {
        return 'Conference';
      }
    };

    // Helper function to create fallback conference
    const createFallbackConference = async (urlString: string, errorDetails: string) => {
      console.log("Creating fallback conference from URL:", urlString);
      
      const minimalConference = {
        name: deriveNameFromUrl(urlString),
        start_date: null,
        end_date: null,
        location: null,
        description: "Conference imported from website; details not parsed automatically.",
        tags: ['conference'],
        source_url: urlString,
        website_data: {
          error: 'fetch_failed',
          details: errorDetails,
          ingested_at: new Date().toISOString(),
        },
        created_by: user.id,
      };

      // Upsert to database
      const { data: existing } = await supabase
        .from('conferences')
        .select('id')
        .eq('source_url', urlString)
        .eq('created_by', user.id)
        .maybeSingle();

      let conferenceId: string;
      if (existing) {
        const { error: updateError } = await supabase
          .from('conferences')
          .update(minimalConference)
          .eq('id', existing.id);
        
        if (updateError) {
          console.error("Failed to update fallback conference:", updateError);
          throw updateError;
        }
        conferenceId = existing.id;
      } else {
        const { data: newConf, error: insertError } = await supabase
          .from('conferences')
          .insert(minimalConference)
          .select()
          .single();
        
        if (insertError) {
          console.error("Failed to create fallback conference:", insertError);
          throw insertError;
        }
        conferenceId = newConf.id;
      }

      console.log("Fallback conference created:", conferenceId);
      return {
        success: true,
        conference: {
          id: conferenceId,
          ...minimalConference,
        },
        raw: {
          error: 'fetch_failed',
          details: errorDetails,
        },
      };
    };

    // Fetch the HTML content
    console.log("Step 2: Fetching HTML from URL...");
    let htmlResponse;
    let html: string;
    
    try {
      htmlResponse = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        redirect: 'follow',
      });

      if (!htmlResponse.ok) {
        const errorMsg = `HTTP ${htmlResponse.status}: ${htmlResponse.statusText}`;
        console.error("HTTP error:", errorMsg);
        console.log("Falling back to minimal conference creation");
        
        const fallbackResult = await createFallbackConference(url, errorMsg);
        return new Response(
          JSON.stringify(fallbackResult),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      html = await htmlResponse.text();
      console.log("Successfully fetched HTML, length:", html.length);
      
    } catch (fetchError) {
      const errorMsg = fetchError instanceof Error ? fetchError.message : String(fetchError);
      console.error("Fetch error:", errorMsg);
      console.error("Stack:", fetchError instanceof Error ? fetchError.stack : 'N/A');
      console.log("Falling back to minimal conference creation");
      
      const fallbackResult = await createFallbackConference(url, errorMsg);
      return new Response(
        JSON.stringify(fallbackResult),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use OpenAI GPT-5 to parse the conference data for better extraction
    console.log("Step 3: Parsing HTML with GPT-5...");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      console.error("OPENAI_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "AI service not configured" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const htmlSnippet = html.substring(0, 80000); // GPT-5 can handle more context
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.toLocaleString('en-US', { month: 'long' });
    
    const aiPrompt = `You are an expert at extracting conference and event information from websites.

CURRENT DATE CONTEXT: Today is ${currentMonth} ${currentDate.getDate()}, ${currentYear}. 
When you see dates like "January 14-15" without a year, assume the NEXT occurrence of that date.
- If the month has already passed this year, the event is in ${currentYear + 1}
- If the month is still coming this year, the event is in ${currentYear}

Analyze this HTML and extract COMPLETE conference details:

${htmlSnippet}

EXTRACTION REQUIREMENTS:

1. **Conference Name**: Extract the full official name including the year if shown (e.g., "I/ITSEC 2025", "AFCEA TechNet Cyber 2025")

2. **Dates**: 
   - Parse carefully: "14-15 Jan" means Jan 14 to Jan 15
   - "December 1-4, 2025" means Dec 1 to Dec 4, 2025
   - Output in YYYY-MM-DD format
   - If spanning months like "Nov 30 - Dec 2", handle correctly

3. **Location**: City, State/Country format (e.g., "Orlando, FL" or "London, UK")

4. **Venue**: The actual venue name if mentioned (e.g., "Orange County Convention Center")

5. **Description** (CRITICAL - BE THOROUGH):
   - Write 3-5 comprehensive sentences describing what this conference is about
   - Include: target audience (who attends), main topics/themes, industry focus
   - Mention any notable features: exhibits, keynotes, networking, training
   - Include numbers if available: attendees, exhibitors, sessions
   - Make it informative and professional

6. **Tags**: 5-10 relevant keywords covering themes, industries, technologies

7. **Registration URL**: If a separate registration link is visible

Example good description:
"I/ITSEC is the world's largest modeling, simulation, and training conference, attracting over 16,000 attendees annually. Hosted in Orlando, FL, the event brings together defense, government, and industry professionals to explore cutting-edge training technologies, virtual reality solutions, and simulation systems. The conference features 500+ exhibitors, technical paper presentations, tutorials, and extensive networking opportunities for the modeling and simulation community."`;

    console.log("Sending", htmlSnippet.length, "characters to GPT-5...");
    let aiResponse;
    try {
      aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-5-2025-08-07",
          messages: [
            {
              role: "system",
              content: "You are an expert conference data extraction assistant. Extract detailed, comprehensive conference information from HTML content. Focus especially on creating rich, informative descriptions."
            },
            {
              role: "user",
              content: aiPrompt
            }
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_conference_data",
                description: "Extract structured conference information with detailed descriptions",
                parameters: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Full conference name including year" },
                    start_date: { type: "string", description: "Start date in YYYY-MM-DD format" },
                    end_date: { type: "string", description: "End date in YYYY-MM-DD format" },
                    location: { type: "string", description: "Conference location (city, state/country)" },
                    venue: { type: "string", description: "Venue name if available" },
                    short_description: { type: "string", description: "3-5 sentence comprehensive description of the conference, its purpose, attendees, and highlights" },
                    tags: { type: "array", items: { type: "string" }, description: "5-10 relevant topic/industry tags" },
                    registration_url: { type: "string", description: "Registration URL if available" }
                  },
                  required: ["name", "start_date", "end_date", "location", "short_description", "tags"],
                  additionalProperties: false
                }
              }
            }
          ],
          tool_choice: { type: "function", function: { name: "extract_conference_data" } },
          max_completion_tokens: 8000
        }),
      });
    } catch (aiError) {
      console.error("AI request error:", aiError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `AI parsing failed: ${aiError instanceof Error ? aiError.message : String(aiError)}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `AI API returned error: ${aiResponse.status}` 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiData = await aiResponse.json();
    console.log("AI response received, parsing...");

    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall || !toolCall.function?.arguments) {
      console.error("No tool call in AI response:", JSON.stringify(aiData));
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "AI could not extract structured data from the page. The website might not contain clear conference information." 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsedData = JSON.parse(toolCall.function.arguments);
    console.log("Successfully parsed conference data:", JSON.stringify(parsedData, null, 2));

    // Validate required fields - use fallbacks if missing
    if (!parsedData.name || !parsedData.start_date || !parsedData.end_date) {
      console.log("Missing some required fields, using fallbacks:", { 
        name: !!parsedData.name, 
        start_date: !!parsedData.start_date, 
        end_date: !!parsedData.end_date 
      });
      
      // If we at least have a name, try to create a conference with TBD dates
      const fallbackName = parsedData.name || deriveNameFromUrl(url);
      
      // Create a fallback with today + 30 days as placeholder dates if dates are missing
      const today = new Date();
      const futureDate = new Date(today);
      futureDate.setDate(futureDate.getDate() + 30);
      
      const fallbackStartDate = parsedData.start_date || today.toISOString().split('T')[0];
      const fallbackEndDate = parsedData.end_date || futureDate.toISOString().split('T')[0];
      
      // Update parsedData with fallbacks
      parsedData.name = fallbackName;
      parsedData.start_date = fallbackStartDate;
      parsedData.end_date = fallbackEndDate;
      parsedData.short_description = parsedData.short_description || 
        `Conference imported from ${new URL(url).hostname}. Date information may need to be updated manually.`;
      parsedData.tags = parsedData.tags || ['conference', 'imported'];
      
      console.log("Using fallback data:", JSON.stringify(parsedData, null, 2));
    }

    // Check if conference with this URL already exists
    console.log("Step 4: Checking for existing conference...");
    const { data: existing, error: checkError } = await supabase
      .from('conferences')
      .select('id, calendar_event_id')
      .eq('source_url', url)
      .eq('created_by', user.id)
      .maybeSingle();
    
    if (checkError) {
      console.error("Error checking existing conference:", checkError);
    }
    console.log("Existing conference:", existing ? existing.id : "none");

    const conferenceData = {
      name: parsedData.name,
      start_date: parsedData.start_date,
      end_date: parsedData.end_date,
      location: parsedData.location,
      description: parsedData.short_description,
      tags: parsedData.tags,
      source_url: url,
      website_data: {
        ...parsedData,
        ingested_at: new Date().toISOString(),
      },
      created_by: user.id,
    };

    let conferenceId: string;

    if (existing) {
      // Update existing conference
      console.log("Step 5: Updating existing conference:", existing.id);
      const { error: updateError } = await supabase
        .from('conferences')
        .update(conferenceData)
        .eq('id', existing.id);

      if (updateError) {
        console.error("Update error:", updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to update conference: ${updateError.message}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      conferenceId = existing.id;
      console.log("Successfully updated conference");
    } else {
      // Insert new conference
      console.log("Step 5: Creating new conference");
      const { data: newConf, error: insertError } = await supabase
        .from('conferences')
        .insert(conferenceData)
        .select()
        .single();

      if (insertError) {
        console.error("Insert error:", insertError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to create conference: ${insertError.message}` 
          }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      conferenceId = newConf.id;
      console.log("Successfully created conference:", conferenceId);
    }

    // Create or update the linked calendar event (prevents duplicates)
    const calendarEventPayload = {
      title: parsedData.name,
      start_date: parsedData.start_date,
      end_date: parsedData.end_date,
      location: parsedData.location,
      description: parsedData.short_description,
      event_type: 'conference',
      type: 'conference',
      all_day: true,
      user_id: user.id,
      color_hex: '#8B5CF6',
      icon_name: 'presentation',
    };

    if (existing?.calendar_event_id) {
      console.log("Step 6: Updating existing calendar event:", existing.calendar_event_id);
      const { error: calendarUpdateError } = await supabase
        .from('calendar_events')
        .update(calendarEventPayload)
        .eq('id', existing.calendar_event_id);

      if (calendarUpdateError) {
        console.error("Calendar event update error:", calendarUpdateError);
      }
    } else {
      // If the conference isn't linked yet, try to reuse an existing identical conference event
      console.log("Step 6: Finding or creating calendar event for conference");

      const { data: existingEvent, error: existingEventError } = await supabase
        .from('calendar_events')
        .select('id')
        .eq('user_id', user.id)
        .eq('event_type', 'conference')
        .eq('title', calendarEventPayload.title)
        .eq('start_date', calendarEventPayload.start_date)
        .eq('end_date', calendarEventPayload.end_date)
        .maybeSingle();

      if (existingEventError) {
        console.error("Calendar event lookup error:", existingEventError);
      }

      const eventIdToLink = existingEvent?.id;

      if (eventIdToLink) {
        console.log("Step 7: Linking existing calendar event to conference:", eventIdToLink);
        await supabase
          .from('conferences')
          .update({
            calendar_event_id: eventIdToLink,
            calendar_source: 'internal',
          })
          .eq('id', conferenceId);
        console.log("Successfully linked existing calendar event");
      } else {
        console.log("Step 6b: Creating calendar event for conference");
        const { data: calendarEvent, error: calendarError } = await supabase
          .from('calendar_events')
          .insert(calendarEventPayload)
          .select()
          .single();

        if (!calendarError && calendarEvent) {
          console.log("Step 7: Linking calendar event to conference");
          await supabase
            .from('conferences')
            .update({
              calendar_event_id: calendarEvent.id,
              calendar_source: 'internal',
            })
            .eq('id', conferenceId);
          console.log("Successfully linked calendar event");
        } else if (calendarError) {
          console.error("Calendar event creation error:", calendarError);
        }
      }
    }

    console.log("=== Conference ingestion completed successfully ===");
    return new Response(
      JSON.stringify({
        success: true,
        conference: {
          id: conferenceId,
          name: parsedData.name,
          start_date: parsedData.start_date,
          end_date: parsedData.end_date,
          location: parsedData.location,
          short_description: parsedData.short_description,
          tags: parsedData.tags || [],
          venue: parsedData.venue,
          registration_url: parsedData.registration_url,
        },
        raw: parsedData,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('=== FATAL ERROR in ingest-conference-from-url ===');
    console.error('Error type:', error?.constructor?.name);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred during conference ingestion"
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
