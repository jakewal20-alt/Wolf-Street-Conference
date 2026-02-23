import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, Calendar, Users, Mic, FileText } from "lucide-react";
import { VoiceRecapsList } from "@/components/conferences/VoiceRecapsList";

export default function SharedConference() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["shared-conference", token],
    queryFn: async () => {
      if (!token) throw new Error("No share token");

      // Look up the share link
      const { data: shareLink, error: linkError } = await supabase
        .from("conference_share_links")
        .select("*, conferences(*)")
        .eq("token", token)
        .eq("is_active", true)
        .maybeSingle();

      if (linkError) throw linkError;
      if (!shareLink) throw new Error("Invalid or expired share link");

      // Check expiry
      if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
        throw new Error("This share link has expired");
      }

      const conference = shareLink.conferences;

      // Fetch leads
      const { data: leads } = await supabase
        .from("conference_leads")
        .select("*")
        .eq("conference_id", conference.id)
        .order("created_at", { ascending: false });

      // Fetch voice recaps
      const { data: recaps } = await supabase
        .from("conference_voice_recaps")
        .select(`
          *,
          profiles:recorded_by (full_name, email),
          conference_leads:lead_id (contact_name, company)
        `)
        .eq("conference_id", conference.id)
        .order("created_at", { ascending: false });

      return { conference, leads: leads || [], recaps: recaps || [] };
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <h2 className="text-xl font-semibold mb-2">Link Not Available</h2>
            <p className="text-muted-foreground">
              {error instanceof Error ? error.message : "This share link is invalid or has expired."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { conference, leads, recaps } = data;

  const groupedLeads = {
    new: leads.filter((l: any) => l.status === "new"),
    contacted: leads.filter((l: any) => l.status === "contacted"),
    qualified: leads.filter((l: any) => l.status === "qualified"),
    converted: leads.filter((l: any) => l.status === "converted"),
    dropped: leads.filter((l: any) => l.status === "dropped"),
  };

  const summary = conference.exec_summary;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{conference.name}</h1>
          <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
            {conference.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {conference.location}
              </span>
            )}
            {conference.start_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(conference.start_date).toLocaleDateString()}
                {conference.end_date && ` — ${new Date(conference.end_date).toLocaleDateString()}`}
              </span>
            )}
          </div>
          {conference.description && (
            <p className="text-sm text-muted-foreground mt-3">{conference.description}</p>
          )}
          {conference.tags && conference.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {conference.tags.map((tag: string) => (
                <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
              ))}
            </div>
          )}
        </div>

        {/* Leads */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Contacts ({leads.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts added yet.</p>
            ) : (
              Object.entries(groupedLeads).map(([status, statusLeads]) => {
                if ((statusLeads as any[]).length === 0) return null;
                return (
                  <div key={status}>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase mb-2">
                      {status} ({(statusLeads as any[]).length})
                    </h4>
                    <div className="grid gap-2">
                      {(statusLeads as any[]).map((lead: any) => (
                        <div key={lead.id} className="p-3 rounded-md bg-muted/30 border">
                          <p className="font-medium text-sm">{lead.contact_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {lead.company}
                            {lead.title && ` — ${lead.title}`}
                          </p>
                          {lead.notes && (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{lead.notes}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Voice Recaps */}
        {recaps.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mic className="w-5 h-5" />
                Voice Recaps ({recaps.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {recaps.map((recap: any) => (
                <div key={recap.id} className="p-3 rounded-md bg-muted/30 border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>{recap.profiles?.full_name || "Unknown"}</span>
                    <span>·</span>
                    <span>{new Date(recap.created_at).toLocaleDateString()}</span>
                    {recap.conference_leads && (
                      <>
                        <span>·</span>
                        <span>Re: {recap.conference_leads.contact_name}</span>
                      </>
                    )}
                  </div>
                  {recap.ai_summary && (
                    <p className="text-sm mb-2">{recap.ai_summary}</p>
                  )}
                  {recap.transcript && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{recap.transcript}</p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Executive Summary */}
        {summary && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Executive Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {summary.headline && (
                <div className="border-l-4 border-primary pl-4">
                  <p className="text-lg font-semibold">{summary.headline}</p>
                </div>
              )}
              {summary.conference_overview && (
                <p className="text-sm">{summary.conference_overview}</p>
              )}
              {summary.exec_recommendations && summary.exec_recommendations.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground mb-2">Recommendations</h4>
                  <ul className="space-y-1">
                    {summary.exec_recommendations.map((rec: string, i: number) => (
                      <li key={i} className="text-sm flex gap-2">
                        <span className="text-primary shrink-0">•</span>
                        <span>{rec.replace(/^[•\-]\s*/, "")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground">
            Powered by Wolf Street Conference
          </p>
        </div>
      </div>
    </div>
  );
}
