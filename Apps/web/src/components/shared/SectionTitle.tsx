import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// S37 — section/page title with the small highlight marker in front (plan-S37 §0.5: one of the
// few places the accent appears in admin/staff). The marker is decorative (aria-hidden).
// `align="center"` for the storefront's centered section headers.
export function SectionTitle({
  as: Tag = "h2",
  align = "start",
  className,
  children,
  id,
}: {
  as?: "h1" | "h2" | "h3";
  align?: "start" | "center";
  className?: string;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Tag
      id={id}
      className={cn("flex items-center gap-2.5", align === "center" && "justify-center", className)}
    >
      <span
        aria-hidden="true"
        className="inline-block h-[0.8em] w-1 shrink-0 rounded-full bg-highlight"
      />
      <span className="min-w-0">{children}</span>
    </Tag>
  );
}
