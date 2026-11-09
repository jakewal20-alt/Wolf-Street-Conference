import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowRight } from "lucide-react";
import { WOLFSTREET_HOME_SSO_PATH } from "@/lib/suite";


export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const navigate = useNavigate();
  const location = useLocation();
  // After sign-in, go back where we came from (e.g. /sso for another Wolf
  // Street app). Same-site paths only, never another origin. A plain sign-in
  // lands on the Wolf Street home page, through SSO.
  const nextParam = new URLSearchParams(location.search).get("next") ?? "";
  const nextPath = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : WOLFSTREET_HOME_SSO_PATH;
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
      if (session) navigate(nextPath, { replace: true });
    });
  }, [location.pathname, navigate, nextPath]);

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

      navigate(nextPath);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
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
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
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
        throw new Error("This link has expired or was already used. Use 'Forgot password?' on the sign-in page, or ask your admin for a new invite.");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;

      toast({
        title: "Password saved",
        description: "You're signed in.",
      });

      navigate(WOLFSTREET_HOME_SSO_PATH);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Which Wolf Street app sent them here (via /sso?app=X)?
  const continueTo = (() => {
    if (!nextPath.startsWith("/sso")) return null;
    const app = new URLSearchParams(nextPath.split("?")[1] ?? "").get("app") ?? "";
    return SUITE_APPS[app] ?? null;
  })();

  // If we're on the reset password page, show only the password reset form
  if (showResetPassword) {
    return (
      <SuiteShell>
        <h1 className="text-center font-display text-2xl font-semibold tracking-tight text-white">Choose your password</h1>
        <p className="mt-2 text-center text-sm leading-6 text-slate-300">
          One Wolf Street password for Forecast, SAMklr, Hallway and Ghostwriter.
        </p>
        <form onSubmit={handleUpdatePassword} className="mt-6 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password" className="text-slate-200">Password</Label>
            <Input
              id="new-password"
              type="password"
              placeholder="At least 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className={FIELD}
            />
          </div>
          <Button type="submit" className={PRIMARY} disabled={loading}>
            {loading ? "Saving..." : "Save password"}
          </Button>
        </form>
      </SuiteShell>
    );
  }

  return (
    <SuiteShell>
      <h1 className="text-center font-display text-2xl font-semibold tracking-tight text-white">Sign in to Wolf Street</h1>
      <p className="mt-2 text-center text-sm leading-6 text-slate-300">
        One account for Forecast, SAMklr, Hallway and Ghostwriter.
      </p>
      {continueTo && (
        <p className="mt-3 text-center text-sm font-medium text-[#e69617]">You'll continue to {continueTo}.</p>
      )}

      <Tabs defaultValue="signin" className="mt-6">
        <TabsList className="grid h-10 w-full grid-cols-2 rounded bg-white/5 p-1">
          <TabsTrigger value="signin" className="rounded-sm text-slate-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">Sign in</TabsTrigger>
          <TabsTrigger value="forgot" className="rounded-sm text-slate-300 data-[state=active]:bg-white/10 data-[state=active]:text-white">Forgot password?</TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form onSubmit={handleSignIn} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="signin-email" className="text-slate-200">Email</Label>
              <Input
                id="signin-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={FIELD}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signin-password" className="text-slate-200">Password</Label>
              <Input
                id="signin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className={FIELD}
              />
            </div>
            <Button type="submit" className={`group ${PRIMARY}`} disabled={loading}>
              {loading ? "Signing in..." : <span className="flex items-center gap-2">Sign in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></span>}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="forgot">
          <form onSubmit={handleForgotPassword} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="forgot-email" className="text-slate-200">Email</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className={FIELD}
              />
            </div>
            <Button type="submit" className={PRIMARY} disabled={loading}>
              {loading ? "Sending reset link..." : "Send reset link"}
            </Button>
          </form>
        </TabsContent>
      </Tabs>

      <p className="mt-6 text-center text-xs leading-5 text-slate-400">
        Wolf Street is invite-only. Need access? Ask your team's admin to invite you.
      </p>
    </SuiteShell>
  );
}

const SUITE_APPS: Record<string, string> = {
  forecast: "Forecast",
  samklr: "SAMklr",
  ghostwriter: "Ghostwriter",
  wolfstreet: "Wolf Street",
  hallway: "Hallway",
};

const FIELD =
  "h-11 border-white/15 bg-white/5 text-white placeholder:text-slate-500 focus-visible:ring-[#e69617] focus-visible:ring-offset-0";
const PRIMARY =
  "h-11 w-full bg-[#e69617] font-semibold text-[#0c1522] hover:bg-[#f0a632] focus-visible:ring-[#e69617]";

/** The one Wolf Street sign-in look: logo centred on the logo's own navy. */
function SuiteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0c1522] px-4 py-8">
      <img
        src="/branding/wolfstreet-logo.png"
        alt="Wolf Street"
        width={560}
        height={560}
        className="h-32 w-32 sm:h-40 sm:w-40"
      />
      <p className="-mt-1 mb-6 text-center text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
        Find the money. Meet the people. Win the work.
      </p>
      <div className="w-full max-w-sm rounded border border-white/10 bg-white/[0.03] p-6 sm:p-8">{children}</div>
    </div>
  );
}
