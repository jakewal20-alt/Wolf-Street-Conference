import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Loader2, Check, X, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ShareConferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conferenceId: string;
  conferenceName: string;
}

export function ShareConferenceDialog({
  open,
  onOpenChange,
  conferenceId,
  conferenceName,
}: ShareConferenceDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const queryClient = useQueryClient();

  // Fetch all users (from profiles) except current user
  const { data: users, isLoading: usersLoading } = useQuery({
    queryKey: ["all-users-for-sharing"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .neq("id", user.id)
        .order("full_name");

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch existing collaborators for this conference
  const { data: existingCollaborators } = useQuery({
    queryKey: ["conference-collaborators", conferenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conference_collaborators")
        .select("user_id")
        .eq("conference_id", conferenceId);

      if (error) throw error;
      return data.map(c => c.user_id);
    },
    enabled: open,
  });

  const handleShare = async () => {
    if (!selectedUserId) {
      toast.error("Please select a user to share with");
      return;
    }

    setIsSharing(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("conference_collaborators")
        .insert({
          conference_id: conferenceId,
          user_id: selectedUserId,
          invited_by: user.id,
          role: "partner",
        });

      if (error) {
        if (error.code === "23505") {
          toast.error("This user already has access to this conference");
        } else {
          throw error;
        }
        return;
      }

      toast.success("Conference shared successfully", {
        description: "Your partner can now add leads and business cards",
      });

      queryClient.invalidateQueries({ queryKey: ["conference-collaborators", conferenceId] });
      onOpenChange(false);
      setSelectedUserId(null);
    } catch (error) {
      console.error("Error sharing conference:", error);
      toast.error("Failed to share conference");
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveCollaborator = async (userId: string) => {
    try {
      const { error } = await supabase
        .from("conference_collaborators")
        .delete()
        .eq("conference_id", conferenceId)
        .eq("user_id", userId);

      if (error) throw error;

      toast.success("Access removed");
      queryClient.invalidateQueries({ queryKey: ["conference-collaborators", conferenceId] });
    } catch (error) {
      console.error("Error removing collaborator:", error);
      toast.error("Failed to remove access");
    }
  };

  const availableUsers = users?.filter(u => !existingCollaborators?.includes(u.id)) || [];
  const sharedUsers = users?.filter(u => existingCollaborators?.includes(u.id)) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Share Conference
          </DialogTitle>
          <DialogDescription>
            Share "{conferenceName}" with a partner so they can add leads and business cards.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Existing collaborators */}
          {sharedUsers.length > 0 && (
            <div className="space-y-2">
              <Label>Current Partners</Label>
              <div className="flex flex-wrap gap-2">
                {sharedUsers.map((user) => (
                  <Badge key={user.id} variant="secondary" className="flex items-center gap-1 pr-1">
                    <Users className="w-3 h-3" />
                    {user.full_name || user.email}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-4 w-4 p-0 ml-1 hover:bg-destructive/20"
                      onClick={() => handleRemoveCollaborator(user.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* User selection */}
          <div className="space-y-2">
            <Label>Add a Partner</Label>
            {usersLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : availableUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                {users?.length === 0 
                  ? "No other users in Wolf Street yet" 
                  : "All users already have access"}
              </p>
            ) : (
              <ScrollArea className="h-[200px] border rounded-md">
                <div className="p-2 space-y-1">
                  {availableUsers.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => setSelectedUserId(user.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-md text-left transition-colors ${
                        selectedUserId === user.id
                          ? "bg-primary/10 border border-primary"
                          : "hover:bg-muted"
                      }`}
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {user.full_name || "No name"}
                        </p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                      {selectedUserId === user.id && (
                        <Check className="w-4 h-4 text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSharing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleShare}
              disabled={isSharing || !selectedUserId}
            >
              {isSharing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4 mr-2" />
                  Share Access
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

