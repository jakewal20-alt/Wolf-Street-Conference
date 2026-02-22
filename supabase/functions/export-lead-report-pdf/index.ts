import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getPersonaPromptPrefix } from "../_shared/bd-persona.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LeadSummary {
  contact_name: string;
  title: string;
  company: string;
  ai_fit_score: number | null;
  status: string;
  summary: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conferenceId } = await req.json();
    if (!conferenceId) {
      return new Response(
        JSON.stringify({ error: 'Missing conferenceId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiKey = Deno.env.get('OPENAI_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch conference
    const { data: conference, error: confErr } = await supabase
      .from('conferences')
      .select('*')
      .eq('id', conferenceId)
      .single();

    if (confErr || !conference) {
      return new Response(
        JSON.stringify({ error: 'Conference not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch ALL leads for this conference
    const { data: leads, error: leadsErr } = await supabase
      .from('conference_leads')
      .select('*')
      .eq('conference_id', conferenceId)
      .order('ai_fit_score', { ascending: false, nullsFirst: false });

    if (leadsErr) {
      throw new Error(`Failed to fetch leads: ${leadsErr.message}`);
    }

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No leads found for this conference' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get BD persona for context
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);
    const personaPrefix = user ? await getPersonaPromptPrefix(supabase, user.id) : '';

    // Build lead data for AI
    const leadDataForAI = leads.map((l: any, idx: number) => ({
      index: idx + 1,
      name: l.contact_name,
      title: l.title || 'N/A',
      company: l.company,
      score: l.ai_fit_score ?? 'Unscored',
      status: l.status,
      notes: l.notes || 'No notes',
      ai_reason: l.ai_reason || '',
      email: l.email || '',
      phone: l.phone || '',
    }));

    console.log(`[export-lead-report-pdf] Generating AI summaries for ${leads.length} leads`);

    // Call OpenAI to generate per-lead summaries
    const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `${personaPrefix}\n\nYou are generating a professional lead report for a conference. For EACH lead, write a concise 2-3 sentence summary that captures:\n1. Who they are and their strategic relevance\n2. Key talking points or updates from the interaction\n3. Recommended next step\n\nRespond with a JSON array of objects with these fields:\n- contact_name (string)\n- title (string)\n- company (string)\n- ai_fit_score (number or null)\n- status (string)\n- summary (string: your 2-3 sentence AI-generated summary)\n\nReturn ONLY the JSON array, no markdown.`
          },
          {
            role: 'user',
            content: `Conference: ${conference.name}\nLocation: ${conference.location}\nDates: ${conference.start_date} to ${conference.end_date}\n\nHere are ALL ${leads.length} leads:\n${JSON.stringify(leadDataForAI, null, 2)}`
          }
        ],
        temperature: 0.4,
        max_tokens: 4000,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error('[export-lead-report-pdf] OpenAI error:', errText);
      throw new Error(`OpenAI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    if (!content) throw new Error('Empty AI response');

    let leadSummaries: LeadSummary[];
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      leadSummaries = JSON.parse(cleaned);
    } catch {
      console.error('[export-lead-report-pdf] Failed to parse AI response:', content);
      // Fallback: use raw lead data without AI summaries
      leadSummaries = leads.map((l: any) => ({
        contact_name: l.contact_name,
        title: l.title || '',
        company: l.company,
        ai_fit_score: l.ai_fit_score,
        status: l.status,
        summary: l.notes || l.ai_reason || 'No summary available.',
      }));
    }

    // Generate PDF
    const pdfBytes = generateLeadReportPDF(conference, leadSummaries);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    console.log(`[export-lead-report-pdf] PDF generated, ${pdfBytes.length} bytes, ${leadSummaries.length} leads`);

    return new Response(
      JSON.stringify({ pdfBase64 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[export-lead-report-pdf] Error:', msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateLeadReportPDF(conference: any, leads: LeadSummary[]): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const mL = 60, mR = 60, mT = 60, mB = 70;
  const contentWidth = pageWidth - mL - mR;
  const lineH = 13;

  const esc = (t: string) => (t || '').replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)').replace(/[\r\n]+/g, ' ');
  
  const wrap = (text: string, max: number): string[] => {
    if (!text) return [];
    const words = text.split(' ');
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length <= max) {
        cur = (cur + ' ' + w).trim();
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    }
    if (cur) lines.push(cur);
    return lines;
  };

  const pages: string[][] = [[]];
  let pi = 0;
  let y = pageHeight - mT;

  const add = (c: string) => pages[pi].push(c);
  const newPage = () => { pi++; pages.push([]); y = pageHeight - mT; };
  const check = (n: number) => { if (y < mB + n) newPage(); };

  // Header
  add(`0.15 0.25 0.45 rg`);
  add(`0 ${pageHeight - 90} ${pageWidth} 90 re f`);
  add(`BT 1 1 1 rg /F2 22 Tf ${mL} ${pageHeight - 50} Td (LEAD REPORT) Tj ET`);
  add(`BT 0.85 0.85 0.95 rg /F1 11 Tf ${mL} ${pageHeight - 70} Td (${esc(conference.name)}) Tj ET`);
  const startD = conference.start_date ? new Date(conference.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const endD = conference.end_date ? new Date(conference.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  add(`BT 0.7 0.7 0.8 rg /F1 9 Tf ${mL} ${pageHeight - 84} Td (${esc(conference.location || '')} | ${esc(startD)} - ${esc(endD)} | ${leads.length} Leads) Tj ET`);

  y = pageHeight - 110;

  // Each lead
  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const summaryLines = wrap(lead.summary, 85);
    const neededHeight = 50 + summaryLines.length * (lineH + 1);
    check(neededHeight);

    // Lead number + name bar
    add(`0.95 0.97 1 rg`);
    add(`${mL} ${y - 18} ${contentWidth} 22 re f`);
    add(`0.2 0.4 0.8 rg`);
    add(`${mL} ${y - 18} 3 22 re f`);

    const scoreText = lead.ai_fit_score != null ? `  [Fit: ${lead.ai_fit_score}]` : '';
    add(`BT 0.15 0.15 0.15 rg /F2 10 Tf ${mL + 8} ${y - 12} Td (${esc(`${i + 1}. ${lead.contact_name}${scoreText}`)}) Tj ET`);

    // Status badge area
    const statusX = pageWidth - mR - 60;
    add(`BT 0.4 0.4 0.4 rg /F1 8 Tf ${statusX} ${y - 12} Td (${esc(lead.status || '')}) Tj ET`);

    y -= 24;

    // Title & company
    const titleLine = [lead.title, lead.company].filter(Boolean).join(' at ');
    if (titleLine) {
      add(`BT 0.4 0.4 0.4 rg /F1 9 Tf ${mL + 8} ${y} Td (${esc(titleLine)}) Tj ET`);
      y -= lineH + 2;
    }

    // AI Summary
    for (const line of summaryLines) {
      check(lineH + 2);
      add(`BT 0.2 0.2 0.2 rg /F1 9 Tf ${mL + 8} ${y} Td (${esc(line)}) Tj ET`);
      y -= lineH + 1;
    }

    y -= 10; // gap between leads

    // Divider line
    if (i < leads.length - 1) {
      add(`0.85 0.85 0.85 RG`);
      add(`0.5 w`);
      add(`${mL} ${y + 4} m ${pageWidth - mR} ${y + 4} l S`);
      y -= 6;
    }
  }

  // Footer on each page
  const footerY = mB - 20;
  const genDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  for (let i = 0; i < pages.length; i++) {
    pages[i].push(`0.7 0.7 0.7 RG`);
    pages[i].push(`0.5 w`);
    pages[i].push(`${mL} ${footerY + 15} m ${pageWidth - mR} ${footerY + 15} l S`);
    pages[i].push(`BT 0.6 0.6 0.6 rg /F1 8 Tf ${mL} ${footerY} Td (Generated ${genDate}) Tj ET`);
    if (pages.length > 1) {
      pages[i].push(`BT 0.6 0.6 0.6 rg /F1 8 Tf ${pageWidth - mR - 60} ${footerY} Td (Page ${i + 1} of ${pages.length}) Tj ET`);
    }
  }

  // Build PDF structure
  const pageCount = pages.length;
  const firstPageObj = 3;
  const firstContentObj = firstPageObj + pageCount;
  const fontObj1 = firstContentObj + pageCount;
  const fontObj2 = fontObj1 + 1;

  const pageObjs = [];
  const contentObjs = [];
  const kidsArr = [];

  for (let i = 0; i < pageCount; i++) {
    const pObj = firstPageObj + i;
    const cObj = firstContentObj + i;
    kidsArr.push(`${pObj} 0 R`);
    pageObjs.push(`${pObj} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${cObj} 0 R /Resources << /Font << /F1 ${fontObj1} 0 R /F2 ${fontObj2} 0 R >> >> >>\nendobj`);
    const stream = pages[i].join('\n');
    const len = new TextEncoder().encode(stream).length;
    contentObjs.push(`${cObj} 0 obj\n<< /Length ${len} >>\nstream\n${stream}\nendstream\nendobj`);
  }

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [${kidsArr.join(' ')}] /Count ${pageCount} >>
endobj
${pageObjs.join('\n')}
${contentObjs.join('\n')}
${fontObj1} 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>
endobj
${fontObj2} 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>
endobj
xref
0 ${fontObj2 + 1}
0000000000 65535 f 
trailer
<< /Size ${fontObj2 + 1} /Root 1 0 R >>
startxref
0
%%EOF`;

  return new TextEncoder().encode(pdf);
}
