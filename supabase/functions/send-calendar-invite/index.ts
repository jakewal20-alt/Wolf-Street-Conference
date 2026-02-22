import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.86.0';
import { Resend } from 'https://esm.sh/resend@4.0.0';

const resend = new Resend(Deno.env.get('RESEND_API_KEY') as string);
const FROM_EMAIL = Deno.env.get('EMAIL_FROM_ADDRESS') || 'Wolf Street <calendar@resend.dev>';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  location: string | null;
  user_id: string;
  all_day: boolean | null;
  invite_email: string | null;
}

// Format date to ICS format: YYYYMMDDTHHMMSSZ
function formatToICS(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Format date for all-day events: YYYYMMDD
function formatToICSDate(dateStr: string): string {
  return dateStr.replace(/-/g, '');
}

// Generate ICS content
function generateICS(event: CalendarEvent, organizerEmail: string): string {
  const now = new Date();
  const dtstamp = formatToICS(now);
  
  let dtstart: string;
  let dtend: string;
  let isAllDay = event.all_day ?? true;
  
  if (isAllDay || !event.start_time) {
    // All-day event
    dtstart = `DTSTART;VALUE=DATE:${formatToICSDate(event.start_date)}`;
    const endDate = event.end_date || event.start_date;
    // For all-day events, end date should be the day after
    const endDateObj = new Date(endDate);
    endDateObj.setDate(endDateObj.getDate() + 1);
    const endDateStr = endDateObj.toISOString().split('T')[0];
    dtend = `DTEND;VALUE=DATE:${formatToICSDate(endDateStr)}`;
  } else {
    // Timed event - combine date and time
    const startDateTime = new Date(`${event.start_date}T${event.start_time}`);
    dtstart = `DTSTART:${formatToICS(startDateTime)}`;
    
    if (event.end_time && event.end_date) {
      const endDateTime = new Date(`${event.end_date}T${event.end_time}`);
      dtend = `DTEND:${formatToICS(endDateTime)}`;
    } else if (event.end_time) {
      const endDateTime = new Date(`${event.start_date}T${event.end_time}`);
      dtend = `DTEND:${formatToICS(endDateTime)}`;
    } else {
      // Default to 1 hour duration
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
      dtend = `DTEND:${formatToICS(endDateTime)}`;
    }
  }
  
  // Escape special characters in text fields
  const escapeICS = (text: string | null): string => {
    if (!text) return '';
    return text
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wolf Street BD Intelligence//EN',
    'METHOD:REQUEST',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${event.id}@wolfstreet.app`,
    `DTSTAMP:${dtstamp}`,
    dtstart,
    dtend,
    `SUMMARY:${escapeICS(event.title)}`,
    event.description ? `DESCRIPTION:${escapeICS(event.description)}` : '',
    event.location ? `LOCATION:${escapeICS(event.location)}` : '',
    `ORGANIZER:mailto:${organizerEmail}`,
    'STATUS:CONFIRMED',
    'SEQUENCE:0',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(line => line !== '').join('\r\n');
  
  return icsContent;
}

// Format date for email display
function formatDateForEmail(event: CalendarEvent): string {
  const startDate = new Date(event.start_date);
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  
  let dateStr = startDate.toLocaleDateString('en-US', options);
  
  if (event.start_time && !event.all_day) {
    const [hours, minutes] = event.start_time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    dateStr += ` at ${hour12}:${minutes} ${ampm}`;
    
    if (event.end_time) {
      const [endHours, endMinutes] = event.end_time.split(':');
      const endHour = parseInt(endHours);
      const endAmpm = endHour >= 12 ? 'PM' : 'AM';
      const endHour12 = endHour % 12 || 12;
      dateStr += ` - ${endHour12}:${endMinutes} ${endAmpm}`;
    }
  } else {
    dateStr += ' (All day)';
  }
  
  return dateStr;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { event_id, test_email } = await req.json();
    
    console.log('Processing calendar invite for event:', event_id);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch the event
    const { data: event, error: eventError } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('id', event_id)
      .single();

    if (eventError || !event) {
      console.error('Error fetching event:', eventError);
      return new Response(
        JSON.stringify({ error: 'Event not found', details: eventError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch the user's email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', event.user_id)
      .single();

    if (profileError || !profile) {
      console.error('Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'User profile not found', details: profileError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Priority: test_email > event.invite_email > profile.email
    const recipientEmail = test_email || event.invite_email || profile.email;
    const organizerEmail = profile.email;
    
    console.log('Sending invite to:', recipientEmail, '(invite_email:', event.invite_email, ')');

    // Generate ICS content
    const icsContent = generateICS(event as CalendarEvent, organizerEmail);
    console.log('Generated ICS content for event:', event.title);

    // Create email HTML body
    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
          <div style="background-color: #ffffff; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
            <h1 style="color: #1a1a1a; font-size: 24px; margin-bottom: 20px;">📅 New Calendar Event</h1>
            
            <div style="background-color: #f8f9fa; border-left: 4px solid #3b82f6; padding: 15px; margin-bottom: 20px; border-radius: 0 4px 4px 0;">
              <h2 style="color: #1a1a1a; font-size: 20px; margin: 0 0 10px 0;">${event.title}</h2>
              <p style="color: #4a5568; margin: 5px 0;"><strong>When:</strong> ${formatDateForEmail(event as CalendarEvent)}</p>
              ${event.location ? `<p style="color: #4a5568; margin: 5px 0;"><strong>Where:</strong> ${event.location}</p>` : ''}
              ${event.description ? `<p style="color: #4a5568; margin: 10px 0 0 0;">${event.description}</p>` : ''}
            </div>
            
            <p style="color: #4a5568; font-size: 14px;">
              Click the attached calendar invite (<strong>event.ics</strong>) to add this event to your calendar.
            </p>
            
            <p style="color: #6b7280; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              This invite was sent from Wolf Street BD Intelligence Platform.
            </p>
          </div>
        </body>
      </html>
    `;

    // Encode ICS content to base64 for attachment
    const encoder = new TextEncoder();
    const icsBytes = encoder.encode(icsContent);
    const base64Content = btoa(String.fromCharCode(...icsBytes));

    const { data: emailResult, error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [recipientEmail],
      subject: `📅 Event: ${event.title}`,
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

    console.log('Successfully sent calendar invite email to:', recipientEmail);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Calendar invite sent',
        emailId: emailResult?.id,
        recipient: recipientEmail 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Calendar invite error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Failed to process calendar invite', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
