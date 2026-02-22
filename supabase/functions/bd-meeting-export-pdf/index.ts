import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAGE_CONFIG: Record<string, { label: string; color: { r: number; g: number; b: number } }> = {
  'STAGE_0': { label: 'Stage 0: RFI / WP / Briefings', color: { r: 100, g: 116, b: 139 } },
  'STAGE_1': { label: 'Stage 1: Follow-ups', color: { r: 59, g: 130, b: 246 } },
  'STAGE_2': { label: 'Stage 2: Deal Desk Tracking', color: { r: 245, g: 158, b: 11 } },
  'STAGE_3': { label: 'Stage 3: Bid & Proposal', color: { r: 34, g: 197, b: 94 } },
  'ACTION_ITEMS': { label: 'Action Items', color: { r: 168, g: 85, b: 247 } },
  'ARCHIVED': { label: 'Archived', color: { r: 156, g: 163, b: 175 } },
};

// Standard base64 encoding for Uint8Array
import { encode as base64Encode } from "https://deno.land/std@0.208.0/encoding/base64.ts";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { snapshot_id, projectKey = 'HGSET' } = await req.json();

    if (!snapshot_id) {
      return new Response(JSON.stringify({ error: 'Missing snapshot_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch JIRA sprint data
    let jiraTasks = { inProgress: [] as any[], open: [] as any[] };
    try {
      const jiraToken = Deno.env.get('JIRA_API_TOKEN');
      const jiraEmail = Deno.env.get('JIRA_USER_EMAIL');
      
      if (jiraToken && jiraEmail) {
        const authHeader = btoa(`${jiraEmail}:${jiraToken}`);
        const baseUrl = 'https://accelint.atlassian.net';
        const jql = `project = ${projectKey} AND sprint in openSprints() ORDER BY status ASC, priority DESC`;
        
        const jiraResponse = await fetch(
          `${baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&fields=summary,status,assignee,priority,issuetype&maxResults=50`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${authHeader}`,
              'Accept': 'application/json',
            },
          }
        );

        if (jiraResponse.ok) {
          const jiraData = await jiraResponse.json();
          const issues = (jiraData.issues || []).map((issue: any) => ({
            key: issue.key,
            summary: issue.fields.summary,
            status: issue.fields.status?.name || 'Unknown',
            assignee: issue.fields.assignee?.displayName || null,
          }));
          
          jiraTasks.inProgress = issues.filter((i: any) => 
            i.status === 'In Progress' || i.status === 'In Review'
          );
          jiraTasks.open = issues.filter((i: any) => 
            i.status === 'To Do' || i.status === 'Open' || i.status === 'Backlog'
          );
          console.log(`Fetched ${issues.length} JIRA issues for export`);
        } else {
          console.warn('JIRA API returned non-OK status:', jiraResponse.status);
        }
      }
    } catch (jiraErr) {
      console.warn('Failed to fetch JIRA data for export:', jiraErr);
    }

    // Fetch the snapshot
    const { data: snapshot, error: snapError } = await supabase
      .from('bd_meeting_pipeline_snapshots')
      .select('id, title, meeting_date, updated_at')
      .eq('id', snapshot_id)
      .eq('user_id', user.id)
      .single();

    if (snapError || !snapshot) {
      return new Response(JSON.stringify({ error: 'No pipeline found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch items
    const { data: items } = await supabase
      .from('bd_meeting_pipeline_items')
      .select('*')
      .eq('snapshot_id', snapshot_id)
      .order('sort_order', { ascending: true });

    // Group items by stage
    const byStage: Record<string, any[]> = {};
    Object.keys(STAGE_CONFIG).forEach(s => { byStage[s] = []; });
    (items || []).forEach(item => {
      if (byStage[item.stage]) {
        byStage[item.stage].push(item);
      }
    });

    // Calculate summary stats
    const totalOpportunities = items?.length || 0;
    const stage3Count = byStage['STAGE_3']?.length || 0;
    const actionItemCount = byStage['ACTION_ITEMS']?.length || 0;

    // Generate PDF with live JIRA tasks
    const today = new Date().toISOString().split('T')[0];
    console.log('Generating PDF for pipeline with', totalOpportunities, 'items and', jiraTasks.inProgress.length + jiraTasks.open.length, 'JIRA tasks');
    const pdf = generateExecutivePDF(today, snapshot, byStage, totalOpportunities, stage3Count, actionItemCount, jiraTasks);
    console.log('PDF generated, size:', pdf.length, 'bytes');
    const base64Pdf = base64Encode(pdf);

    return new Response(JSON.stringify({ pdf: base64Pdf }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('PDF export error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

interface JiraTask {
  key: string;
  summary: string;
  status: string;
  assignee?: string;
}

function generateExecutivePDF(
  dateStr: string,
  snapshot: { title: string; meeting_date: string },
  byStage: Record<string, any[]>,
  totalOpportunities: number,
  stage3Count: number,
  actionItemCount: number,
  jiraTasks?: { inProgress: JiraTask[]; open: JiraTask[] }
): Uint8Array {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 40;
  const contentWidth = pageWidth - 2 * margin;

  let y = pageHeight - margin;
  const pages: string[] = [];
  let currentPageContent = '';

  function escape(text: string): string {
    return (text || '')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)')
      .replace(/[\x00-\x1F\x7F-\xFF]/g, '');
  }

  function wrapText(text: string, maxWidth: number, fontSize: number): string[] {
    const avgCharWidth = fontSize * 0.45;
    const charsPerLine = Math.floor(maxWidth / avgCharWidth);
    const words = (text || '').split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= charsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
  }

  function checkNewPage(neededSpace: number): void {
    if (y < margin + neededSpace) {
      pages.push(currentPageContent);
      currentPageContent = '';
      y = pageHeight - margin;
    }
  }

  function addText(text: string, fontSize: number, font: string = '/F1', x: number = margin): number {
    const lines = wrapText(text, contentWidth - (x - margin), fontSize);
    for (const line of lines) {
      checkNewPage(fontSize + 4);
      currentPageContent += `BT ${font} ${fontSize} Tf ${x} ${y} Td (${escape(line)}) Tj ET\n`;
      y -= fontSize + 4;
    }
    return lines.length;
  }

  function addColoredRect(x: number, rectY: number, width: number, height: number, r: number, g: number, b: number): void {
    currentPageContent += `${(r/255).toFixed(3)} ${(g/255).toFixed(3)} ${(b/255).toFixed(3)} rg\n`;
    currentPageContent += `${x} ${rectY} ${width} ${height} re f\n`;
  }

  function addLine(x1: number, y1: number, x2: number, y2: number, lineWidth: number = 0.5): void {
    currentPageContent += `${lineWidth} w 0.7 0.7 0.7 RG ${x1} ${y1} m ${x2} ${y2} l S\n`;
  }

  // === HEADER SECTION ===
  addColoredRect(0, pageHeight - 80, pageWidth, 80, 30, 41, 59);
  
  currentPageContent += `BT /F2 22 Tf 1 1 1 rg ${margin} ${pageHeight - 50} Td (BD Pipeline Summary) Tj ET\n`;
  currentPageContent += `BT /F1 11 Tf 0.8 0.8 0.8 rg ${margin} ${pageHeight - 68} Td (Generated ${escape(dateStr)}) Tj ET\n`;

  y = pageHeight - 110;

  // === METRICS CARDS ===
  const stageMetrics = [
    { label: 'Total', value: totalOpportunities.toString(), color: { r: 59, g: 130, b: 246 } },
    { label: 'Stage 0', value: (byStage['STAGE_0']?.length || 0).toString(), color: { r: 100, g: 116, b: 139 } },
    { label: 'Stage 1', value: (byStage['STAGE_1']?.length || 0).toString(), color: { r: 59, g: 130, b: 246 } },
    { label: 'Stage 2', value: (byStage['STAGE_2']?.length || 0).toString(), color: { r: 245, g: 158, b: 11 } },
    { label: 'Stage 3', value: (byStage['STAGE_3']?.length || 0).toString(), color: { r: 34, g: 197, b: 94 } },
    { label: 'Actions', value: (byStage['ACTION_ITEMS']?.length || 0).toString(), color: { r: 168, g: 85, b: 247 } },
  ];

  const cardWidth = (contentWidth - 50) / 6;
  const cardHeight = 55;
  const cardY = y - cardHeight;

  stageMetrics.forEach((metric, i) => {
    const cardX = margin + i * (cardWidth + 10);
    currentPageContent += `0.95 0.95 0.95 rg ${cardX} ${cardY} ${cardWidth} ${cardHeight} re f\n`;
    addColoredRect(cardX, cardY, 4, cardHeight, metric.color.r, metric.color.g, metric.color.b);
    currentPageContent += `BT /F2 18 Tf 0.1 0.1 0.1 rg ${cardX + 10} ${cardY + 28} Td (${escape(metric.value)}) Tj ET\n`;
    currentPageContent += `BT /F1 7 Tf 0.4 0.4 0.4 rg ${cardX + 10} ${cardY + 10} Td (${escape(metric.label)}) Tj ET\n`;
  });

  y = cardY - 25;

  // === PIPELINE BY STAGE ===
  const stageOrder = ['STAGE_3', 'STAGE_2', 'STAGE_1', 'STAGE_0', 'ACTION_ITEMS'];
  
  for (const stageId of stageOrder) {
    const stageItems = byStage[stageId] || [];
    if (stageItems.length === 0) continue;

    const stageConfig = STAGE_CONFIG[stageId];
    if (!stageConfig) continue;

    checkNewPage(100);

    addColoredRect(margin, y - 18, contentWidth, 22, stageConfig.color.r, stageConfig.color.g, stageConfig.color.b);
    currentPageContent += `BT /F2 11 Tf 1 1 1 rg ${margin + 10} ${y - 13} Td (${escape(stageConfig.label)} (${stageItems.length})) Tj ET\n`;
    y -= 30;

    for (const item of stageItems) {
      const hasNotes = item.notes && item.notes.trim().length > 0;
      const itemCardHeight = hasNotes ? 70 : 50;
      
      checkNewPage(itemCardHeight + 15);
      
      currentPageContent += `0.98 0.98 0.98 rg ${margin} ${y - itemCardHeight + 5} ${contentWidth} ${itemCardHeight} re f\n`;
      addLine(margin, y - itemCardHeight + 5, margin + contentWidth, y - itemCardHeight + 5);
      
      currentPageContent += `BT /F2 11 Tf 0.1 0.1 0.1 rg ${margin + 10} ${y - 5} Td (${escape(item.name || 'Untitled')}) Tj ET\n`;
      
      let detailLine = '';
      if (item.customer) detailLine += item.customer;
      if (item.owner) detailLine += detailLine ? ` | Owner: ${item.owner}` : `Owner: ${item.owner}`;
      if (detailLine) {
        currentPageContent += `BT /F1 9 Tf 0.4 0.4 0.4 rg ${margin + 10} ${y - 18} Td (${escape(detailLine)}) Tj ET\n`;
      }

      if (item.next_action) {
        const nextActionText = `Next: ${item.next_action.substring(0, 80)}${item.next_action.length > 80 ? '...' : ''}`;
        currentPageContent += `BT /F1 9 Tf 0.3 0.3 0.3 rg ${margin + 10} ${y - 31} Td (${escape(nextActionText)}) Tj ET\n`;
      }

      if (hasNotes) {
        const notesText = item.notes.substring(0, 100) + (item.notes.length > 100 ? '...' : '');
        currentPageContent += `BT /F1 8 Tf 0.25 0.25 0.25 rg ${margin + 10} ${y - 44} Td (${escape(notesText)}) Tj ET\n`;
      }

      if (item.next_action_due) {
        currentPageContent += `BT /F1 8 Tf 0.5 0.5 0.5 rg ${pageWidth - margin - 60} ${y - 18} Td (Due: ${escape(item.next_action_due)}) Tj ET\n`;
      }

      y -= itemCardHeight + 5;
    }
    y -= 10;
  }

  // === JIRA SPRINT TASKS ===
  if (jiraTasks && (jiraTasks.inProgress?.length > 0 || jiraTasks.open?.length > 0)) {
    checkNewPage(100);
    y -= 10;
    
    addColoredRect(margin, y - 18, contentWidth, 22, 0, 82, 204);
    currentPageContent += `BT /F2 11 Tf 1 1 1 rg ${margin + 10} ${y - 13} Td (HGSET Sprint Tasks) Tj ET\n`;
    y -= 35;

    if (jiraTasks.inProgress?.length > 0) {
      currentPageContent += `BT /F2 10 Tf 0.2 0.4 0.8 rg ${margin} ${y} Td (In Progress (${jiraTasks.inProgress.length})) Tj ET\n`;
      y -= 16;
      
      for (const task of jiraTasks.inProgress) {
        checkNewPage(30);
        currentPageContent += `BT /F2 9 Tf 0.2 0.4 0.8 rg ${margin + 10} ${y} Td (${escape(task.key)}) Tj ET\n`;
        if (task.assignee) {
          currentPageContent += `BT /F1 8 Tf 0.5 0.5 0.5 rg ${pageWidth - margin - 80} ${y} Td (${escape(task.assignee)}) Tj ET\n`;
        }
        y -= 12;
        currentPageContent += `BT /F1 9 Tf 0.2 0.2 0.2 rg ${margin + 10} ${y} Td (${escape(task.summary.substring(0, 70))}${task.summary.length > 70 ? '...' : ''}) Tj ET\n`;
        y -= 16;
      }
      y -= 8;
    }

    if (jiraTasks.open?.length > 0) {
      currentPageContent += `BT /F2 10 Tf 0.4 0.4 0.4 rg ${margin} ${y} Td (Open (${jiraTasks.open.length})) Tj ET\n`;
      y -= 16;
      
      for (const task of jiraTasks.open) {
        checkNewPage(30);
        currentPageContent += `BT /F2 9 Tf 0.4 0.4 0.4 rg ${margin + 10} ${y} Td (${escape(task.key)}) Tj ET\n`;
        if (task.assignee) {
          currentPageContent += `BT /F1 8 Tf 0.5 0.5 0.5 rg ${pageWidth - margin - 80} ${y} Td (${escape(task.assignee)}) Tj ET\n`;
        }
        y -= 12;
        currentPageContent += `BT /F1 9 Tf 0.2 0.2 0.2 rg ${margin + 10} ${y} Td (${escape(task.summary.substring(0, 70))}${task.summary.length > 70 ? '...' : ''}) Tj ET\n`;
        y -= 16;
      }
    }
  }

  // === FOOTER ===
  checkNewPage(30);
  y = margin + 20;
  addLine(margin, y, pageWidth - margin, y);
  const now = new Date().toISOString().split('T')[0];
  currentPageContent += `BT /F1 8 Tf 0.5 0.5 0.5 rg ${margin} ${margin + 5} Td (Generated ${escape(now)} | Confidential - Internal Use Only) Tj ET\n`;

  pages.push(currentPageContent);

  // Build PDF structure
  let pdf = '%PDF-1.4\n';
  const objects: string[] = [];
  let objectCount = 0;

  function addObject(content: string): number {
    objectCount++;
    objects.push(`${objectCount} 0 obj\n${content}\nendobj\n`);
    return objectCount;
  }

  const catalogId = addObject('<< /Type /Catalog /Pages 2 0 R >>');
  const pagesId = addObject('PLACEHOLDER');
  const font1Id = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  const font2Id = addObject('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>');

  const pageObjectIds: number[] = [];

  for (const pageContent of pages) {
    const contentId = addObject(`<< /Length ${pageContent.length} >>\nstream\n${pageContent}endstream`);
    const pageId = addObject(
      `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      `/Contents ${contentId} 0 R /Resources << /Font << /F1 ${font1Id} 0 R /F2 ${font2Id} 0 R >> >> >>`
    );
    pageObjectIds.push(pageId);
  }

  const kidsArray = pageObjectIds.map(id => `${id} 0 R`).join(' ');
  objects[pagesId - 1] = `${pagesId} 0 obj\n<< /Type /Pages /Kids [${kidsArray}] /Count ${pages.length} >>\nendobj\n`;

  pdf += objects.join('');

  const xrefOffset = pdf.length;
  pdf += 'xref\n';
  pdf += `0 ${objectCount + 1}\n`;
  pdf += '0000000000 65535 f \n';

  let offset = 9;
  for (let i = 0; i < objectCount; i++) {
    pdf += `${offset.toString().padStart(10, '0')} 00000 n \n`;
    offset += objects[i].length;
  }

  pdf += 'trailer\n';
  pdf += `<< /Size ${objectCount + 1} /Root ${catalogId} 0 R >>\n`;
  pdf += 'startxref\n';
  pdf += `${xrefOffset}\n`;
  pdf += '%%EOF';

  return new TextEncoder().encode(pdf);
}
