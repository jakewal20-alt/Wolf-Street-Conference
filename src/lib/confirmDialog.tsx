import { createRoot } from "react-dom/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { buttonVariants } from "@/components/ui/button";

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

/**
 * An in-page replacement for window.confirm(). Some embedded browsers (the
 * Claude browser pane, some in-app webviews) block native dialogs silently,
 * which made "Sign out" do nothing. Resolves true only when confirmed.
 */
export function confirmDialog({ title, description, confirmLabel = "Confirm", destructive = false }: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    let settled = false;
    const finish = (ok: boolean) => {
      if (settled) return;
      settled = true;
      resolve(ok);
      // Let the close animation run before unmounting.
      setTimeout(() => {
        root.unmount();
        host.remove();
      }, 200);
      render(false);
    };
    const render = (open: boolean) =>
      root.render(
        <AlertDialog open={open} onOpenChange={(o) => !o && finish(false)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{title}</AlertDialogTitle>
              {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => finish(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className={destructive ? buttonVariants({ variant: "destructive" }) : undefined}
                onClick={() => finish(true)}
              >
                {confirmLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>,
      );
    render(true);
  });
}
