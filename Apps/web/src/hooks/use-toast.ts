import { toast as sonnerToast } from "sonner";

// Sub-01 Sprint 1 compatibility shim: ported MVP hooks call the legacy shadcn
// `useToast()` object-call shape (`toast({ title, description, variant })`). Rather than
// hand-rewrite every call site during the data-decoupling sprints, this adapts that shape
// onto the real sonner instance the app already mounts (no second <Toaster/>, no separate
// toast state). Sprint 2 ("mount a single sonner Toaster") is where call sites get rewritten
// to sonner's own API directly and this file is deleted.
interface LegacyToastOptions {
  title?: string;
  description?: string;
  variant?: "default" | "destructive";
}

function toast({ title, description, variant }: LegacyToastOptions): void {
  const message = title ?? description ?? "";
  const options = title && description ? { description } : undefined;
  if (variant === "destructive") {
    sonnerToast.error(message, options);
  } else {
    sonnerToast.success(message, options);
  }
}

export function useToast() {
  return { toast };
}
