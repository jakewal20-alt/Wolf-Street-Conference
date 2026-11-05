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

      toast({
        title: "Account created!",
        description: "You can now sign in with your credentials.",
      });

      // Auto sign in after signup
      if (data.user) {
        navigate("/");
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
      <div className="min-h-screen bg-[#07111f] px-4 py-12 text-white sm:px-6">
        <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md items-center">
          <Card className="w-full border-white/10 bg-white text-slate-950 shadow-2xl shadow-black/30">
            <CardHeader>
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700">
                <LockKeyhole className="h-6 w-6" />
              </div>
              <CardTitle className="text-2xl">Set a new password</CardTitle>
              <CardDescription>
                Choose a secure password to get back into Wolf Street.
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
                <Button type="submit" className="w-full bg-[#0b2847] hover:bg-[#0d355f]" disabled={loading}>
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
    <div className="min-h-screen overflow-hidden bg-[#07111f] text-white">
      <div className="relative mx-auto grid min-h-screen max-w-[1600px] lg:grid-cols-[1.12fr_0.88fr]">
        <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(125,211,252,.06)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,.06)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />

        <section className="relative flex flex-col justify-between px-6 py-8 sm:px-10 lg:px-16 lg:py-12 xl:px-24">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/95 shadow-lg">
              <img src="/branding/intel-hero-wolfstreet.png" alt="Wolf Street" className="h-9 w-9 rounded-lg" />
            </div>
            <div>
              <p className="font-['Space_Grotesk'] text-lg font-semibold tracking-tight">Wolf Street</p>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-300/80">Conference intelligence</p>
            </div>
          </div>

          <div className="max-w-2xl py-14 lg:py-20">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-200">
              <Sparkles className="h-3.5 w-3.5" />
              Turn every conversation into momentum
            </div>
            <h1 className="max-w-xl font-['Space_Grotesk'] text-4xl font-semibold leading-[1.05] tracking-[-0.045em] sm:text-5xl xl:text-6xl">
              Leave the conference with a clear next move.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">
              Capture the people you meet, the conversations that matter, and the follow-ups that win—then turn it all into an executive-ready readout.
            </p>

            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ScanLine, label: "Scan contacts", detail: "Business cards to clean data" },
                { icon: Mic2, label: "Capture context", detail: "Voice recaps while it's fresh" },
                { icon: BarChart3, label: "Prove impact", detail: "Team and executive insights" },
              ].map(({ icon: Icon, label, detail }) => (
                <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 backdrop-blur-sm">
                  <Icon className="mb-4 h-5 w-5 text-cyan-300" />
                  <p className="text-sm font-semibold text-white">{label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">{detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-cyan-400" /> Secure team workspace</span>
            <span className="flex items-center gap-1.5"><Check className="h-4 w-4 text-cyan-400" /> Built for conference teams</span>
          </div>
        </section>

        <section className="relative flex items-center px-4 pb-8 sm:px-8 lg:py-8 lg:pr-10 xl:pr-16">
          <div className="w-full rounded-[28px] border border-white/10 bg-[#f7f9fc] p-2 shadow-2xl shadow-black/40">
            <Card className="rounded-[22px] border-0 bg-white text-slate-950 shadow-none">
              <CardHeader className="px-6 pb-3 pt-7 sm:px-9 sm:pt-9">
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 lg:hidden">
                  <img src="/branding/intel-hero-wolfstreet.png" alt="" className="h-9 w-9 rounded-xl" />
                </div>
                <CardTitle className="font-['Space_Grotesk'] text-2xl tracking-tight sm:text-3xl">Welcome to Wolf Street</CardTitle>
                <CardDescription className="text-sm leading-6 text-slate-500">
                  Sign in to continue, or create your team workspace in under a minute.
                </CardDescription>
              </CardHeader>
              <CardContent className="px-6 pb-7 sm:px-9 sm:pb-9">
                <Tabs defaultValue="signin">
                  <TabsList className="grid h-11 w-full grid-cols-3 rounded-xl bg-slate-100 p-1">
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
                  <Button type="submit" className="group h-11 w-full bg-[#0b2847] hover:bg-[#0d355f]" disabled={loading}>
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
                  <Button type="submit" className="h-11 w-full bg-[#0b2847] hover:bg-[#0d355f]" disabled={loading}>
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
                  <Button type="submit" className="h-11 w-full bg-[#0b2847] hover:bg-[#0d355f]" disabled={loading}>
                    {loading ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </TabsContent>
                </Tabs>
                <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-5 text-xs text-slate-400">
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
