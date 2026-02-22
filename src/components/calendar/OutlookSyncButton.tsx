import { Button } from "@/components/ui/button";
import { Cloud, CloudOff, Loader2 } from "lucide-react";
import { useOutlookSync } from "@/hooks/useOutlookSync";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface CalendarEvent {
  id: string;
  title: string;
  description: string | null;
  event_type: string;
  start_date: string;
  end_date: string | null;
  all_day: boolean;
  location: string | null;
}

interface OutlookSyncButtonProps {
  calendarEvents: CalendarEvent[];
}

export function OutlookSyncButton({ calendarEvents }: OutlookSyncButtonProps) {
  const { isConnected, isLoading, isSyncing, connect, disconnect, syncEvents } = useOutlookSync();

  const handleSync = async () => {
    if (calendarEvents.length === 0) {
      return;
    }
    await syncEvents(calendarEvents);
  };

  if (isLoading) {
    return (
      <Button variant="outline" className="w-full justify-start gap-2" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        Connecting...
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <Button
        variant="outline"
        className="w-full justify-start gap-2 hover:bg-accent transition-all"
        onClick={connect}
      >
        <Cloud className="h-4 w-4" />
        Connect Outlook
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="w-full justify-start gap-2 hover:bg-accent transition-all"
          disabled={isSyncing}
        >
          {isSyncing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Cloud className="h-4 w-4 text-primary" />
          )}
          {isSyncing ? "Syncing..." : "Outlook Connected"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuItem onClick={handleSync} disabled={calendarEvents.length === 0}>
          <Cloud className="h-4 w-4 mr-2" />
          Sync All Events ({calendarEvents.length})
        </DropdownMenuItem>
        <DropdownMenuItem onClick={disconnect} className="text-destructive">
          <CloudOff className="h-4 w-4 mr-2" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
