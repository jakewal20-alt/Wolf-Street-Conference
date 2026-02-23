import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Mic, Clock, User, ChevronDown, ChevronUp, Play, Pause } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useRef } from "react";

interface VoiceRecapsListProps {
  conferenceId: string;
  readOnly?: boolean;
}

export function VoiceRecapsList({ conferenceId, readOnly = false }: VoiceRecapsListProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: recaps, isLoading } = useQuery({
    queryKey: ["conference-voice-recaps", conferenceId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conference_voice_recaps")
        .select(`
          *,
          profiles:recorded_by (full_name, email),
          conference_leads:lead_id (contact_name, company)
        `)
        .eq("conference_id", conferenceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const togglePlay = (recapId: string, audioUrl: string | null) => {
    if (!audioUrl) return;

    if (playingId === recapId) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
    }

    const audio = new Audio(audioUrl);
    audio.onended = () => setPlayingId(null);
    audio.play();
    audioRef.current = audio;
    setPlayingId(recapId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Loading voice recaps...</p>
        </CardContent>
      </Card>
    );
  }

  if (!recaps || recaps.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Mic className="w-5 h-5" />
          Voice Recaps ({recaps.length})
        </CardTitle>
        <CardDescription>
          Recorded conversation recaps from this conference
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {recaps.map((recap: any) => {
          const isExpanded = expandedId === recap.id;
          const profile = recap.profiles;
          const lead = recap.conference_leads;

          return (
            <Card key={recap.id} className="bg-muted/30">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <User className="w-3 h-3" />
                        <span>{profile?.full_name || profile?.email || "Unknown"}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{formatDuration(recap.duration_seconds)}</span>
                      </div>
                      {lead && (
                        <Badge variant="outline" className="text-xs">
                          {lead.contact_name} — {lead.company}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(recap.created_at).toLocaleDateString()} at{" "}
                      {new Date(recap.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>

                    {/* Preview */}
                    {!isExpanded && recap.ai_summary && (
                      <p className="text-sm mt-2 line-clamp-2">{recap.ai_summary}</p>
                    )}
                    {!isExpanded && !recap.ai_summary && recap.transcript && (
                      <p className="text-sm mt-2 line-clamp-2 text-muted-foreground italic">
                        {recap.transcript}
                      </p>
                    )}

                    {/* Expanded view */}
                    {isExpanded && (
                      <div className="mt-3 space-y-3">
                        {recap.ai_summary && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">AI Summary</p>
                            <p className="text-sm whitespace-pre-wrap">{recap.ai_summary}</p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Full Transcript</p>
                          <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                            {recap.transcript}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {recap.audio_url && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => togglePlay(recap.id, recap.audio_url)}
                        className="h-8 w-8 p-0"
                      >
                        {playingId === recap.id ? (
                          <Pause className="w-4 h-4" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(isExpanded ? null : recap.id)}
                      className="h-8 w-8 p-0"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </CardContent>
    </Card>
  );
}
