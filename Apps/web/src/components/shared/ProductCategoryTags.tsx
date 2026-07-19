/**
 * ProductCategoryTags Component
 * Displays product categories as styled tags
 */

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

interface ProductCategoryTagsProps {
  categories: string[];
  className?: string;
  maxDisplay?: number;
  showIcon?: boolean;
  variant?: "default" | "secondary" | "outline" | "destructive";
  size?: "sm" | "default" | "lg";
}

export function ProductCategoryTags({ 
  categories, 
  className,
  maxDisplay = 3,
  showIcon = true,
  variant = "secondary",
  size = "default"
}: ProductCategoryTagsProps) {
  const { t } = useTranslation();
  // Don't render if no categories
  if (!categories || categories.length === 0) {
    return null;
  }

  // Limit displayed categories
  const displayCategories = categories.slice(0, maxDisplay);
  const remainingCount = categories.length - maxDisplay;

  const getSizeClasses = (size: string) => {
    switch (size) {
      case "sm":
        return "text-xs px-2 py-1";
      case "lg":
        return "text-sm px-3 py-1.5";
      default:
        return "text-sm px-2.5 py-1";
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {showIcon && (
        <div className="flex items-center text-muted-foreground">
          <Tag className="w-4 h-4 mr-1" />
          <span className="text-sm font-medium">{t("tags.categories")}</span>
        </div>
      )}
      
      {displayCategories.map((category, index) => (
        <Badge
          key={`${category}-${index}`}
          variant={variant}
          className={cn(
            "transition-colors hover:bg-primary/80 hover:text-primary-foreground",
            getSizeClasses(size)
          )}
          role="button"
          tabIndex={0}
          aria-label={t("tags.filterBy", { category })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              // TODO: Implement category filtering
              console.log(`Filter by category: ${category}`);
            }
          }}
        >
          {category}
        </Badge>
      ))}
      
      {remainingCount > 0 && (
        <Badge
          variant="outline"
          className={cn(
            "text-muted-foreground hover:text-foreground",
            getSizeClasses(size)
          )}
          role="button"
          tabIndex={0}
          aria-label={t("tags.showMore", { count: remainingCount })}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              // TODO: Implement show more categories
              console.log(`Show ${remainingCount} more categories`);
            }
          }}
        >
          +{remainingCount} more
        </Badge>
      )}
    </div>
  );
}

/**
 * Compact version for use in product cards
 */
export function ProductCategoryTagsCompact({ 
  categories, 
  className 
}: Pick<ProductCategoryTagsProps, 'categories' | 'className'>) {
  return (
    <ProductCategoryTags
      categories={categories}
      className={className}
      maxDisplay={2}
      showIcon={false}
      variant="outline"
      size="sm"
    />
  );
}

/**
 * Full version for product details page
 */
export function ProductCategoryTagsFull({ 
  categories, 
  className 
}: Pick<ProductCategoryTagsProps, 'categories' | 'className'>) {
  return (
    <ProductCategoryTags
      categories={categories}
      className={className}
      maxDisplay={5}
      showIcon={true}
      variant="secondary"
      size="default"
    />
  );
}
