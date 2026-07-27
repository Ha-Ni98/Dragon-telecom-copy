import { useTranslation } from "@/hooks/useTranslation";
import {
  InvoiceStatus,
  SupplierInvoiceStatus,
  ClientStatus,
  OrderStatus,
} from "@dragon-telecom/contract";
import { ORDER_STATUS_LABEL_KEY } from "@/lib/order-status-labels";

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
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]} ${pulse ? "animate-pulse-soft" : ""}`}
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

// set-02 PUB-10 — invoices (My-Invoices table + InvoiceView), following the EXTENSION POINT
// pattern above.
const INVOICE_STATUS_TONE: Record<InvoiceStatus, BadgeTone> = {
  [InvoiceStatus.ISSUED]: "warning",
  [InvoiceStatus.PARTIALLY_PAID]: "warning",
  [InvoiceStatus.PAID]: "success",
  [InvoiceStatus.CANCELLED]: "destructive",
};

const INVOICE_STATUS_LABEL_KEY: Record<InvoiceStatus, string> = {
  [InvoiceStatus.ISSUED]: "invoices.status.issued",
  [InvoiceStatus.PARTIALLY_PAID]: "invoices.status.partiallyPaid",
  [InvoiceStatus.PAID]: "invoices.status.paid",
  [InvoiceStatus.CANCELLED]: "invoices.status.cancelled",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={INVOICE_STATUS_TONE[status]} label={t(INVOICE_STATUS_LABEL_KEY[status])} />
  );
}

// set-04 ADM-07/ADM-08 — the purchasing module's own DRAFT/CONFIRMED/CANCELLED status, distinct
// from InvoiceStatus above (billing module) — same EXTENSION POINT pattern.
const SUPPLIER_INVOICE_STATUS_TONE: Record<SupplierInvoiceStatus, BadgeTone> = {
  [SupplierInvoiceStatus.DRAFT]: "neutral",
  [SupplierInvoiceStatus.CONFIRMED]: "success",
  [SupplierInvoiceStatus.CANCELLED]: "destructive",
};

const SUPPLIER_INVOICE_STATUS_LABEL_KEY: Record<SupplierInvoiceStatus, string> = {
  [SupplierInvoiceStatus.DRAFT]: "admin.supplierInvoices.status.draft",
  [SupplierInvoiceStatus.CONFIRMED]: "admin.supplierInvoices.status.confirmed",
  [SupplierInvoiceStatus.CANCELLED]: "admin.supplierInvoices.status.cancelled",
};

export function SupplierInvoiceStatusBadge({ status }: { status: SupplierInvoiceStatus }) {
  const { t } = useTranslation();
  return (
    <StatusPill
      tone={SUPPLIER_INVOICE_STATUS_TONE[status]}
      label={t(SUPPLIER_INVOICE_STATUS_LABEL_KEY[status])}
    />
  );
}

// ADM-12 — clients.dtos.ts's registration-approval status, same EXTENSION POINT pattern.
const CLIENT_STATUS_TONE: Record<ClientStatus, BadgeTone> = {
  [ClientStatus.PENDING]: "warning",
  [ClientStatus.APPROVED]: "success",
  [ClientStatus.REJECTED]: "destructive",
};

const CLIENT_STATUS_LABEL_KEY: Record<ClientStatus, string> = {
  [ClientStatus.PENDING]: "admin.clients.statusPending",
  [ClientStatus.APPROVED]: "admin.clients.statusActive",
  [ClientStatus.REJECTED]: "admin.clients.statusRefused",
};

export function ClientStatusBadge({ status }: { status: ClientStatus }) {
  const { t } = useTranslation();
  return (
    <StatusPill tone={CLIENT_STATUS_TONE[status]} label={t(CLIENT_STATUS_LABEL_KEY[status])} />
  );
}

// S11 — orders (admin stat cards + the orders table's status column), same EXTENSION POINT
// pattern. BadgeTone has four tones and S2 owns that palette (RC-3), so CONFIRMED and PACKAGED
// both map to `neutral`: they are "in progress, nothing has moved yet" states and the table's own
// status text already distinguishes them. Do not widen BadgeTone here.
const ORDER_STATUS_TONE: Record<OrderStatus, BadgeTone> = {
  [OrderStatus.PENDING]: "warning",
  [OrderStatus.CONFIRMED]: "neutral",
  [OrderStatus.PACKAGED]: "neutral",
  [OrderStatus.IN_DELIVERY]: "warning",
  [OrderStatus.COMPLETED]: "success",
  [OrderStatus.CANCELLED]: "destructive",
  [OrderStatus.CANCELLED_BY_CLIENT]: "destructive",
  [OrderStatus.RETURNED]: "destructive",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation();
  return <StatusPill tone={ORDER_STATUS_TONE[status]} label={t(ORDER_STATUS_LABEL_KEY[status])} />;
}
