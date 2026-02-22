import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-right"
      gap={12}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:border-border group-[.toaster]:shadow-xl group-[.toaster]:backdrop-blur-sm group-[.toaster]:animate-slide-in-right",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:hover:bg-primary/90 group-[.toast]:transition-colors",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:hover:bg-muted/80 group-[.toast]:transition-colors",
          success: "group-[.toaster]:border-success group-[.toaster]:bg-success/5",
          error: "group-[.toaster]:border-destructive group-[.toaster]:bg-destructive/5",
          warning: "group-[.toaster]:border-warning group-[.toaster]:bg-warning/5",
          info: "group-[.toaster]:border-primary group-[.toaster]:bg-primary/5",
        },
        duration: 4000,
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
