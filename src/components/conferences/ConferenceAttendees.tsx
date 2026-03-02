import { useConferenceAttendees } from "@/hooks/useConferenceAttendees";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Check, Loader2, UserPlus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ConferenceAttendeeBadgesProps {
  conferenceId: string;
}

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }
  return (email || "?")[0].toUpperCase();
}

export function ConferenceAttendeeBadges({ conferenceId }: ConferenceAttendeeBadgesProps) {
  const { attendees, isCurrentUserAttending, toggleMyAttendance, isAdding, isRemoving } = useConferenceAttendees(conferenceId);

  const isToggling = isAdding || isRemoving;

  return (
    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
      <Button
        variant={isCurrentUserAttending ? "default" : "outline"}
        size="sm"
        className={`h-7 text-xs ${isCurrentUserAttending ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
        onClick={toggleMyAttendance}
        disabled={isToggling}
      >
        {isToggling ? (
          <Loader2 className="w-3 h-3 animate-spin mr-1" />
        ) : isCurrentUserAttending ? (
          <Check className="w-3 h-3 mr-1" />
        ) : (
          <UserPlus className="w-3 h-3 mr-1" />
        )}
        {isCurrentUserAttending ? "Going" : "I'm going"}
      </Button>

      {attendees && attendees.length > 0 && (
        <TooltipProvider>
          <div className="flex -space-x-2">
            {attendees.slice(0, 5).map((attendee) => {
              const profile = attendee.profiles as any;
              const name = profile?.full_name;
              const email = profile?.email;
              return (
                <Tooltip key={attendee.id}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-6 w-6 border-2 border-background">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(name, email)}
                      </AvatarFallback>
                    </Avatar>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{name || email}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
            {attendees.length > 5 && (
              <Avatar className="h-6 w-6 border-2 border-background">
                <AvatarFallback className="text-[10px] bg-muted text-muted-foreground">
                  +{attendees.length - 5}
                </AvatarFallback>
              </Avatar>
            )}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
