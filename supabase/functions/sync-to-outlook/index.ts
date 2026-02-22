import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MICROSOFT_GRAPH_URL = 'https://graph.microsoft.com/v1.0';

interface OutlookEvent {
  subject: string;
  body: {
    contentType: string;
    content: string;
  };
  start: {
    dateTime: string;
    timeZone: string;
  };
  end: {
    dateTime: string;
    timeZone: string;
  };
  location?: {
    displayName: string;
  };
  isAllDay?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { 
      events, 
      accessToken,
      action = 'sync' // 'sync' | 'auth_url' | 'exchange_token'
    } = await req.json();

    const clientId = Deno.env.get('MICROSOFT_CLIENT_ID');
    const clientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET');
    const redirectUri = Deno.env.get('MICROSOFT_REDIRECT_URI');

    if (!clientId) {
      return new Response(JSON.stringify({ 
        error: 'Microsoft integration not configured',
        message: 'Please add MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, and MICROSOFT_REDIRECT_URI secrets'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate OAuth URL for user authorization
    if (action === 'auth_url') {
      const scopes = encodeURIComponent('Calendars.ReadWrite offline_access');
      const authUrl = `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri || '')}&response_mode=query&scope=${scopes}`;
      
      return new Response(JSON.stringify({ authUrl }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Exchange authorization code for tokens
    if (action === 'exchange_token') {
      const { code } = await req.json();
      
      const tokenResponse = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret || '',
          code,
          redirect_uri: redirectUri || '',
          grant_type: 'authorization_code',
          scope: 'Calendars.ReadWrite offline_access',
        }),
      });

      const tokens = await tokenResponse.json();
      
      if (tokens.error) {
        console.error('Token exchange error:', tokens);
        return new Response(JSON.stringify({ error: tokens.error_description || 'Failed to exchange token' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ 
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresIn: tokens.expires_in
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Sync events to Outlook
    if (action === 'sync') {
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'Missing Microsoft access token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!events || !Array.isArray(events) || events.length === 0) {
        return new Response(JSON.stringify({ error: 'No events to sync' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const results = [];
      const errors = [];

      for (const event of events) {
        try {
          const outlookEvent: OutlookEvent = {
            subject: event.title,
            body: {
              contentType: 'text',
              content: event.description || '',
            },
            start: {
              dateTime: event.start_date,
              timeZone: 'UTC',
            },
            end: {
              dateTime: event.end_date || event.start_date,
              timeZone: 'UTC',
            },
            isAllDay: event.all_day || false,
          };

          if (event.location) {
            outlookEvent.location = { displayName: event.location };
          }

          console.log('Creating Outlook event:', outlookEvent);

          const response = await fetch(`${MICROSOFT_GRAPH_URL}/me/events`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(outlookEvent),
          });

          const data = await response.json();

          if (!response.ok) {
            console.error('Microsoft Graph API error:', data);
            errors.push({ eventId: event.id, error: data.error?.message || 'Failed to create event' });
          } else {
            results.push({ eventId: event.id, outlookId: data.id, success: true });
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          console.error('Error syncing event:', err);
          errors.push({ eventId: event.id, error: errorMessage });
        }
      }

      return new Response(JSON.stringify({ 
        success: errors.length === 0,
        synced: results.length,
        failed: errors.length,
        results,
        errors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in sync-to-outlook function:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
