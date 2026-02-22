import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Professional multi-page PDF generation
function generatePDF(conference: any): Uint8Array {
  const summary = conference.exec_summary;
  
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 60;
  const marginRight = 60;
  const marginTop = 60;
  const marginBottom = 70;
  const contentWidth = pageWidth - marginLeft - marginRight;
  const lineHeight = 14;
  const sectionGap = 24;
  
  const escape = (text: string) => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[\r\n]+/g, ' ');
  };

  const wrapText = (text: string, maxChars: number): string[] => {
    if (!text) return [];
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxChars) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines;
  };

  // Multi-page content arrays
  const pages: string[][] = [[]];
  let pageIndex = 0;
  let y = pageHeight - marginTop - 100; // Start after header on first page
  
  const addToPage = (content: string) => {
    pages[pageIndex].push(content);
  };
  
  const newPage = () => {
    pageIndex++;
    pages.push([]);
    y = pageHeight - marginTop;
  };
  
  const checkSpace = (needed: number) => {
    if (y < marginBottom + needed) {
      newPage();
    }
  };

  // Conference info
  const confName = conference.name || 'Conference';
  const startDate = conference.start_date ? new Date(conference.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const endDate = conference.end_date ? new Date(conference.end_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '';
  const location = conference.location || '';

  // Page 1 Header (will be added to page 1 content stream)
  const headerContent = [
    `0.15 0.25 0.45 rg`,
    `0 ${pageHeight - 100} ${pageWidth} 100 re f`,
    `BT 1 1 1 rg /F2 24 Tf ${marginLeft} ${pageHeight - 55} Td (EXECUTIVE SUMMARY) Tj ET`,
    `BT 0.85 0.85 0.95 rg /F1 12 Tf ${marginLeft} ${pageHeight - 80} Td (${escape(confName)}) Tj ET`,
    `BT 0.7 0.7 0.8 rg /F1 10 Tf ${marginLeft} ${pageHeight - 95} Td (${escape(location)} | ${escape(startDate)} - ${escape(endDate)}) Tj ET`,
  ];
  headerContent.forEach(c => addToPage(c));
  
  y = pageHeight - 130;

  // Headline
  if (summary.headline) {
    checkSpace(70);
    addToPage(`0.95 0.97 1 rg`);
    addToPage(`${marginLeft - 10} ${y - 40} ${contentWidth + 20} 55 re f`);
    addToPage(`0.2 0.4 0.8 rg`);
    addToPage(`${marginLeft - 10} ${y - 40} 4 55 re f`);
    
    const headlineLines = wrapText(summary.headline, 80);
    let hy = y - 5;
    for (const line of headlineLines) {
      addToPage(`BT 0.15 0.15 0.15 rg /F2 11 Tf ${marginLeft + 5} ${hy} Td (${escape(line)}) Tj ET`);
      hy -= 16;
    }
    y -= 60;
  }

  // Conference Overview
  if (summary.conference_overview) {
    checkSpace(50);
    y -= sectionGap;
    addToPage(`0.2 0.4 0.8 RG`);
    addToPage(`2 w`);
    addToPage(`${marginLeft} ${y + 4} m ${marginLeft + 40} ${y + 4} l S`);
    addToPage(`BT 0.2 0.4 0.8 rg /F2 11 Tf ${marginLeft} ${y - 10} Td (CONFERENCE OVERVIEW) Tj ET`);
    y -= 28;
    
    const overviewLines = wrapText(summary.conference_overview, 85);
    for (const line of overviewLines) {
      checkSpace(lineHeight + 5);
      addToPage(`BT 0.2 0.2 0.2 rg /F1 10 Tf ${marginLeft} ${y} Td (${escape(line)}) Tj ET`);
      y -= lineHeight + 2;
    }
  }

  // Key Metrics
  if (summary.key_metrics) {
    checkSpace(80);
    y -= sectionGap;
    addToPage(`0.2 0.4 0.8 RG`);
    addToPage(`2 w`);
    addToPage(`${marginLeft} ${y + 4} m ${marginLeft + 40} ${y + 4} l S`);
    addToPage(`BT 0.2 0.4 0.8 rg /F2 11 Tf ${marginLeft} ${y - 10} Td (KEY METRICS) Tj ET`);
    y -= 28;
    
    const metrics = [
      { label: 'Total Leads', value: summary.key_metrics.total_leads || 0 },
      { label: 'High-Fit Leads', value: summary.key_metrics.high_fit_leads || 0 },
      { label: 'New Opportunities', value: summary.key_metrics.new_opportunities_created || 0 },
    ];
    if (summary.key_metrics.est_pipeline_value) {
      metrics.push({ label: 'Pipeline Value', value: `$${(summary.key_metrics.est_pipeline_value / 1000000).toFixed(1)}M` });
    }
    
    const boxWidth = 110;
    const boxHeight = 45;
    const gap = 15;
    
    metrics.forEach((metric, idx) => {
      const boxX = marginLeft + idx * (boxWidth + gap);
      addToPage(`0.96 0.96 0.96 rg`);
      addToPage(`${boxX} ${y - boxHeight} ${boxWidth} ${boxHeight} re f`);
      addToPage(`0.2 0.4 0.8 rg`);
      addToPage(`${boxX} ${y} ${boxWidth} 3 re f`);
      addToPage(`BT 0.15 0.15 0.15 rg /F2 18 Tf ${boxX + 10} ${y - 22} Td (${escape(String(metric.value))}) Tj ET`);
      addToPage(`BT 0.5 0.5 0.5 rg /F1 8 Tf ${boxX + 10} ${y - 38} Td (${escape(metric.label)}) Tj ET`);
    });
    y -= boxHeight + 15;
  }

  // Strategic Themes
  if (summary.strategic_themes?.length > 0) {
    checkSpace(50);
    y -= sectionGap;
    addToPage(`0.2 0.4 0.8 RG`);
    addToPage(`2 w`);
    addToPage(`${marginLeft} ${y + 4} m ${marginLeft + 40} ${y + 4} l S`);
    addToPage(`BT 0.2 0.4 0.8 rg /F2 11 Tf ${marginLeft} ${y - 10} Td (STRATEGIC THEMES) Tj ET`);
    y -= 28;
    
    for (const theme of summary.strategic_themes) {
      checkSpace(lineHeight + 8);
      addToPage(`0.2 0.4 0.8 rg`);
      addToPage(`${marginLeft} ${y + 3} 4 4 re f`);
      addToPage(`BT 0.2 0.2 0.2 rg /F1 10 Tf ${marginLeft + 12} ${y} Td (${escape(theme)}) Tj ET`);
      y -= lineHeight + 4;
    }
  }

  // Top Leads (show up to 6)
  if (summary.top_leads?.length > 0) {
    checkSpace(50);
    y -= sectionGap;
    addToPage(`0.2 0.4 0.8 RG`);
    addToPage(`2 w`);
    addToPage(`${marginLeft} ${y + 4} m ${marginLeft + 40} ${y + 4} l S`);
    addToPage(`BT 0.2 0.4 0.8 rg /F2 11 Tf ${marginLeft} ${y - 10} Td (TOP LEADS) Tj ET`);
    y -= 28;
    
    const leadsToShow = summary.top_leads.slice(0, 6);
    for (const lead of leadsToShow) {
      checkSpace(50);
      const nameTitle = `${lead.contact_name || 'Unknown'}${lead.title ? `, ${lead.title}` : ''}`;
      addToPage(`BT 0.15 0.15 0.15 rg /F2 10 Tf ${marginLeft} ${y} Td (${escape(nameTitle)}) Tj ET`);
      y -= lineHeight;
      
      if (lead.company) {
        addToPage(`BT 0.4 0.4 0.4 rg /F1 9 Tf ${marginLeft} ${y} Td (${escape(lead.company)}) Tj ET`);
        y -= lineHeight;
      }
      
      if (lead.reason) {
        const reasonLines = wrapText(lead.reason, 90);
        for (const line of reasonLines) {
          checkSpace(lineHeight + 2);
          addToPage(`BT 0.3 0.3 0.3 rg /F1 9 Tf ${marginLeft + 10} ${y} Td (${escape(line)}) Tj ET`);
          y -= lineHeight;
        }
      }
      y -= 8;
    }
  }

  // Next Steps (renamed from Executive Recommendations)
  if (summary.exec_recommendations?.length > 0) {
    checkSpace(50);
    y -= sectionGap;
    addToPage(`0.2 0.4 0.8 RG`);
    addToPage(`2 w`);
    addToPage(`${marginLeft} ${y + 4} m ${marginLeft + 40} ${y + 4} l S`);
    addToPage(`BT 0.2 0.4 0.8 rg /F2 11 Tf ${marginLeft} ${y - 10} Td (NEXT STEPS) Tj ET`);
    y -= 28;
    
    for (let idx = 0; idx < summary.exec_recommendations.length; idx++) {
      const rec = summary.exec_recommendations[idx];
      const cleanRec = rec.replace(/^[•\-]\s*/, '');
      const recLines = wrapText(cleanRec, 85);
      
      for (let i = 0; i < recLines.length; i++) {
        checkSpace(lineHeight + 4);
        const prefix = i === 0 ? `${idx + 1}. ` : '   ';
        addToPage(`BT 0.2 0.2 0.2 rg /F1 10 Tf ${marginLeft + 5} ${y} Td (${escape(prefix + recLines[i])}) Tj ET`);
        y -= lineHeight + 2;
      }
    }
  }

  // Add footer to each page
  const footerY = marginBottom - 20;
  const generatedDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  
  for (let i = 0; i < pages.length; i++) {
    pages[i].push(`0.7 0.7 0.7 RG`);
    pages[i].push(`0.5 w`);
    pages[i].push(`${marginLeft} ${footerY + 15} m ${pageWidth - marginRight} ${footerY + 15} l S`);
    pages[i].push(`BT 0.6 0.6 0.6 rg /F1 8 Tf ${marginLeft} ${footerY} Td (Generated ${generatedDate}) Tj ET`);
    if (pages.length > 1) {
      pages[i].push(`BT 0.6 0.6 0.6 rg /F1 8 Tf ${pageWidth - marginRight - 50} ${footerY} Td (Page ${i + 1} of ${pages.length}) Tj ET`);
    }
  }

  // Build PDF with multiple pages
  const pageCount = pages.length;
  const pageObjects: string[] = [];
  const contentObjects: string[] = [];
  
  // Calculate object numbers
  // 1: Catalog, 2: Pages, 3+: Page objects, then content streams, then fonts
  const firstPageObj = 3;
  const firstContentObj = firstPageObj + pageCount;
  const fontObj1 = firstContentObj + pageCount;
  const fontObj2 = fontObj1 + 1;
  
  // Build page objects
  for (let i = 0; i < pageCount; i++) {
    const pageObjNum = firstPageObj + i;
    const contentObjNum = firstContentObj + i;
    pageObjects.push(`${pageObjNum} 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents ${contentObjNum} 0 R /Resources << /Font << /F1 ${fontObj1} 0 R /F2 ${fontObj2} 0 R >> >> >>
endobj`);
  }
  
  // Build content streams
  for (let i = 0; i < pageCount; i++) {
    const contentObjNum = firstContentObj + i;
    const streamContent = pages[i].join('\n');
    const streamLength = new TextEncoder().encode(streamContent).length;
    contentObjects.push(`${contentObjNum} 0 obj
<< /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj`);
  }
  
  // Build kids array for Pages object
  const kidsArray = Array.from({ length: pageCount }, (_, i) => `${firstPageObj + i} 0 R`).join(' ');
  
  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [${kidsArray}] /Count ${pageCount} >>
endobj
${pageObjects.join('\n')}
${contentObjects.join('\n')}
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conferenceId } = await req.json();
    console.log(`[export-conference-summary-pdf] Exporting PDF for conference: ${conferenceId}`);

    if (!conferenceId) {
      return new Response(
        JSON.stringify({ error: 'Missing conferenceId' }),
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

    const { data: conference, error: fetchError } = await supabaseClient
      .from('conferences')
      .select('*')
      .eq('id', conferenceId)
      .single();

    if (fetchError || !conference) {
      console.error(`[export-conference-summary-pdf] Conference not found: ${fetchError?.message}`);
      return new Response(
        JSON.stringify({ error: 'Conference not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conference.exec_summary) {
      return new Response(
        JSON.stringify({ error: 'No executive summary to export' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const pdfBytes = generatePDF(conference);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));

    console.log(`[export-conference-summary-pdf] PDF generated successfully, size: ${pdfBytes.length} bytes`);

    return new Response(
      JSON.stringify({ pdfBase64 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[export-conference-summary-pdf] Error: ${errorMessage}`);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
