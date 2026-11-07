import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Session } from "@supabase/supabase-js";
import PendingApproval from "@/pages/PendingApproval";
import { Button } from "@/components/ui/button";
import { signOutAndClear } from "@/lib/signOut";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const location = useLocation();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Only clear session on explicit sign-out, not on token refresh failures
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setLoading(false);
          setIsApproved(null);
        } else if (session) {
          setSession(session);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const [approvalError, setApprovalError] = useState(false);
  const [approvalAttempt, setApprovalAttempt] = useState(0);

  // Check approval status when session changes. The profile row is created by
  // a database trigger right after sign-up, so a brief miss is retried a few
  // times with backoff; after that we stop and show an error instead of
  // polling forever.
  useEffect(() => {
    if (!session?.user?.id) return;
    const userId = session.user.id;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const MAX_ATTEMPTS = 5;

    const checkApproval = async (attempt: number) => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("id", userId)
        .maybeSingle();
      if (cancelled) return;

      if (error || !profile) {
        if (error) console.error("Error checking approval:", error);
        if (attempt + 1 < MAX_ATTEMPTS) {
          timer = setTimeout(() => checkApproval(attempt + 1), 1000 * 2 ** attempt);
        } else {
          setApprovalError(true);
          setLoading(false);
        }
        return;
      }

      setApprovalError(false);
      setIsApproved(profile.is_approved ?? false);
      setLoading(false);
    };

    setApprovalError(false);
    checkApproval(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [session?.user?.id, approvalAttempt]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!session) {
    // Remember where they were going so sign-in can send them back.
    const here = location.pathname + location.search;
    const next = here === "/" ? "" : `?next=${encodeURIComponent(here)}`;
    return <Navigate to={`/auth${next}`} replace />;
  }

  if (approvalError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="max-w-sm space-y-4 text-center">
          <h2 className="text-lg font-semibold">We couldn't load your account</h2>
          <p className="text-sm text-muted-foreground">
            Check your connection and try again. If this keeps happening, contact your Hallway admin.
          </p>
          <div className="flex justify-center gap-2">
            <Button onClick={() => { setLoading(true); setApprovalAttempt((n) => n + 1); }}>Try again</Button>
            <Button variant="outline" onClick={signOutAndClear}>Sign out</Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isApproved) {
    return <PendingApproval email={session.user.email || ""} />;
  }

  return <>{children}</>;
}
