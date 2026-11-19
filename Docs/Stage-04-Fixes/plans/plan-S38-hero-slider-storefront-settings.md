# Plan S38 — Hero slider, storefront settings, footer & page metadata

Execution plan for **set 38** of `Docs/Stage-04-Fixes/sets-37-39.md`.

It spans the full stack:
- one new table, `HeroSlide`, with one migration;
- contract changes;
- API changes in the **platform** module and the shared image pipeline;
- web changes: the admin Settings tabs, the home hero, the footer, and the document head.

---

## §0 — Before you start

### 0.1 Sets that must already be landed

- **S37 is committed** (`b88f3f2`). S38 builds on these S37 pieces:
  - the `highlight` token, used for the slider dots;
  - `SectionTitle`;
  - `FieldError`;
  - the phone-layout breakpoint `md` (S37 P1), used for the hero's `<picture>` switch;
  - the restructured `PublicHeader` and `PublicLayout`;
  - `Logo`'s `textClassName` prop.
- **S39 depends on S38.** It reads `storefront.repairToolsFamilyId` from public settings. The S39
  tile work (light tiles behind the logos, upload guidance for logos and icons, product cards and
  home rows) is **not** part of S38. Do not restyle the logo, the tiles or `ProductCard` here.

### 0.2 Owner decisions taken while planning (settled, do not re-open)

| # | Question | Answer |
|---|---|---|
| Q1 | Link-preview scrapers (WhatsApp, Facebook) read the raw HTML and never run JavaScript. The web app is a static SPA, and the repo doesn't show how it is hosted. How should the link-preview setting work? | **Client-side, plus a static fallback.** At runtime, set `meta[name=description]`, the `og:*` and the `twitter:*` tags from settings (browser tabs, Google). `index.html` keeps static **French** tags with a **fixed default image**, so a shared link always shows a preview. Settings-driven share previews would need server-side head injection; **that is out of scope**, and the report says so. |
| Q2 | The footer has a hardcoded email and four social buttons that link nowhere. What happens to them? | **Add settings for them.** New optional `store` fields: `email`, `facebookUrl`, `instagramUrl`, `tiktokUrl`. Each one appears in the footer only when filled. **Twitter and YouTube are dropped.** |

### 0.3 Recorded decision this set reverses (say so in the report)

Stage-00 records the storefront footer as **front-end static**. It says so in three places:
- `database-description.md` §11, Setting: "store info (**invoice header only** — the storefront
  footer is front-end static)";
- `PUB-01-home.md`, the Footer line;
- `ADM-17-settings.md`, the Store line, plus `Module-Contracts/platform.md`'s `SettingsDto` comment.

**S38 deliberately reverses this**, at the owner's request (set 38: "one source of truth … change
them without a deploy"). The footer now reads the store's name, address, phones, WhatsApp, email
and social links from `GET /settings/public`. Action 1.1 amends all four Stage-00 documents.
Stage-00 is the source of truth, and it was amended the same way in S23.

### 0.4 Findings from reading the code (record them in the report)

- **F1 — the image pipeline caps every image at a 1600px long edge.** See `IMAGE_MAX_LONG_EDGE`
  and `image-pipeline.service.ts:85`. A 1920×600 desktop banner would be stored at 1600×500, then
  upscaled about 20% on a full-HD screen. Action 3.2 gives the two hero purposes their own cap
  **inside the same pipeline**, so there is still no second upload path.
- **F2 — the upload route returns `key` and `url` but writes no row** (S26.1). Today the caller
  PATCHes only a URL (`brand.logoUrl`, `store.logoUrl`), and the stored object is never cleaned up.
  - A slide must be able to **delete its R2 objects**, which needs the **keys**.
  - A key sent by the client is attacker-controlled: an admin token could ask the API to delete
    `products/<hash>.webp`.
  - So the hero service accepts **only keys that match the hero folder's content-addressed
    pattern and that exist in R2**, and it **derives the URL server-side** (Action 3.3).
- **F3 — a `PATCH /admin/settings` cannot clear a field today.** `mergeDefined` skips
  `undefined`, and the DTO fields are `.optional()`, so they reject `null`.
  - The new validated fields (email, URLs, WhatsApp, the family id, the link-preview image) must
    be clearable.
  - Action 3.4 makes `null` in a command mean "remove this key".
  - Existing commands never send `null`, so their behaviour is unchanged.
- **F4 — `ui/carousel.tsx` hardcodes English** (`sr-only` "Previous slide" / "Next slide",
  `aria-roledescription="carousel"`), and nothing uses it. The hero calls `useEmblaCarousel` from
  the already-installed `embla-carousel-react@8.6` directly, with every label through `t()`.
  `ui/carousel.tsx` is left as it is.
- **F5 — there is no autoplay plugin.** Only `embla-carousel-react` is installed. A 5-second
  interval calling `api.scrollNext()` is enough, so **no new dependency**.
- **F6 — `index.html` still says "Dragon Telecom — full-stack starter."** in its description and
  og tags. That is template residue, replaced in Action 6.12.
- **F7 — the Stage-00 "No localisation keys" rule is about `Setting` rows.** `HeroSlide.text` is
  per-locale **content**, which the set mandates. It is not a translation key. The Stage-00
  amendment states this, so the two don't read as a contradiction.
- **F8 — the hero copy keys and assets become dead.** Replacing the static `HeroSection` leaves
  the `hero.*` translation keys, `src/assets/hero-phones.jpg` and `src/assets/spar-parts.png` with
  no consumer. `hero-phones.jpg` is **moved** into `public/` as the static share image (Q1). The
  `hero.*` keys stay in the JSON: harmless, same S37 convention as `header.menu`.

### 0.5 Decisions this plan takes on its own (list them in the report)

| # | Decision | Why |
|---|---|---|
| P1 | **`HeroSlide` lives in the platform module.** Routes, service methods, mapper and events all sit next to settings. | Platform already owns settings, the storefront section and the media upload route. A slide is storefront configuration. |
| P2 | **The schedule is in store days, not datetimes.** The form takes `startsOn` / `endsOn` (`YYYY-MM-DD`, Africa/Algiers, `endsOn` inclusive). The columns store `startsAt` (that day's local midnight in UTC) and `endsAt` (**exclusive**: midnight after `endsOn`), both through the existing `storeDayRangeUtc`. | This matches every date filter in the app since S34. Campaigns run by the day. It avoids hand-converting a datetime-local input across time zones. |
| P3 | **Every slide has a button.** `link`, `text.fr.ctaLabel` and `text.en.ctaLabel` are all required. | "Title and button only." The slide is the call to action. |
| P4 | **`link` is either an internal path starting with `/` (not `//`), or an absolute `http(s)://` URL.** Internal links render as `<Link>`. External links render as `<a target="_blank" rel="noopener noreferrer">`. | Blocks `javascript:` and protocol-relative links, and keeps in-app links as SPA navigation. |
| P5 | **At most 20 slides stored (`HERO_SLIDES_MAX`). The public endpoint returns at most 5 live slides (`HERO_SLIDES_PUBLIC_MAX`), first by `displayOrder`.** The admin panel warns when more than 5 are live. | The set targets 3–5 on screen. Both lists stay bounded (the 1GB machine rule). 20 leaves room to prepare seasonal slides. |
| P6 | **No live slides means no hero section.** The home page then starts with the category row. | PUB-01's "an empty section hides itself" precedent. A fresh install has no slide images to show. |
| P7 | **The "repairer / professional account" slide is documented, not seeded.** The admin panel's empty state shows the suggested copy and the `/register` link, and the Stage-00 PUB-01 amendment records it. | The set says "seed or document … rather than hardcoding". Seeding would need images in R2 that don't exist, and the brief forbids data backfills. |
| P8 | **Every slide mutation returns the full ordered admin list** (`HeroSlideDto[]`, at most 20 rows). | The panel always re-renders the true order after create, edit, delete and reorder. Bounded by P5. |
| P9 | **Reorder is one endpoint** (`PUT /admin/hero-slides/order { ids }`). The list must name every slide exactly once, or the request fails with 409 `HERO_SLIDE_ORDER_MISMATCH`. The UI uses up/down buttons. | No drag-and-drop library is installed. One transaction rewrites `displayOrder = index`, and a stale list can't silently drop a slide. |
| P10 | **Image cleanup is reference-counted**, following `catalog.service.ts#deleteImage`. Keys are content-addressed, so two slides can share one object. Deleting a slide, or replacing one of its images, deletes the old object (and its `-thumb` derivative) **only if no other slide still references that key**. | The same reasoning as catalog's product images. |
| P11 | **Dots, autoplay and the arrows hide when only one slide is live.** Autoplay is off under `prefers-reduced-motion`, paused while the pointer or focus is inside the slider, and paused while the tab is hidden. | Accessibility, and no pointless motion. |
| P12 | **The meta description is one string, not per-locale.** It falls back to a translated default when empty. | French is the default locale and the indexing language. The owner maintains a single line. |
| P13 | **Store phones keep their S26.1 fallbacks in the footer.** Repairs uses `repairPhone ?? phone`; Sales uses `salesPhone ?? phone`; if the two resolve to the same number, it shows once, labelled "Phone". | S26.1 Q2: no surface loses a number when only `phone` is set. |
| P14 | **The WhatsApp number must be a valid Algerian number** (`DZ_PHONE_PATTERN`, moved into the contract). The other phones stay free text, as today. Links normalise to `+213…` for `tel:` and to digits for `wa.me`. | `wa.me` only accepts an international number. Only the new field gets validation; existing data isn't re-validated. |
| P15 | **The store-logo wordmark reads `store.name`.** The header, footer and admin header all show it, falling back to `common.brand.pageTitle`. The document `<title>` follows the same fallback. | One source of truth for the shop name. S37 left the wordmark hardcoded and flagged it for S38. |

### 0.6 Gates (no tests: do not edit or run any test file)

| Package | Command | Must stay |
|---|---|---|
| contract | `npx tsc --noEmit`, `npx eslint src` | clean |
| api | `npx tsc --noEmit` | **0 errors in `src/`**. Whole project: the S36 baseline of **198 errors in 29 files**, unchanged. |
| api | `npx eslint <touched files>` | no new errors (7 pre-existing elsewhere) |
| web | `npx tsc --noEmit` | clean |
| web | `npx tsc --noEmit -p tsconfig.test.json` | **53 errors**, compared **per file** |
| web | eslint on touched and created files | **no file above its HEAD count**. Compare with `eslint -f json` against `git stash`, exactly as in report-S37 §5. Run `eslint --fix` **only** on files that were Prettier-clean at HEAD. |

The migration (Action 2.2) is applied to the **dev** DB only, not the test DB (the S30 precedent).

---

## §1 — Stage-00 amendments (do first, so the code has a spec to point at)

### Action 1.1 — the four Stage-00 documents

1. **`Docs/Stage-00-Conception/database-description.md`, §11 System:**
   - In the **Setting** line, replace "store info (**invoice header only** — the storefront footer
     is front-end static)" with:
     > store info — the invoice/receipt header **and, since S38, the storefront footer** (name,
     > address, phones, WhatsApp, email, social links); the storefront section (featured
     > products/families, repair-tools family, meta description, link-preview image)
   - Keep the remainder of the line.
   - Add a new entity paragraph after **Setting**:
     > **HeroSlide** (S38) — the home-page slider, admin-managed: `desktopImageUrl` +
     > `desktopImageKey` · `mobileImageUrl` + `mobileImageKey` (two separate uploads, ~1920×600
     > and ~1080×1080) · `text` JSON keyed by content locale `{ fr: { title, ctaLabel }, en: {
     > title, ctaLabel } }` — real text rendered over the image, never baked in; this is slide
     > *content*, not a localisation key · `link` (internal path or http(s) URL) · `isActive` ·
     > `startsAt?` / `endsAt?` (store-day bounds, `endsAt` exclusive) · `displayOrder` ·
     > `createdAt` · `updatedAt`. Public = active, inside its window, by `displayOrder`, max 5.
2. **`Pages-Requirements/PUB-01-home.md`:**
   - Replace the `HeroSection` line with:
     > `HeroSlider` (S38): up to 5 live `HeroSlide`s from GET /api/hero-slides; ~45% of viewport
     > height; `<picture>` desktop/mobile art direction; 5 s autoplay (off under reduced motion),
     > swipe, highlight-token dots; every slide after the first lazy-loads. No live slide → no
     > hero. Suggested slide: "Vous êtes réparateur ?" → `/register` (professional pricing comes
     > from client categories; there is no separate account type).
   - Replace the Footer line with:
     > Footer (S38): store name, address, repair/sales phones (`tel:`), WhatsApp (`wa.me`),
     > email (`mailto:`) and Facebook/Instagram/TikTok links — all from GET /api/settings/public,
     > each shown only when set.
   - Add `useHeroSlides()` → `['platform','hero-slides','public']` under Data dependencies.
3. **`Pages-Requirements/ADM-17-settings.md`:**
   - Store line:
     > **Store**: name, activity line, address, phone, repair phone, sales phone, **WhatsApp**,
     > **email**, **Facebook / Instagram / TikTok URLs**, logo, print logo — feeds the invoice /
     > receipt header **and the storefront footer** (S38).
   - Storefront line:
     > **Storefront**: **hero slides** (create/edit/delete, both images, FR+EN title and button,
     > link, active, start/end day, reorder) · featured products picker · featured families ·
     > **repair-tools family** · **site description** · **link-preview image**.
4. **`Module-Contracts/platform.md`:**
   - **Routes table** — add these rows:
     - `PLATFORM_ROUTES.HERO_SLIDES` — GET `/api/hero-slides` — public — live slides, ≤ 5
     - `PLATFORM_ROUTES.ADMIN_HERO_SLIDES` — GET/POST `/api/admin/hero-slides` — admin
     - `PLATFORM_ROUTES.ADMIN_HERO_SLIDE_BY_ID` — PATCH/DELETE `/api/admin/hero-slides/:id` — admin
     - `PLATFORM_ROUTES.ADMIN_HERO_SLIDES_ORDER` — PUT `/api/admin/hero-slides/order` — admin
   - Change the `SETTINGS_PUBLIC` note to "store header + footer contact, storefront section".
   - **Code block:**
     - extend `SettingsDto` with the new `store` and `storefront` fields;
     - delete the "invoice header ONLY" comment;
     - add `HeroSlideDto`.
   - **Events:** add `heroSlides.changed { description }`.

---

## §2 — Schema and migration

### Action 2.1 — `Apps/api/prisma/schema.prisma`

Add after `model Setting`:

```prisma
// S38 — home-page hero slider (platform module). Images come from the shared pipeline
// (ImagePurpose.HERO_DESKTOP / HERO_MOBILE); the *Key columns let a delete clean R2 up, the
// *Url columns are derived server-side from the key (never taken from the client).
// `text` = HeroSlideTextSchema: { fr: { title, ctaLabel }, en: { title, ctaLabel } } — slide
// content per locale, rendered over the image. startsAt/endsAt are store-day bounds (endsAt
// exclusive), both null = always on while active.
model HeroSlide {
  id              String    @id @default(uuid())
  desktopImageUrl String
  desktopImageKey String
  mobileImageUrl  String
  mobileImageKey  String
  text            Json
  link            String
  isActive        Boolean   @default(true)
  startsAt        DateTime?
  endsAt          DateTime?
  displayOrder    Int       @default(0)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([isActive, displayOrder])
}
```

This is the schema's **first `Json` column**, which is Postgres `jsonb`.

### Action 2.2 — migration `Apps/api/prisma/migrations/20261119130000_s38_hero_slides/migration.sql`

`prisma migrate dev` refuses non-interactive shells (the S30 precedent). From `Apps/api`, with
`.env` exported:

```bash
mkdir -p prisma/migrations/20261119130000_s38_hero_slides
npx prisma migrate diff --from-schema-datasource prisma/schema.prisma \
  --to-schema-datamodel prisma/schema.prisma --script \
  > prisma/migrations/20261119130000_s38_hero_slides/migration.sql
npx prisma migrate deploy && npx prisma generate
```

- **Read the generated SQL before deploying.** It must contain only `CREATE TABLE "HeroSlide"`
  plus its index. If it contains anything else, the dev DB has drifted: stop and report it.
- **No seed and no backfill** (P7).

---

## §3 — Contract (`Apps/contract/src`)

### Action 3.1 — new `common/locale.ts` and `common/phone.ts`; export both from `index.ts`

```ts
// common/locale.ts
// S38 — the two content locales the storefront ships (Arabic is out of scope). Keys of
// locale-keyed CONTENT such as HeroSlide.text — not UI translation keys, which live in the web's
// translations.json.
export enum ContentLocale {
  FR = 'fr',
  EN = 'en',
}
export const CONTENT_LOCALES = [ContentLocale.FR, ContentLocale.EN] as const;
```

```ts
// common/phone.ts
// S38 — the one Algerian phone rule, moved here from web's phone.schema.ts (S15/R3) so the API
// validates the store's WhatsApp number with the same pattern the storefront forms use.
// Optional +213 / 00213 prefix or a leading 0, then 9 digits (first non-zero). Callers strip
// spaces, dots and dashes first (stripPhoneSeparators).
export const DZ_PHONE_PATTERN = /^(?:(?:\+|00)213|0)[1-9]\d{8}$/;

export const stripPhoneSeparators = (raw: string): string => raw.replace(/[\s.-]/g, '');

export const isDzPhone = (raw: string): boolean => DZ_PHONE_PATTERN.test(stripPhoneSeparators(raw));

// '+213XXXXXXXXX', or null when `raw` is not an Algerian number. Used for tel: and wa.me links.
export function toInternationalDzPhone(raw: string): string | null {
  const digits = stripPhoneSeparators(raw);
  if (!DZ_PHONE_PATTERN.test(digits)) return null;
  const national = digits.replace(/^(?:\+213|00213|0)/, '');
  return `+213${national}`;
}
```

Add `export * from './common/locale';` and `export * from './common/phone';` to `src/index.ts`,
after `store-time`.

### Action 3.2 — `common/media.ts`

1. Add to `ImagePurpose`:

   ```ts
   // S38 — hero slider banners (two uploads per slide) and the site's link-preview image.
   HERO_DESKTOP = 'HERO_DESKTOP',
   HERO_MOBILE = 'HERO_MOBILE',
   LINK_PREVIEW = 'LINK_PREVIEW',
   ```

2. Add constants after `IMAGE_THUMBNAIL_LONG_EDGE`:

   ```ts
   /** S38 — the desktop hero banner is the one image wider than IMAGE_MAX_LONG_EDGE: a 1920px
    *  screen would otherwise upscale a 1600px banner. Same WebP pipeline, larger cap. */
   export const IMAGE_HERO_DESKTOP_MAX_LONG_EDGE = 1920;
   /** S38 — upload guidance shown in the admin (not enforced; a mismatched ratio is cropped by
    *  object-cover and the admin sees a soft warning). */
   export const HERO_IMAGE_GUIDANCE = {
     desktop: { width: 1920, height: 600 },
     mobile: { width: 1080, height: 1080 },
   } as const;
   /** S38 — Open Graph's recommended share-image size. */
   export const LINK_PREVIEW_IMAGE_GUIDANCE = { width: 1200, height: 630 } as const;
   ```

### Action 3.3 — new `modules/platform/platform.constants.ts`; export it from `modules/platform/index.ts`

```ts
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
```

### Action 3.4 — `modules/platform/platform.dtos.ts`

1. **`SettingsResponseSchema.store`** — after `salesPhone`, add:

   ```ts
   // S38 — storefront footer contact (Q2). Validated on write (platform.command.ts); optional
   // here because rows written before S38 have none, and a cleared field is a removed key.
   whatsappPhone: z.string().optional(),
   email: z.string().optional(),
   facebookUrl: z.string().optional(),
   instagramUrl: z.string().optional(),
   tiktokUrl: z.string().optional(),
   ```

2. **`SettingsResponseSchema.storefront`** — after `featuredFamilyIds`, add:

   ```ts
   // S38 — the family feeding the home page's "Repair tools" row (S39). A stored id, not a
   // product flag; absent = the row hides.
   repairToolsFamilyId: z.uuid().optional(),
   metaDescription: z.string().optional(),
   linkPreviewImageUrl: z.string().optional(),
   ```

3. **`PublicSettingsResponseSchema`:**
   - add the same five `store` fields and the same three `storefront` fields;
   - rewrite the comment above it: the store header **and footer contact** are public (S38: the
     storefront footer reads them), and so is the storefront section; `invoicing` and `delivery`
     stay internal.
4. **Append the hero DTOs:**

   ```ts
   // S38 — one locale's slide copy. Shared by the DTOs and the commands.
   export const HeroSlideLocaleTextSchema = z.object({
     title: z.string().trim().min(1).max(HERO_SLIDE_TITLE_MAX),
     ctaLabel: z.string().trim().min(1).max(HERO_SLIDE_CTA_MAX),
   });
   export const HeroSlideTextSchema = z.object({
     [ContentLocale.FR]: HeroSlideLocaleTextSchema,
     [ContentLocale.EN]: HeroSlideLocaleTextSchema,
   });
   export type HeroSlideText = z.infer<typeof HeroSlideTextSchema>;

   // Admin view — everything the edit dialog needs. startsOn/endsOn are store-local days
   // (endsOn inclusive), converted back from the stored UTC bounds by the mapper.
   export const HeroSlideResponseSchema = z.object({
     id: z.uuid(),
     desktopImageUrl: z.string(),
     desktopImageKey: z.string(),
     mobileImageUrl: z.string(),
     mobileImageKey: z.string(),
     text: HeroSlideTextSchema,
     link: z.string(),
     isActive: z.boolean(),
     startsOn: z.iso.date().optional(),
     endsOn: z.iso.date().optional(),
     displayOrder: z.number().int().min(0),
     /** Server-computed: active AND inside its window right now. Drives the panel's badge. */
     isLive: z.boolean(),
   });
   export type HeroSlideDto = z.infer<typeof HeroSlideResponseSchema>;

   // Public view — only what the storefront renders. No keys, no schedule.
   export const PublicHeroSlideResponseSchema = z.object({
     id: z.uuid(),
     desktopImageUrl: z.string(),
     mobileImageUrl: z.string(),
     text: HeroSlideTextSchema,
     link: z.string(),
   });
   export type PublicHeroSlideDto = z.infer<typeof PublicHeroSlideResponseSchema>;
   ```

   Import `ContentLocale` from `../../common/locale`, and `HERO_SLIDE_TITLE_MAX` /
   `HERO_SLIDE_CTA_MAX` from `./platform.constants`.

### Action 3.5 — `modules/platform/platform.command.ts`

1. **`StoreSettingsInputSchema`** — add the fields below. **`null` = clear the field** (F3):

   ```ts
   whatsappPhone: z.string().refine(isDzPhone).nullable().optional(),
   email: z.email().nullable().optional(),
   facebookUrl: z.url({ protocol: /^https?$/ }).nullable().optional(),
   instagramUrl: z.url({ protocol: /^https?$/ }).nullable().optional(),
   tiktokUrl: z.url({ protocol: /^https?$/ }).nullable().optional(),
   ```

   `z.url({ protocol: /^https?$/ })` was verified during planning on the installed zod 4.4.3: it
   rejects `javascript:` and `ftp:`.

2. **`StorefrontSettingsInputSchema`** — add:

   ```ts
   repairToolsFamilyId: z.uuid().nullable().optional(),
   metaDescription: z.string().trim().max(META_DESCRIPTION_MAX).nullable().optional(),
   linkPreviewImageUrl: z.string().nullable().optional(),
   ```

3. Update the comment above `UpdateSettingsSchema`: "… a PATCH may touch just one leaf field.
   S38: a leaf sent as `null` is removed from the stored section (the only way to clear an
   optional field); `undefined` / absent leaves it untouched."
4. **Append the hero commands:**

   ```ts
   // S38 — images travel as the KEYS returned by POST /admin/media/images (purpose
   // HERO_DESKTOP / HERO_MOBILE). The API validates each key's folder + format and its existence
   // in R2, then derives the URL itself — a client-sent URL is never stored.
   const HeroSlideScheduleShape = {
     startsOn: z.iso.date().nullable().optional(),
     endsOn: z.iso.date().nullable().optional(),
   };
   const endsNotBeforeStarts = (v: { startsOn?: string | null; endsOn?: string | null }) =>
     v.startsOn == null || v.endsOn == null || v.endsOn >= v.startsOn;

   export const CreateHeroSlideSchema = z
     .object({
       desktopImageKey: z.string().min(1),
       mobileImageKey: z.string().min(1),
       text: HeroSlideTextSchema,
       link: z.string().trim().refine(isHeroSlideLink),
       isActive: z.boolean().optional(),
       ...HeroSlideScheduleShape,
     })
     .refine(endsNotBeforeStarts, { path: ['endsOn'] });
   export type CreateHeroSlideCommand = z.infer<typeof CreateHeroSlideSchema>;

   // Every field optional; schedule fields accept null (= remove that bound). The service
   // re-checks endsOn >= startsOn against the stored value when only one bound is sent.
   export const UpdateHeroSlideSchema = z
     .object({
       desktopImageKey: z.string().min(1).optional(),
       mobileImageKey: z.string().min(1).optional(),
       text: HeroSlideTextSchema.optional(),
       link: z.string().trim().refine(isHeroSlideLink).optional(),
       isActive: z.boolean().optional(),
       ...HeroSlideScheduleShape,
     })
     .refine(endsNotBeforeStarts, { path: ['endsOn'] });
   export type UpdateHeroSlideCommand = z.infer<typeof UpdateHeroSlideSchema>;

   export const ReorderHeroSlidesSchema = z.object({
     ids: z.array(z.uuid()).min(1).max(HERO_SLIDES_MAX),
   });
   export type ReorderHeroSlidesCommand = z.infer<typeof ReorderHeroSlidesSchema>;
   ```

   Import `isDzPhone` from `../../common/phone`, `HeroSlideTextSchema` from `./platform.dtos`,
   and the constants from `./platform.constants`.

### Action 3.6 — `platform.query.ts`, `platform.routes.ts`, `platform.events.ts`

- `platform.query.ts`: append
  `export const HeroSlideIdParamsSchema = z.object({ id: z.uuid() }); export type HeroSlideIdParams = z.infer<typeof HeroSlideIdParamsSchema>;`.
- `platform.routes.ts`: add these, with a one-line S38 comment:

  ```ts
  HERO_SLIDES: '/hero-slides',
  ADMIN_HERO_SLIDES: '/admin/hero-slides',
  ADMIN_HERO_SLIDES_ORDER: '/admin/hero-slides/order',
  ADMIN_HERO_SLIDE_BY_ID: '/admin/hero-slides/:id',
  ```

- `platform.events.ts`: add `'heroSlides.changed': { description: string };`.

**Then:** contract `npx tsc --noEmit` and lint, then rebuild the contract the way the other packages
consume it (`npm run build` in `Apps/contract`, if the api/web resolve `dist`). Check
`contract/package.json` and follow what S37/S36 did.

---

## §4 — API (`Apps/api/src`)

### Action 4.1 — `common/storage/storage.types.ts` and `r2.service.ts`

- In the `StorageService` interface, add:

  ```ts
  /** Public URL of a stored key — `${R2_PUBLIC_URL}/${key}`. S38: lets a caller that holds only
   *  a key (hero slides) derive the URL instead of trusting a client-sent one. */
  urlFor(key: string): string;
  ```

- `R2StorageService`: implement `urlFor(key) { return \`${env.R2_PUBLIC_URL}/${key}\`; }`, and make
  `put()` return `url: this.urlFor(input.key)`. No test fake implements `StorageService` (checked
  during planning).

### Action 4.2 — `common/media/image-pipeline.service.ts`

1. In `FOLDER`, add `HERO_DESKTOP: 'hero'`, `HERO_MOBILE: 'hero'`, `LINK_PREVIEW: 'settings'`.
2. Add a per-purpose long-edge map, and use it in the main resize (the thumbnail stays at
   `IMAGE_THUMBNAIL_LONG_EDGE`):

   ```ts
   // S38 — only the desktop hero banner exceeds the shared 1600px cap (F1).
   const MAX_LONG_EDGE: Partial<Record<ImagePurpose, number>> = {
     [ImagePurpose.HERO_DESKTOP]: IMAGE_HERO_DESKTOP_MAX_LONG_EDGE,
   };
   …
   const longEdge = MAX_LONG_EDGE[purpose] ?? IMAGE_MAX_LONG_EDGE;
   .resize({ width: longEdge, height: longEdge, fit: 'inside', withoutEnlargement: true })
   ```

3. Update the class header comment's purpose list ("product photos, brand logos, family icons,
   the store logo, the print logo, **hero banners, the link-preview image**").
4. **Do not change** the WebP or PNG encoders. S39 owns the alpha check.

### Action 4.3 — `modules/platform/platform.mapper.ts`

Add these two static methods, importing the hero schemas, `storeLocalDate` and the
`HeroSlide` Prisma type:

```ts
// S38 — startsAt/endsAt are stored as UTC instants of store-day bounds (endsAt exclusive); the
// admin form edits store-local days, endsOn inclusive — hence the 1 ms step back.
static toHeroSlideDto(slide: HeroSlide, now: Date): HeroSlideDto {
  const dto: HeroSlideDto = {
    id: slide.id,
    desktopImageUrl: slide.desktopImageUrl,
    desktopImageKey: slide.desktopImageKey,
    mobileImageUrl: slide.mobileImageUrl,
    mobileImageKey: slide.mobileImageKey,
    text: HeroSlideTextSchema.parse(slide.text),
    link: slide.link,
    isActive: slide.isActive,
    ...(slide.startsAt ? { startsOn: storeLocalDate(slide.startsAt) } : {}),
    ...(slide.endsAt ? { endsOn: storeLocalDate(new Date(slide.endsAt.getTime() - 1)) } : {}),
    displayOrder: slide.displayOrder,
    isLive:
      slide.isActive &&
      (slide.startsAt == null || slide.startsAt <= now) &&
      (slide.endsAt == null || slide.endsAt > now),
  };
  return HeroSlideResponseSchema.parse(dto);
}

static toPublicHeroSlideDto(slide: HeroSlide): PublicHeroSlideDto {
  return PublicHeroSlideResponseSchema.parse({
    id: slide.id,
    desktopImageUrl: slide.desktopImageUrl,
    mobileImageUrl: slide.mobileImageUrl,
    text: HeroSlideTextSchema.parse(slide.text),
    link: slide.link,
  });
}
```

`toSettingsDto` needs **no** change:
- `store` falls back as a whole section, and the new fields are optional;
- `storefront` already spreads its defaults field by field.

`toPublicSettingsDto` passes `store` and `storefront` through. Leave it as it is: the schema change
in Action 3.4 is what admits the new fields.

### Action 4.4 — `modules/platform/platform.service.ts`, settings clearing (F3)

1. Change `OptionalPatch<T>` to `{ [K in keyof T]?: T[K] | null | undefined }`, and in
   `mergeDefined`:

   ```ts
   const value = patch[key];
   if (value === null) delete (result as Record<keyof T, unknown>)[key]; // S38 — null = clear
   else if (value !== undefined) result[key] = value as T[keyof T];
   ```

   Update the comment above `mergeDefined` with one sentence about `null`.
2. `describeSettingsChange` needs nothing: a removed key diffs as `"x" → undefined`.
3. Settings stay unvalidated against the catalog. This mirrors `featuredFamilyIds`, which were
   never checked: S39 hides the row when the family is missing or disabled.

### Action 4.5 — `modules/platform/platform.service.ts`, hero slides

Add these methods to `PlatformService`, and their signatures to `IPlatformService`
(`platform.interface.ts`). Import `storageService`, the hero contract symbols, `storeDayRangeUtc`
and `HERO_SLIDE_ERROR`.

```ts
// S38 — every key the hero accepts is one the shared pipeline wrote into the hero folder:
// content-addressed `hero/<sha256>.webp` (image-pipeline.service.ts). Checked BEFORE any write,
// so a crafted key can neither be stored nor later fed to storage.delete (F2).
private static readonly HERO_KEY_PATTERN = /^hero\/[0-9a-f]{64}\.webp$/;

private async assertHeroImageKey(key: string): Promise<void> {
  if (!PlatformService.HERO_KEY_PATTERN.test(key) || !(await storageService.exists(key))) {
    throw new BadRequestError(HERO_SLIDE_ERROR.INVALID_IMAGE);
  }
}

// P2 — store-day bounds via the same helper every S34 date filter uses.
private static heroWindow(startsOn?: string | null, endsOn?: string | null) {
  const range = storeDayRangeUtc(startsOn ?? undefined, endsOn ?? undefined);
  return { startsAt: range.gte ?? null, endsAt: range.lt ?? null };
}

private async listHeroSlideRows() {
  return this.prisma.heroSlide.findMany({
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    take: HERO_SLIDES_MAX,
  });
}

async listAdminHeroSlides(): Promise<HeroSlideDto[]> {
  const now = new Date();
  return (await this.listHeroSlideRows()).map((s) => PlatformMapper.toHeroSlideDto(s, now));
}

async listPublicHeroSlides(): Promise<PublicHeroSlideDto[]> {
  const now = new Date();
  const rows = await this.prisma.heroSlide.findMany({
    where: {
      isActive: true,
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gt: now } }] }],
    },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
    take: HERO_SLIDES_PUBLIC_MAX,
  });
  return rows.map((s) => PlatformMapper.toPublicHeroSlideDto(s));
}
```

**`createHeroSlide(cmd)`:**
1. `count >= HERO_SLIDES_MAX` → `ConflictError(HERO_SLIDE_ERROR.LIMIT_REACHED)`.
2. Assert both keys.
3. `displayOrder` = (current max `displayOrder`) + 1, or 0 when there are no slides.
4. Create with `desktopImageUrl: storageService.urlFor(key)` (same for mobile),
   `text: cmd.text` (a `Prisma.InputJsonValue`), `isActive: cmd.isActive ?? true`, and
   `...heroWindow(cmd.startsOn, cmd.endsOn)`.
5. Emit `heroSlides.changed`: `Hero slide created: "<fr title>" → <link>`.
6. Return `listAdminHeroSlides()`.

**`updateHeroSlide(id, cmd)`:**
1. Not found → `NotFoundError('HeroSlide')`.
2. Assert any key that was sent.
3. **Schedule:** when only one bound is sent, combine it with the stored other bound (convert the
   stored bounds back with the mapper's logic). If `endsOn < startsOn` →
   `BadRequestError('endsOn must not be before startsOn')`.
   - `startsOn: null` clears `startsAt`; `endsOn: null` clears `endsAt`; an absent field leaves its
     column alone.
4. Update.
5. **After** the update, for each replaced key (the old key differs from the new one), run
   `releaseHeroImage(oldKey)`.
6. Emit `heroSlides.changed`, naming the fields changed.
7. Return the list.

**`deleteHeroSlide(id)`:**
1. Not found → `NotFoundError`.
2. Delete the row.
3. `releaseHeroImage(desktopKey)` and `releaseHeroImage(mobileKey)`.
4. Emit the event.
5. Return the list.

**`reorderHeroSlides(cmd)`:**
1. Load all ids.
2. If `cmd.ids` is not a permutation of them (same size, same set, no duplicates) →
   `ConflictError(HERO_SLIDE_ERROR.ORDER_MISMATCH)`.
3. `this.prisma.$transaction(cmd.ids.map((id, index) => this.prisma.heroSlide.update({ where: { id }, data: { displayOrder: index } })))`.
4. Emit the event ("Hero slides reordered").
5. Return the list.

```ts
// P10 — content-addressed keys can be shared by two slides (same file uploaded twice), so an
// object is deleted only once no slide references it in either column. Mirrors
// catalog.service.ts#deleteImage. The pipeline also wrote a `-thumb` derivative — remove it too.
private async releaseHeroImage(key: string): Promise<void> {
  const stillUsed = await this.prisma.heroSlide.count({
    where: { OR: [{ desktopImageKey: key }, { mobileImageKey: key }] },
  });
  if (stillUsed > 0) return;
  await storageService.deleteMany([key, key.replace(/\.webp$/, '-thumb.webp')]);
}
```

Every write that touches more than one row goes through `$transaction`. A storage delete always
happens **after** the DB write succeeds, so a failed delete leaves an orphan object, never a slide
pointing at a missing object.

### Action 4.6 — `platform.controller.ts` and `platform.routes.ts`

**Controller.** Add five thin handlers in the existing `try { sendSuccess(…) } catch { next }`
shape:
- `listPublicHeroSlides`;
- `listAdminHeroSlides`;
- `createHeroSlide` (201);
- `updateHeroSlide` (params `HeroSlideIdParams`);
- `deleteHeroSlide`;
- `reorderHeroSlides`.

No logic in the controller.

**Routes:**

```ts
router.get(PLATFORM_ROUTES.HERO_SLIDES, controller.listPublicHeroSlides);

router.get(PLATFORM_ROUTES.ADMIN_HERO_SLIDES, adminOnly, controller.listAdminHeroSlides);
router.post(PLATFORM_ROUTES.ADMIN_HERO_SLIDES, adminOnly,
  validateRequest({ body: CreateHeroSlideSchema }), controller.createHeroSlide);
// Registered before ADMIN_HERO_SLIDE_BY_ID: "/order" must never be read as an :id.
router.put(PLATFORM_ROUTES.ADMIN_HERO_SLIDES_ORDER, adminOnly,
  validateRequest({ body: ReorderHeroSlidesSchema }), controller.reorderHeroSlides);
router.patch(PLATFORM_ROUTES.ADMIN_HERO_SLIDE_BY_ID, adminOnly,
  validateRequest({ params: HeroSlideIdParamsSchema, body: UpdateHeroSlideSchema }), controller.updateHeroSlide);
router.delete(PLATFORM_ROUTES.ADMIN_HERO_SLIDE_BY_ID, adminOnly,
  validateRequest({ params: HeroSlideIdParamsSchema }), controller.deleteHeroSlide);
```

### Action 4.7 — `modules/observability/observability.listener.ts`

After the `deliveryFees.changed` handler, add the same shape:

```ts
eventBus.on('heroSlides.changed', (payload) =>
  this.handle('heroSlides.changed', payload, (p) => ({
    actionType: 'heroSlides.changed',
    entityType: 'HeroSlide',
    entityId: 'hero-slides',
    description: p.description,
  })),
);
```

`AuditLog.actionType` is an open string, so no schema change is needed.

**Check.** Run api `npx tsc --noEmit` (0 in `src/`) and lint the touched files. Then a **smoke run**
against the dev API:
- `GET /api/v1/hero-slides` returns `[]`;
- `PATCH /admin/settings` with `{ store: { email: null } }` on an unset field returns 200;
- a `POST /admin/hero-slides` with `desktopImageKey: "products/x.webp"` returns 400
  `HERO_SLIDE_INVALID_IMAGE`.

If R2 is reachable in this environment, also upload two images with the hero purposes, then
create, reorder and delete a slide. Record what ran.

---

## §5 — Web data layer (`Apps/web/src`)

### Action 5.1 — `lib/validation/phone.schema.ts`

Replace the local `DZ_PHONE` regex with `isDzPhone` from the contract:
`.refine(isDzPhone, t("common.validation.invalidPhone"))`. Update the comment ("the rule now lives
in `@dragon-telecom/contract` common/phone.ts, S38"). The behaviour is identical.

### Action 5.2 — create `lib/contact-links.ts`

```ts
import { stripPhoneSeparators, toInternationalDzPhone } from "@dragon-telecom/contract";

// S38 — tappable contact links (footer). tel: prefers the +213 form; a free-text number that is
// not Algerian (store phones are not validated) still dials with its separators removed.
export const telHref = (raw: string): string =>
  `tel:${toInternationalDzPhone(raw) ?? stripPhoneSeparators(raw)}`;

// wa.me needs the international number, digits only. null when the number is not Algerian
// (the admin form validates WhatsApp, so this only guards legacy/hand-edited data).
export const whatsappHref = (raw: string): string | null => {
  const international = toInternationalDzPhone(raw);
  return international ? `https://wa.me/${international.slice(1)}` : null;
};

export const mailtoHref = (email: string): string => `mailto:${email}`;
```

### Action 5.3 — query keys and services

- `lib/query-keys.ts`, under `platform`, add:

  ```ts
  heroSlides: {
    all: () => ["platform", "hero-slides"] as const,
    public: () => ["platform", "hero-slides", "public"] as const,
    admin: () => ["platform", "hero-slides", "admin"] as const,
  },
  ```

- `services/platform.service.ts`: add `listPublicHeroSlides`, `listAdminHeroSlides`,
  `createHeroSlide(cmd)`, `updateHeroSlide(id, cmd)`, `deleteHeroSlide(id)` and
  `reorderHeroSlides(cmd)`.
  - Use the same `ApiResponse` / defensive-throw shape as the file's other functions.
  - `withParams(apiPath(PLATFORM_ROUTES.ADMIN_HERO_SLIDE_BY_ID), { id })` builds the `:id` routes.
  - Every admin mutation returns `HeroSlideDto[]`.

### Action 5.4 — `hooks/usePlatform.ts`

```ts
export function usePublicHeroSlides() {
  return useQuery({
    queryKey: qk.platform.heroSlides.public(),
    queryFn: platformService.listPublicHeroSlides,
    staleTime: 5 * 60_000,
  });
}

export function useAdminHeroSlides() {
  return useQuery({ queryKey: qk.platform.heroSlides.admin(), queryFn: platformService.listAdminHeroSlides });
}
```

- Add four mutations (`useCreateHeroSlide`, `useUpdateHeroSlide`, `useDeleteHeroSlide`,
  `useReorderHeroSlides`).
- Each one `onSuccess`:
  - `queryClient.setQueryData(qk.platform.heroSlides.admin(), data)`;
  - `queryClient.invalidateQueries({ queryKey: qk.platform.heroSlides.public() })`.
- `useUpdatePlatformSettings` already invalidates `publicSettings`, so the footer and metadata
  refresh without changes.

### Action 5.5 — `lib/query-client.ts`

Import `HERO_SLIDE_ERROR` and add three rows to `SENTINEL_TRANSLATION_KEYS`, with the S38 comment:
- `common.errors.sentinel.heroSlideLimitReached`
- `common.errors.sentinel.heroSlideInvalidImage`
- `common.errors.sentinel.heroSlideOrderMismatch`

### Action 5.6 — `components/shared/image-upload-field.tsx`

- Widen the callback to `onUploaded: (url: string, image: MediaImageDto) => void`, and call it
  as `onUploaded(result.url, result)`. The existing callers ignore the second argument, so they
  are unchanged.
- Add an optional `previewAlt?: string`. The preview `<img alt>` currently is `""`; keep `""` when
  `previewAlt` is absent.
- Update the header comment: the store-logo, print-logo, brand-logo and family-icon callers are
  joined by the hero and link-preview uploads (S38), which need the returned `key` and the
  dimensions.

---

## §6 — Web UI

### Action 6.1 — `pages/admin/settings/components/store-settings.schema.ts`

1. Add these fields, each allowing an **empty string** in the form:

   ```ts
   whatsappPhone: z.string().trim().refine((v) => v === "" || isDzPhone(v), t("common.validation.invalidPhone")),
   email: z.union([z.literal(""), z.email(t("common.validation.invalidEmail"))]),
   facebookUrl: httpsUrlField(t),
   instagramUrl: httpsUrlField(t),
   tiktokUrl: httpsUrlField(t),
   ```

   where `httpsUrlField(t) = z.union([z.literal(""), z.url({ protocol: /^https?$/, error: t("common.validation.invalidUrl") })])`.
   Use `.trim()` before the union if the resolver allows it; otherwise trim in `toStorePatch`.
2. Export `toStorePatch(values)`. It maps `""` → `null` for the five new fields only, and passes
   the old six through unchanged (an empty old field keeps being stored as `""`, as today). It
   returns `NonNullable<UpdateSettingsCommand["store"]>`.
3. **Remove** the `AssertAssignable` guard, or retarget it at `ReturnType<typeof toStorePatch>`:
   form values now carry `""`, which the command rejects for email and URLs. Update the comment to
   match.

### Action 6.2 — `pages/admin/settings/components/store-settings-form.tsx`

1. Seed `values` with `""` for the five new fields, mapping a missing setting to `""`.
2. After `salesPhone`, add `whatsappPhone`, with helper text.
3. Add `email`, using the existing label key `admin.settings.general.storeEmail`.
4. Add a **"Social links"** sub-heading (`<h3 className="pt-2 text-sm font-semibold">`), then the
   three URL inputs (`type="url"`, `inputMode="url"`, placeholder `https://`), with one shared
   helper line under the group.
5. `onSubmit` → `onSave(toStorePatch(values))`.

**`AdminSettings.tsx`:** `handleSaveStore` takes the patch type instead of the form values.

### Action 6.3 — create `pages/admin/settings/components/hero-slide.schema.ts`

The RHF schema, built with `t`:
- `desktopImageKey` / `mobileImageKey`: non-empty → `…hero.validation.imageRequired`;
- `desktopImageUrl` / `mobileImageUrl`: preview only, not submitted;
- `titleFr`, `titleEn`: `trim().min(1, required).max(HERO_SLIDE_TITLE_MAX, maxLength)`;
- `ctaFr`, `ctaEn`: the same rule, with `HERO_SLIDE_CTA_MAX`;
- `link`: `refine(isHeroSlideLink, …hero.validation.linkInvalid)`;
- `isActive`: boolean;
- `startsOn`, `endsOn`: `""` or `YYYY-MM-DD`;
- a `.refine` that requires `endsOn >= startsOn` when both are set, with
  `path: ["endsOn"]` and the message `…hero.validation.endBeforeStart`.

Export:
- `toCreateHeroSlideCommand(values)`, which maps the `text` object
  (`{ [ContentLocale.FR]: { title, ctaLabel }, [ContentLocale.EN]: … }`) and turns `""` dates into
  absent fields;
- `toUpdateHeroSlideCommand(values, initial)`, which sends only the changed fields, and `null`
  for a date cleared from a previously set value;
- `heroSlideToFormValues(dto)`.

### Action 6.4 — create `pages/admin/settings/components/hero-slide-dialog.tsx`

A `Dialog` (`max-w-2xl`, scrollable), with the title `…hero.dialog.createTitle` or
`…hero.dialog.editTitle`. It takes the props `slide?`, `open`, `onOpenChange`, `onSubmit` and
`isSaving`. It holds a dumb RHF form; the hooks live in the panel.

**Images.** Two `ImageUploadField`s, side by side on `sm+` and stacked on phones:
- **Desktop:** purpose `HERO_DESKTOP`, preview class `h-20 w-64`. Hint `…hero.desktopImageHelp`
  with `{ width: 1920, height: 600, max }` from `HERO_IMAGE_GUIDANCE` and
  `IMAGE_MAX_UPLOAD_BYTES / MiB`.
- **Mobile:** purpose `HERO_MOBILE`, preview `h-24 w-24`. Hint `…hero.mobileImageHelp`.
- `onUploaded(url, image)` sets the key and URL in the form.
- **Soft ratio warning**, never blocking. It shows when `image.width / image.height` is outside
  2.6–3.8 for desktop, or outside 0.85–1.18 for mobile. Render it as
  `<p className="flex items-start gap-1.5 text-xs text-warning-foreground"><AlertTriangle …/>…</p>`
  using `…hero.ratioWarning`, interpolated with `{ width, height, targetWidth, targetHeight }`.
  It is a warning, not an error, so it uses the warning glyph (S37 F8 convention).

**Text fields:**
- a two-column grid on `sm+`: Titre (FR) | Title (EN), and Bouton (FR) | Button (EN);
- `link`, with helper text;
- the `isActive` `Switch`;
- two `type="date"` inputs (start, end), with the schedule helper.

**Errors** use `FormMessage` (it carries the icon since S37).

**Footer:** Cancel (outline) and Save (primary). Save is disabled while saving or uploading.

### Action 6.5 — create `pages/admin/settings/components/hero-slides-panel.tsx`

This is a `Card` with `CardHeader`: `SectionTitle as="h2"` "Hero slider", the description, and an
"Add slide" button (`Plus`). The button is disabled at `HERO_SLIDES_MAX` slides, with a tooltip-free
helper line `…hero.limitReached` underneath.

**Data:** `useAdminHeroSlides`, plus the four mutations.

**States:**
- **Loading:** `TableSkeleton rows={3} columns={1}`.
- **Error:** `NotFoundState` with a retry action (the same shape the tab uses for settings).
- **Empty:** a muted box with `…hero.empty`, followed by the **suggested example** (P7). It is a
  `<div className="rounded-md border border-dashed p-3 text-sm">` holding
  `…hero.exampleTitle` and `…hero.exampleBody`. It is text only: no button that creates data.

**Each row** (`ul`, each `li` a flex row, `min-w-0` on the text column):
- the mobile image preview, `h-14 w-14 rounded object-cover`, `alt=""`;
- the current-language title, plus the link in `text-xs text-muted-foreground truncate`;
- a status `StatusBadge`-style pill. These are **semantic statuses**, never `highlight` (S37 §0.5):

  | Status | When | Class |
  |---|---|---|
  | **Live** | `isLive` | `bg-success/15 text-success` |
  | **Scheduled** | active, with `startsOn` in the future | `bg-warning/15 text-warning-foreground` |
  | **Ended** | active, with `endsOn` in the past | `bg-muted text-muted-foreground` |
  | **Inactive** | `!isActive` | `bg-muted text-muted-foreground` |

  Use the existing `StatusBadge` component if its API fits; read
  `components/shared/StatusBadge.tsx` first.
- the schedule as `formatAdminDate`-style text when it is set;
- icon buttons: Up, Down (disabled at the ends; they call reorder with the swapped id list), Edit
  (opens the dialog) and Delete (an `AlertDialog` confirm, `…hero.deleteConfirm.*`).
  - Every icon button gets an `aria-label` through `t()`.

**Live warning:** when more than `HERO_SLIDES_PUBLIC_MAX` slides are live, show an inline
`AlertTriangle` warning `…hero.tooManyLive` above the list.

**Toasts:** `…hero.saveSuccess` and `…hero.deleteSuccess`. Reorder has no toast, because the list
visibly moves. Errors go through the global sentinel toast (Action 5.5).

### Action 6.6 — create `pages/admin/settings/components/storefront-options-form.tsx`

This is a `Card` with `SectionTitle` "Home page & sharing", holding an RHF form over:
- **`repairToolsFamilyId`:**
  - a shadcn `Select` over the **enabled** families (`families.filter(f => f.isEnabled)`, passed
    in by `AdminSettings` from its existing `families` query), plus a "None" item;
  - "None" uses a sentinel value constant `NO_FAMILY = "__none__"`, local to the file, the same
    pattern as `ProductFilters`' `ALL`;
  - if the stored id isn't among the enabled families (it was disabled or deleted), show it as
    "None" with the helper `…options.repairToolsFamilyMissing`.
- **`metaDescription`:** a `Textarea`, `maxLength={META_DESCRIPTION_MAX}`, with a live counter
  `{count}/{max}` in the helper.
- **Save** → `{ storefront: { repairToolsFamilyId: value === NO_FAMILY ? null : value, metaDescription: trimmed || null } }`.

**Beside the form** sits the `ImageUploadField` for the **link-preview image** (purpose
`LINK_PREVIEW`, preview `h-20 w-40`).
- It commits immediately: `{ storefront: { linkPreviewImageUrl: url } }`. This is the S26.1 logo
  rule — two writers for one field would race, so the text form never carries it.
- Hint `…options.linkPreviewImageHelp`, interpolated with `LINK_PREVIEW_IMAGE_GUIDANCE`, plus the
  **Q1 note** `…options.linkPreviewShareNote`: shares on WhatsApp and Facebook keep the default
  image until server-side previews exist.

### Action 6.7 — `pages/admin/settings/AdminSettings.tsx`, Storefront tab

The tab content becomes, in order:
1. `<HeroSlidesPanel />`;
2. the existing featured-products/families block, wrapped in a `Card` with a
   `SectionTitle` reusing `admin.settings.storefront.title`;
3. `<StorefrontOptionsForm …>`, plus the link-preview upload.

**Handlers:** add `handleSaveStorefrontOptions(patch)` and `handleSaveLinkPreviewImage(url)`,
both through `updateSettings.mutate` with the existing `saveSuccess` toast.

**Untouched:** `handleSaveStorefront`. It still sends only the two id arrays, and `mergeDefined`
keeps the other storefront fields.

**Comment:** extend the file's header comment with one S38 paragraph listing what the Storefront
tab now holds and why the link-preview image commits on its own.

### Action 6.8 — create `components/sections/landing/hero-slider.tsx`; delete `hero-section.tsx`

Uses `usePublicHeroSlides()`, `useEmblaCarousel` (direct, F4) and `useTranslation()`.

**Constants** (`config/constants.ts`, S38 comments):
- `HERO_AUTOPLAY_MS = 5000`;
- `HERO_SWITCH_MEDIA = "(min-width: 768px)"`, which is S37 P1's `md`. A comment ties it to
  Tailwind's `md`.

**Render rules:**
- **Loading:** a `Skeleton` with the hero's own height classes (below), so the page doesn't jump.
- **Error, or zero slides:** `return null` (P6). It is fail-quiet: the `ErrorBoundary` around it
  in `Index` stays.
- **Text** for the UI language:
  `slide.text[language === "en" ? ContentLocale.EN : ContentLocale.FR]`, using `ContentLocale`
  and not a string literal.

**Structure:**

```tsx
<section
  aria-roledescription={t("home.hero.roleDescription")}
  aria-label={t("home.hero.label")}
  className="relative w-full overflow-hidden bg-muted"
  onMouseEnter={pause} onMouseLeave={resume} onFocusCapture={pause} onBlurCapture={resume}
>
  <div ref={emblaRef} className="overflow-hidden">
    <div className="flex">
      {slides.map((slide, index) => (
        <div key={slide.id} role="group" aria-roledescription={t("home.hero.slide")}
             aria-label={t("home.hero.slideOf", { n: index + 1, total: slides.length })}
             className="relative min-w-0 shrink-0 grow-0 basis-full h-[45svh] min-h-[16rem] max-h-[40rem]">
          {shouldRender(index) && (
            <picture>
              <source media={HERO_SWITCH_MEDIA} srcSet={slide.desktopImageUrl} />
              <img src={slide.mobileImageUrl} alt="" /* decorative: the title is real text */
                   className="absolute inset-0 h-full w-full object-cover"
                   loading={index === 0 ? "eager" : "lazy"}
                   fetchPriority={index === 0 ? "high" : "auto"} decoding="async" />
            </picture>
          )}
          {/* scrim — keeps white text readable over any photo, in both themes */}
          <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent md:bg-gradient-to-r md:from-black/65 md:via-black/30" />
          <div className="relative mx-auto flex h-full max-w-6xl flex-col justify-end gap-4 px-4 pb-12 md:justify-center md:pb-0">
            <h2 className="max-w-xl text-2xl font-bold leading-tight text-white [overflow-wrap:anywhere] sm:text-3xl md:text-5xl">{text.title}</h2>
            <div><Button asChild size="lg">{internal ? <Link to={slide.link}>{text.ctaLabel}</Link>
              : <a href={slide.link} target="_blank" rel="noopener noreferrer">{text.ctaLabel}</a>}</Button></div>
          </div>
        </div>
      ))}
    </div>
  </div>
  {slides.length > 1 && (/* arrows md+ and dots, below */)}
</section>
```

**Lazy loading (the set's rule):**
- `shouldRender(index)` is true for slide 0, for the selected slide, and for the slides next to
  it (selected ± 1, wrapping, because `loop: true`).
- Keep a `Set<number>` of indices already rendered, so an image never unmounts once loaded.
- So the first paint requests **only slide 1's image**. The others load only as they come close.

**Embla:**
- `useEmblaCarousel({ loop: slides.length > 1, align: "start" })`;
- `api.on("select", …)` tracks `selectedIndex`; clean up with `api.off` on unmount;
- swipe is Embla's default drag.

**Autoplay (P11):**
- a `useEffect` with `setInterval(() => api?.scrollNext(), HERO_AUTOPLAY_MS)`;
- it runs only when: `api` exists, `slides.length > 1`, not paused, `!document.hidden` (listen to
  `visibilitychange`), and `!window.matchMedia("(prefers-reduced-motion: reduce)").matches`;
- a manual dot or arrow click restarts the interval: make the effect depend on `selectedIndex`.

**Dots** (`absolute bottom-4 inset-x-0 flex justify-center gap-2`):
- one `<button type="button">` per slide, with `aria-label={t("home.hero.goToSlide", { n })}` and
  `aria-current={selected ? "true" : undefined}`;
- **active:** `h-2 w-6 rounded-full bg-highlight`;
- **inactive:** `h-2 w-2 rounded-full bg-white/70 hover:bg-white`.

  The dots sit on the scrimmed image in both themes. `bg-highlight` is a fill without text, so no
  foreground token is needed.

**Arrows** (`hidden md:flex`):
- two round `Button variant="secondary" size="icon"` at `left-4` / `right-4`, vertically centred;
- `aria-label` keys `home.hero.previous` / `home.hero.next`;
- icons `ChevronLeft` / `ChevronRight`.

**CTA:** stays the **blue primary** button. The accent is never used on a primary button
(S37 §0.5).

**Height:** `h-[45svh] min-h-[16rem] max-h-[40rem]` is the set's "40–50% of viewport height, so
products are visible on the first screen". Put this in the file's header comment.

**Then:**
- `pages/Index.tsx`: replace the `HeroSection` import and use with `HeroSlider`, wrapped in
  `<ErrorBoundary>`, which the old hero lacked.
- Delete `components/sections/landing/hero-section.tsx`.
- Delete `src/assets/spar-parts.png`.
- **Move** `src/assets/hero-phones.jpg` → `Apps/web/public/og-default.jpg` (`git mv`). The
  `public/` directory is new: Vite serves it at `/`.
- Grep that nothing else imports either asset.

### Action 6.9 — `components/shared/Logo.tsx` (P15)

- The wordmark text becomes `settings?.store.name || t("common.brand.pageTitle")`, via
  `useTranslation`.
- The logo `<img alt>` stays `settings?.store.name ?? ""`.
- **Do not** add a tile or background. That is S39.
- Update the file's top comment.

### Action 6.10 — rewrite `components/layout/PublicFooter.tsx`

Read `usePublicSettings()` and compute `store`. A loading or error state renders **every
settings-driven item absent**, so the footer never shows placeholder contact details.

**Column 1:**
- `<Logo size={32} />`;
- `footer.description`;
- the **social links**, rendered only for each of `facebookUrl` / `instagramUrl` / `tiktokUrl`
  that is set:
  - each is `<a href target="_blank" rel="noopener noreferrer" aria-label={t("footer.social.<network>")}>`
    styled like the old outline icon buttons (`Button variant="outline" size="icon" asChild className="h-8 w-8"`);
  - `Facebook` and `Instagram` icons come from lucide (already imported);
  - TikTok has no lucide icon: create `components/shared/icons/TikTokIcon.tsx`, a single-path
    inline SVG (`viewBox="0 0 24 24"`, `fill="currentColor"`, `aria-hidden`, `className` prop);
  - **delete** the Twitter and YouTube buttons and their imports (Q2).

**Column 2:** quick links, unchanged.

**Column 3**, "Contact", rendering each row only when its value exists:
- **Address:** `MapPin` and the text.
- **Phones (P13):** `repair = store.repairPhone || store.phone` and
  `sales = store.salesPhone || store.phone`.
  - If `repair && repair === sales`, render one row labelled `footer.phone`.
  - Otherwise render a `footer.repairPhone` row for `repair` and a `footer.salesPhone` row for
    `sales`, each when set.
  - Each row is `<a href={telHref(n)}>`, `Phone` icon, with "Label · number".
- **WhatsApp:** `whatsappHref(store.whatsappPhone)`.
  - When non-null: `<a href target="_blank" rel="noopener noreferrer">`, `MessageCircle` icon,
    "WhatsApp · number".
  - When null, render nothing.
- **Email:** `<a href={mailtoHref(email)}>`, `Mail` icon.

**Links:**
- Every link has `min-h-11 py-1 inline-flex items-center` (a 44px tap target) and
  `break-words [overflow-wrap:anywhere]` on the text: a long email must not overflow at 320px
  (S37 rule).
- **Both** `tel:` and `wa.me` links stay active on desktop: the set says "tappable on mobile and
  desktop alike". Desktop handles `tel:` through the OS dialer or app, and `wa.me` through
  WhatsApp Web.

**Copyright:** replace the hardcoded year logic only if it duplicates `common.legal.copyright`.
Keep the key, and pass `store.name` if the key interpolates a name; read its value first. Its
`en` copy hardcodes "© 2026 Dragon Telecom" while `fr` interpolates `{year}`. Fix the **`en`
value** to `© {year} Dragon Telecom. All rights reserved.` so the two locales agree, and note it
in the report.

**Header comment:** S38 — reads settings (reversing the Stage-00 "footer is front-end static"
decision, see §0.3); each item renders only when set; links are `tel:` / `wa.me` / `mailto:`.

### Action 6.11 — create `hooks/use-document-meta.ts`, and use it in `App.tsx`

```ts
// S38 — the document head from settings, client-side (Q1). Browsers and Google read these;
// WhatsApp/Facebook scrapers do NOT run JS and keep reading index.html's static tags — settings-
// driven share previews would need server-side head injection (out of scope, report-S38).
export function useDocumentMeta(): void
```

**Reads:** `usePublicSettings()` and `useTranslation()`.

**Computes:**

| Value | Source, in fallback order |
|---|---|
| `title` | `store.name` → `t("common.brand.pageTitle")` |
| `description` | `storefront.metaDescription` → `t("common.brand.metaDescription")` (new key) |
| `image` | `storefront.linkPreviewImageUrl` → `store.logoUrl` → `` `${window.location.origin}/og-default.jpg` `` |

**Effect:** depends on those three values and `language`. It:
- sets `document.title`;
- upserts `meta[name="description"]`;
- upserts `meta[property="og:title"]`, `og:description`, `og:image`, `og:type=website` and
  `og:locale` (`fr_FR` or `en_US` from the language);
- upserts `meta[name="twitter:card"]=summary_large_image`.

Use one local `upsertMeta(attr: "name" | "property", key, content)` helper. It finds the tag, or
creates it and appends it to `document.head`.

**`App.tsx`:**
- delete the `document.title` effect and call `useDocumentMeta()` instead;
- keep the favicon effect.

### Action 6.12 — `Apps/web/index.html` and `.env.example`

Replace the four template meta tags with static **French** fallbacks (Q1):

```html
<title>Dragon Telecom</title>
<meta name="description" content="Pièces détachées et accessoires pour smartphones — écrans, batteries, connecteurs de charge. Livraison en Algérie et service de réparation." />
<meta property="og:title" content="Dragon Telecom" />
<meta property="og:description" content="Pièces détachées et accessoires pour smartphones — écrans, batteries, connecteurs de charge. Livraison en Algérie et service de réparation." />
<meta property="og:type" content="website" />
<meta property="og:locale" content="fr_FR" />
<!-- S38 — scrapers need an absolute URL and never run JS; VITE_SITE_URL is the web origin. -->
<meta property="og:image" content="%VITE_SITE_URL%/og-default.jpg" />
<meta name="twitter:card" content="summary_large_image" />
```

- The `fr` value of `common.brand.metaDescription` must be **this same sentence**.
- **`Apps/web/.env.example`:** append

  ```
  # S38 — public origin of the web app, no trailing slash. Only index.html's static og:image
  # uses it (link-preview scrapers need an absolute URL). Example: https://dragontelecom.dz
  VITE_SITE_URL=http://localhost:5173
  ```

- Add the same line to the developer's local `Apps/web/.env` (gitignored).
- If `VITE_SITE_URL` is unset, Vite 5 leaves the literal `%VITE_SITE_URL%`. Only share previews
  are affected; note this in the report.

---

## §7 — Translation keys (`Apps/web/src/config/translations.json`)

Every entry is `{ "en", "fr", "ar": "" }`. **Grep first and reuse an existing key with the same
meaning**; list each reuse in the report. Keys already reused by this plan:
- `admin.settings.general.storeEmail`
- `common.validation.invalidPhone`
- `common.validation.invalidEmail`
- `common.validation.required`
- `common.validation.maxLength`
- `admin.settings.saveSuccess`
- `common.save`, `common.cancel`, `common.saving`

| Key | en | fr |
|---|---|---|
| `common.brand.metaDescription` | Phone spare parts and accessories — screens, batteries, charging connectors. Delivery across Algeria and a repair service. | Pièces détachées et accessoires pour smartphones — écrans, batteries, connecteurs de charge. Livraison en Algérie et service de réparation. |
| `common.validation.invalidUrl` | Enter a full address starting with https:// | Saisissez une adresse complète commençant par https:// |
| `common.errors.sentinel.heroSlideLimitReached` | You already have the maximum of 20 slides. Delete one to add another. | Vous avez déjà le maximum de 20 diapositives. Supprimez-en une pour en ajouter une autre. |
| `common.errors.sentinel.heroSlideInvalidImage` | A slide image is missing or invalid. Upload it again. | Une image de la diapositive est manquante ou invalide. Téléversez-la à nouveau. |
| `common.errors.sentinel.heroSlideOrderMismatch` | The slide list changed in the meantime. Reload the page and try again. | La liste des diapositives a changé entre-temps. Rechargez la page et réessayez. |
| `admin.settings.general.whatsappPhone` | WhatsApp number | Numéro WhatsApp |
| `admin.settings.general.whatsappPhoneHelp` | Algerian mobile number. Opens a WhatsApp chat from the storefront footer. | Numéro mobile algérien. Ouvre une discussion WhatsApp depuis le pied de page de la boutique. |
| `admin.settings.general.socialLinks` | Social links | Réseaux sociaux |
| `admin.settings.general.facebookUrl` | Facebook page | Page Facebook |
| `admin.settings.general.instagramUrl` | Instagram | Instagram |
| `admin.settings.general.tiktokUrl` | TikTok | TikTok |
| `admin.settings.general.socialLinksHelp` | Full https:// address. Each link appears in the storefront footer only when filled. | Adresse complète en https://. Chaque lien n'apparaît dans le pied de page que s'il est renseigné. |
| `admin.settings.storefront.hero.title` | Hero slider | Bannière d'accueil |
| `admin.settings.storefront.hero.description` | Slides at the top of the home page, in this order. At most 5 live slides are shown. | Diapositives en haut de la page d'accueil, dans cet ordre. 5 diapositives actives au maximum sont affichées. |
| `admin.settings.storefront.hero.add` | Add slide | Ajouter une diapositive |
| `admin.settings.storefront.hero.limitReached` | Maximum of 20 slides reached. | Maximum de 20 diapositives atteint. |
| `admin.settings.storefront.hero.empty` | No slide yet. Until one is live, the home page starts with the categories. | Aucune diapositive. Tant qu'aucune n'est active, la page d'accueil commence par les catégories. |
| `admin.settings.storefront.hero.exampleTitle` | Suggested slide: the professional account | Diapositive suggérée : le compte professionnel |
| `admin.settings.storefront.hero.exampleBody` | Title "Vous êtes réparateur ? Profitez des prix pro" / "Are you a repairer? Get trade prices", button "Créer un compte" / "Create an account", link /register. | Titre « Vous êtes réparateur ? Profitez des prix pro » / « Are you a repairer? Get trade prices », bouton « Créer un compte » / « Create an account », lien /register. |
| `admin.settings.storefront.hero.tooManyLive` | {count} slides are live — only the first 5 are shown on the home page. | {count} diapositives sont actives — seules les 5 premières sont affichées sur la page d'accueil. |
| `admin.settings.storefront.hero.status.live` | Live | En ligne |
| `admin.settings.storefront.hero.status.scheduled` | Scheduled | Programmée |
| `admin.settings.storefront.hero.status.ended` | Ended | Terminée |
| `admin.settings.storefront.hero.status.inactive` | Inactive | Inactive |
| `admin.settings.storefront.hero.moveUp` | Move up | Monter |
| `admin.settings.storefront.hero.moveDown` | Move down | Descendre |
| `admin.settings.storefront.hero.edit` | Edit slide | Modifier la diapositive |
| `admin.settings.storefront.hero.delete` | Delete slide | Supprimer la diapositive |
| `admin.settings.storefront.hero.deleteConfirm.title` | Delete this slide? | Supprimer cette diapositive ? |
| `admin.settings.storefront.hero.deleteConfirm.body` | Its images are deleted too. This cannot be undone. | Ses images sont supprimées aussi. Cette action est irréversible. |
| `admin.settings.storefront.hero.saveSuccess` | Slide saved | Diapositive enregistrée |
| `admin.settings.storefront.hero.deleteSuccess` | Slide deleted | Diapositive supprimée |
| `admin.settings.storefront.hero.dialog.createTitle` | New slide | Nouvelle diapositive |
| `admin.settings.storefront.hero.dialog.editTitle` | Edit slide | Modifier la diapositive |
| `admin.settings.storefront.hero.desktopImage` | Desktop image | Image ordinateur |
| `admin.settings.storefront.hero.desktopImageHelp` | Wide banner, {width} × {height} px. JPEG, PNG, WebP or HEIC, under {max} MB. Keep the left side calm: the title sits there. | Bannière large, {width} × {height} px. JPEG, PNG, WebP ou HEIC, moins de {max} Mo. Gardez le côté gauche épuré : le titre s'y affiche. |
| `admin.settings.storefront.hero.mobileImage` | Mobile image | Image mobile |
| `admin.settings.storefront.hero.mobileImageHelp` | Square, {width} × {height} px. JPEG, PNG, WebP or HEIC, under {max} MB. Keep the bottom calm: the title sits there. | Carrée, {width} × {height} px. JPEG, PNG, WebP ou HEIC, moins de {max} Mo. Gardez le bas épuré : le titre s'y affiche. |
| `admin.settings.storefront.hero.ratioWarning` | This image is {width} × {height} px; {targetWidth} × {targetHeight} is expected. It will be cropped to fit. | Cette image fait {width} × {height} px ; {targetWidth} × {targetHeight} est attendu. Elle sera recadrée. |
| `admin.settings.storefront.hero.titleFr` | Title (French) | Titre (français) |
| `admin.settings.storefront.hero.titleEn` | Title (English) | Titre (anglais) |
| `admin.settings.storefront.hero.ctaFr` | Button label (French) | Texte du bouton (français) |
| `admin.settings.storefront.hero.ctaEn` | Button label (English) | Texte du bouton (anglais) |
| `admin.settings.storefront.hero.link` | Button link | Lien du bouton |
| `admin.settings.storefront.hero.linkHelp` | A page of this site starting with / (e.g. /register or /products?familyId=…), or a full https:// address. | Une page du site commençant par / (ex. /register ou /products?familyId=…), ou une adresse complète en https://. |
| `admin.settings.storefront.hero.isActive` | Active | Active |
| `admin.settings.storefront.hero.startsOn` | Start date | Date de début |
| `admin.settings.storefront.hero.endsOn` | End date (inclusive) | Date de fin (incluse) |
| `admin.settings.storefront.hero.scheduleHelp` | Optional, store days (Algiers time). Leave empty to show the slide as long as it is active. | Facultatif, jours du magasin (heure d'Alger). Laissez vide pour afficher la diapositive tant qu'elle est active. |
| `admin.settings.storefront.hero.validation.imageRequired` | Upload this image | Téléversez cette image |
| `admin.settings.storefront.hero.validation.linkInvalid` | Start with / for a page of this site, or with https:// | Commencez par / pour une page du site, ou par https:// |
| `admin.settings.storefront.hero.validation.endBeforeStart` | The end date must be on or after the start date | La date de fin doit être égale ou postérieure à la date de début |
| `admin.settings.storefront.options.title` | Home page & sharing | Page d'accueil et partage |
| `admin.settings.storefront.options.repairToolsFamily` | Repair tools family | Famille « Outils de réparation » |
| `admin.settings.storefront.options.repairToolsFamilyHelp` | Its products fill the "Repair tools" row on the home page. | Ses produits remplissent la rangée « Outils de réparation » de la page d'accueil. |
| `admin.settings.storefront.options.repairToolsFamilyMissing` | The family chosen earlier is disabled or no longer exists — the row is hidden until you pick another. | La famille choisie précédemment est désactivée ou n'existe plus — la rangée est masquée jusqu'à un nouveau choix. |
| `admin.settings.storefront.options.none` | None | Aucune |
| `admin.settings.storefront.options.metaDescription` | Site description | Description du site |
| `admin.settings.storefront.options.metaDescriptionHelp` | Shown by search engines under the site name. {count}/{max} characters. Empty = the default description. | Affichée par les moteurs de recherche sous le nom du site. {count}/{max} caractères. Vide = description par défaut. |
| `admin.settings.storefront.options.linkPreviewImage` | Link-preview image | Image d'aperçu des liens |
| `admin.settings.storefront.options.linkPreviewImageHelp` | {width} × {height} px. Empty = the store logo. | {width} × {height} px. Vide = le logo du magasin. |
| `admin.settings.storefront.options.linkPreviewShareNote` | Browsers and search engines use it right away. WhatsApp and Facebook shares keep showing the default image for now. | Les navigateurs et moteurs de recherche l'utilisent immédiatement. Les partages WhatsApp et Facebook affichent encore l'image par défaut pour l'instant. |
| `home.hero.label` | Highlights | À la une |
| `home.hero.roleDescription` | carousel | carrousel |
| `home.hero.slide` | slide | diapositive |
| `home.hero.slideOf` | {n} of {total} | {n} sur {total} |
| `home.hero.goToSlide` | Go to slide {n} | Aller à la diapositive {n} |
| `home.hero.previous` | Previous slide | Diapositive précédente |
| `home.hero.next` | Next slide | Diapositive suivante |
| `footer.phone` | Phone | Téléphone |
| `footer.repairPhone` | Repairs | Réparations |
| `footer.salesPhone` | Sales | Ventes |
| `footer.whatsapp` | WhatsApp | WhatsApp |
| `footer.emailLabel` | Email | E-mail |
| `footer.social.facebook` | Facebook (opens in a new tab) | Facebook (s'ouvre dans un nouvel onglet) |
| `footer.social.instagram` | Instagram (opens in a new tab) | Instagram (s'ouvre dans un nouvel onglet) |
| `footer.social.tiktok` | TikTok (opens in a new tab) | TikTok (s'ouvre dans un nouvel onglet) |

**`common.legal.copyright`:** set its `en` to `© {year} Dragon Telecom. All rights reserved.`
(Action 6.10).

---

## §8 — Files touched (summary for the report)

**Docs:**
- `Docs/Stage-00-Conception/database-description.md`
- `Pages-Requirements/PUB-01-home.md`
- `Pages-Requirements/ADM-17-settings.md`
- `Module-Contracts/platform.md`

**Prisma:** `schema.prisma`, plus migration `20261119130000_s38_hero_slides`.

**Contract:**
- new `common/locale.ts`, `common/phone.ts`, `modules/platform/platform.constants.ts`;
- edited `index.ts`, `common/media.ts`, and `platform.{dtos,command,query,routes,events}.ts`,
  plus the platform `index.ts`.

**API:**
- `common/storage/{storage.types,r2.service}.ts`
- `common/media/image-pipeline.service.ts`
- `modules/platform/{platform.mapper,platform.service,platform.interface,platform.controller,platform.routes}.ts`
- `modules/observability/observability.listener.ts`

**Web, new:**
- `lib/contact-links.ts`
- `hooks/use-document-meta.ts`
- `components/sections/landing/hero-slider.tsx`
- `components/shared/icons/TikTokIcon.tsx`
- `pages/admin/settings/components/{hero-slide.schema.ts, hero-slide-dialog.tsx, hero-slides-panel.tsx, storefront-options-form.tsx}`
- `public/og-default.jpg` (moved)

**Web, edited:**
- `index.html`, `.env.example`, `App.tsx`
- `config/constants.ts`, `config/translations.json`
- `lib/query-keys.ts`, `lib/query-client.ts`, `lib/validation/phone.schema.ts`
- `services/platform.service.ts`, `hooks/usePlatform.ts`
- `components/shared/{image-upload-field,Logo}.tsx`
- `components/layout/PublicFooter.tsx`
- `pages/Index.tsx`
- `pages/admin/settings/AdminSettings.tsx`
- `pages/admin/settings/components/{store-settings.schema.ts, store-settings-form.tsx}`

**Web, deleted:**
- `components/sections/landing/hero-section.tsx`
- `src/assets/spar-parts.png`
- `src/assets/hero-phones.jpg` (moved to `public/og-default.jpg`)

---

## §9 — Manual verification checklist (owner, in the browser)

**Set-up:**
- Run `prisma migrate deploy` on the dev DB.
- Set `VITE_SITE_URL` in `Apps/web/.env`, then restart Vite.
- "Phone" means **375px and 320px** in DevTools. "Desktop" means **≥ 1280px**.
- Run each storefront section in **light and dark**.

### A. Admin — Store tab (desktop, then phone)
1. The Store tab shows the new fields:
   - WhatsApp number, Store Email;
   - a "Social links" group: Facebook, Instagram, TikTok, with the helper line.
2. Enter `0555 12 34 56` as WhatsApp, an email, and `https://facebook.com/dragontelecom`. Save:
   a success toast, and the values persist after a reload.
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
   - Save → the slide appears with a **green "Live"** badge.
3. Upload a **square** image as the desktop image. An amber **warning** with a triangle icon
   explains the crop, and saving still works.
4. Validation:
   - an empty FR title → error with icon;
   - link `www.site.com` → link error;
   - an end date before the start date → error on the end date;
   - saving without images → "Upload this image".
5. Add two more slides. **Up/Down** reorders them, and the order persists after a reload.
6. Set slide 2's start date to tomorrow → **"Scheduled"** (amber). Set slide 3 inactive →
   **"Inactive"** (grey). Status badges are **never** scarlet (S37 §0.5).
7. Delete a slide (confirm dialog) → it disappears, with a toast.
8. Make 6 slides live → the "{count} slides are live — only the first 5 …" warning shows.
9. **Admin → Activity logs:** `heroSlides.changed` entries narrate create, update, reorder and
   delete.
10. At 375px the panel rows don't overflow, the dialog scrolls, and the images stack.

### C. Admin — Storefront tab: home page and sharing
1. Repair tools family: choose a family, then Save → it persists. Choose "None", then Save →
   cleared.
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
3. Tapping a phone opens the dialer (`tel:+213…`). On desktop, the link exists and is clickable.
4. **WhatsApp** opens `https://wa.me/213555123456` in a new tab, on phone and on desktop.
5. Email opens the mail client. The social icons appear **only** for the URLs that are set, and
   open in a new tab. There are no Twitter or YouTube icons.
6. With all contact fields empty, the footer shows no placeholder number or email.
7. At 320px, a long email or address wraps with no horizontal scroll (the S37 console one-liner
   prints `[]`). Tap targets are comfortably sized.

### E. Storefront — hero slider (both themes, phone and desktop)
1. Desktop: the hero shows the **desktop** image, is about half the viewport tall, and products
   or categories are visible below it without scrolling.
2. Phone: the **mobile** (square) image shows, the title sits at the bottom over the dark scrim,
   and the title text is readable in both themes.
3. The title and button are **real text**: you can select them with the mouse, and FR/EN
   switching changes them.
4. Autoplay advances every **5 s**. Hovering (desktop) or focusing a dot pauses it. Switching
   tabs and coming back doesn't jump several slides.
5. Swipe left and right on touch (DevTools touch emulation). The arrows show on desktop only.
6. The dots: the active one is a **scarlet** (light) or **vermilion** (dark) pill, the others
   white. Clicking a dot goes to that slide.
7. **Lazy loading:** DevTools → Network → Img, reload `/`. Only **one** hero image (slide 1) loads
   at first. The next loads as the slider approaches it.
8. The button goes to its link: an internal link navigates in-app, an external one opens a new
   tab.
9. One live slide: no dots, no arrows, no autoplay.
10. No live slide (all inactive): the home page starts directly with the categories, with no
    empty band.
11. In OS settings, turn on **Reduce motion** and reload: no autoplay; swiping still works.
12. A scheduled slide (start tomorrow) does **not** appear today. An ended one does not appear.

### F. Document head
1. DevTools → Elements → `<head>`. `title` is the store name, and `meta[name=description]` is the
   site description from Settings. With it empty, it is the default sentence in the UI language.
   Switch FR/EN and the default follows.
2. `og:image` is the link-preview image. With none set it is the store logo; with neither, it is
   `…/og-default.jpg`.
3. **View page source** (Ctrl+U, the raw HTML): the static French description, and
   `og:image = <VITE_SITE_URL>/og-default.jpg`. That URL opens the image (Q1 fallback).
4. The favicon is still the store logo.

### G. Regression
1. POS receipt, repair receipt and an invoice PDF still print the store name, address and phones
   as before.
2. The S37 header, category bar and bottom nav are unchanged. The bottom nav does not cover the
   footer's last line.

---

## §10 — Execution protocol

Execute this set, then write `Docs/Stage-04-Fixes/results/report-S38.md`. It covers:
- what changed, file by file;
- F1–F8 and P1–P15 as applied;
- the Stage-00 reversal (§0.3);
- the Q1 limitation (settings-driven share previews need server-side head injection);
- every translation key reused;
- the migration SQL as generated;
- the API smoke run results, and whether R2 was reachable;
- the gate results (§0.6).

End the report with the verification checklist above. The owner reviews and approves before S39
begins.
