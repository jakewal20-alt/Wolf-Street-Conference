import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const STAGE_LABELS: Record<string, string> = {
  'STAGE_0': 'Stage 0 – RFI / WP / Briefings',
  'STAGE_1': 'Stage 1 – Follow-ups',
  'STAGE_2': 'Stage 2 – Deal Desk Tracking',
  'STAGE_3': 'Stage 3 – Bid & Proposal',
  'ACTION_ITEMS': 'Action Items',
  'BIN': 'Deprioritized',
  'ARCHIVED': 'Archived',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { snapshot_id } = await req.json();

    if (!snapshot_id) {
      return new Response(JSON.stringify({ error: 'Missing snapshot_id' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get the snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from('bd_meeting_pipeline_snapshots')
      .select('id, title, meeting_date, updated_at')
      .eq('id', snapshot_id)
      .eq('user_id', user.id)
      .single();

    if (snapshotError || !snapshot) {
      return new Response(JSON.stringify({ 
        markdown: `# BD Pipeline Summary\n\nNo pipeline data found.`,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get all items for this snapshot
    const { data: items, error: itemsError } = await supabase
      .from('bd_meeting_pipeline_items')
      .select('*')
      .eq('snapshot_id', snapshot_id)
      .order('stage', { ascending: true })
      .order('sort_order', { ascending: true });

    if (itemsError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch items' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get upcoming calendar events (max 10, ascending by date)
    const { data: calendarEvents } = await supabase
      .from('calendar_events')
      .select('title, start_date, end_date, location, description, event_type')
      .eq('user_id', user.id)
      .gte('start_date', new Date().toISOString().split('T')[0])
      .order('start_date', { ascending: true })
      .limit(10);

    // Group items by stage
    const byStage: Record<string, any[]> = {};
    for (const item of (items || [])) {
      if (!byStage[item.stage]) {
        byStage[item.stage] = [];
      }
      byStage[item.stage].push(item);
    }

    // Build markdown
    const today = new Date().toISOString().split('T')[0];
    let md = `# BD Pipeline Summary\n\n`;
    md += `*Generated on ${today}*\n\n`;
    md += `---\n\n`;

    const stageOrder = ['STAGE_3', 'STAGE_2', 'STAGE_1', 'STAGE_0', 'ACTION_ITEMS', 'BIN', 'ARCHIVED'];
    
    for (const stage of stageOrder) {
      const stageItems = byStage[stage] || [];
      if (stageItems.length === 0) continue;

      md += `## ${STAGE_LABELS[stage] || stage}\n\n`;
      
      for (const item of stageItems) {
        md += `### ${item.name}`;
        if (item.customer) md += ` – ${item.customer}`;
        md += `\n`;
        
        if (item.owner) md += `- **Owner:** ${item.owner}\n`;
        if (item.confidence) md += `- **Confidence:** ${item.confidence}%\n`;
        if (item.value_estimate) md += `- **Value:** $${Number(item.value_estimate).toLocaleString()}\n`;
        if (item.next_action) {
          md += `- **Next Action:** ${item.next_action}`;
          if (item.next_action_due) md += ` *(due ${item.next_action_due})*`;
          md += `\n`;
        }
        if (item.notes) md += `- **Notes:** ${item.notes}\n`;
        md += `\n`;
      }
    }

    // Upcoming Events section
    if (calendarEvents && calendarEvents.length > 0) {
      md += `## Upcoming Events\n\n`;
      for (const event of calendarEvents) {
        const startDate = new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        const endDate = event.end_date ? new Date(event.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;
        const dateRange = endDate && endDate !== startDate ? `${startDate} – ${endDate}` : startDate;
        
        md += `- **${event.title}** (${dateRange})`;
        if (event.location) md += ` – ${event.location}`;
        md += `\n`;
      }
      md += `\n`;
    }

    // Summary stats
    const totalItems = items?.length || 0;
    const stage3Count = (byStage['STAGE_3'] || []).length;
    const totalValue = (items || []).reduce((sum, i) => sum + (Number(i.value_estimate) || 0), 0);

    md += `---\n\n`;
    md += `## Summary\n\n`;
    md += `- **Total Opportunities:** ${totalItems}\n`;
    md += `- **Ready to Bid (Stage 3):** ${stage3Count}\n`;
    if (totalValue > 0) {
      md += `- **Total Pipeline Value:** $${totalValue.toLocaleString()}\n`;
    }

    // Fix acronyms
    md = md.replace(/\bwisc\b/gi, 'WSC');

    return new Response(JSON.stringify({ 
      markdown: md,
      stats: {
        total: totalItems,
        stage3: stage3Count,
        totalValue
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Export error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
