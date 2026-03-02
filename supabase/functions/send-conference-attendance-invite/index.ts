import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
const FROM_EMAIL = Deno.env.get('EMAIL_FROM_ADDRESS') || 'Wolf Street <calendar@resend.dev>';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function formatToICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

function generateConferenceICS(conference: {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  location: string;
  description?: string | null;
}, organizerEmail: string): string {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const dtstart = `DTSTART;VALUE=DATE:${formatToICSDate(conference.start_date)}`;
  // For all-day events, end date should be the day after
  const endDateObj = new Date(conference.end_date);
  endDateObj.setDate(endDateObj.getDate() + 1);
  const endDateStr = endDateObj.toISOString().split('T')[0];
  const dtend = `DTEND;VALUE=DATE:${formatToICSDate(endDateStr)}`;

  const escapeICS = (text: string | null): string => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wolf Street BD Intelligence//EN',
    'METHOD:REQUEST',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:conf-${conference.id}@wolfstreet.app`,
    `DTSTAMP:${dtstamp}`,
    dtstart,
    dtend,
    `SUMMARY:${escapeICS(conference.name)}`,
    conference.description ? `DESCRIPTION:${escapeICS(conference.description)}` : '',
    conference.location ? `LOCATION:${escapeICS(conference.location)}` : '',
    `ORGANIZER:mailto:${organizerEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(line => line !== '').join('\r\n');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { conference_id, recipient_email, recipient_name } = await req.json();

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch conference
    const { data: conference, error: confError } = await supabase
      .from('conferences')
      .select('*')
      .eq('id', conference_id)
      .single();

    if (confError || !conference) {
      return new Response(
        JSON.stringify({ error: 'Conference not found', details: confError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get organizer email (conference creator)
    const { data: creator } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', conference.created_by)
      .single();

    const organizerEmail = creator?.email || 'noreply@wolfstreet.app';

    // Generate ICS
    const icsContent = generateConferenceICS(conference, organizerEmail);

    // Format dates for display
    const startDate = new Date(conference.start_date);
    const endDate = new Date(conference.end_date);
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    };
    const dateStr = `${startDate.toLocaleDateString('en-US', options)} - ${endDate.toLocaleDateString('en-US', options)}`;

    const greeting = recipient_name ? `Hi ${recipient_name},` : 'Hi,';

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">You're attending a conference!</h1>
            <p style="color: #4a5568; font-size: 16px;">${greeting}</p>
            <p style="color: #4a5568; font-size: 16px;">You've been tagged as attending the following conference:</p>

            <div style="background-color: #f8f9fa; border-left: 4px solid #10b981; padding: 15px; margin: 20px 0; border-radius: 0 4px 4px 0;">
              <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 10px 0;">${conference.name}</h2>
              <p style="color: #4a5568; margin: 5px 0;"><strong>When:</strong> ${dateStr}</p>
              ${conference.location ? `<p style="color: #4a5568; margin: 5px 0;"><strong>Where:</strong> ${conference.location}</p>` : ''}
              ${conference.description ? `<p style="color: #4a5568; margin: 10px 0 0 0;">${conference.description}</p>` : ''}
            </div>

            <p style="color: #4a5568; font-size: 14px;">
              Click the attached calendar invite (<strong>event.ics</strong>) to add this conference to your Outlook / Google / Apple calendar.
            </p>

            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              This invite was sent from Wolf Street BD Intelligence Platform.
            </p>
          </div>
        </body>
      </html>
    `;

    const encoder = new TextEncoder();
    const icsBytes = encoder.encode(icsContent);
    const base64Content = btoa(String.fromCharCode(...icsBytes));

    const { data: emailResult, error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [recipient_email],
      subject: `📅 Conference: ${conference.name}`,
      html: emailHtml,
      attachments: [
        {
          filename: 'event.ics',
          content: base64Content,
          contentType: 'text/calendar; charset=utf-8; method=REQUEST',
        },
      ],
    });

    if (sendError) {
      console.error('Error sending email:', sendError);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: sendError }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Sent conference attendance invite to:', recipient_email);

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult?.id, recipient: recipient_email }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Conference attendance invite error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to process invite', details: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
