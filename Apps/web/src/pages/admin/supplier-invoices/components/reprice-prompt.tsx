import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { z } from "zod";
import type { ConfirmResultDto, UpdatePricingCommand } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

type RepriceCandidate = ConfirmResultDto["repriceCandidates"][number];

const repriceFieldsSchema = z.object({
  guestPrice: z.number().min(0).optional(),
  defaultSalePrice: z.number().min(0).optional(),
});

interface RepriceCandidateRowProps {
  candidate: RepriceCandidate;
  onApply: (productId: string, values: UpdatePricingCommand) => void;
  onSkip: (productId: string) => void;
  isApplying?: boolean;
}

function RepriceCandidateRow({
  candidate,
  onApply,
  onSkip,
  isApplying = false,
}: RepriceCandidateRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const { register, handleSubmit } = useForm<z.infer<typeof repriceFieldsSchema>>({
    resolver: zodResolver(repriceFieldsSchema),
    defaultValues: {
      guestPrice: candidate.current.guestPrice,
      defaultSalePrice: candidate.current.defaultSalePrice,
    },
  });

  if (!expanded) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {candidate.name} — {t("admin.supplierInvoices.editor.reprice.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((values) => {
            onApply(candidate.productId, values);
            setExpanded(false);
          })}
          className="space-y-3"
        >
          <div className="text-sm text-muted-foreground">
            {t("admin.suppliers.averageQuantity")}: {candidate.averageCost.toLocaleString()}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>{t("common.pricing.resolvedPrice")}</Label>
              <Input
                type="number"
                step="0.01"
                {...register("guestPrice", { valueAsNumber: true })}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("admin.supplierInvoices.editor.reprice.title")}</Label>
              <Input
                type="number"
                step="0.01"
                {...register("defaultSalePrice", { valueAsNumber: true })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onSkip(candidate.productId);
                setExpanded(false);
              }}
              disabled={isApplying}
            >
              {t("admin.supplierInvoices.editor.reprice.skip")}
            </Button>
            <Button type="submit" disabled={isApplying}>
              {t("admin.supplierInvoices.editor.reprice.apply")}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

interface RepricePromptProps {
  candidates: RepriceCandidate[];
  onApply: (productId: string, values: UpdatePricingCommand) => void;
  onSkip: (productId: string) => void;
  onSkipAll: () => void;
  isApplying?: boolean;
}

// ADM-08 — one collapsible reprice sub-form per received product, shown only after a
// successful confirm (plan §5, "renders only after a successful confirm").
export function RepricePrompt({
  candidates,
  onApply,
  onSkip,
  onSkipAll,
  isApplying = false,
}: RepricePromptProps) {
  const { t } = useTranslation();
  if (candidates.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button type="button" variant="ghost" size="sm" onClick={onSkipAll}>
          {t("admin.supplierInvoices.editor.reprice.skipAll")}
        </Button>
      </div>
      {candidates.map((candidate) => (
        <RepriceCandidateRow
          key={candidate.productId}
          candidate={candidate}
          onApply={onApply}
          onSkip={onSkip}
          isApplying={isApplying}
        />
      ))}
    </div>
  );
}
