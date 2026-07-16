import { useTranslation } from "@/hooks/useTranslation";

export type BadgeTone = "success" | "warning" | "destructive" | "neutral";

const TONE_CLASS: Record<BadgeTone, string> = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/20 text-warning-foreground border border-warning/40",
  destructive: "bg-destructive/15 text-destructive",
  neutral: "bg-muted text-muted-foreground",
};

// Shared pill markup — every status/enabled badge in the app renders through this, so the
// visual language (dot, pill shape, tone colors) can't drift between badge types.
export function StatusPill({
  tone,
  label,
  pulse = false,
}: {
  tone: BadgeTone;
  label: string;
  pulse?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]} ${pulse ? "animate-pulse-soft" : ""}`}
    >
      ● {label}
    </span>
  );
}

// EXTENSION POINT (modules): add one enum-backed badge per status enum, following this
// pattern — a tone map keyed by the enum, then a component that renders <StatusPill>.

// isEnabled is a boolean, not an enum — the reference example for an active/inactive pill.
export function EnabledBadge({ isEnabled }: { isEnabled: boolean }) {
  const { t } = useTranslation();
  return (
    <StatusPill
      tone={isEnabled ? "success" : "neutral"}
      label={isEnabled ? t("common.status.enabled") : t("common.status.disabled")}
    />
  );
}
