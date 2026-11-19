# Module: platform
Merges: settings (+ SequenceService) + delivery (wilayas/communes bilingual, fees, resolution, Excel).

## Shared Conventions (self-contained — no other file needed)
- Every response: `ApiResponse<T>` (`sendSuccess` wraps; frontend unwraps `data`). Zod 4; types via `z.infer`; dates as ISO strings. Inputs `XxxCommand`/`XxxQuery`, outputs `XxxDto`, routes `[MODULE]_ROUTES` with UPPERCASE keys. Lists use `PaginationInfo`.
- Money: decimal DZD. **Cash only** — no payment-method field exists anywhere.
- **No delete endpoints** — `isEnabled` PATCH toggles. Notes, reasons, email: always `.optional()`.
- Access levels: `public` · `client` (JWT type CLIENT) · `staff(PAGE_KEY)` (JWT type STAFF + page in effective set; data scoped where stated) · `admin` (type ADMIN — all pages, unscoped data).
- **Connection rule:** needs a return value inside the caller's transaction ⇒ **injected service** (`InventoryService`, `SequenceService`, `DeliveryFeeService`); mirrors state elsewhere ⇒ **domain event**, emitted after commit, listener idempotent by source-document id. Event payloads are contract DTOs, named past-tense.
- Confirmed/issued documents are immutable snapshots; corrections are cancellations or return documents. Every money/stock/status/access mutation emits an event the audit module narrates.

## API Interface [CONTRACT]

| Route const | Method + path | Access | Notes |
|---|---|---|---|
| `PLATFORM_ROUTES.WILAYAS` | GET `/api/wilayas` | public | 69, bilingual, with communes |
| `PLATFORM_ROUTES.FEE` | GET `/api/delivery-fees?wilayaId=&communeId=` | public | resolved pair |
| `PLATFORM_ROUTES.ADMIN_FEES` | GET/PUT `/api/admin/delivery-fees` | admin | wilaya rows + commune overrides |
| `PLATFORM_ROUTES.FEES_IMPORT` | POST `/api/admin/delivery-fees/import` | admin | Excel, row-validated, all-or-nothing |
| `PLATFORM_ROUTES.FEES_EXPORT` | GET `/api/admin/delivery-fees/export?format=` | admin | excel/csv/json |
| `PLATFORM_ROUTES.SETTINGS` | GET/PATCH `/api/admin/settings` | admin | |
| `PLATFORM_ROUTES.SETTINGS_PUBLIC` | GET `/api/settings/public` | public | store header + footer contact, storefront section |
| `PLATFORM_ROUTES.HERO_SLIDES` | GET `/api/hero-slides` | public | live slides (active, inside window), ≤ 5 (S38) |
| `PLATFORM_ROUTES.ADMIN_HERO_SLIDES` | GET/POST `/api/admin/hero-slides` | admin | S38 |
| `PLATFORM_ROUTES.ADMIN_HERO_SLIDES_ORDER` | PUT `/api/admin/hero-slides/order` | admin | full id list, S38 |
| `PLATFORM_ROUTES.ADMIN_HERO_SLIDE_BY_ID` | PATCH/DELETE `/api/admin/hero-slides/:id` | admin | S38 |

```
WilayaDto { id; wilayaCode; frName; arName; communes: { id; communeCode; frName; arName }[] }
FeeDto { deliveryHome; deliveryOffice; source: 'commune'|'wilaya'|'default' }
UpsertFeesCommand { rows: { wilayaId; communeId?: uuid|null; deliveryHome; deliveryOffice }[] }
SettingsDto { store { name; activityLine?; address?; phone?; repairPhone?; salesPhone?; whatsappPhone?; email?; facebookUrl?; instagramUrl?; tiktokUrl?; logoUrl?; printLogoUrl? };  // invoice/receipt header AND (S38) the storefront footer
  invoicing { prefixes: Record<DocType,string>; nextSequences: Record<DocType,number>; footerNote? };
  delivery { defaultHome; defaultOffice };
  storefront { featuredProductIds: uuid[]; featuredFamilyIds: uuid[]; repairToolsFamilyId?: uuid; metaDescription?: string; linkPreviewImageUrl?: string } }
HeroSlideDto { id; desktopImageUrl; desktopImageKey; mobileImageUrl; mobileImageKey; text: { fr: { title; ctaLabel }; en: { title; ctaLabel } }; link; isActive; startsOn?; endsOn?; displayOrder; isLive }  // S38
DocType = 'INVOICE'|'SALE'|'ORDER'|'REPAIR'|'SUPPLIER_INVOICE'|'ADJUSTMENT'|'POS_CLIENT'|'CLIENT'
```

## Events [CONTRACT]
- Emits `settings.changed { description }`, `deliveryFees.changed { description }`, `heroSlides.changed { description }` (audit). Listens: none.

## Injected services [CONTRACT]
- `SequenceService.nextNumber(tx, docType) → string` — `PREFIX-YYYY-NNNN`, transactional, monotonic, gaps tolerated, never reused. Injected into every document module.
- `DeliveryFeeService.resolve(wilayaId, communeId, mode) → number` — commune override → wilaya row → settings default. PICKUP callers never ask (fee 0 by rule). Injected into orders.

## Business Logic [BACKEND]
1. 69 wilayas + communes seeded bilingual (frName/arName); DTOs always carry both, the front picks by language.
2. Fee rows: `communeId = null` = the wilaya fee; unique (wilayaId, communeId). Import validates wilaya/commune codes and numeric fees, reports row-level errors, writes nothing on any failure. Export round-trips.
3. Settings JSON per key. Lowering a next-sequence → 409 `SEQUENCE_DECREASE_FORBIDDEN`. No localisation keys exist.

## Test Scenarios [BACKEND]
Resolution precedence + `source` field. Import one bad row → 400 listing it, zero writes. Sequence monotonic under concurrency; decrease 409. settings.changed narrated old → new.
