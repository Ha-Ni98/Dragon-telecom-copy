import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/hooks/useTranslation';
import { OrdersListSection } from '@/components/sections/orders/orders-list-section';
import { toast } from 'sonner';

// Route-level auth protection (ProtectedRoute/RoleGuard) is applied in App.tsx's router
// config in Sub-01 Sprint 3 — this page assumes it's already behind that guard.
const OrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  // Handle order cancellation
  const handleOrderCancelled = (orderId: number) => {
    toast.success(t('orders.orderCancelled'));
  };

  // Handle back navigation
  const handleBack = () => {
    navigate(-1);
  };

  return (
    <div className="min-h-screen">
      <main>
        {/* Page Header */}
        <section className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="container mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="flex items-center gap-2"
                  aria-label={t('common.back')}
                >
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  {t('common.back')}
                </Button>
                <div>
                  <h1 className="text-2xl font-bold">{t('orders.title')}</h1>
                  <p className="text-muted-foreground">{t('orders.description')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Main Content */}
        <section className="container mx-auto px-4 py-8">
          <OrdersListSection onOrderCancelled={handleOrderCancelled} />
        </section>
      </main>
    </div>
  );
};

export default OrdersPage;
