import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        {
          default: "border-transparent bg-primary text-primary-foreground shadow",
          secondary: "border-transparent bg-secondary text-secondary-foreground",
          destructive: "border-transparent bg-destructive text-destructive-foreground shadow",
          outline: "text-foreground",
          success: "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
          warning: "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
        }[variant],
        className
      )}
      {...props}
    />
  );
}
