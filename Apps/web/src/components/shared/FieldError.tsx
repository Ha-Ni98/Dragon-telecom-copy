import type { ReactNode } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

// S37 — every error message is icon + text, so a red line is never read as a warning or as a
// decorative accent (the highlight scarlet is close to --destructive in light mode). AlertCircle
// = error; AlertTriangle stays the warning glyph. Renders nothing when there is no message, so
// call sites can pass `errors.x?.message` straight through.
export function FieldError({
  id,
  className,
  children,
}: {
  id?: string;
  className?: string;
  children?: ReactNode;
}) {
  if (children === undefined || children === null || children === "" || children === false) {
    return null;
  }
  return (
    <p
      id={id}
      role="alert"
      className={cn("flex items-start gap-1.5 text-sm font-medium text-destructive", className)}
    >
      <AlertCircle className="mt-[0.15em] h-[1em] w-[1em] shrink-0" aria-hidden="true" />
      <span className="min-w-0">{children}</span>
    </p>
  );
}
