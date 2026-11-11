import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogOut } from "lucide-react";
import { signOutAndClear } from "@/lib/signOut";

interface PendingApprovalProps {
  email: string;
}

export default function PendingApproval({ email }: PendingApprovalProps) {
  const handleSignOut = signOutAndClear;

  return (
    <div className="flex items-center justify-center min-h-screen bg-background p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
            <Clock className="w-8 h-8 text-warning" />
          </div>
          <CardTitle className="text-2xl">No Hallway access yet</CardTitle>
          <CardDescription className="text-base mt-2">
            Your Wolf Street account isn't part of a Hallway company yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-muted rounded-lg p-3 text-center">
            <p className="text-sm text-muted-foreground">Signed in as</p>
            <p className="font-medium">{email}</p>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Ask your company's Hallway admin to invite you. Once they do, sign out and back in.
          </p>
          <Button variant="outline" className="w-full" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
