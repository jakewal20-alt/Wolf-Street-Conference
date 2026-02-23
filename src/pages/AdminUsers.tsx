import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, UserCheck, UserX, Users, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { PageLayout, PageHeader } from "@/components/PageLayout";

export default function AdminUsers() {
  const queryClient = useQueryClient();

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

  const pendingCount = users?.filter(u => !u.is_approved).length || 0;
  const approvedCount = users?.filter(u => u.is_approved).length || 0;
  const totalCount = users?.length || 0;

  return (
    <PageLayout>
      <PageHeader
        title="User Management"
        description="Approve new users and manage access"
        icon={<Shield className="w-6 h-6" />}
      />

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
            <p className="text-3xl font-bold text-amber-500">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-green-500">{approvedCount}</p>
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
                        <Badge variant="outline" className="text-green-600 border-green-600 text-xs">Approved</Badge>
                      ) : (
                        <Badge variant="outline" className="text-amber-500 border-amber-500 text-xs">Pending</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                    {user.created_at && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Joined {format(new Date(user.created_at), "MMM d, yyyy 'at' h:mm a")}
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
