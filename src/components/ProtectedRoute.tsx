import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Session } from "@supabase/supabase-js";
import PendingApproval from "@/pages/PendingApproval";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isApproved, setIsApproved] = useState<boolean | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        if (!session) {
          setLoading(false);
          setIsApproved(null);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (!session) setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Check approval status when session changes
  useEffect(() => {
    if (!session?.user?.id) return;

    const checkApproval = async () => {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("is_approved")
        .eq("id", session.user.id)
        .single();

      if (error) {
        console.error("Error checking approval:", error);
        // If profile doesn't exist yet (race condition with trigger), wait and retry
        setTimeout(checkApproval, 1000);
        return;
      }

      setIsApproved(profile?.is_approved ?? false);
      setLoading(false);
    };

    checkApproval();
  }, [session?.user?.id]);

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
    return <Navigate to="/auth" replace />;
  }

  if (!isApproved) {
    return <PendingApproval email={session.user.email || ""} />;
  }

  return <>{children}</>;
}
