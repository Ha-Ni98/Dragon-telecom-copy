import { Outlet } from "react-router-dom";
import { StaffHeader } from "@/components/layout/StaffHeader";
import { StaffSidebar } from "@/components/layout/StaffSidebar";

// Mirrors AdminLayout.tsx — the third shell (rules §6C: Public/Admin/Staff, never mixed). No
// `children` override prop like AdminLayout's — nothing outside the router mounts this
// directly (AdminLayout's override exists solely for CatchAllRoute, which picks between
// Admin/PublicLayout only; a 404 under /staff still renders inside AdminLayout's branch, same
// as before this set).
export function StaffLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <StaffHeader />
      <div className="mx-auto flex max-w-7xl">
        <StaffSidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
