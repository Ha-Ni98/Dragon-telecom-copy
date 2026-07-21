import StaffOrders from "@/pages/staff/orders/StaffOrders";

// ADM-09 — same stats/tabs/table/dialog tree as STF-04, admin-scoped (adds cancel/return and
// the live-availability re-check — gated on `scope` inside the shared components). Rewires
// off the Sub-01 stub (use-admin-orders.ts, numeric-id view-models) this sprint.
export default function AdminOrders() {
  return <StaffOrders scope="admin" />;
}
