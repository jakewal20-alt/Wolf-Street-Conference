import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowRight,
  BarChart3,
  Check,
  LockKeyhole,
  Mic2,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";


export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Check if we're on the reset password page
  useEffect(() => {
    if (location.pathname === "/reset-password") {
      setShowResetPassword(true);
    }
  }, [location]);

  // Already signed in? Skip the login screen (but not the password-reset form,
  // which runs inside the temporary recovery session).
  useEffect(() => {
    if (location.pathname === "/reset-password") return;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/", { replace: true });
    });
  }, [location.pathname, navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) throw error;

      if (data.session) {
        // Email confirmation is off: the user is signed in already. New
        // accounts still need an admin's approval (ProtectedRoute shows that).
        toast({
          title: "Account created",
          description: "An admin needs to approve your account before you can use Hallway.",
        });
        navigate("/");
      } else {
        // Email confirmation is on: there is no session until they click the link.
        toast({
          title: "Check your email",
          description: `We sent a confirmation link to ${email}. After confirming, an admin will approve your account.`,
        });
      }
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "Welcome back!",
        description: "You've successfully signed in.",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Check your email",
        description: "We've sent you a password reset link.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("This reset link has expired or was already used. Request a new one from the sign-in page.");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password updated!",
        description: "Your password has been successfully changed.",
      });

      navigate("/");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // If we're on the reset password page, show only the password reset form
  if (showResetPassword) {
    return (
      <div className="min-h-screen bg-inverse px-4 py-12 text-inverse-foreground sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md items-center">
          <Card className="w-full border-0 bg-card text-card-foreground">
            <CardHeader>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-signal-muted text-signal">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl">Set a new password</CardTitle>
              <CardDescription>
                Choose a secure password to get back into Hallway.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="At least 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Updating password..." : "Update Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-hidden bg-inverse text-inverse-foreground">
      <div className="relative mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[1.12fr_0.88fr]">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(125,211,252,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,.06)_1px,transparent_1px)] [background-size:48px_48px]" />

        <section className="relative flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-16 lg:py-12 xl:px-24">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white">
              <img src="/branding/intel-hero-wolfstreet.png" alt="Hallway" className="h-9 w-9 rounded-lg" />
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight">Hallway</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-sidebar-primary">Conference intelligence · A Wolf Street app</p>
            </div>
          </div>

          <div className="max-w-2xl py-14 lg:py-20">
            <div className="mb-7 inline-flex items-center gap-2 rounded-xl border border-sidebar-primary/30 bg-sidebar-primary/10 px-3 py-1.5 text-xs font-semibold text-sidebar-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Turn every conversation into momentum
            </div>
            <h1 className="max-w-xl font-display text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-5xl xl:text-6xl">
              Leave the conference with a clear next move.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-inverse-foreground/85 sm:text-lg">
              Capture the people you meet, the conversations that matter, and the follow-ups that win—then turn it all into an executive-ready readout.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ScanLine, label: "Scan contacts", detail: "Business cards to clean data" },
                { icon: Mic2, label: "Capture context", detail: "Voice recaps while it's fresh" },
                { icon: BarChart3, label: "Prove impact", detail: "Team and executive insights" },
              ].map(({ icon: Icon, label, detail }) => (
                <div key={label} className="rounded-lg border border-inverse-foreground/15 bg-inverse-foreground/[0.04] p-4">
                  <Icon className="mb-4 h-5 w-5 text-sidebar-primary" />
                  <p className="text-sm font-semibold text-inverse-foreground">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-inverse-muted">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-inverse-muted">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-sidebar-primary" /> Secure team workspace</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-sidebar-primary" /> Built for conference teams</span>
          </div>
        </section>

        <section className="relative flex items-center px-4 pb-8 sm:px-8 lg:py-8 lg:pr-10 xl:pr-16">
          <div className="w-full rounded-lg border border-inverse-foreground/15 bg-card p-1">
            <Card className="rounded-lg border-0 bg-card text-card-foreground shadow-none">
              <CardHeader className="px-6 pb-3 pt-7 sm:px-9 sm:pt-9">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-signal-muted text-signal lg:hidden">
                  <img src="/branding/intel-hero-wolfstreet.png" alt="" className="h-9 w-9 rounded-xl" />
                </div>
                <CardTitle className="font-display text-2xl tracking-tight sm:text-3xl">Welcome to Hallway</CardTitle>
                <CardDescription className="text-sm leading-6 text-muted-foreground">
                  Sign in to continue, or create your team workspace in under a minute.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-7 sm:px-9 sm:pb-9">
                <Tabs defaultValue="signin">
                  <TabsList className="grid h-11 w-full grid-cols-3 rounded-lg bg-muted p-1">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
                <TabsTrigger value="forgot">Forgot?</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="group h-11 w-full" disabled={loading}>
                    {loading ? "Signing in..." : <span className="flex items-center gap-2">Sign In <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="forgot">
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="h-11 w-full" disabled={loading}>
                    {loading ? "Sending reset link..." : "Send Reset Link"}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="At least 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="h-11 w-full" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
                </Tabs>
                <div className="mt-6 flex items-center justify-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" /> Your data stays inside your secure workspace.
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}
