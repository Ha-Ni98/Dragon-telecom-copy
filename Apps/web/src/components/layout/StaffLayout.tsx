import { Outlet } from "react-router-dom";
import { StaffHeader } from "@/components/layout/StaffHeader";
import { StaffSidebar } from "@/components/layout/StaffSidebar";
import { ScrollToTop } from "@/components/layout/ScrollToTop";

// Mirrors AdminLayout.tsx — the third shell (rules §6C: Public/Admin/Staff, never mixed). No
// `children` override prop like AdminLayout's — nothing outside the router mounts this
// directly. CatchAllRoute (S2) no longer picks any layout at all — a 404 under /staff renders
// shell-less, like every other 404, not inside this shell.
export function StaffLayout() {
  return (
    <div className="min-h-screen bg-surface">
      <ScrollToTop />
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
