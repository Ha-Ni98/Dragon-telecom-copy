import { Navigate, useLocation } from "react-router-dom";
import { OrderConfirmationBody } from "@/pages/order-confirmation/components/OrderConfirmationBody";
import { useSession } from "@/hooks/useSession";
import { UserType, type OrderDto } from "@dragon-telecom/contract";

// PUB-05 — state-driven, no fetch. `location.state` is cast the same lightweight way
// ProtectedRoute/PublicOnlyRoute already cast their own router state (no full Zod parse — this
// object was put here by our own navigate() call in the same session, not untrusted input).
export default function OrderConfirmation() {
  const location = useLocation();
  const { data: session } = useSession();
  const order = (location.state as { order?: OrderDto } | null)?.order;

  if (!order) return <Navigate to="/" replace />;

  return <OrderConfirmationBody order={order} isClient={session?.type === UserType.CLIENT} />;
}
