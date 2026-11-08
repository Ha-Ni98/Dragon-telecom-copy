import { Banknote, Receipt, ShoppingCart, Truck, Undo2, Wrench } from "lucide-react";
import { CashRegisterSection } from "@/pages/admin/cash-register/components/cash-register-section";
import { CashMovementCard } from "@/pages/admin/cash-register/components/cash-movement-card";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import { CashRegisterDrill, type StaffCashRegisterDto } from "@dragon-telecom/contract";
import type { CashRegisterFigure } from "@/types/cash-register.types";

interface CashRegisterSectionsProps {
  /** The admin CashRegisterDto is assignable to this: it is a superset (it adds `profit`). */
  data: StaffCashRegisterDto;
  /** Absent (the staff dashboard) = every figure is a plain, non-clickable card. */
  onDrill?: (drill: CashRegisterDrill, titleKey: string) => void;
}

// S35 — the Caisse's sections + net cash movement, shared by ADM-20 (clickable, with drill) and the
// staff dashboard (plain cards). Profit is not here: it exists only on the admin DTO and is
// rendered by AdminCashRegister alone.
export function CashRegisterSections({ data, onDrill }: CashRegisterSectionsProps) {
  const { t, language } = useTranslation();
  const money = (amount: number) => formatDZD(amount, language);

  const sections: { titleKey: string; icon: JSX.Element; figures: CashRegisterFigure[] }[] = [
    {
      titleKey: "admin.cashRegister.sales.title",
      icon: <Receipt className="h-5 w-5" />,
      figures: [
        {
          labelKey: "admin.cashRegister.sales.count",
          value: String(data.sales.count),
          drill: CashRegisterDrill.SALES,
        },
        { labelKey: "admin.cashRegister.sales.totalSold", value: money(data.sales.totalSold) },
        { labelKey: "admin.cashRegister.sales.totalPaid", value: money(data.sales.totalPaid) },
        { labelKey: "admin.cashRegister.sales.newCredit", value: money(data.sales.newCredit) },
      ],
    },
    {
      titleKey: "admin.cashRegister.returns.title",
      icon: <Undo2 className="h-5 w-5" />,
      figures: [
        {
          labelKey: "admin.cashRegister.returns.count",
          value: String(data.returns.count),
          drill: CashRegisterDrill.RETURNS,
        },
        {
          labelKey: "admin.cashRegister.returns.totalRefunded",
          value: money(data.returns.totalRefunded),
        },
      ],
    },
    {
      titleKey: "admin.cashRegister.repairs.title",
      icon: <Wrench className="h-5 w-5" />,
      figures: [
        {
          labelKey: "admin.cashRegister.repairs.count",
          value: String(data.repairs.count),
          drill: CashRegisterDrill.REPAIRS_PICKED_UP,
        },
        { labelKey: "admin.cashRegister.repairs.paid", value: money(data.repairs.paidAmount) },
        {
          labelKey: "admin.cashRegister.repairs.unpaid",
          value: money(data.repairs.unpaidAmount),
        },
        // P5 — "refunded repair amount (where any)".
        ...(data.repairs.refundCount > 0
          ? [
              {
                labelKey: "admin.cashRegister.repairs.refunded",
                value: t("admin.cashRegister.repairs.refundedValue", {
                  amount: money(data.repairs.refundedAmount),
                  count: data.repairs.refundCount,
                }),
                drill: CashRegisterDrill.REPAIR_REFUNDS,
              },
            ]
          : []),
      ],
    },
    {
      titleKey: "admin.cashRegister.orders.title",
      icon: <ShoppingCart className="h-5 w-5" />,
      figures: [
        {
          labelKey: "admin.cashRegister.orders.confirmed",
          value: String(data.orders.confirmedCount),
          drill: CashRegisterDrill.ORDERS_CONFIRMED,
        },
        {
          labelKey: "admin.cashRegister.orders.inDelivery",
          value: String(data.orders.inDeliveryCount),
          drill: CashRegisterDrill.ORDERS_IN_DELIVERY,
        },
        {
          labelKey: "admin.cashRegister.orders.completed",
          value: String(data.orders.completedCount),
          drill: CashRegisterDrill.ORDERS_COMPLETED,
        },
        {
          labelKey: "admin.cashRegister.orders.completedPaid",
          value: money(data.orders.completedPaid),
        },
      ],
    },
    {
      titleKey: "admin.cashRegister.suppliers.title",
      icon: <Truck className="h-5 w-5" />,
      figures: [
        {
          labelKey: "admin.cashRegister.suppliers.invoiceCount",
          value: String(data.suppliers.invoiceCount),
          drill: CashRegisterDrill.SUPPLIER_INVOICES,
        },
        {
          labelKey: "admin.cashRegister.suppliers.totalInvoiced",
          value: money(data.suppliers.totalInvoiced),
        },
        {
          labelKey: "admin.cashRegister.suppliers.paidOnInvoices",
          value: money(data.suppliers.paidOnInvoices),
          drill: CashRegisterDrill.SUPPLIER_PAYMENTS,
        },
        // Invoiced − ALL supplier payments of the day (invoice-linked here + on-account in
        // Payments). May be negative: more was paid to suppliers than invoiced that day.
        {
          labelKey: "admin.cashRegister.suppliers.newCredit",
          value: money(data.suppliers.newCredit),
        },
      ],
    },
    {
      titleKey: "admin.cashRegister.payments.title",
      icon: <Banknote className="h-5 w-5" />,
      figures: [
        {
          labelKey: "admin.cashRegister.payments.client",
          value: t("admin.cashRegister.amountWithCount", {
            amount: money(data.payments.clientTotal),
            count: data.payments.clientCount,
          }),
          drill: CashRegisterDrill.PAYMENTS_CLIENT,
        },
        {
          labelKey: "admin.cashRegister.payments.supplier",
          value: t("admin.cashRegister.amountWithCount", {
            amount: money(data.payments.supplierTotal),
            count: data.payments.supplierCount,
          }),
          drill: CashRegisterDrill.PAYMENTS_SUPPLIER,
        },
      ],
    },
  ];

  return (
    <>
      {sections.map((section) => (
        <CashRegisterSection
          key={section.titleKey}
          titleKey={section.titleKey}
          icon={section.icon}
          figures={section.figures}
          onDrill={onDrill}
        />
      ))}
      <CashMovementCard cash={data.cashMovement} />
    </>
  );
}
