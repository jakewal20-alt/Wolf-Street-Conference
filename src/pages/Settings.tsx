import { HuntsManager } from "@/components/HuntsManager";
import { SyncHistory } from "@/components/SyncHistory";
import { ReferenceDocumentsManager } from "@/components/ReferenceDocumentsManager";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Loader2, User, Palette } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { UploadExemplarDialog } from "@/components/UploadExemplarDialog";

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  email: z.string().email("Invalid email address"),
});

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const form = useForm<z.infer<typeof profileSchema>>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      email: "",
    },
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error) throw error;

        form.reset({
          full_name: profile.full_name || "",
          email: profile.email,
        });
      } catch (error) {
        console.error("Error loading profile:", error);
        toast({
          title: "Error",
          description: "Failed to load profile data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [form, toast]);

  const onSubmit = async (values: z.infer<typeof profileSchema>) => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      const { error } = await supabase
        .from("profiles")
        .update({ full_name: values.full_name })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage your profile, hunts, reference documents, and sync preferences
        </p>
      </div>

      <Separator />

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="hunts">Hunts</TabsTrigger>
          <TabsTrigger value="documents">Reference Documents</TabsTrigger>
          <TabsTrigger value="history">Sync History</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Account Details
              </CardTitle>
              <CardDescription>
                View and update your profile information
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    <FormField
                      control={form.control}
                      name="full_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter your full name" {...field} />
                          </FormControl>
                          <FormDescription>
                            This is your display name across the platform
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input {...field} disabled />
                          </FormControl>
                          <FormDescription>
                            Email cannot be changed at this time
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button type="submit" disabled={saving}>
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Save Changes
                    </Button>
                  </form>
                </Form>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="h-5 w-5" />
                Appearance
              </CardTitle>
              <CardDescription>
                Customize the look and feel of your workspace
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label className="text-base">Theme</Label>
                  <p className="text-sm text-muted-foreground">
                    Switch between light and dark mode
                  </p>
                </div>
                <ThemeToggle />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="hunts" className="space-y-6">
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Your Hunts</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Configure hunts that represent your capability areas. Each active hunt will automatically search SAM.gov daily for matching opportunities.
            </p>
            <HuntsManager />
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">How Hunts Work</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Each hunt represents a capability area you're pursuing (e.g., "Training Products", "IT Services")</li>
              <li>• Active hunts run automatically every day at midnight UTC</li>
              <li>• New opportunities are fetched from SAM.gov based on your keywords, NAICS codes, and agencies</li>
              <li>• Each opportunity is analyzed by AI to provide summaries, red flags, fit scores, and recommendations</li>
              <li>• Opportunities will show which hunt(s) found them</li>
              <li>• You can also trigger a manual sync anytime using the "Sync Now" button</li>
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="documents" className="space-y-6">
          <Card className="bg-primary/5 border-primary/20 p-6">
            <h2 className="text-xl font-semibold mb-4">Company Information Documents</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Upload documents that describe what your company does to help AI better score opportunities based on your hunts and capabilities.
            </p>
            <div className="space-y-2 text-sm">
              <p className="font-medium">Recommended documents:</p>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground ml-2">
                <li>Company capability statements or overviews (PPT, DOCX, PDF)</li>
                <li>Past performance summaries and case studies</li>
                <li>Technical white papers and product descriptions</li>
                <li>Past proposals or proposal sections</li>
              </ul>
            </div>
          </Card>
          
          <Card className="bg-accent/5 border-accent/20 p-6">
            <h2 className="text-xl font-semibold mb-4">Exemplar Proposals</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Upload finished proposals to use as style and structure references when AI generates new proposals for similar opportunities.
            </p>
            <UploadExemplarDialog />
          </Card>
          
          <ReferenceDocumentsManager />
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">How Reference Documents Help AI Scoring</h2>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• AI uses these documents along with your active hunts to understand your company's strengths</li>
              <li>• Opportunities are scored based on alignment with your documented capabilities and target areas</li>
              <li>• More detailed documents lead to more accurate fit scores and recommendations</li>
              <li>• Mark documents as active/inactive to control which ones influence scoring</li>
            </ul>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <SyncHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
