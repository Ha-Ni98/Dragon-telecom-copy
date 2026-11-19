// S38 — the two content locales the storefront ships (Arabic is out of scope). Keys of
// locale-keyed CONTENT such as HeroSlide.text — not UI translation keys, which live in the web's
// translations.json.
export enum ContentLocale {
  FR = 'fr',
  EN = 'en',
}
export const CONTENT_LOCALES = [ContentLocale.FR, ContentLocale.EN] as const;
