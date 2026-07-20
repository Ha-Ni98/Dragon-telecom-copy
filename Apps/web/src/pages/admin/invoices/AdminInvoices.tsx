import StaffInvoices from "@/pages/staff/invoices/StaffInvoices";

// ADM-14 — three-tab admin view (Outgoing/Incoming/Payments) built on the same outgoing-
// invoices tree as STF-06, admin-scoped for the extra tabs and actions.
export default function AdminInvoices() {
  return <StaffInvoices scope="admin" />;
}
