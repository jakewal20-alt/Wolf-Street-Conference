import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, Square, Loader2, Save, Sparkles } from "lucide-react";
import { AudioRecorder } from "@/utils/audioRecorder";

interface VoiceRecapDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conferenceId: string;
  leads: any[];
}

export function VoiceRecapDialog({ open, onOpenChange, conferenceId, leads }: VoiceRecapDialogProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [selectedLeadId, setSelectedLeadId] = useState<string>("none");
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const recorderRef = useRef<AudioRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open]);

  const resetState = () => {
    setIsRecording(false);
    setIsTranscribing(false);
    setIsSummarizing(false);
    setIsSaving(false);
    setTranscript("");
    setAiSummary("");
    setSelectedLeadId("none");
    setRecordingDuration(0);
    setAudioBase64(null);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleStartRecording = async () => {
    try {
      recorderRef.current = new AudioRecorder();
      await recorderRef.current.start();
      setIsRecording(true);
      setRecordingDuration(0);

      timerRef.current = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Could not access microphone. Please check permissions.");
    }
  };

  const handleStopRecording = async () => {
    if (!recorderRef.current) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setIsRecording(false);
    setIsTranscribing(true);

    try {
      const base64Audio = await recorderRef.current.stop();
      setAudioBase64(base64Audio);

      // Transcribe via Whisper
      const { data, error } = await supabase.functions.invoke("voice-to-text", {
        body: { audio: base64Audio },
      });

      if (error) throw error;

      if (data?.text) {
        setTranscript(data.text);
        toast.success("Recording transcribed successfully");
      } else {
        toast.error("No transcript returned");
      }
    } catch (error) {
      console.error("Error transcribing:", error);
      toast.error("Failed to transcribe recording");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!transcript.trim()) return;

    setIsSummarizing(true);
    try {
      const { data, error } = await supabase.functions.invoke("summarize-voice-recap", {
        body: { transcript },
      });

      if (error) throw error;

      if (data?.summary) {
        setAiSummary(data.summary);
        toast.success("Summary generated");
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Failed to generate summary");
    } finally {
      setIsSummarizing(false);
    }
  };

  const handleSave = async () => {
    if (!transcript.trim()) {
      toast.error("No transcript to save");
      return;
    }

    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload audio to storage if available
      let audioUrl: string | null = null;
      if (audioBase64) {
        const fileName = `${user.id}/${Date.now()}_voice_recap.webm`;
        const byteCharacters = atob(audioBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "audio/webm" });

        const { error: uploadError } = await supabase.storage
          .from("meeting-transcripts")
          .upload(fileName, blob);

        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("meeting-transcripts")
            .getPublicUrl(fileName);
          audioUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase
        .from("conference_voice_recaps")
        .insert({
          conference_id: conferenceId,
          lead_id: selectedLeadId !== "none" ? selectedLeadId : null,
          recorded_by: user.id,
          audio_url: audioUrl,
          transcript,
          ai_summary: aiSummary || null,
          duration_seconds: recordingDuration,
        });

      if (error) throw error;

      toast.success("Voice recap saved");
      queryClient.invalidateQueries({ queryKey: ["conference-voice-recaps", conferenceId] });
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving recap:", error);
      toast.error("Failed to save voice recap");
    } finally {
      setIsSaving(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mic className="w-5 h-5 text-primary" />
            Voice Recap
          </DialogTitle>
          <DialogDescription>
            Record a conversation recap. It will be transcribed and saved to this conference.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Optional lead association */}
          <div className="space-y-2">
            <Label>Associate with Lead (optional)</Label>
            <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a lead..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No specific lead</SelectItem>
                {leads.map((lead) => (
                  <SelectItem key={lead.id} value={lead.id}>
                    {lead.contact_name} — {lead.company}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Recording controls */}
          <div className="flex flex-col items-center gap-3 py-4">
            {isRecording && (
              <div className="flex items-center gap-2 text-destructive">
                <span className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                <span className="text-lg font-mono font-semibold">
                  {formatDuration(recordingDuration)}
                </span>
              </div>
            )}

            {isTranscribing ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Transcribing...</span>
              </div>
            ) : isRecording ? (
              <Button
                variant="destructive"
                size="lg"
                onClick={handleStopRecording}
                className="rounded-full w-16 h-16"
              >
                <Square className="w-6 h-6" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleStartRecording}
                disabled={!!transcript}
                className="rounded-full w-16 h-16"
              >
                <Mic className="w-6 h-6" />
              </Button>
            )}

            {!isRecording && !isTranscribing && !transcript && (
              <p className="text-xs text-muted-foreground">Tap to start recording</p>
            )}
          </div>

          {/* Transcript */}
          {transcript && (
            <div className="space-y-2">
              <Label>Transcript</Label>
              <Textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                rows={5}
                placeholder="Transcript will appear here..."
              />
            </div>
          )}

          {/* AI Summary */}
          {transcript && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>AI Summary</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateSummary}
                  disabled={isSummarizing || !transcript.trim()}
                >
                  {isSummarizing ? (
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4 mr-1" />
                  )}
                  {aiSummary ? "Regenerate" : "Generate Summary"}
                </Button>
              </div>
              {aiSummary && (
                <Textarea
                  value={aiSummary}
                  onChange={(e) => setAiSummary(e.target.value)}
                  rows={4}
                />
              )}
            </div>
          )}

          {/* Actions */}
          {transcript && (
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={isSaving || !transcript.trim()}>
                {isSaving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Recap
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
