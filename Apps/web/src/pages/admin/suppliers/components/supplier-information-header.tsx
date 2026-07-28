import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { ArrowLeft, RefreshCw, RotateCcw } from "lucide-react";
import type { SupplierDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface SupplierInformationHeaderProps {
  supplier: SupplierDto;
  onRefresh?: () => void;
  /** S7 I12 — re-enable a disabled supplier; omit or leave undefined when the supplier is
   *  already enabled (no button renders). */
  onEnable?: () => void;
}

// ADM-07 detail — retyped off SupplierDto: `id` (uuid), `name`/`contactName`/`phone`/`email`
// (was `idSupplier`/`supplierName`/`supplierPersonName`/...). Edit-mode toggle now lives inside
// `SupplierDetailsSection` itself (self-contained), so this header no longer needs to lift
// isEditMode/isSaving/hasUnsavedChanges state — export/print/share actions (never implemented,
// Sub-01 placeholders) are dropped rather than retyped. S7 I12/I14: a disabled supplier shows a
// destructive badge and, when `onEnable` is passed, a re-enable button beside Refresh.
export function SupplierInformationHeader({
  supplier,
  onRefresh,
  onEnable,
}: SupplierInformationHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              onClick={() => navigate("/admin/suppliers")}
              className="cursor-pointer hover:text-primary"
            >
              {t("admin.suppliers.title")}
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{supplier.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/admin/suppliers")}
            className="p-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{supplier.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-muted-foreground">
              {supplier.location && <span>{supplier.location}</span>}
              {supplier.location && <Separator orientation="vertical" className="h-4" />}
              <Badge variant="secondary">
                {supplier.invoiceCount} {t("admin.suppliers.invoices")}
              </Badge>
              {!supplier.isEnabled && (
                <Badge variant="destructive">{t("admin.suppliers.disabledBadge")}</Badge>
              )}
              {supplier.phone && (
                <>
                  <Separator orientation="vertical" className="h-4" />
                  <span>{supplier.phone}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!supplier.isEnabled && onEnable && (
            <Button onClick={onEnable} variant="outline" size="sm" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              {t("admin.suppliers.table.enable")}
            </Button>
          )}
          {onRefresh && (
            <Button onClick={onRefresh} variant="outline" size="sm" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              {t("common.refresh")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
