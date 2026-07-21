import { useState, useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Download,
  Upload,
  Truck,
  MapPin,
  RefreshCw,
  AlertTriangle,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { useTranslation } from "@/hooks/useTranslation";
import type { ExcelImportResult } from "@/types/draft-types";
import { ExcelFileUploader } from "@/components/shared/excel-file-uploader";
import type { AdminFeesDto } from "@dragon-telecom/contract";

interface DeliveryFeesSectionProps {
  className?: string;
}

type FeeRow = {
  id: string;
  wilayaName: string;
  communeName?: string;
  deliveryHome: number;
  deliveryOffice: number;
};

function flattenFeeRows(fees: AdminFeesDto): FeeRow[] {
  return fees.wilayas.flatMap((wilaya) => [
    {
      id: wilaya.wilayaId,
      wilayaName: wilaya.frName,
      deliveryHome: wilaya.deliveryHome,
      deliveryOffice: wilaya.deliveryOffice,
    },
    ...wilaya.communes.map((commune) => ({
      id: commune.communeId,
      wilayaName: wilaya.frName,
      communeName: commune.frName,
      deliveryHome: commune.deliveryHome,
      deliveryOffice: commune.deliveryOffice,
    })),
  ]);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "DZD",
    minimumFractionDigits: 0,
  }).format(amount);
}

// ADM-17 Settings Delivery fees tab — retyped off AdminFeesDto (platform.dtos.ts): a nested
// `wilayas[] -> communes[]` shape (one resolved fee per wilaya + only the communes with an
// explicit override), not the old view-model's flat `{wilaya, commune, deliveryHome,
// deliveryOffice}[]` — flattened into table rows here (`communeName` absent = the wilaya-level
// default row). Data is a local placeholder instead of the incompatible stub hook
// `useDeliveryFees` (`use-admin-settings.ts`) — Sprint 8 swaps this for `useAdminDeliveryFees`/
// `useImport/ExportAdminDeliveryFees`. The Excel uploader's own `ExcelImportResult` contract
// (a shared component, `components/shared/excel-file-uploader.tsx`) still predates the real
// dry-run-report flow the plan calls for — flagged for Sprint 8, not solved here.
export function DeliveryFeesSection({ className }: DeliveryFeesSectionProps) {
  const { t } = useTranslation();

  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const fees: AdminFeesDto | undefined = undefined;
  const isLoading = false;
  const isError = false;

  const rows = useMemo(() => (fees ? flattenFeeRows(fees) : []), [fees]);
  const paginatedRows = useMemo(
    () => rows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage),
    [rows, currentPage],
  );
  const totalPages = Math.ceil(rows.length / itemsPerPage);
  const stats = useMemo(
    () => ({
      total: rows.length,
      wilayas: new Set(rows.map((r) => r.wilayaName)).size,
      communes: rows.filter((r) => r.communeName).length,
    }),
    [rows],
  );

  const handleFileProcessed = (result: ExcelImportResult) => {
    setImportResult(result);
    setIsProcessing(false);
  };
  const handleImportDialogClose = () => {
    setIsImportDialogOpen(false);
    setImportResult(null);
    setIsProcessing(false);
  };

  const columns: ColumnDef<FeeRow>[] = [
    {
      accessorKey: "wilayaName",
      header: t("admin.settings.delivery.wilaya"),
      cell: ({ row }) => (
        <div className="flex items-center gap-2 font-medium">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {row.original.wilayaName}
        </div>
      ),
    },
    {
      accessorKey: "communeName",
      header: t("admin.settings.delivery.commune"),
      cell: ({ row }) =>
        row.original.communeName ? (
          <Badge variant="outline">{row.original.communeName}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      accessorKey: "deliveryOffice",
      header: t("admin.settings.delivery.deliveryOffice"),
      cell: ({ row }) => formatCurrency(row.original.deliveryOffice),
    },
    {
      accessorKey: "deliveryHome",
      header: t("admin.settings.delivery.deliveryHome"),
      cell: ({ row }) => formatCurrency(row.original.deliveryHome),
    },
  ];

  const renderMobileRow = (fee: FeeRow) => (
    <div className="space-y-2 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-medium">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          {fee.wilayaName}
        </div>
        {fee.communeName && <Badge variant="outline">{fee.communeName}</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <span>
          {t("admin.settings.delivery.office")}: {formatCurrency(fee.deliveryOffice)}
        </span>
        <span>
          {t("admin.settings.delivery.home")}: {formatCurrency(fee.deliveryHome)}
        </span>
      </div>
    </div>
  );

  return (
    <div className={className}>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                {t("admin.settings.delivery.title")}
              </CardTitle>
              <CardDescription>{t("admin.settings.delivery.description")}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={isLoading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                {t("common.actions.refresh")}
              </Button>
              <Button variant="outline" size="sm" disabled={!rows.length}>
                <Download className="mr-2 h-4 w-4" />
                {t("admin.settings.delivery.exportExcel")}
              </Button>
              <Button onClick={() => setIsImportDialogOpen(true)} disabled={isLoading}>
                <Upload className="mr-2 h-4 w-4" />
                {t("admin.settings.delivery.importExcel")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t("admin.settings.delivery.loadError")}</AlertDescription>
            </Alert>
          )}

          {isLoading ? (
            <TableSkeleton rows={5} columns={4} />
          ) : (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {t("admin.settings.delivery.totalEntries")}
                    </p>
                    <p className="text-2xl font-bold">{stats.total}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t("admin.settings.delivery.wilayas")}</p>
                    <p className="text-2xl font-bold">{stats.wilayas}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 rounded-lg bg-muted p-3">
                  <Truck className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{t("admin.settings.delivery.communes")}</p>
                    <p className="text-2xl font-bold">{stats.communes}</p>
                  </div>
                </div>
              </div>

              <DataTable
                columns={columns}
                data={paginatedRows}
                getRowKey={(fee) => fee.id}
                renderMobileRow={renderMobileRow}
                emptyState={
                  <EmptyState
                    icon={<Truck className="h-6 w-6" />}
                    title={t("admin.settings.delivery.noFeesFound")}
                    body={t("admin.settings.delivery.description")}
                  />
                }
              />

              {totalPages > 1 && (
                <SimplePagination
                  page={currentPage}
                  totalPages={totalPages}
                  onPageChange={setCurrentPage}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t("admin.settings.delivery.importTitle")}
            </DialogTitle>
            <DialogDescription>{t("admin.settings.delivery.importDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            <ExcelFileUploader
              onFileProcessed={handleFileProcessed}
              disabled={isProcessing}
              isProcessing={isProcessing}
            />

            {importResult && (
              <Alert variant={importResult.success ? "default" : "destructive"}>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {importResult.message}
                  {importResult.errors && importResult.errors.length > 0 && (
                    <ul className="mt-2 list-inside list-disc">
                      {importResult.errors.map((error, index) => (
                        <li key={index} className="text-sm">
                          {error}
                        </li>
                      ))}
                    </ul>
                  )}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleImportDialogClose} disabled={isProcessing}>
                {importResult ? t("admin.settings.delivery.close") : t("common.actions.cancel")}
              </Button>
              {importResult?.success && (
                <Button onClick={handleImportDialogClose}>
                  {t("admin.settings.delivery.continue")}
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
