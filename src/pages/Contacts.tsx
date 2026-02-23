import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  UserPlus, 
  Search, 
  Building2, 
  Phone, 
  Mail, 
  MessageSquare,
  Calendar,
  ChevronRight,
  User,
  Camera,
  Linkedin,
  RefreshCw
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import ContactDetailDialog from '@/components/contacts/ContactDetailDialog';
import UploadBusinessCardDialog from '@/components/contacts/UploadBusinessCardDialog';

interface Contact {
  id: string;
  name: string;
  org_name: string | null;
  role: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  linkedin_url: string | null;
  created_at: string;
  updated_at: string;
  touchpoint_count?: number;
  last_touchpoint?: string;
}

// Helper to get company logo URL from Clearbit
const getCompanyLogoUrl = (companyName: string | null): string | null => {
  if (!companyName) return null;
  // Clean and normalize company name to domain
  const cleanName = companyName.toLowerCase()
    .replace(/\s+(inc\.?|corp\.?|llc|ltd\.?|co\.?|company|group|solutions|services|technologies|consulting|systems?)$/gi, '')
    .replace(/\s+/g, '') // Remove all spaces (e.g., "BAE SYSTEMS" -> "bae")
    .replace(/[^a-z0-9]/g, '');
  return `https://logo.clearbit.com/${cleanName}.com`;
};

export default function Contacts() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBusinessCardOpen, setIsBusinessCardOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [isFetchingLinkedIn, setIsFetchingLinkedIn] = useState(false);
  const [newContact, setNewContact] = useState({
    name: '',
    org_name: '',
    role: '',
    email: '',
    phone: '',
    notes: '',
  });
  
  const queryClient = useQueryClient();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fetch contacts with touchpoint counts
      const { data: contactsData, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false });

      if (contactsError) throw contactsError;

      // Get touchpoint counts for each contact
      const contactsWithStats = await Promise.all(
        (contactsData || []).map(async (contact) => {
          const { count } = await supabase
            .from('touchpoints')
            .select('*', { count: 'exact', head: true })
            .eq('contact_id', contact.id);

          const { data: lastTouch } = await supabase
            .from('touchpoints')
            .select('date')
            .eq('contact_id', contact.id)
            .order('date', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...contact,
            touchpoint_count: count || 0,
            last_touchpoint: lastTouch?.date,
          };
        })
      );

      return contactsWithStats;
    },
  });

  const createContactMutation = useMutation({
    mutationFn: async (contact: typeof newContact) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          name: contact.name,
          org_name: contact.org_name || null,
          role: contact.role || null,
          email: contact.email || null,
          phone: contact.phone || null,
          notes: contact.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      setIsCreateOpen(false);
      setNewContact({ name: '', org_name: '', role: '', email: '', phone: '', notes: '' });
      toast.success('Contact created');
    },
    onError: (error) => {
      console.error('Error creating contact:', error);
      toast.error('Failed to create contact');
    },
  });

  const fetchLinkedInProfiles = async () => {
    if (!contacts || contacts.length === 0) return;
    
    const contactsWithoutLinkedIn = contacts.filter(c => !c.linkedin_url);
    if (contactsWithoutLinkedIn.length === 0) {
      toast.info('All contacts already have LinkedIn profiles');
      return;
    }

    setIsFetchingLinkedIn(true);
    toast.info(`Searching LinkedIn for ${contactsWithoutLinkedIn.length} contacts...`);

    try {
      const { data, error } = await supabase.functions.invoke('fetch-contact-linkedin', {
        body: { contactIds: contactsWithoutLinkedIn.map(c => c.id) }
      });

      if (error) throw error;

      if (data?.success) {
        const { summary } = data;
        if (summary.found > 0) {
          toast.success(`Found ${summary.found} LinkedIn profiles`);
          queryClient.invalidateQueries({ queryKey: ['contacts'] });
        } else {
          toast.info('No LinkedIn profiles found');
        }
      } else {
        toast.error(data?.error || 'Failed to fetch LinkedIn profiles');
      }
    } catch (err) {
      console.error('Error fetching LinkedIn profiles:', err);
      toast.error('Failed to fetch LinkedIn profiles');
    } finally {
      setIsFetchingLinkedIn(false);
    }
  };

  const filteredContacts = contacts?.filter((contact) => {
    const search = searchTerm.toLowerCase();
    return (
      contact.name.toLowerCase().includes(search) ||
      (contact.org_name?.toLowerCase() || '').includes(search) ||
      (contact.role?.toLowerCase() || '').includes(search)
    );
  });

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contacts</h1>
          <p className="text-muted-foreground">
            Manage your conference contacts and relationships
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsBusinessCardOpen(true)}>
            <Camera className="h-4 w-4 mr-2" />
            Scan Card
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Contact</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  placeholder="John Smith"
                />
              </div>
              <div>
                <Label htmlFor="org_name">Organization</Label>
                <Input
                  id="org_name"
                  value={newContact.org_name}
                  onChange={(e) => setNewContact({ ...newContact, org_name: e.target.value })}
                  placeholder="Lockheed Martin, US Army, etc."
                />
              </div>
              <div>
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={newContact.role}
                  onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                  placeholder="BD Manager, Contracting Officer, etc."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newContact.email}
                    onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                    placeholder="john@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    value={newContact.phone}
                    onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={newContact.notes}
                  onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                  placeholder="Any relevant notes about this contact..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => createContactMutation.mutate(newContact)}
                  disabled={!newContact.name || createContactMutation.isPending}
                >
                  {createContactMutation.isPending ? 'Creating...' : 'Create Contact'}
                </Button>
              </div>
            </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Business Card Upload Dialog */}
        <UploadBusinessCardDialog
          open={isBusinessCardOpen}
          onOpenChange={setIsBusinessCardOpen}
        />
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search contacts by name, organization, or role..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            All Contacts
            {contacts && (
              <Badge variant="secondary" className="ml-2">
                {contacts.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading contacts...</div>
          ) : filteredContacts && filteredContacts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Contact Info</TableHead>
                  <TableHead className="text-center">Touchpoints</TableHead>
                  <TableHead>Last Contact</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredContacts.map((contact) => (
                  <TableRow 
                    key={contact.id} 
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedContact(contact)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarImage 
                            src={getCompanyLogoUrl(contact.org_name) || ''} 
                            alt={contact.org_name || 'Company'} 
                          />
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {contact.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{contact.name}</span>
                        {contact.linkedin_url && (
                          <a 
                            href={contact.linkedin_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-[#0A66C2] hover:text-[#004182] transition-colors"
                          >
                            <Linkedin className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {contact.org_name ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          {contact.org_name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {contact.role ? (
                        <Badge variant="outline">{contact.role}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3 text-sm">
                        {contact.email && (
                          <a 
                            href={`mailto:${contact.email}`} 
                            className="text-primary hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Mail className="h-3 w-3" />
                          </a>
                        )}
                        {contact.phone && (
                          <a 
                            href={`tel:${contact.phone}`} 
                            className="text-primary hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="h-3 w-3" />
                          </a>
                        )}
                        {contact.linkedin_url && (
                          <a 
                            href={contact.linkedin_url} 
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#0A66C2] hover:underline flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Linkedin className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={contact.touchpoint_count > 0 ? 'default' : 'secondary'}>
                        {contact.touchpoint_count}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contact.last_touchpoint ? (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDistanceToNow(new Date(contact.last_touchpoint), { addSuffix: true })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">Never</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-medium mb-1">No contacts yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Start tracking your BD relationships by adding contacts
              </p>
              <Button onClick={() => setIsCreateOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Your First Contact
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contact Detail Dialog */}
      {selectedContact && (
        <ContactDetailDialog
          contact={selectedContact}
          open={!!selectedContact}
          onOpenChange={(open) => !open && setSelectedContact(null)}
        />
      )}
    </div>
  );
}