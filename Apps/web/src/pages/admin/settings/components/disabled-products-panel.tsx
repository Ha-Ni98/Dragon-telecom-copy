import { PackageX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SimplePagination } from "@/components/shared/SimplePagination";
import type { AdminProductDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface DisabledProductsPanelProps {
  products: AdminProductDto[];
  isLoading?: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onEnable: (product: AdminProductDto) => void;
  /** True while any re-enable mutation is in flight — disables every row's button. */
  isEnabling?: boolean;
}

// S21 — products disabled from /admin/products' per-row Enabled switch used to be unreachable:
// listAdminProducts pinned `isEnabled: true`, so a disabled row vanished for good. This panel is
// the way back, driven by the admin-only `enabledStatus=disabled` filter. Families/brands/models
// are NOT listed here — they already live in the Hierarchy tab, which now offers Enable too.
export function DisabledProductsPanel({
  products,
  isLoading = false,
  page,
  totalPages,
  onPageChange,
  onEnable,
  isEnabling = false,
}: DisabledProductsPanelProps) {
  const { t } = useTranslation();

  if (isLoading) {
    return <TableSkeleton rows={5} columns={3} />;
  }

  if (products.length === 0) {
    return (
      <EmptyState
        icon={<PackageX className="h-6 w-6" />}
        title={t("admin.settings.disabledProducts.empty")}
        body=""
      />
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{t("admin.settings.disabledProducts.helper")}</p>
      <Card>
        <CardContent className="space-y-1 pt-4">
          {products.map((product) => {
            const parentDisabled = !product.family.isEnabled || !product.brand.isEnabled;
            const disabledParentNames = [
              !product.family.isEnabled ? product.family.name : null,
              !product.brand.isEnabled ? product.brand.name : null,
            ]
              .filter(Boolean)
              .join(", ");

            return (
              <div
                key={product.id}
                className="flex items-center justify-between rounded-md border p-2 text-sm"
              >
                <div>
                  <span>{product.name}</span>
                  <div className="text-xs text-muted-foreground">
                    {product.barcode ?? "—"} ·{" "}
                    {[product.family.name, product.brand.name, product.model?.name]
                      .filter(Boolean)
                      .join(" / ")}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {parentDisabled && (
                    <span className="text-xs text-muted-foreground">
                      {t("admin.settings.disabledProducts.parentDisabled", {
                        names: disabledParentNames,
                      })}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEnable(product)}
                    disabled={isEnabling}
                  >
                    {t("common.actions.enable")}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <SimplePagination page={page} totalPages={totalPages} onPageChange={onPageChange} />
      )}
    </div>
  );
}
