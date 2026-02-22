import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, Loader2, X } from "lucide-react";

interface AddLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conferenceId: string;
}

export function AddLeadDialog({ open, onOpenChange, conferenceId }: AddLeadDialogProps) {
  const [contactName, setContactName] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Business card photo states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null);

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
        const extracted = data.extracted;
        
        // Only prefill empty fields
        if (!contactName && extracted.contact_name) setContactName(extracted.contact_name);
        if (!company && extracted.company) setCompany(extracted.company);
        if (!title && extracted.title) setTitle(extracted.title);
        if (!email && extracted.email) setEmail(extracted.email);
        if (!phone && extracted.phone) setPhone(extracted.phone);
        
        toast.success("Business card information extracted!");
      } else {
        toast.error("Couldn't read the card. You can still fill the fields manually.");
      }
    } catch (error) {
      console.error("Error extracting business card:", error);
      toast.error("Couldn't read the card. You can still fill the fields manually.");
    } finally {
      setIsExtracting(false);
    }
  };

  const clearPhoto = () => {
    setSelectedFile(null);
    setPreviewUrl("");
    setCardImageUrl(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!contactName || !company) {
      toast.error("Contact name and company are required");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Upload business card image if present
      let uploadedCardImageUrl = cardImageUrl;
      if (selectedFile && !cardImageUrl) {
        const fileName = `${user.id}/${Date.now()}_${selectedFile.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from("meeting-transcripts")
          .upload(fileName, selectedFile);

        if (uploadError) {
          console.error("Upload error:", uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from("meeting-transcripts")
            .getPublicUrl(fileName);
          uploadedCardImageUrl = urlData.publicUrl;
        }
      }

      const { error } = await supabase.from("conference_leads").insert({
        conference_id: conferenceId,
        contact_name: contactName,
        company,
        title: title || null,
        email: email || null,
        phone: phone || null,
        notes: notes || null,
        source: selectedFile ? "business_card" : "manual",
        status: "new",
        card_image_url: uploadedCardImageUrl,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Lead added successfully");
      queryClient.invalidateQueries({ queryKey: ["conference-leads", conferenceId] });
      onOpenChange(false);
      
      // Reset form
      setContactName("");
      setCompany("");
      setTitle("");
      setEmail("");
      setPhone("");
      setNotes("");
      clearPhoto();
    } catch (error) {
      console.error("Error adding lead:", error);
      toast.error("Failed to add lead");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Business Card Photo Section */}
          <div className="space-y-2">
            <Label>Business Card Photo (optional)</Label>
            {!selectedFile ? (
              <div className="relative">
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={isExtracting}
                  className="cursor-pointer"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Upload or take a photo to auto-fill contact details
                </p>
              </div>
            ) : (
              <div className="relative rounded-lg border bg-muted p-2">
                {previewUrl && (
                  <img 
                    src={previewUrl} 
                    alt="Business card preview" 
                    className="w-full h-32 object-contain rounded"
                  />
                )}
                {isExtracting && (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <span className="ml-2 text-sm">Extracting info...</span>
                  </div>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute top-1 right-1"
                  onClick={clearPhoto}
                  disabled={isExtracting}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactName">Contact Name *</Label>
            <Input
              id="contactName"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="John Smith"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="company">Company *</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Corp"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Job Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VP of Engineering"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@acme.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555-0123"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Conversation notes..."
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Lead"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}