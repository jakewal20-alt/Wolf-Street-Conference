import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";

interface UploadBusinessCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conferenceId: string;
}

export function UploadBusinessCardDialog({
  open,
  onOpenChange,
  conferenceId,
}: UploadBusinessCardDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const queryClient = useQueryClient();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    
    // Auto-extract on file select
    await extractBusinessCard(file);
  };

  const extractBusinessCard = async (file: File) => {
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const { data, error } = await supabase.functions.invoke("parse-business-card", {
        body: formData,
      });

      if (error) throw error;

      if (data.success) {
        setExtractedData(data.extracted);
        toast.success("Business card information extracted!");
      } else {
        toast.error("Failed to extract info, but you can enter it manually");
      }
    } catch (error) {
      console.error("Error extracting business card:", error);
      toast.error("Extraction failed, please enter details manually");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!extractedData || !extractedData.contact_name || !extractedData.company) {
      toast.error("Contact name and company are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload image to storage
      let cardImageUrl = null;
      if (selectedFile) {
        const fileName = `${user.id}/${Date.now()}_${selectedFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("meeting-transcripts")
          .upload(fileName, selectedFile);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from("meeting-transcripts")
          .getPublicUrl(fileName);

        cardImageUrl = urlData.publicUrl;
      }

      const { error } = await supabase.from("conference_leads").insert({
        conference_id: conferenceId,
        contact_name: extractedData.contact_name,
        company: extractedData.company,
        title: extractedData.title || null,
        email: extractedData.email || null,
        phone: extractedData.phone || null,
        notes: notes || extractedData.additional_info || null,
        source: "business_card",
        status: "new",
        card_image_url: cardImageUrl,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Lead added from business card!");
      queryClient.invalidateQueries({ queryKey: ["conference-leads", conferenceId] });
      onOpenChange(false);
      
      // Reset
      setSelectedFile(null);
      setPreviewUrl("");
      setExtractedData(null);
      setNotes("");
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error("Failed to save lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Upload Business Card</DialogTitle>
        </DialogHeader>

        {!selectedFile ? (
          <div className="border-2 border-dashed rounded-lg p-8 text-center">
            <Upload className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">
              Upload a photo of a business card to extract contact information
            </p>
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="max-w-xs mx-auto"
            />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {previewUrl && (
              <div className="rounded-lg overflow-hidden border">
                <img src={previewUrl} alt="Business card" className="w-full h-48 object-contain bg-muted" />
              </div>
            )}

            {isExtracting ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="ml-3 text-muted-foreground">Extracting information...</span>
              </div>
            ) : extractedData ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="contactName">Contact Name *</Label>
                    <Input
                      id="contactName"
                      value={extractedData.contact_name || ""}
                      onChange={(e) => setExtractedData({ ...extractedData, contact_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="company">Company *</Label>
                    <Input
                      id="company"
                      value={extractedData.company || ""}
                      onChange={(e) => setExtractedData({ ...extractedData, company: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">Job Title</Label>
                  <Input
                    id="title"
                    value={extractedData.title || ""}
                    onChange={(e) => setExtractedData({ ...extractedData, title: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={extractedData.email || ""}
                      onChange={(e) => setExtractedData({ ...extractedData, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={extractedData.phone || ""}
                      onChange={(e) => setExtractedData({ ...extractedData, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add any additional notes..."
                    rows={3}
                  />
                </div>

                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl("");
                      setExtractedData(null);
                    }}
                  >
                    Start Over
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? "Saving..." : "Save Lead"}
                  </Button>
                </div>
              </>
            ) : (
              <div className="text-center p-4">
                <p className="text-muted-foreground">
                  Extraction failed. Please add details manually or try another image.
                </p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => {
                    setSelectedFile(null);
                    setPreviewUrl("");
                  }}
                >
                  Try Again
                </Button>
              </div>
            )}
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}