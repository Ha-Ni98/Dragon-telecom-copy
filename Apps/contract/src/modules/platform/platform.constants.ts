// S38 — hero slider bounds. Stored slides are capped so the admin list stays bounded (1GB machine
// rule); the storefront shows at most HERO_SLIDES_PUBLIC_MAX live slides (the set's 3–5).
export const HERO_SLIDES_MAX = 20;
export const HERO_SLIDES_PUBLIC_MAX = 5;
export const HERO_SLIDE_TITLE_MAX = 80;
export const HERO_SLIDE_CTA_MAX = 30;
// S38 — storefront.metaDescription: what search engines show under the site name.
export const META_DESCRIPTION_MAX = 160;

// S38 — a slide link is an in-app path ("/register", "/products?familyId=…", never "//host")
// or an absolute http(s) URL. Anything else (javascript:, data:, protocol-relative) is refused.
export const isHeroSlideLink = (value: string): boolean =>
  (value.startsWith('/') && !value.startsWith('//')) || /^https?:\/\/[^\s]+$/.test(value);

// Sentinels travel as the error *message* (MEDIA_ERROR convention). Every one is also mapped in
// web's SENTINEL_TRANSLATION_KEYS (lib/query-client.ts).
export const HERO_SLIDE_ERROR = {
  /** Creating would exceed HERO_SLIDES_MAX. */
  LIMIT_REACHED: 'HERO_SLIDE_LIMIT_REACHED',
  /** An image key is not a hero-folder content-addressed key, or the object is not in R2. */
  INVALID_IMAGE: 'HERO_SLIDE_INVALID_IMAGE',
  /** A reorder list does not name every slide exactly once (the list changed underneath). */
  ORDER_MISMATCH: 'HERO_SLIDE_ORDER_MISMATCH',
} as const;
