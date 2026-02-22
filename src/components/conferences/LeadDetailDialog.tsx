import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Mail, Phone, Building2, User, Calendar, ImageIcon } from "lucide-react";
import { format } from "date-fns";

interface LeadDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: any;
}

export function LeadDetailDialog({ open, onOpenChange, lead }: LeadDetailDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Lead Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold">{lead.contact_name}</h3>
              <p className="text-muted-foreground flex items-center gap-1">
                <Building2 className="w-4 h-4" />
                {lead.company}
              </p>
            </div>
            <Badge variant={lead.status === "converted" ? "default" : "secondary"}>
              {lead.status}
            </Badge>
          </div>

          {lead.title && (
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>{lead.title}</span>
            </div>
          )}

          {lead.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-4 h-4 text-muted-foreground" />
              <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                {lead.email}
              </a>
            </div>
          )}

          {lead.phone && (
            <div className="flex items-center gap-2 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <a href={`tel:${lead.phone}`} className="text-primary hover:underline">
                {lead.phone}
              </a>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>Added {format(new Date(lead.created_at), "MMM d, yyyy")}</span>
          </div>

          {lead.ai_fit_score && (
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">AI Fit Score</span>
                <Badge variant="secondary">{lead.ai_fit_score}/100</Badge>
              </div>
              {lead.ai_reason && (
                <p className="text-sm text-muted-foreground">{lead.ai_reason}</p>
              )}
            </div>
          )}

          {lead.notes && (
            <div>
              <h4 className="text-sm font-medium mb-2">Notes</h4>
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-sm whitespace-pre-wrap">{lead.notes}</p>
              </div>
            </div>
          )}

          {lead.card_image_url && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <ImageIcon className="w-4 h-4" />
                Business Card
              </h4>
              <div className="rounded-lg overflow-hidden border">
                <img
                  src={lead.card_image_url}
                  alt="Business card"
                  className="w-full h-auto"
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}