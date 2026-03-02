import { useState } from "react";
import { useConferenceAttendees } from "@/hooks/useConferenceAttendees";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, X, Loader2, Mail, Check, Users, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface ConferenceAttendeeManagerProps {
  conferenceId: string;
}

function getInitials(name?: string | null, email?: string): string {
  if (name) {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }
  return (email || "?")[0].toUpperCase();
}

export function ConferenceAttendeeManager({ conferenceId }: ConferenceAttendeeManagerProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const {
    attendees,
    attendeesLoading,
    availableUsers,
    currentUser,
    isCurrentUserAttending,
    addAttendee,
    removeAttendee,
    toggleMyAttendance,
    isAdding,
    isRemoving,
  } = useConferenceAttendees(conferenceId);

  const toggleUser = (userId: string) => {
    setSelectedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleAddSelected = () => {
    selectedUserIds.forEach(userId => addAttendee(userId));
    setSelectedUserIds([]);
    setPopoverOpen(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="w-4 h-4" />
            Who's Going
            {attendees && attendees.length > 0 && (
              <Badge variant="secondary" className="text-xs">{attendees.length}</Badge>
            )}
          </CardTitle>
          <Button
            variant={isCurrentUserAttending ? "default" : "outline"}
            size="sm"
            className={isCurrentUserAttending ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            onClick={toggleMyAttendance}
            disabled={isAdding || isRemoving}
          >
            {isAdding || isRemoving ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : isCurrentUserAttending ? (
              <Check className="w-3 h-3 mr-1" />
            ) : (
              <Plus className="w-3 h-3 mr-1" />
            )}
            {isCurrentUserAttending ? "I'm Going" : "I'm Going"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Multi-select add attendees */}
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-full justify-start text-muted-foreground">
              <UserPlus className="w-4 h-4 mr-2" />
              {selectedUserIds.length > 0
                ? `${selectedUserIds.length} selected`
                : "Add team members..."}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-3 border-b">
              <p className="text-sm font-medium">Select team members</p>
            </div>
            <div className="max-h-48 overflow-y-auto p-2">
              {availableUsers && availableUsers.length > 0 ? (
                availableUsers.map((user) => (
                  <label
                    key={user.id}
                    className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(user.id)}
                      onCheckedChange={() => toggleUser(user.id)}
                    />
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {getInitials(user.full_name, user.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate">{user.full_name || user.email}</span>
                      {user.full_name && (
                        <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                      )}
                    </div>
                  </label>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-3">
                  Everyone is already added
                </p>
              )}
            </div>
            {selectedUserIds.length > 0 && (
              <div className="p-2 border-t">
                <Button
                  className="w-full"
                  size="sm"
                  onClick={handleAddSelected}
                  disabled={isAdding}
                >
                  {isAdding ? (
                    <Loader2 className="w-3 h-3 animate-spin mr-1" />
                  ) : (
                    <Plus className="w-3 h-3 mr-1" />
                  )}
                  Add {selectedUserIds.length} {selectedUserIds.length === 1 ? "person" : "people"}
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* Attendee list */}
        {attendeesLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : attendees && attendees.length > 0 ? (
          <div className="space-y-2">
            {attendees.map((attendee) => {
              const profile = attendee.profiles as any;
              const name = profile?.full_name;
              const email = profile?.email;
              const isMe = attendee.user_id === currentUser?.id;

              return (
                <div
                  key={attendee.id}
                  className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {getInitials(name, email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {name || email}
                        {isMe && <span className="text-muted-foreground ml-1">(you)</span>}
                      </span>
                      {name && (
                        <span className="text-xs text-muted-foreground">{email}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {attendee.notified_at && (
                      <Badge variant="outline" className="text-xs gap-1">
                        <Mail className="w-3 h-3" />
                        Notified
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removeAttendee(attendee.user_id)}
                      disabled={isRemoving}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-2">
            No one tagged yet — click "I'm Going" or add team members above
          </p>
        )}
      </CardContent>
    </Card>
  );
}
