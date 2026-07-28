import type { StaffProductDto } from "@dragon-telecom/contract";

/** The POS price rule (STF-02): a category price when the attached client's category has one,
 *  the product's default sale price otherwise. Kept here rather than in either consumer so the
 *  ticket (StaffPos.tsx) and the search card (PosProductSearch.tsx) can never drift apart. */
export function resolvePosPrice(
  categoryPrices: { categoryId: string; price: number }[],
  defaultSalePrice: number,
  categoryId?: string,
): number {
  if (categoryId) {
    const match = categoryPrices.find((cp) => cp.categoryId === categoryId);
    if (match) return match.price;
  }
  return defaultSalePrice;
}

/** The four figures the POS card lists beneath a product (S6/I8): the default sale price plus one
 *  entry per client category that has its own price. Data-driven — a product priced for only two
 *  categories lists three figures, not four. */
export function posPriceBreakdown(product: StaffProductDto): { label: string; price: number }[] {
  return product.categoryPrices.map((cp) => ({ label: cp.categoryName, price: cp.price }));
}
