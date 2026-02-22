import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Camera, Upload, Loader2, X, CreditCard, Image } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';

interface ExtractedData {
  contact_name: string | null;
  company: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  additional_info: string | null;
}

interface UploadBusinessCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UploadBusinessCardDialog({
  open,
  onOpenChange,
}: UploadBusinessCardDialogProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();

  const resetState = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setExtractedData(null);
    setNotes('');
    setIsExtracting(false);
    setIsSubmitting(false);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    
    // Auto-extract on file selection
    await extractBusinessCard(file);
  };

  const extractBusinessCard = async (file: File) => {
    setIsExtracting(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const { data, error } = await supabase.functions.invoke('parse-business-card', {
        body: formData,
      });

      if (error) throw error;

      if (data?.success && data.extracted) {
        setExtractedData(data.extracted);
        toast.success('Business card info extracted');
      } else {
        throw new Error(data?.error || 'Failed to extract info');
      }
    } catch (err) {
      console.error('Extraction error:', err);
      toast.error('Failed to extract business card info');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async () => {
    if (!extractedData?.contact_name) {
      toast.error('Contact name is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create the contact
      const { error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          name: extractedData.contact_name,
          org_name: extractedData.company || null,
          role: extractedData.title || null,
          email: extractedData.email || null,
          phone: extractedData.phone || null,
          linkedin_url: extractedData.linkedin_url || null,
          notes: [notes, extractedData.additional_info].filter(Boolean).join('\n\n') || null,
        });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created from business card');
      resetState();
      onOpenChange(false);
    } catch (err) {
      console.error('Submit error:', err);
      toast.error('Failed to save contact');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetState();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Scan Business Card
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Upload Area */}
          {!previewUrl && (
            <div className="space-y-3">
              {/* Take Photo Button */}
              <div
                onClick={() => cameraInputRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <Camera className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium">Take Photo</p>
                <p className="text-sm text-muted-foreground">Use your camera</p>
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
              
              {/* Choose from Library Button */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
              >
                <Image className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="font-medium">Choose from Library</p>
                <p className="text-sm text-muted-foreground">Select an existing photo</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* Preview & Extraction */}
          {previewUrl && (
            <div className="space-y-4">
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Business card"
                  className="w-full rounded-lg border"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 bg-background/80"
                  onClick={resetState}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {isExtracting && (
                <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Extracting contact info...
                </div>
              )}

              {extractedData && !isExtracting && (
                <div className="space-y-3">
                  {/* Mobile: Save button at top */}
                  {isMobile && (
                    <div className="flex justify-between gap-2 pb-2 border-b">
                      <Button variant="outline" onClick={resetState} size="sm">
                        Start Over
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={!extractedData.contact_name || isSubmitting}
                        size="sm"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Contact'
                        )}
                      </Button>
                    </div>
                  )}
                  
                  <div>
                    <Label htmlFor="name">Name *</Label>
                    <Input
                      id="name"
                      value={extractedData.contact_name || ''}
                      onChange={(e) => setExtractedData({
                        ...extractedData,
                        contact_name: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="company">Organization</Label>
                    <Input
                      id="company"
                      value={extractedData.company || ''}
                      onChange={(e) => setExtractedData({
                        ...extractedData,
                        company: e.target.value
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={extractedData.title || ''}
                      onChange={(e) => setExtractedData({
                        ...extractedData,
                        title: e.target.value
                      })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        value={extractedData.email || ''}
                        onChange={(e) => setExtractedData({
                          ...extractedData,
                          email: e.target.value
                        })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={extractedData.phone || ''}
                        onChange={(e) => setExtractedData({
                          ...extractedData,
                          phone: e.target.value
                        })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="linkedin">LinkedIn</Label>
                    <Input
                      id="linkedin"
                      value={extractedData.linkedin_url || ''}
                      onChange={(e) => setExtractedData({
                        ...extractedData,
                        linkedin_url: e.target.value
                      })}
                      placeholder="https://linkedin.com/in/..."
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Additional notes..."
                      rows={2}
                    />
                  </div>
                  
                  {/* Desktop: Save button at bottom */}
                  {!isMobile && (
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={resetState}>
                        Start Over
                      </Button>
                      <Button
                        onClick={handleSubmit}
                        disabled={!extractedData.contact_name || isSubmitting}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Contact'
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
