import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, UserCheck, UserX, Loader2, Trash2, UserPlus, Copy } from "lucide-react";
import { toast } from "sonner";
import { safeFormat } from "@/utils/dateHelpers";
import { PageLayout, PageHeader } from "@/components/PageLayout";

type InviteResult =
  | { status: "invited"; approved: boolean; emailed: boolean; invite_url: string }
  | { status: "existing"; approved: boolean };

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [lastInvite, setLastInvite] = useState<{ email: string; result: InviteResult } | null>(null);

  const inviteMutation = useMutation({
    mutationFn: async ({ email, fullName }: { email: string; fullName: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-invite-user", {
        body: { email, full_name: fullName },
      });
      if (error) {
        // Surface the function's own message (e.g. "Enter a valid email address").
        const ctx = (error as { context?: Response }).context;
        const detail = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(detail?.error ?? error.message);
      }
      return data as InviteResult;
    },
    onSuccess: (result, { email }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setLastInvite({ email, result });
      setInviteEmail("");
      setInviteName("");
      if (result.status === "existing") {
        toast.success(`${email} already has an account. It's approved.`);
      } else if (result.emailed) {
        toast.success(`Invite sent to ${email}`);
      } else {
        toast.success("Invite created. Copy the link and send it yourself.");
      }
    },
    onError: (error) => toast.error("Invite failed: " + error.message),
  });

  const copyInviteLink = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Invite link copied");
    } catch {
      toast.error("Couldn't copy. Select the link and copy it manually.");
    }
  };

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: { is_approved?: boolean; is_admin?: boolean } }) => {
      const { error } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User updated");
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast.error("Failed to update user");
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId },
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User deleted");
    },
    onError: (error) => {
      console.error("Delete error:", error);
      toast.error("Failed to delete user: " + error.message);
    },
  });

  const pendingCount = users?.filter(u => !u.is_approved).length || 0;
  const approvedCount = users?.filter(u => u.is_approved).length || 0;
  const totalCount = users?.length || 0;

  return (
    <PageLayout>
      <PageHeader
        title="User Management"
        description="Invite people and manage access. Sign-up is invite-only."
        icon={<Shield className="w-6 h-6" />}
      />

      {/* Invite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" /> Invite someone
          </CardTitle>
          <CardDescription>
            They get a one-time link (valid 24 hours) to set a password. Invited people are approved automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              inviteMutation.mutate({ email: inviteEmail.trim(), fullName: inviteName.trim() });
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="name@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="invite-name">Full name (optional)</Label>
              <Input
                id="invite-name"
                placeholder="Jane Doe"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim()}>
              {inviteMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />}
              Send invite
            </Button>
          </form>

          {lastInvite?.result.status === "invited" && (
            <div className="space-y-2 rounded border border-border bg-muted/50 p-3 text-sm">
              <p>
                {lastInvite.result.emailed
                  ? <>Emailed to <span className="font-medium">{lastInvite.email}</span>. If it doesn't arrive, send them this link:</>
                  : <>The email couldn't be sent. Send <span className="font-medium">{lastInvite.email}</span> this link yourself:</>}
              </p>
              <div className="flex gap-2">
                <Input readOnly value={lastInvite.result.invite_url} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
                <Button type="button" variant="outline" size="sm" onClick={() => copyInviteLink((lastInvite.result as { invite_url: string }).invite_url)}>
                  <Copy className="mr-1 h-4 w-4" /> Copy
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold">{totalCount}</p>
            <p className="text-sm text-muted-foreground">Total Users</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-warning">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-success">{approvedCount}</p>
            <p className="text-sm text-muted-foreground">Approved</p>
          </CardContent>
        </Card>
      </div>

      {/* User List */}
      {isLoading ? (
        <Card>
          <CardContent className="p-6 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            Loading users...
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {users?.map((user) => (
            <Card key={user.id} className={`border-l-4 ${
              user.is_admin
                ? "border-l-primary"
                : user.is_approved
                  ? "border-l-green-500"
                  : "border-l-amber-500"
            }`}>
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{user.full_name || "No name"}</span>
                      {user.is_admin && (
                        <Badge className="bg-primary text-primary-foreground text-xs">Admin</Badge>
                      )}
                      {user.is_approved ? (
                        <Badge variant="outline" className="text-success border-success text-xs">Approved</Badge>
                      ) : (
                        <Badge variant="outline" className="text-warning border-warning text-xs">Pending</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.created_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Joined {safeFormat(user.created_at, "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!user.is_approved ? (
                      <Button
                        size="sm"
                        onClick={() => updateUserMutation.mutate({
                          userId: user.id,
                          updates: { is_approved: true },
                        })}
                        disabled={updateUserMutation.isPending}
                      >
                        <UserCheck className="w-4 h-4 mr-1" />
                        Approve
                      </Button>
                    ) : !user.is_admin ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => updateUserMutation.mutate({
                          userId: user.id,
                          updates: { is_approved: false },
                        })}
                        disabled={updateUserMutation.isPending}
                      >
                        <UserX className="w-4 h-4 mr-1" />
                        Revoke
                      </Button>
                    ) : null}
                    {!user.is_admin && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          if (confirm(`Delete ${user.email}? This cannot be undone.`)) {
                            deleteUserMutation.mutate(user.id);
                          }
                        }}
                        disabled={deleteUserMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </PageLayout>
  );
}
