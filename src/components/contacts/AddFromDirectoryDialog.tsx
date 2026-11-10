import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type DirectoryPerson = {
  id: string;
  name: string;
  title: string | null;
  role: string | null;
  office: string | null;
  officeParent: string | null;
  email: string | null;
  phone: string | null;
  publishedOn: string | null;
  publishedAt: string | null;
  lastSeen: string | null;
  stale: boolean;
  lines: string[];
  url: string;
};

const ROLE: Record<string, string> = {
  decision_maker: "Decision maker", program_office: "Program office", contracting: "Contracting",
  requirements: "Requirements", technical: "Technical POC", other: "Government",
};

const month = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", year: "numeric" }) : "");

/**
 * Search Wolf Street's government contact directory (people listed on SAM.gov notices, DSIP topics,
 * Grants.gov and agendas) and add one to your contacts, with where their details were published.
 */
export default function AddFromDirectoryDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [adding, setAdding] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setTerm(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const { data, isFetching } = useQuery({
    queryKey: ["forecast-directory", term],
    enabled: open && term.length >= 2,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke(`forecast-directory?q=${encodeURIComponent(term)}`, { method: "GET" });
      if (error) throw error;
      return data as { configured: boolean; available?: boolean; people: DirectoryPerson[] };
    },
  });

  const add = async (p: DirectoryPerson) => {
    setAdding(p.id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const source = p.publishedOn ? `Contact details as published on ${p.publishedOn}${p.publishedAt ? `, ${month(p.publishedAt)}` : ""}.` : "";
      const lines = p.lines.length ? ` Office linked to budget lines ${p.lines.join(", ")}.` : "";
      const { error } = await supabase.from("contacts").insert({
        user_id: user.id,
        name: p.name,
        org_name: [p.office, p.officeParent].filter(Boolean).join(", ") || null,
        role: p.title || (p.role ? ROLE[p.role] ?? null : null),
        email: p.email,
        phone: p.phone,
        notes: `From the Wolf Street directory. ${source}${lines}`.trim(),
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`${p.name} added to your contacts`);
    } catch (err) {
      console.error("Add from directory failed:", err);
      toast.error("Couldn't add that contact");
    } finally {
      setAdding(null);
    }
  };

  const people = data?.people ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add from directory</DialogTitle>
          <DialogDescription>
            Government points of contact from SAM.gov notices, DSIP topics, Grants.gov and conference agendas. During an
            active source selection, talk only to the contracting officer named on the solicitation.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Name, office, office code or program element" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {data && !data.configured && <p className="text-sm text-muted-foreground">The Wolf Street directory isn't connected for your company.</p>}
          {data?.configured && data.available === false && <p className="text-sm text-muted-foreground">Forecast didn't answer. Try again in a minute.</p>}
          {isFetching && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Searching…</p>}
          {term.length >= 2 && data?.available && !isFetching && people.length === 0 && <p className="text-sm text-muted-foreground">No one matches.</p>}
          {people.map((p) => (
            <div key={p.id} className="flex items-start justify-between gap-3 rounded-md border p-3">
              <div className="min-w-0 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  {p.role && <Badge variant="secondary">{ROLE[p.role] ?? p.role}</Badge>}
                  {p.stale && <Badge variant="outline">Not seen since {month(p.lastSeen)}</Badge>}
                </div>
                {p.title && <div className="text-sm">{p.title}</div>}
                {p.office && <div className="text-sm text-muted-foreground">{p.office}{p.officeParent ? ` · ${p.officeParent}` : ""}</div>}
                {(p.email || p.phone) && (
                  <div className="text-xs text-muted-foreground">
                    {[p.email, p.phone].filter(Boolean).join(" · ")}
                    {p.publishedOn && ` (published on ${p.publishedOn}${p.publishedAt ? `, ${month(p.publishedAt)}` : ""})`}
                  </div>
                )}
                {p.lines.length > 0 && <div className="text-xs text-muted-foreground">Budget lines: {p.lines.join(", ")}</div>}
              </div>
              <Button size="sm" variant="outline" disabled={adding === p.id} onClick={() => add(p)}>
                {adding === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                <span className="ml-1">Add</span>
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
