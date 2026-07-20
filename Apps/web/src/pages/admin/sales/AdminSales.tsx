import StaffSales from "@/pages/staff/sales/StaffSales";

// ADM-10 — same table/detail-drawer tree as STF-05, admin-scoped (adds profit/seller columns,
// footer totals, and the return flow — gated on `scope` inside the shared components).
export default function AdminSales() {
  return <StaffSales scope="admin" />;
}
