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
import { MarginDisplay } from "@/components/shared/MarginDisplay";

type RepriceCandidate = ConfirmResultDto["repriceCandidates"][number];
type TFunction = ReturnType<typeof useTranslation>["t"];

const repriceFieldsSchema = z.object({
  guestPrice: z.number().min(0).optional(),
  defaultSalePrice: z.number().min(0).optional(),
  categoryPrices: z
    .array(z.object({ categoryId: z.uuid(), price: z.number().min(0).optional() }))
    .optional(),
});

// I7's label format: `guest price -previous 1000-`, or `-previous empty-` when the product had
// no value for that field before this invoice.
function previousLabel(base: string, previous: number | undefined, t: TFunction): string {
  return `${base} ${
    previous == null
      ? t("admin.supplierInvoices.editor.reprice.previousEmpty")
      : t("admin.supplierInvoices.editor.reprice.previous", { value: previous.toLocaleString() })
  }`;
}

interface RepriceCandidateRowProps {
  candidate: RepriceCandidate;
  categories: { id: string; name: string }[];
  onApply: (productId: string, values: UpdatePricingCommand) => void;
  onSkip: (productId: string) => void;
  isApplying?: boolean;
}

function RepriceCandidateRow({
  candidate,
  categories,
  onApply,
  onSkip,
  isApplying = false,
}: RepriceCandidateRowProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const { register, handleSubmit, watch } = useForm<z.infer<typeof repriceFieldsSchema>>({
    resolver: zodResolver(repriceFieldsSchema),
    defaultValues: {
      guestPrice: candidate.current.guestPrice,
      defaultSalePrice: candidate.current.defaultSalePrice,
      categoryPrices: categories.map((c) => ({
        categoryId: c.id,
        price: candidate.current.categoryPrices.find((p) => p.categoryId === c.id)?.price,
      })),
    },
  });

  if (!expanded) return null;

  // `valueAsNumber` turns an empty optional numeric input into NaN, which z.number().optional()
  // rejects outright — handleSubmit's valid callback then never fires and Apply silently does
  // nothing (S3 F1's documented trap). setValueAs maps blank to undefined first.
  const optionalNumber = (raw: string) => (raw === "" ? undefined : Number(raw));

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
            onApply(candidate.productId, {
              guestPrice: values.guestPrice ?? null,
              ...(values.defaultSalePrice != null
                ? { defaultSalePrice: values.defaultSalePrice }
                : {}),
              categoryPrices: (values.categoryPrices ?? [])
                .filter((c): c is { categoryId: string; price: number } => c.price != null)
                .map((c) => ({ categoryId: c.categoryId, price: c.price })),
            });
            setExpanded(false);
          })}
          className="space-y-3"
        >
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
            <span>
              {t("admin.supplierInvoices.editor.reprice.qtyInStock")}: {candidate.quantityOnHand}
            </span>
            <span>
              {t("admin.supplierInvoices.editor.reprice.avgStockPrice")}:{" "}
              {candidate.avgStockPrice.toLocaleString()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>
                {previousLabel(
                  t("admin.supplierInvoices.editor.reprice.guestPrice"),
                  candidate.current.guestPrice,
                  t,
                )}
              </Label>
              <Input
                type="number"
                step="0.01"
                {...register("guestPrice", { setValueAs: optionalNumber })}
              />
              <MarginDisplay price={watch("guestPrice")} cost={candidate.avgStockPrice} />
            </div>
            <div className="space-y-1">
              <Label>
                {previousLabel(
                  t("admin.supplierInvoices.editor.reprice.defaultSalePrice"),
                  candidate.current.defaultSalePrice,
                  t,
                )}
              </Label>
              <Input
                type="number"
                step="0.01"
                {...register("defaultSalePrice", { setValueAs: optionalNumber })}
              />
              <MarginDisplay price={watch("defaultSalePrice")} cost={candidate.avgStockPrice} />
            </div>
            {categories.map((category, index) => {
              const previous = candidate.current.categoryPrices.find(
                (p) => p.categoryId === category.id,
              )?.price;
              return (
                <div key={category.id} className="space-y-1">
                  <Label>
                    {previousLabel(
                      `${category.name} ${t("admin.productsAdd.categoryPriceLabel")}`,
                      previous,
                      t,
                    )}
                  </Label>
                  <input
                    type="hidden"
                    {...register(`categoryPrices.${index}.categoryId` as const)}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    {...register(`categoryPrices.${index}.price` as const, {
                      setValueAs: optionalNumber,
                    })}
                  />
                  <MarginDisplay
                    price={watch(`categoryPrices.${index}.price`)}
                    cost={candidate.avgStockPrice}
                  />
                </div>
              );
            })}
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
  categories: { id: string; name: string }[];
  onApply: (productId: string, values: UpdatePricingCommand) => void;
  onSkip: (productId: string) => void;
  onSkipAll: () => void;
  isApplying?: boolean;
}

// ADM-08 — one collapsible reprice sub-form per received product, shown only after a
// successful confirm (plan §5, "renders only after a successful confirm"). S7 I7: moved to the
// top of the invoice information page, extended to every client category price (not just guest/
// default — categories the product never had a price for render an empty field, same convention
// as Product Info's S3 R2), and each field's label now carries its previous value in the form
// "label -previous 1000-" / "-previous empty-". Margins are computed against avgStockPrice
// (D10/RC-2) — the opposite figure from the invoice line's own avgPrice helper text.
export function RepricePrompt({
  candidates,
  categories,
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
          categories={categories}
          onApply={onApply}
          onSkip={onSkip}
          isApplying={isApplying}
        />
      ))}
    </div>
  );
}
