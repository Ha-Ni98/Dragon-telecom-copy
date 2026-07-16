import { PageHeader } from "@/components/shared/PageHeader";
import { useTranslation } from "@/hooks/useTranslation";
import { DeliveryCompaniesTab } from "./components/DeliveryCompaniesTab";

// Reference example page: a fully-wired admin CRUD screen (list + create/edit/toggle) built
// on the delivery-company module. Mirror this shape for new admin pages.
export default function DeliveryCompaniesPage() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("admin.deliveryCompanies.title")}
        subtitle={t("admin.deliveryCompanies.subtitle")}
      />
      <DeliveryCompaniesTab />
    </div>
  );
}
