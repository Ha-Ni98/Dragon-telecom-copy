import { Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";

interface AgeFlagProps {
  /** ISO datetime the age is measured from — OrderDto.placedAt, RepairDto.intakeAt. */
  since: string;
  /**
   * When set, renders nothing until elapsed time exceeds it, then renders as a warning
   * (STF-04/ADM-09's "age flag (pending > 24h)"). Omitted, it always renders as a neutral
   * elapsed-time badge (ADM-13/STF-07 repair cards' plain "age" column — no threshold implied).
   */
  thresholdHours?: number;
  className?: string;
}

export function AgeFlag({ since, thresholdHours, className }: AgeFlagProps) {
  const { t } = useTranslation();
  const hours = (Date.now() - new Date(since).getTime()) / 3_600_000;

  if (thresholdHours != null && hours < thresholdHours) return null;

  const label =
    hours < 24
      ? t("common.age.hours", { count: Math.max(0, Math.floor(hours)) })
      : t("common.age.days", { count: Math.floor(hours / 24) });

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1",
        thresholdHours != null && "border-warning/40 bg-warning/20 text-warning-foreground",
        className,
      )}
    >
      <Clock className="h-3 w-3" />
      {label}
    </Badge>
  );
}
