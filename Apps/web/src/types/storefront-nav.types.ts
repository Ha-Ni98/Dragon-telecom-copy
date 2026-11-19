// S37 — router state the bottom nav's "Categories" item passes to /products. Kept out of the URL
// on purpose: the URL is the catalog's filter source of truth (Products.tsx), and "open the
// filter drawer" is a one-shot UI request, cleared as soon as Products reads it.
export interface CatalogLocationState {
  openFamilyFilter?: boolean;
}
