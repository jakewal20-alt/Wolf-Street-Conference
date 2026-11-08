import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Shield, UserCheck, UserX, Loader2, UserMinus, UserPlus, Copy, Building2 } from "lucide-react";
import { toast } from "sonner";
import { safeFormat } from "@/utils/dateHelpers";
import { PageLayout, PageHeader } from "@/components/PageLayout";

type InviteResult =
  | { status: "invited"; resent?: boolean; approved: boolean; company?: string; emailed: boolean; email_error?: string | null; invite_url: string }
  | { status: "existing"; approved: boolean; company?: string };

type Company = { id: string; name: string; slug: string };

/** Surface an edge function's own error message (e.g. "Enter a valid email address"). */
async function functionError(error: unknown): Promise<Error> {
  const ctx = (error as { context?: unknown }).context;
  const detail = ctx instanceof Response ? await ctx.json().catch(() => null) : null;
  return new Error(detail?.error ?? (error as Error).message);
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
}

export default function AdminUsers() {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteAdmin, setInviteAdmin] = useState(false);
  const [inviteOrgId, setInviteOrgId] = useState<string>("");
  const [newCompany, setNewCompany] = useState("");
  const [lastInvite, setLastInvite] = useState<{ email: string; result: InviteResult } | null>(null);

  const { data: me } = useQuery({
    queryKey: ["admin-me"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("id, org_id, is_admin, is_platform_admin")
        .eq("id", user.id)
        .single();
      if (error) throw error;
      return data;
    },
  });
  const isPlatformAdmin = me?.is_platform_admin === true;

  const { data: companies } = useQuery({
    queryKey: ["admin-companies"],
    enabled: !!me,
    queryFn: async () => {
      const { data, error } = await supabase.from("organizations").select("id, name, slug").order("name");
      if (error) throw error;
      return data as Company[];
    },
  });
  const companyName = useMemo(() => {
    const m = new Map((companies ?? []).map((c) => [c.id, c.name]));
    return (id: string | null | undefined) => (id ? m.get(id) : undefined);
  }, [companies]);
  const myCompany = companyName(me?.org_id);
  const targetOrgId = inviteOrgId || me?.org_id || "";

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      // Row-level security limits this to your company (everyone for the platform admin).
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createCompanyMutation = useMutation({
    mutationFn: async (name: string) => {
      const slug = slugify(name);
      if (slug.length < 2) throw new Error("Use a longer company name");
      const { data, error } = await supabase
        .from("organizations")
        .insert({ name, slug, created_by: me?.id ?? null })
        .select("id, name, slug")
        .single();
      if (error) throw new Error(error.code === "23505" ? "A company with that name already exists" : error.message);
      return data as Company;
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      setNewCompany("");
      setInviteOrgId(company.id);
      setInviteAdmin(true);
      toast.success(`${company.name} created. Invite their first admin below.`);
    },
    onError: (error) => toast.error("Couldn't create company: " + error.message),
  });

  const inviteMutation = useMutation({
    mutationFn: async ({ email, fullName }: { email: string; fullName: string }) => {
      const { data, error } = await supabase.functions.invoke("admin-invite-user", {
        body: { email, full_name: fullName, org_id: targetOrgId || undefined, make_admin: inviteAdmin },
      });
      if (error) throw await functionError(error);
      return data as InviteResult;
    },
    onSuccess: (result, { email }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      setLastInvite({ email, result });
      setInviteEmail("");
      setInviteName("");
      setInviteAdmin(false);
      if (result.status === "existing") {
        toast.success(`${email} already had a Wolf Street login. They're now in ${result.company ?? "the company"}.`);
      } else if (result.emailed) {
        toast.success(result.resent ? `New invite link sent to ${email}` : `Invite sent to ${email}`);
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

  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: { is_approved?: boolean; is_admin?: boolean } }) => {
      const { error } = await supabase.from("profiles").update(updates).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("User updated");
    },
    onError: (error) => {
      console.error("Update error:", error);
      toast.error("Failed to update user: " + error.message);
    },
  });

  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { userId } });
      if (error) throw await functionError(error);
      if (!data.success) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Removed from the company");
    },
    onError: (error) => toast.error("Couldn't remove: " + error.message),
  });

  const inCompany = (users ?? []).filter((u) => u.org_id);
  const pendingCount = inCompany.filter((u) => !u.is_approved).length;
  const approvedCount = inCompany.filter((u) => u.is_approved).length;
  const peopleIn = (orgId: string) => (users ?? []).filter((u) => u.org_id === orgId).length;

  return (
    <PageLayout>
      <PageHeader
        title="User Management"
        description={
          isPlatformAdmin
            ? "You're the platform admin: you see every company. Sign-up is invite-only."
            : `People in ${myCompany ?? "your company"}. Sign-up is invite-only.`
        }
        icon={<Shield className="w-6 h-6" />}
      />

      {/* Companies (platform admin only) */}
      {isPlatformAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" /> Companies
            </CardTitle>
            <CardDescription>
              Each company only sees its own conferences, leads, contacts and calendar. Create a company, then invite its first admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y divide-border rounded border border-border text-sm">
              {(companies ?? []).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">
                    {peopleIn(c.id)} {peopleIn(c.id) === 1 ? "person" : "people"}
                  </span>
                </li>
              ))}
            </ul>
            <form
              className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"
              onSubmit={(e) => {
                e.preventDefault();
                createCompanyMutation.mutate(newCompany.trim());
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="new-company">New company</Label>
                <Input
                  id="new-company"
                  placeholder="Customer name"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  maxLength={200}
                />
              </div>
              <Button type="submit" variant="outline" disabled={createCompanyMutation.isPending || !newCompany.trim()}>
                {createCompanyMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Building2 className="mr-1 h-4 w-4" />}
                Create company
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Invite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserPlus className="h-5 w-5" /> Invite someone
          </CardTitle>
          <CardDescription>
            They get a one-time link (valid 24 hours) to set a password, and are approved into{" "}
            {companyName(targetOrgId) ?? "your company"} automatically. Someone who already uses another Wolf Street app is added right away.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto] lg:items-end"
            onSubmit={(e) => {
              e.preventDefault();
              inviteMutation.mutate({ email: inviteEmail.trim(), fullName: inviteName.trim() });
            }}
          >
            {isPlatformAdmin && (
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                <Label>Company</Label>
                <Select value={targetOrgId} onValueChange={setInviteOrgId}>
                  <SelectTrigger className="sm:max-w-xs">
                    <SelectValue placeholder="Choose a company" />
                  </SelectTrigger>
                  <SelectContent>
                    {(companies ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
            <Button type="submit" disabled={inviteMutation.isPending || !inviteEmail.trim() || !targetOrgId}>
              {inviteMutation.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <UserPlus className="mr-1 h-4 w-4" />}
              Send invite
            </Button>
            <label className="flex items-center gap-2 text-sm sm:col-span-2 lg:col-span-3">
              <Checkbox checked={inviteAdmin} onCheckedChange={(v) => setInviteAdmin(v === true)} />
              Make them an admin of {companyName(targetOrgId) ?? "the company"} (they can invite and remove people)
            </label>
          </form>

          {lastInvite?.result.status === "invited" && (
            <div className="space-y-2 rounded border border-border bg-muted/50 p-3 text-sm">
              <p>
                {lastInvite.result.emailed
                  ? <>Emailed to <span className="font-medium">{lastInvite.email}</span>. If it doesn't arrive, send them this link:</>
                  : <>The email couldn't be sent{lastInvite.result.email_error ? <> ({lastInvite.result.email_error})</> : null}. Send <span className="font-medium">{lastInvite.email}</span> this link yourself:</>}
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
            <p className="text-3xl font-bold">{inCompany.length}</p>
            <p className="text-sm text-muted-foreground">{isPlatformAdmin ? "People (all companies)" : "People"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6 text-center">
            <p className="text-3xl font-bold text-warning">{pendingCount}</p>
            <p className="text-sm text-muted-foreground">Access paused</p>
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
          {users?.map((user) => {
            const isMe = user.id === me?.id;
            const noCompany = !user.org_id;
            return (
              <Card key={user.id} className={`border-l-4 ${
                noCompany
                  ? "border-l-border"
                  : user.is_admin
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
                        {isPlatformAdmin && (
                          <Badge variant="secondary" className="text-xs">
                            {noCompany ? "No Hallway company" : companyName(user.org_id) ?? "Company"}
                          </Badge>
                        )}
                        {user.is_platform_admin && (
                          <Badge className="bg-primary text-primary-foreground text-xs">Platform admin</Badge>
                        )}
                        {!noCompany && user.is_admin && !user.is_platform_admin && (
                          <Badge className="bg-primary text-primary-foreground text-xs">Admin</Badge>
                        )}
                        {!noCompany && (user.is_approved ? (
                          <Badge variant="outline" className="text-success border-success text-xs">Approved</Badge>
                        ) : (
                          <Badge variant="outline" className="text-warning border-warning text-xs">Access paused</Badge>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground break-all">{user.email}</p>
                      {noCompany ? (
                        <p className="text-xs text-muted-foreground mt-1">
                          Wolf Street login without Hallway access. Use Invite to add them to a company.
                        </p>
                      ) : user.created_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Joined {safeFormat(user.created_at, "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      )}
                    </div>
                    {!isMe && !noCompany && !user.is_platform_admin && (
                      <div className="flex flex-wrap items-center gap-2">
                        {!user.is_approved ? (
                          <Button
                            size="sm"
                            onClick={() => updateUserMutation.mutate({ userId: user.id, updates: { is_approved: true } })}
                            disabled={updateUserMutation.isPending}
                          >
                            <UserCheck className="w-4 h-4 mr-1" />
                            Approve
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateUserMutation.mutate({
                              userId: user.id,
                              updates: user.is_admin ? { is_admin: false } : { is_approved: false },
                            })}
                            disabled={updateUserMutation.isPending}
                          >
                            <UserX className="w-4 h-4 mr-1" />
                            {user.is_admin ? "Remove admin" : "Pause access"}
                          </Button>
                        )}
                        {user.is_approved && !user.is_admin && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updateUserMutation.mutate({ userId: user.id, updates: { is_admin: true } })}
                            disabled={updateUserMutation.isPending}
                          >
                            <Shield className="w-4 h-4 mr-1" />
                            Make admin
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Remove ${user.email} from ${companyName(user.org_id) ?? "this company"}? Their Wolf Street login stays; they lose Hallway access. Records they created stay with the company.`)) {
                              removeUserMutation.mutate(user.id);
                            }
                          }}
                          disabled={removeUserMutation.isPending}
                        >
                          <UserMinus className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </PageLayout>
  );
}
