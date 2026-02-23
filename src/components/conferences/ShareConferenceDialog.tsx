import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { UserPlus, Loader2, Check, X, Users, Link2, Copy, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";

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
  const [isGeneratingLink, setIsGeneratingLink] = useState(false);
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

  // Fetch existing share link
  const { data: shareLink } = useQuery({
    queryKey: ["conference-share-link", conferenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conference_share_links")
        .select("*")
        .eq("conference_id", conferenceId)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      return data;
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
        description: "Your partner can now see all leads, recaps, and notes",
      });

      queryClient.invalidateQueries({ queryKey: ["conference-collaborators", conferenceId] });
      queryClient.invalidateQueries({ queryKey: ["conference-collaborator-count", conferenceId] });
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
      queryClient.invalidateQueries({ queryKey: ["conference-collaborator-count", conferenceId] });
    } catch (error) {
      console.error("Error removing collaborator:", error);
      toast.error("Failed to remove access");
    }
  };

  const handleGenerateLink = async () => {
    setIsGeneratingLink(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Generate a random token
      const token = crypto.randomUUID().replace(/-/g, "");

      const { error } = await supabase
        .from("conference_share_links")
        .insert({
          conference_id: conferenceId,
          token,
          created_by: user.id,
        });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["conference-share-link", conferenceId] });
      toast.success("Share link generated");
    } catch (error) {
      console.error("Error generating link:", error);
      toast.error("Failed to generate share link");
    } finally {
      setIsGeneratingLink(false);
    }
  };

  const handleToggleLink = async (active: boolean) => {
    if (!shareLink) return;
    try {
      const { error } = await supabase
        .from("conference_share_links")
        .update({ is_active: active })
        .eq("id", shareLink.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["conference-share-link", conferenceId] });
      toast.success(active ? "Link reactivated" : "Link disabled");
    } catch (error) {
      console.error("Error toggling link:", error);
      toast.error("Failed to update link");
    }
  };

  const handleCopyLink = () => {
    if (!shareLink) return;
    const url = `${window.location.origin}/shared/${shareLink.token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link copied to clipboard");
  };

  const availableUsers = users?.filter(u => !existingCollaborators?.includes(u.id)) || [];
  const sharedUsers = users?.filter(u => existingCollaborators?.includes(u.id)) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary" />
            Share Conference
          </DialogTitle>
          <DialogDescription>
            Share "{conferenceName}" with partners or generate a read-only link.
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
              <ScrollArea className="h-[160px] border rounded-md">
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

            {selectedUserId && (
              <Button
                onClick={handleShare}
                disabled={isSharing}
                className="w-full"
              >
                {isSharing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <UserPlus className="w-4 h-4 mr-2" />
                )}
                Share Access
              </Button>
            )}
          </div>

          <Separator />

          {/* Shareable Link Section */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Read-Only Share Link
            </Label>

            {shareLink ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={`${window.location.origin}/shared/${shareLink.token}`}
                    readOnly
                    className="text-xs"
                  />
                  <Button variant="outline" size="sm" onClick={handleCopyLink}>
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">
                    Anyone with this link can view (read-only)
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">Active</span>
                    <Switch
                      checked={shareLink.is_active}
                      onCheckedChange={handleToggleLink}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={handleGenerateLink}
                disabled={isGeneratingLink}
                className="w-full"
              >
                {isGeneratingLink ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Link2 className="w-4 h-4 mr-2" />
                )}
                Generate Share Link
              </Button>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
