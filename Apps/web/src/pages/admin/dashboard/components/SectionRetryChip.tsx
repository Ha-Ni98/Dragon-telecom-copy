import { RefreshCw } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-01's own error treatment, distinct from the 4 older widgets' full Alert block: "a failed
// widget shows a retry chip without blanking the page" (plan.md D10) — small, compact, doesn't
// dominate the section the way an Alert does. Page-local (not components/shared) since no other
// page currently wants this — STF-01 silent-hides instead (plan.md STF-01 §3).
export function SectionRetryChip({ onRetry }: { onRetry?: () => void }) {
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={onRetry}
      className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/15"
    >
      <RefreshCw className="h-3 w-3" />
      {t("admin.dashboard.retryChip")}
    </button>
  );
}
