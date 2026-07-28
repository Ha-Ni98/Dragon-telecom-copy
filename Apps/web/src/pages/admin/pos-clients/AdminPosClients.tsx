import StaffPosClients from "@/pages/staff/pos-clients/StaffPosClients";

// S18/D-5 — same table/dialogs/drawer tree as the staff page, admin-scoped (adds the
// linked-account link). Mirrors AdminPos/AdminOrders/AdminSales/AdminInvoices/AdminRepairs.
export default function AdminPosClients() {
  return <StaffPosClients scope="admin" />;
}
