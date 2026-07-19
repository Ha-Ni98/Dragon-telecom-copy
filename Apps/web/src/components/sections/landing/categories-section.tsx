import { Smartphone, Headphones, Watch, Battery, Cable, Shield } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";

const getCategoryData = (t: (key: string) => string) => [
  {
    id: 1,
    name: t('categories.smartphones'),
    icon: Smartphone,
    count: "150+ products",
    gradient: "from-primary to-primary-glow",
  },
  {
    id: 2,
    name: t('categories.accessories'),
    icon: Headphones,
    count: "80+ products",
    gradient: "from-accent to-primary",
  },
  {
    id: 3,
    name: t('categories.watches'),
    icon: Watch,
    count: "25+ products",
    gradient: "from-primary to-accent",
  },
  {
    id: 4,
    name: t('categories.batteries'),
    icon: Battery,
    count: "40+ products",
    gradient: "from-success to-accent",
  },
  {
    id: 5,
    name: t('categories.cables'),
    icon: Cable,
    count: "60+ products",
    gradient: "from-warning to-primary",
  },
  {
    id: 6,
    name: t('categories.protection'),
    icon: Shield,
    count: "35+ products",
    gradient: "from-accent to-success",
  },
];

export function CategoriesSection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <section className="py-8">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            {t('categories.title')}
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            {t('categories.description')}
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {getCategoryData(t).map((category) => {
            const IconComponent = category.icon;
            return (
              <Card 
                key={category.id} 
                className="group cursor-pointer product-card border-0 shadow-card hover:shadow-elegant"
                onClick={() => {
                  // Navigate to products page with category filter
                  const categoryMap: { [key: string]: string } = {
                    [t('categories.smartphones')]: 'Smartphones',
                    [t('categories.accessories')]: 'Accessories',
                    [t('categories.watches')]: 'Smartwatches',
                    [t('categories.batteries')]: 'Batteries',
                    [t('categories.cables')]: 'Cables',
                    [t('categories.protection')]: 'Protection'
                  };
                  const categoryName = categoryMap[category.name] || category.name;
                  navigate(`/products?category=${encodeURIComponent(1)}`);
                }}
              >
                <CardContent className="p-6 text-center">
                  <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br ${category.gradient} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                    <IconComponent className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="font-semibold text-sm md:text-base mb-2 group-hover:text-primary transition-colors">
                    {category.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {category.count}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
}