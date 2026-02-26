import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { safeDate } from '@/utils/dateHelpers';

interface Contact {
  id: string;
  name: string;
  org_name: string | null;
}

interface LogOutreachDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preselectedContact?: Contact | null;
  relatedType?: 'award' | 'opportunity';
  relatedId?: string;
  relatedTitle?: string;
  onSuccess?: () => void;
}

const TOUCHPOINT_TYPES = [
  { value: 'call', label: 'Phone Call' },
  { value: 'email', label: 'Email' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'event', label: 'Event / Conference' },
];

const OUTCOME_OPTIONS = [
  'Positive - Interested',
  'Neutral - Need Follow-up',
  'No Response',
  'Not Interested',
  'Scheduled Next Steps',
  'Information Gathered',
];

export default function LogOutreachDialog({
  open,
  onOpenChange,
  preselectedContact,
  relatedType,
  relatedId,
  relatedTitle,
  onSuccess,
}: LogOutreachDialogProps) {
  const [contactOpen, setContactOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    preselectedContact?.id || null
  );
  const [showNewContactForm, setShowNewContactForm] = useState(false);
  const [newContactName, setNewContactName] = useState('');
  const [newContactOrg, setNewContactOrg] = useState('');
  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    type: 'call',
    outcome: '',
    notes: '',
  });

  const queryClient = useQueryClient();

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedContactId(preselectedContact?.id || null);
      setShowNewContactForm(false);
      setNewContactName('');
      setNewContactOrg('');
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        type: 'call',
        outcome: '',
        notes: '',
      });
    }
  }, [open, preselectedContact]);

  const { data: contacts } = useQuery({
    queryKey: ['contacts-list'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, org_name')
        .order('name');

      if (error) throw error;
      return data as Contact[];
    },
    enabled: open,
  });

  const createContactMutation = useMutation({
    mutationFn: async ({ name, org_name }: { name: string; org_name: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          name,
          org_name: org_name || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSelectedContactId(data.id);
      setShowNewContactForm(false);
      setNewContactName('');
      setNewContactOrg('');
      queryClient.invalidateQueries({ queryKey: ['contacts-list'] });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contact created');
    },
    onError: (error) => {
      console.error('Error creating contact:', error);
      toast.error('Failed to create contact');
    },
  });

  const logTouchpointMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (!selectedContactId) {
        throw new Error('Please select a contact');
      }

      const { error } = await supabase
        .from('touchpoints')
        .insert({
          user_id: user.id,
          contact_id: selectedContactId,
          related_type: relatedType || null,
          related_id: relatedId || null,
          date: safeDate(formData.date).toISOString(),
          type: formData.type,
          outcome: formData.outcome || null,
          notes: formData.notes || null,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Outreach logged');
      onOpenChange(false);
      onSuccess?.();
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['touchpoints'] });
    },
    onError: (error: any) => {
      console.error('Error logging touchpoint:', error);
      toast.error(error.message || 'Failed to log outreach');
    },
  });

  const selectedContact = contacts?.find((c) => c.id === selectedContactId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log Outreach</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Related Item Badge */}
          {relatedTitle && (
            <div className="bg-muted p-3 rounded-md text-sm">
              <span className="text-muted-foreground">Related to: </span>
              <span className="font-medium">{relatedTitle}</span>
            </div>
          )}

          {/* Contact Selection */}
          <div>
            <Label>Contact *</Label>
            {showNewContactForm ? (
              <div className="space-y-2 mt-2">
                <Input
                  placeholder="Contact name"
                  value={newContactName}
                  onChange={(e) => setNewContactName(e.target.value)}
                />
                <Input
                  placeholder="Organization (optional)"
                  value={newContactOrg}
                  onChange={(e) => setNewContactOrg(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowNewContactForm(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => createContactMutation.mutate({ name: newContactName, org_name: newContactOrg })}
                    disabled={!newContactName || createContactMutation.isPending}
                  >
                    Create
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-2 mt-1">
                <Popover open={contactOpen} onOpenChange={setContactOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={contactOpen}
                      className="flex-1 justify-between"
                    >
                      {selectedContact
                        ? `${selectedContact.name}${selectedContact.org_name ? ` (${selectedContact.org_name})` : ''}`
                        : 'Select contact...'}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[300px] p-0">
                    <Command>
                      <CommandInput placeholder="Search contacts..." />
                      <CommandList>
                        <CommandEmpty>No contact found.</CommandEmpty>
                        <CommandGroup>
                          {contacts?.map((contact) => (
                            <CommandItem
                              key={contact.id}
                              value={`${contact.name} ${contact.org_name || ''}`}
                              onSelect={() => {
                                setSelectedContactId(contact.id);
                                setContactOpen(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  'mr-2 h-4 w-4',
                                  selectedContactId === contact.id ? 'opacity-100' : 'opacity-0'
                                )}
                              />
                              <div>
                                <div>{contact.name}</div>
                                {contact.org_name && (
                                  <div className="text-xs text-muted-foreground">{contact.org_name}</div>
                                )}
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewContactForm(true)}
                  title="Create new contact"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Date */}
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({ ...formData, date: e.target.value })}
              className="mt-1"
            />
          </div>

          {/* Type */}
          <div>
            <Label>Type</Label>
            <Select
              value={formData.type}
              onValueChange={(value) => setFormData({ ...formData, type: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOUCHPOINT_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Outcome */}
          <div>
            <Label>Outcome</Label>
            <Select
              value={formData.outcome}
              onValueChange={(value) => setFormData({ ...formData, outcome: value })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select outcome..." />
              </SelectTrigger>
              <SelectContent>
                {OUTCOME_OPTIONS.map((outcome) => (
                  <SelectItem key={outcome} value={outcome}>
                    {outcome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="What was discussed? Any action items?"
              rows={3}
              className="mt-1"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => logTouchpointMutation.mutate()}
              disabled={!selectedContactId || logTouchpointMutation.isPending}
            >
              {logTouchpointMutation.isPending ? 'Saving...' : 'Log Outreach'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}