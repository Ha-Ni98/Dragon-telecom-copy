# Report S38 — Hero slider, storefront settings, footer & page metadata

Status: **executed, gates green, awaiting owner review.** Plan: `Docs/Stage-04-Fixes/plans/plan-S38-hero-slider-storefront-settings.md`.
Full stack: one new table (`HeroSlide`, one migration), contract, API, web. Nothing committed.

**Not verified by me:** every visual and browser behaviour. There is no browser here. The owner
checklist at the end is the only check of the UI. What I did verify is listed in §3.

---

## 1. What changed

### 1.1 Stage-00 (the reversal, §0.3 of the plan)

Stage-00 recorded the storefront footer as **front-end static**. S38 deliberately **reverses** that
at the owner's request ("one source of truth … change them without a deploy"). Amended:
- `database-description.md` §11: the Setting line, plus a new **HeroSlide** entity paragraph;
- `Pages-Requirements/PUB-01-home.md`: the hero and footer lines, and a `useHeroSlides()` data
  dependency;
- `Pages-Requirements/ADM-17-settings.md`: the Store and Storefront lines;
- `Module-Contracts/platform.md`: the routes table, `SettingsDto`, a new `HeroSlideDto`, and the
  `heroSlides.changed` event.

### 1.2 Schema and migration

`HeroSlide`: the schema's first `Json` column (`jsonb`). The migration `20261119130000_s38_hero_slides`
was generated with `migrate diff` from the **HEAD** schema to the new one (the S30 workaround for
non-interactive shells), and contains exactly this:

```sql
CREATE TABLE "HeroSlide" (
    "id" TEXT NOT NULL, "desktopImageUrl" TEXT NOT NULL, "desktopImageKey" TEXT NOT NULL,
    "mobileImageUrl" TEXT NOT NULL, "mobileImageKey" TEXT NOT NULL, "text" JSONB NOT NULL,
    "link" TEXT NOT NULL, "isActive" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3), "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "HeroSlide_pkey" PRIMARY KEY ("id"));
CREATE INDEX "HeroSlide_isActive_displayOrder_idx" ON "HeroSlide"("isActive", "displayOrder");
```

(Formatted onto fewer lines here; the file is the verbatim `prisma` output.) It was applied to the
**dev DB only**; the test DB was not migrated (the S30 precedent). No seed and no backfill.

### 1.3 Contract

- New `common/locale.ts` (`ContentLocale`) and `common/phone.ts`. The phone file carries the
  Algerian number rule moved from `web/lib/validation/phone.schema.ts`, plus `isDzPhone` and
  `toInternationalDzPhone`.
- `common/media.ts`:
  - `ImagePurpose` gained `HERO_DESKTOP`, `HERO_MOBILE` and `LINK_PREVIEW`;
  - new `IMAGE_HERO_DESKTOP_MAX_LONG_EDGE` (1920), `HERO_IMAGE_GUIDANCE` and `LINK_PREVIEW_IMAGE_GUIDANCE`.
- New `platform.constants.ts`:
  - `HERO_SLIDES_MAX` (20), `HERO_SLIDES_PUBLIC_MAX` (5);
  - the text limits, `META_DESCRIPTION_MAX`, `isHeroSlideLink`;
  - the `HERO_SLIDE_ERROR` sentinels.
- `platform.dtos.ts`:
  - `store` gained `whatsappPhone`, `email`, `facebookUrl`, `instagramUrl`, `tiktokUrl`;
  - `storefront` gained `repairToolsFamilyId`, `metaDescription`, `linkPreviewImageUrl`;
  - both are exposed on the public settings DTO too;
  - new `HeroSlideDto` and `PublicHeroSlideDto`.
- `platform.command.ts`: the new settings leaves, validated, and **`null` = clear**; new
  `CreateHeroSlideSchema`, `UpdateHeroSlideSchema` and `ReorderHeroSlidesSchema`.
- Routes (`HERO_SLIDES`, `ADMIN_HERO_SLIDES`, `ADMIN_HERO_SLIDES_ORDER`, `ADMIN_HERO_SLIDE_BY_ID`),
  the params schema and the `heroSlides.changed` event.

### 1.4 API

- `StorageService.urlFor(key)` (R2 implements it; `put()` now uses it).
- Image pipeline:
  - the three new purposes;
  - the desktop hero banner uses a **1920px cap** (F1), still inside the one pipeline;
  - encoders untouched.
- `PlatformService`:
  - `mergeDefined` accepts `null` (removes the key). Older commands never send `null`, so their
    behaviour is unchanged;
  - hero methods:
    - `listPublicHeroSlides` (active, inside the window, ≤ 5), `listAdminHeroSlides`;
    - `createHeroSlide`, `updateHeroSlide`, `deleteHeroSlide`, `reorderHeroSlides`;
  - image keys are accepted **only** if they match `hero/<sha256>.webp` and exist in storage;
    the URL is **derived server-side**;
  - R2 cleanup is reference-counted and runs **after** the DB write; a shared object is kept;
  - every mutation returns the full ordered list (≤ 20).
- Mapper (`toHeroSlideDto` / `toPublicHeroSlideDto`), controller, routes (`/order` is registered
  before `/:id`), interface, and the observability listener's `heroSlides.changed` audit handler.

### 1.5 Web

- **Data layer:**
  - `lib/contact-links.ts` (`telHref`, `whatsappHref`, `mailtoHref`);
  - `phoneField` now uses the contract's rule;
  - query keys, service functions and hooks (`usePublicHeroSlides`, `useAdminHeroSlides`, four
    mutations that seed the admin cache and invalidate the public one);
  - three sentinel translations;
  - `ImageUploadField`: `onUploaded` also receives the full result (key, dimensions), and a new
    optional `onPendingChange`.
- **Settings → Store:** WhatsApp, email and a "Social links" group. `toStorePatch` turns `""` into
  `null` for those five fields only.
- **Settings → Storefront:**
  - `HeroSlidesPanel`: list with status pills, up/down reorder, edit, delete with confirm, the
    empty-state example and the "more than 5 live" warning;
  - `HeroSlideDialog`: two uploads, a soft ratio warning, FR + EN text, link, active switch, and
    start/end days;
  - `hero-slide.schema.ts`: form schema and converters;
  - `StorefrontOptionsForm`: repair-tools family, site description with a counter, and the
    link-preview image. The image commits on upload.
- **Home:**
  - `HeroSlider` replaces `HeroSection`: `<picture>` art direction, Embla swipe, 5 s autoplay
    paused on hover/focus/hidden tab and off under reduced motion, highlight-token dots, and
    lazy loading;
  - `Index` wraps it in an `ErrorBoundary`;
  - no live slide renders nothing.
- **Footer:** rewritten from public settings. Each item shows only when set. Phones use the S26.1
  fallbacks (one "Phone" row when both resolve to the same number). The footer has `tel:`,
  `wa.me`, `mailto:` and social links, and new `TikTokIcon`. Twitter and YouTube are gone.
- **Head:**
  - `useDocumentMeta` (title, description, og:*, twitter:card) with the plan's fallbacks;
  - `index.html` has static French fallbacks plus `og:image = %VITE_SITE_URL%/og-default.jpg`;
  - `VITE_SITE_URL` was added to `.env.example` and the local `.env`;
  - `hero-phones.jpg` moved to `public/og-default.jpg`.
- **Logo:** the wordmark reads `store.name`, falling back to `common.brand.pageTitle` (P15).
- **Deleted:** `hero-section.tsx` and `assets/spar-parts.png`.

### 1.6 Translation keys

77 keys added (every entry `en`, `fr`, `"ar": ""`), plus a fix to `common.legal.copyright`'s `en`
value, which hardcoded "© 2026" while `fr` used `{year}`. The `hero.*` keys of the old hero are left
in the JSON (harmless, as with `header.menu` in S37).

**Reused instead of added:** `admin.settings.general.storeEmail`, `common.validation.invalidPhone`,
`common.validation.invalidEmail`, `common.validation.required`, `common.validation.maxLength`,
`admin.settings.saveSuccess`, `admin.settings.saveError`, `common.save`, `common.saving`,
`common.retry`, `common.actions.cancel`.

---

## 2. Findings and decisions as applied

- **F1–F8 and P1–P15** hold as written in the plan. Deviations from it:
  - **Lazy loading is stricter than the plan.** The plan rendered the neighbours of the current
    slide right after mount. That would have fired three image requests within milliseconds, so
    the checklist's "only one hero image loads at first" would have failed. Slide 1 now loads
    alone; the neighbours' `<img>`s are added only after slide 1 has loaded.
  - `ImageUploadField.previewAlt` (plan Action 5.6) was **not** added: nothing used it. The
    previews stay decorative (`alt=""`).
  - Added `ImageUploadField.onPendingChange`. The plan said "Save disabled while uploading", and
    the field did not expose that state.
  - The dialog resets its form every time it opens. The form lives above the Dialog's content, so
    without this, reopening "Add slide" after a save showed the previous slide's values.
  - A first draft of the pending-state callback would have looped (an inline callback in an effect
    dependency, with a state update that always created a new object). It was caught on re-read and
    fixed before the gates ran.
- **R2 was not reachable** from this environment, so no real upload was made. Storage calls were
  stubbed in §3's second smoke run.
- **Q1 limitation (as agreed):** the description and link-preview image are applied client-side.
  Browsers and Google follow Settings; WhatsApp and Facebook shares keep showing `index.html`'s
  static French tags and `og-default.jpg`. Making shares follow Settings needs server-side head
  injection, which is out of scope. If `VITE_SITE_URL` is unset, only that one `og:image` tag keeps
  the literal `%VITE_SITE_URL%`.

---

## 3. Verification I ran

| Check | Result |
|---|---|
| contract `tsc --noEmit` and eslint | clean |
| api `tsc --noEmit` | **0 errors in `src/`**; whole project **198** (the S36 baseline, unchanged) |
| api eslint on touched files | clean |
| web `tsc --noEmit` | clean |
| web `tsc -p tsconfig.test.json` | **53 errors**, identical to the S37 baseline (no test file touched or run) |
| web eslint, per file vs a stashed HEAD (`-f json`) | **no file above its HEAD count** (4 vs 9 on the same files; the 8 new files have 0). I ran `eslint --fix` only on files that were Prettier-clean at HEAD, and on the rewritten `PublicFooter`. |
| translation-key audit | every `t()` key in the touched files exists |
| production build, `VITE_SITE_URL=https://example.test` | builds; `index.html` has `og:image = https://example.test/og-default.jpg`; `og-default.jpg` is in the output |
| API smoke 1, real service against the dev DB | public list `[]`; set then `null`-clear on `store.email`/`whatsappPhone` and `storefront.metaDescription` leaves the other leaves and the featured arrays intact; the contract rejects bad WhatsApp, email, a `javascript:` URL, a 161-char description, bad links (`www.x.com`, `//evil`), and `endsOn < startsOn`; a `products/…` key and a `../hero/x.webp` key both give `HERO_SLIDE_INVALID_IMAGE` and write no row; a stale reorder gives `HERO_SLIDE_ORDER_MISMATCH` |
| API smoke 2, real service, **storage calls stubbed** | order and `displayOrder`; the URL is derived server-side; the public list hides inactive slides and follows reorder; schedule store-day math (`2099-01-10` is stored as `2099-01-09T23:00Z`, `endsAt` exclusive, and round-trips to `startsOn`/`endsOn`); future → not live and not public; ended → not live; `null` clears both bounds; a single bound earlier than the stored other is a 400; replacing an image deletes the old object and its `-thumb`; deleting a slide that shares an image with another **keeps** the shared object, and the last reference deletes it; the 21st slide gives `HERO_SLIDE_LIMIT_REACHED`; the public list caps at 5. Rows cleaned up afterwards. |
| Web logic smoke (`tsx`) | `tel:`/`wa.me` normalisation (`0555 12 34 56` → `+213555123456`; garbage → `null`); an empty contact form gives all-`null` and the contract accepts the patch; the form and contract reject the same bad inputs; hero converters send only changed fields (no-change → `{}`, cleared end → `{ endsOn: null }`) |

**NOT verified:** the UI itself (admin panels, dialog, slider behaviour, lazy loading, autoplay,
swipe, footer layout at 320px, both themes), a real R2 upload (including the actual pipeline
output for the two hero purposes), and the real HTTP routes with an admin session.

---

## 4. Manual verification checklist (owner, in the browser)

**Set-up:**
- `prisma migrate deploy` on the dev DB (already applied here).
- `VITE_SITE_URL` is in `Apps/web/.env`. Restart Vite.
- "Phone" means **375px and 320px** in DevTools. "Desktop" means **≥ 1280px**.
- Run each storefront section in **light and dark**.

### A. Admin — Store tab (desktop, then phone)
1. The Store tab shows the new fields:
   - WhatsApp number, Store Email;
   - a "Social links" group: Facebook, Instagram, TikTok, with the helper line.
2. Enter `0555 12 34 56` as WhatsApp, an email, and `https://facebook.com/dragontelecom`. Save: a
   success toast, and the values persist after a reload.
3. Validation, each error with an icon:
   - WhatsApp `12345` → "Invalid phone number";
   - email `abc` → invalid;
   - Facebook `javascript:alert(1)` or `facebook.com/x` (no https) → "Enter a full address
     starting with https://".
4. **Clear** the email and Instagram, then Save. After a reload they stay empty, and the footer
   (§D) no longer shows them.
5. At 375px the form fits with no horizontal scroll.

### B. Admin — Storefront tab: hero slides
1. With no slides, the panel shows the empty text and the suggested **professional-account**
   example (text only).
2. **Add slide:**
   - upload a wide desktop image and a square mobile image;
   - fill both titles, both button labels, and link `/register`;
   - leave it Active;
   - Save → the slide appears with a **green "Live"** pill.
3. Upload a **square** image as the desktop image. An amber **warning** with a triangle icon
   explains the crop, and saving still works.
4. Validation:
   - an empty FR title → error with icon;
   - link `www.site.com` → link error;
   - an end date before the start date → error on the end date;
   - saving without images → "Upload this image".
5. While an image is uploading, **Save is disabled**.
6. After saving a slide, press **Add slide** again: the form is **empty**, not the previous slide's
   values.
7. Add two more slides. **Up/Down** reorders them, and the order persists after a reload.
8. Set slide 2's start date to tomorrow → **"Scheduled"** (amber). Set slide 3 inactive →
   **"Inactive"** (grey). The pills are **never** scarlet (S37 §0.5).
9. Edit a slide: change only the English title and Save; the other fields are untouched. Replace
   one image; the old image no longer loads from its R2 URL (unless another slide uses it).
10. Delete a slide (confirm dialog) → it disappears, with a toast.
11. Make 6 slides live → the "{count} slides are live — only the first 5 …" warning shows.
12. **Admin → Activity logs:** `heroSlides.changed` entries narrate create, update, reorder and
    delete.
13. At 375px the rows stack (actions below the text), the dialog scrolls, and the two uploads
    stack.

### C. Admin — Storefront tab: home page and sharing
1. Repair tools family: choose a family, Save → it persists. Choose "None", Save → cleared.
2. Disable the chosen family (Hierarchy). Back on Storefront, the select shows "None" with the
   "disabled or no longer exists" helper.
3. Site description: the counter counts up to 160, typing stops at 160, Save persists.
4. Link-preview image: upload → saved at once, with a toast. The helper states that WhatsApp and
   Facebook keep the default image.
5. Featured products and families still save as before, and their Save does **not** wipe the
   repair-tools family or the description (check after a reload).

### D. Storefront — footer (both themes, phone and desktop)
1. The footer shows the **store name** from Settings next to the logo. Change the name in
   Settings: the header, footer and admin header follow after a reload.
2. The Contact column shows the address, then the phones:
   - with only `phone` set: **one** "Phone" row;
   - with repair and sales set to different numbers: "Repairs" and "Sales" rows.
3. Tapping a phone opens the dialer (`tel:+213…`). On desktop the link exists and is clickable.
4. **WhatsApp** opens `https://wa.me/213555123456` in a new tab, on phone and on desktop.
5. Email opens the mail client. The social icons appear **only** for the URLs that are set, and
   open in a new tab. There are no Twitter or YouTube icons.
6. With all contact fields empty, the footer shows no placeholder number or email, and no Contact
   column.
7. At 320px a long email or address wraps with no horizontal scroll (the S37 console one-liner
   prints `[]`). The rows are comfortable tap targets.

### E. Storefront — hero slider (both themes, phone and desktop)
1. Desktop: the hero shows the **desktop** image, is about half the viewport tall, and products or
   categories are visible below it without scrolling.
2. Phone: the **mobile** (square) image shows, the title sits at the bottom over the dark scrim,
   and the title is readable in both themes.
3. The title and button are **real text**: you can select them with the mouse, and FR/EN switching
   changes them.
4. Autoplay advances every **5 s**. Hovering (desktop) or focusing a dot pauses it. Switching tabs
   and coming back doesn't jump several slides.
5. Swipe left and right on touch (DevTools touch emulation). The arrows show on desktop only.
6. The dots: the active one is a **scarlet** (light) or **vermilion** (dark) pill, the others
   white. Clicking a dot goes to that slide.
7. **Lazy loading:** DevTools → Network → Img, reload `/`. Only **one** hero image (slide 1) loads
   at first. The next slides' images appear in the list only after slide 1 has loaded.
8. The button goes to its link: an internal link navigates in-app, an external one opens a new tab.
9. One live slide: no dots, no arrows, no autoplay.
10. No live slide (all inactive): the home page starts directly with the categories, with no empty
    band.
11. In OS settings, turn on **Reduce motion** and reload: no autoplay; swiping still works.
12. A scheduled slide (start tomorrow) does **not** appear today. An ended one does not appear.

### F. Document head
1. DevTools → Elements → `<head>`. `title` is the store name, and `meta[name=description]` is the
   site description from Settings. With it empty, it is the default sentence in the UI language.
   Switch FR/EN and the default follows.
2. `og:image` is the link-preview image. With none set it is the store logo; with neither, it is
   `…/og-default.jpg`.
3. **View page source** (Ctrl+U, the raw HTML): the static French description, and
   `og:image = <VITE_SITE_URL>/og-default.jpg`. That URL opens the image (the Q1 fallback).
4. The favicon is still the store logo.

### G. Regression
1. POS receipt, repair receipt and an invoice PDF still print the store name, address and phones
   as before.
2. The S37 header, category bar and bottom nav are unchanged. The bottom nav does not cover the
   footer's last line.
3. Brand logo and family icon uploads in Settings → Hierarchy still work (the shared upload field
   changed).
