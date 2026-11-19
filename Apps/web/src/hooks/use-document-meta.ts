import { useEffect } from "react";
import { usePublicSettings } from "@/hooks/usePlatform";
import { useTranslation } from "@/hooks/useTranslation";
import { DEFAULT_SHARE_IMAGE_PATH } from "@/config/constants";

// Creates the tag on first use, then updates it in place — never duplicates index.html's static
// tag of the same name.
function upsertMeta(attr: "name" | "property", key: string, content: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attr, key);
    document.head.appendChild(tag);
  }
  tag.setAttribute("content", content);
}

const OG_LOCALE = { fr: "fr_FR", en: "en_US", ar: "ar_DZ" } as const;

// S38 — the document head from settings, CLIENT-SIDE (Q1). Browsers and Google read these.
// WhatsApp / Facebook scrapers do NOT run JavaScript: they keep reading index.html's static
// French tags and its fixed share image, so settings-driven share previews would need
// server-side head injection (out of scope — see report-S38). Fallbacks, in order:
//   title        store name        → common.brand.pageTitle
//   description  site description  → common.brand.metaDescription (UI language)
//   image        link-preview      → store logo → /og-default.jpg
export function useDocumentMeta(): void {
  const { t, language } = useTranslation();
  const { data: settings } = usePublicSettings();

  const title = settings?.store.name || t("common.brand.pageTitle");
  const description = settings?.storefront.metaDescription || t("common.brand.metaDescription");
  const image =
    settings?.storefront.linkPreviewImageUrl ||
    settings?.store.logoUrl ||
    `${window.location.origin}${DEFAULT_SHARE_IMAGE_PATH}`;

  useEffect(() => {
    document.title = title;
    upsertMeta("name", "description", description);
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", description);
    upsertMeta("property", "og:image", image);
    upsertMeta("property", "og:type", "website");
    upsertMeta("property", "og:locale", OG_LOCALE[language]);
    upsertMeta("name", "twitter:card", "summary_large_image");
  }, [title, description, image, language]);
}
