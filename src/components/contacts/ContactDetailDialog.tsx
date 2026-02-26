import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Building2, 
  Phone, 
  Mail, 
  Calendar, 
  MessageSquare,
  Plus,
  FileText,
  Award,
  ExternalLink
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { safeFormat } from '@/utils/dateHelpers';
import LogOutreachDialog from './LogOutreachDialog';
import { useNavigate } from 'react-router-dom';

interface Contact {
  id: string;
  name: string;
  org_name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface Touchpoint {
  id: string;
  contact_id: string;
  related_type: string | null;
  related_id: string | null;
  date: string;
  type: string;
  outcome: string | null;
  notes: string | null;
  created_at: string;
}

interface ContactDetailDialogProps {
  contact: Contact;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const touchpointTypeColors: Record<string, string> = {
  call: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  email: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  meeting: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  event: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export default function ContactDetailDialog({ contact, open, onOpenChange }: ContactDetailDialogProps) {
  const [isLogOutreachOpen, setIsLogOutreachOpen] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: touchpoints, isLoading } = useQuery({
    queryKey: ['touchpoints', contact.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('touchpoints')
        .select('*')
        .eq('contact_id', contact.id)
        .order('date', { ascending: false });

      if (error) throw error;
      return data as Touchpoint[];
    },
    enabled: open,
  });

  // Fetch related items for touchpoints
  const { data: relatedItems } = useQuery({
    queryKey: ['touchpoints-related', contact.id],
    queryFn: async () => {
      if (!touchpoints) return {};

      const oppIds = touchpoints.filter(t => t.related_type === 'opportunity' && t.related_id).map(t => t.related_id!);
      const awardIds = touchpoints.filter(t => t.related_type === 'award' && t.related_id).map(t => t.related_id!);

      const related: Record<string, { title: string; type: string }> = {};

      if (oppIds.length > 0) {
        const { data: opps } = await supabase
          .from('opportunities')
          .select('id, title')
          .in('id', oppIds);
        opps?.forEach(opp => {
          related[opp.id] = { title: opp.title, type: 'opportunity' };
        });
      }

      if (awardIds.length > 0) {
        const { data: awards } = await supabase
          .from('contract_awards')
          .select('id, recipient_name, award_description')
          .in('id', awardIds);
        awards?.forEach(award => {
          related[award.id] = { 
            title: award.recipient_name + (award.award_description ? `: ${award.award_description.slice(0, 50)}...` : ''),
            type: 'award' 
          };
        });
      }

      return related;
    },
    enabled: open && !!touchpoints && touchpoints.length > 0,
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>{contact.name}</span>
              <Button size="sm" onClick={() => setIsLogOutreachOpen(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Log Outreach
              </Button>
            </DialogTitle>
          </DialogHeader>

          {/* Contact Info */}
          <div className="space-y-4">
            <div className="flex flex-wrap gap-4 text-sm">
              {contact.org_name && (
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{contact.org_name}</span>
                </div>
              )}
              {contact.role && (
                <Badge variant="outline">{contact.role}</Badge>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4 text-sm">
              {contact.email && (
                <a 
                  href={`mailto:${contact.email}`} 
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Mail className="h-4 w-4" />
                  {contact.email}
                </a>
              )}
              {contact.phone && (
                <a 
                  href={`tel:${contact.phone}`} 
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <Phone className="h-4 w-4" />
                  {contact.phone}
                </a>
              )}
            </div>

            {contact.notes && (
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
                {contact.notes}
              </div>
            )}
          </div>

          <Separator className="my-4" />

          {/* Touchpoints Timeline */}
          <div>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Outreach History
              {touchpoints && (
                <Badge variant="secondary" className="ml-1">
                  {touchpoints.length}
                </Badge>
              )}
            </h3>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : touchpoints && touchpoints.length > 0 ? (
              <div className="space-y-4">
                {touchpoints.map((touchpoint) => (
                  <div 
                    key={touchpoint.id} 
                    className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className={touchpointTypeColors[touchpoint.type] || 'bg-gray-100 text-gray-800'}>
                          {touchpoint.type}
                        </Badge>
                        {touchpoint.outcome && (
                          <span className="text-sm text-muted-foreground">
                            • {touchpoint.outcome}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {safeFormat(touchpoint.date, 'MMM d, yyyy')}
                      </div>
                    </div>

                    {touchpoint.notes && (
                      <p className="text-sm text-muted-foreground mb-2">
                        {touchpoint.notes}
                      </p>
                    )}

                    {/* Related Item */}
                    {touchpoint.related_id && relatedItems?.[touchpoint.related_id] && (
                      <div 
                        className="flex items-center gap-2 text-sm bg-muted/50 p-2 rounded cursor-pointer hover:bg-muted"
                        onClick={() => {
                          const item = relatedItems[touchpoint.related_id!];
                          if (item.type === 'opportunity') {
                            navigate(`/opportunity/${touchpoint.related_id}`);
                          } else {
                            navigate(`/awards?highlight=${touchpoint.related_id}`);
                          }
                          onOpenChange(false);
                        }}
                      >
                        {relatedItems[touchpoint.related_id].type === 'opportunity' ? (
                          <FileText className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Award className="h-4 w-4 text-green-500" />
                        )}
                        <span className="flex-1 truncate">
                          {relatedItems[touchpoint.related_id].title}
                        </span>
                        <ExternalLink className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No outreach logged yet</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-2"
                  onClick={() => setIsLogOutreachOpen(true)}
                >
                  Log First Outreach
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <LogOutreachDialog
        open={isLogOutreachOpen}
        onOpenChange={setIsLogOutreachOpen}
        preselectedContact={contact}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['touchpoints', contact.id] });
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        }}
      />
    </>
  );
}