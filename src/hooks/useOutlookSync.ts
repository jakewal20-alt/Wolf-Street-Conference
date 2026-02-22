import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'outlook_tokens';

interface OutlookTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export function useOutlookSync() {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  // Check for stored tokens on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const tokens: OutlookTokens = JSON.parse(stored);
        if (tokens.expiresAt > Date.now()) {
          setIsConnected(true);
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Handle OAuth callback
  useEffect(() => {
    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      
      if (code && window.location.pathname.includes('calendar')) {
        setIsLoading(true);
        try {
          const { data, error } = await supabase.functions.invoke('sync-to-outlook', {
            body: { action: 'exchange_token', code }
          });

          if (error) throw error;

          if (data.accessToken) {
            const tokens: OutlookTokens = {
              accessToken: data.accessToken,
              refreshToken: data.refreshToken,
              expiresAt: Date.now() + (data.expiresIn * 1000)
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
            setIsConnected(true);
            toast({
              title: "Connected to Outlook",
              description: "Your calendar is now linked to Microsoft Outlook"
            });
            
            // Clean up URL
            window.history.replaceState({}, '', window.location.pathname);
          }
        } catch (err: any) {
          console.error('OAuth callback error:', err);
          toast({
            title: "Connection failed",
            description: err.message || "Failed to connect to Outlook",
            variant: "destructive"
          });
        } finally {
          setIsLoading(false);
        }
      }
    };

    handleCallback();
  }, [toast]);

  const connect = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-to-outlook', {
        body: { action: 'auth_url' }
      });

      if (error) throw error;

      if (data.error) {
        toast({
          title: "Setup Required",
          description: data.message || "Microsoft integration needs to be configured",
          variant: "destructive"
        });
        return;
      }

      if (data.authUrl) {
        window.location.href = data.authUrl;
      }
    } catch (err: any) {
      console.error('Connect error:', err);
      toast({
        title: "Connection failed",
        description: err.message || "Failed to initiate Outlook connection",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setIsConnected(false);
    toast({
      title: "Disconnected",
      description: "Outlook calendar has been disconnected"
    });
  }, [toast]);

  const syncEvents = useCallback(async (events: any[]) => {
    if (!isConnected) {
      toast({
        title: "Not connected",
        description: "Please connect to Outlook first",
        variant: "destructive"
      });
      return { success: false };
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      setIsConnected(false);
      return { success: false };
    }

    const tokens: OutlookTokens = JSON.parse(stored);
    
    if (tokens.expiresAt < Date.now()) {
      localStorage.removeItem(STORAGE_KEY);
      setIsConnected(false);
      toast({
        title: "Session expired",
        description: "Please reconnect to Outlook",
        variant: "destructive"
      });
      return { success: false };
    }

    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-to-outlook', {
        body: { 
          action: 'sync',
          accessToken: tokens.accessToken,
          events 
        }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Events synced",
          description: `Successfully synced ${data.synced} event(s) to Outlook`
        });
      } else if (data.synced > 0) {
        toast({
          title: "Partial sync",
          description: `Synced ${data.synced} of ${events.length} events. ${data.failed} failed.`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Sync failed",
          description: "Failed to sync events to Outlook",
          variant: "destructive"
        });
      }

      return data;
    } catch (err: any) {
      console.error('Sync error:', err);
      toast({
        title: "Sync failed",
        description: err.message || "Failed to sync to Outlook",
        variant: "destructive"
      });
      return { success: false };
    } finally {
      setIsSyncing(false);
    }
  }, [isConnected, toast]);

  return {
    isConnected,
    isLoading,
    isSyncing,
    connect,
    disconnect,
    syncEvents
  };
}
