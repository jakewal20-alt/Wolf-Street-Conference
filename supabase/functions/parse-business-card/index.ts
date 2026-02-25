import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is not configured");
    }

    const formData = await req.formData();
    const imageFile = formData.get('image') as File;

    if (!imageFile) {
      throw new Error("No image file provided");
    }

    // Convert image to base64 in chunks to avoid stack overflow
    const arrayBuffer = await imageFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binary = '';
    const chunkSize = 8192;

    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }

    const base64Image = btoa(binary);
    const mimeType = imageFile.type || 'image/jpeg';
    const dataUrl = `data:${mimeType};base64,${base64Image}`;

    console.log("Extracting business card info from image via OpenAI...");

    const aiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Extract all contact information from this business card image. Return a JSON object with these fields:
- contact_name: full name of the person
- company: company name
- title: job title or position
- email: email address
- phone: phone number
- linkedin_url: LinkedIn profile URL if present (look for linkedin.com/in/ links or LinkedIn icons)
- additional_info: any other relevant information (address, website, social media, etc.)

If a field is not visible or unclear, use null. Be precise and extract exactly what you see.`
              },
              {
                type: "image_url",
                image_url: {
                  url: dataUrl
                }
              }
            ]
          }
        ],
        response_format: { type: "json_object" },
        max_tokens: 1000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("OpenAI extraction error:", aiResponse.status, errorText);
      throw new Error(`OpenAI extraction failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices?.[0]?.message?.content;

    if (!extractedText) {
      throw new Error("No content in AI response");
    }

    const extractedData = JSON.parse(extractedText);

    console.log("Successfully extracted business card info:", extractedData);

    return new Response(
      JSON.stringify({
        success: true,
        extracted: extractedData
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200
      }
    );

  } catch (error) {
    console.error("Error parsing business card:", error);
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