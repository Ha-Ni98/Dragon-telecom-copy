# Plan — Set S27.1: Repair client label & thermal-printer bridge (ZPL / ESC-POS)

> **First execution action:** copy this file to
> `Docs/Stage-04-Fixes/plans/plan-S27-1-repair-label-and-thermal-bridge.md` to match the programme
> convention, and work from that copy. The report goes to
> `Docs/Stage-04-Fixes/results/report-S27-1.md`.

---

## Context

Two owner requests, neither in `sets-26-29.md`:

1. **Repair client label.** The repairs ticket sheet can already print an 80 mm receipt (S25). The
   owner wants a *second* button printing a small adhesive **label** for the device itself — a
   scannable barcode of the repair reference plus the client/device details as plain text, so a
   phone on the bench is identifiable at a glance and its ticket is one scan away.
2. **Real thermal printing.** Everything currently prints by rasterising HTML through the browser
   print dialog (S27). The owner wants the app to drive the hardware directly — **ZPL** for the
   Zebra label printer, **ESC/POS** for the 80 mm receipt printer — falling back to today's browser
   dialog whenever that is not possible.

**Positioning.** Numbered 27.1 but lands *after* S28 and S29, which are already executed and
reported. Depends on S27's label infrastructure; must not disturb S29's `repair-device-label.ts`.

**This set touches no backend and no contract package.** Everything is `Apps/web`. The bridge types
are single-side, so per hard rule 1 they live in `Apps/web/src/types/`.

---

## Owner decisions (confirmed this session)

| # | Decision |
|---|---|
| **D1** | Transport is a **local helper app**, not WebUSB and not the Fly.io backend. WebUSB was proposed and rejected by the owner once the Windows driver-claim conflict was explained. |
| **D2** | The helper's endpoint is **configurable via an env var** — "localhost or something else". |
| **D3** | Hardware: **Zebra label printer (ZPL)** + separate **80 mm receipt printer (ESC/POS)**. ZPL is a label language; the receipt printer does not speak it — hence two generators. |
| **D4** | **Use the helper if it exists; otherwise use the existing browser printing.** For receipts: "see if the sending succeeds, if not keep the same logic." |
| **D5** | The barcode dialogs still get a visible **Thermal printer / Browser** field, defaulting to thermal. |
| **D6** | The repair label carries a **scannable Code 128 barcode of `repair.reference`**; name, phone, device label and problem type are **raw text, one per line**. |

---

## Constraint discovered while planning — the repair barcode barely fits 50 mm stock

Repair references are `REP-2026-0001`, **13 characters** (`platform.service.ts` builds
`${prefix}-${year}-${String(n).padStart(4,'0')}`). Against the project's recorded **0.25 mm/module
scanning floor** (`BARCODE_MIN_MODULE_MM` — the figure S26 widened the product label 40→50 mm to
respect):

**Browser path** (SVG scales continuously):

| Encoding | Modules (incl. 2×10 quiet) | 50 mm **with** store column (41.5 mm) | 50 mm **without** column (48 mm) |
|---|---|---|---|
| All Code B | 198 | 0.210 mm ❌ | 0.242 mm ❌ |
| With Code C compression | 187 | 0.222 mm ❌ | **0.257 mm ✓** |

**ZPL path** (quantised to whole dots; at 203 dpi `^BY2` = exactly 0.250 mm, usable 48 mm = 384 dots):

| Payload | Modules | Width at `^BY2` | |
|---|---|---|---|
| `REP-2026-0001`, all Code B | 198 | 396 dots (49.6 mm) | **overflows 384** |
| `REP-2026-0001`, with Code C | 187 | 374 dots (46.8 mm) | fits, 10 dots spare |
| `REP20260001` (dashes stripped) | 143 | 286 dots (35.8 mm) | comfortable |

Four conclusions the implementation must honour:

1. **The repair label must NOT render the vertical store-name column.** With it the barcode is below
   the floor under every encoding. This is a correctness requirement, not styling.
2. Even without the column it clears the floor **only if JsBarcode picks Code C** for the digit
   runs. It is marginal by design and the existing sub-floor warning may legitimately fire.
3. **Label *height* does not help the barcode** — module width depends only on label *width*.
   50 × 30 mm buys room for text lines, nothing for scannability.
4. **Encode the reference verbatim** (`REP-2026-0001`) so a scan round-trips exactly into the
   existing search box. If a real printed tag fails to scan, the documented escape hatch is to strip
   the dashes (`REP20260001`, 143 modules, comfortable) — but that requires the repair search to
   normalise dashes, so it is a follow-up decision, not a silent change.

**Mitigating factor and an argument for Part B:** ZPL renders the symbol at the printer's native
203/300 dpi, which is crisper than the browser rasterising an SVG, so a marginal module width is
materially more likely to scan through the ZPL path. Verify by scanning a real tag.

---

## Part A — Repair client label

### A1. Extend `BarcodeLabelSheet` rather than fork it

`LabelSheetItem.topText` is a **single** `nowrap` + `ellipsis` 5 pt line; it cannot hold four lines.

**Chosen:** extend `BarcodeLabelSheet` with two optional props, both defaulting to today's
behaviour so neither existing dialog changes:
- `textLines?: string[]` — rendered as stacked single-line rows above the barcode
- `showStoreColumn?: boolean` (default `true`) — the repair label passes `false`

**Rejected:** a separate `repair-label-sheet.tsx`. It would duplicate the portal, the dedup memo and
the page-break DOM shape — and `index.css:287`'s page-break rule is bound to the literal selector
`#label-print-portal > div > .label-page`, so a second component is a silent-breakage risk for no
benefit.

**Vertical budget at 50 × 25 mm** (1 mm padding → 23 mm usable):
- barcode block ≈ 9 mm (bars + human-readable digits) — the practical minimum that scans
- 5 text lines at 6 pt (2.12 mm) × 1.15 line-height ≈ 2.4 mm each ≈ 12 mm
- ≈ 21 mm of 23 mm — fits, tight. At 7 pt it is 23 mm exactly, i.e. zero margin.

⇒ **6 pt text, one line each with ellipsis, barcode at the bottom, store column suppressed.**

### A2. Label content, top → bottom

| Line | Source | Note |
|---|---|---|
| Customer name | `repair.customerName` | required |
| Phone | `repair.customerPhone` | required |
| Device | `formatRepairDeviceLabel(repair.device)` | **must** use the S29 helper (stored label wins over brand+model); returns `""` when all absent → omit the line |
| Problem | `repair.reportedIssues.map(i => t(REPORTED_ISSUE_LABEL_KEY[i])).join(" · ")`, plus `(reportedIssueOther)` when `OTHER` is present | mirrors `RepairReceipt.tsx:101-109` exactly |
| Reference | `repair.reference` | readable form |
| *(barcode)* | Code 128 of `repair.reference` | |

**Hard rule inherited from `RepairReceipt`:** the component takes **no `scope` prop** and must never
render `totalCost`, `totalProfit`, or any part's `costOfGoods`/`profit` — those genuinely *are*
populated for admins. Omitting the prop makes the leak impossible rather than merely discouraged.

### A3. UI placement

- New button in `RepairTicketDetail.tsx`'s `SheetHeader` flex row (lines 108–118), beside Print
  receipt, **outside every `!readOnly` guard** — a bench tag must print at any status, the same
  reasoning S25 recorded for the receipt button.
- It opens a small dialog (size picker, preview, printer-mode field, Print) because label size and
  printer mode must both be choosable. Reuse `<LabelSizeField>`.
- The label sheet renders as a **sibling of `<Dialog>`**, and the dialog itself as a **sibling of
  `<Sheet>`** (line 332 precedent) — Radix transforms both `SheetContent` and `DialogContent`, which
  would otherwise become the containing block for the print root.
- Appears on `/staff/repairs` *and* `/admin/repairs` for free (`AdminRepairs` is
  `<StaffRepairs scope="admin" />`).
- `store` already reaches `RepairTicketDetail` from `StaffRepairs.tsx:80`'s `usePublicSettings()` —
  no new query.
- Give the repair label its **own** remembered size (a second localStorage key, e.g.
  `dt_repair_label_size`) rather than sharing `dt_label_size`: different stock, different bench.
  `useLabelSize` should be parameterised by key rather than copy-pasted.
- Like the S27 dialogs, **do not self-close after Print** — `window.print()` is not reliably
  blocking and unmounting the print root mid-print risks a blank page.

---

## Part B — Thermal bridge

### B1. Configuration

Add to `Apps/web/.env`, `.env.example`, `.env.test` (each currently holds only `VITE_API_URL`,
`VITE_WS_ENABLED`, `VITE_WS_URL`):

```bash
# Local print helper. Empty/unset = no helper; everything falls back to the browser print dialog.
VITE_PRINT_BRIDGE_URL=http://127.0.0.1:9110
```

⚠️ **Mixed-content constraint that D2 ("localhost or something else") runs into:** an **HTTPS** page
may call `http://localhost` / `http://127.0.0.1` because those are "potentially trustworthy"
origins — but a plain-HTTP LAN address such as `http://192.168.1.50:9110` **will be blocked as mixed
content**. If the bridge is ever pointed somewhere other than localhost, it must be served over
HTTPS with a trusted certificate. Document this next to the variable.

### B2. `src/lib/print-bridge.ts` — its own `fetch`, deliberately not the shared axios

`lib/axios.ts` carries an explicit *"exactly one axios instance (rules §3A)"* rule. That rule exists
so the auth-refresh and 401-redirect interceptors cannot be bypassed for **backend** calls. The
bridge is a different origin with no auth, no `ApiResponse` envelope and no refresh, and must **not**
inherit the `Authorization` header. It therefore uses a plain `fetch`, and the file must carry a
comment saying exactly that so it does not read as a violation.

Surface:
- `probeBridge(): Promise<boolean>` — `GET {BRIDGE}/status` with an `AbortController` timeout of
  ~1000 ms so a missing helper never stalls a Print button. Result cached per session.
- `sendToBridge(job): Promise<{ ok: true } | { ok: false; reason: string }>` — never throws; the
  caller branches on `ok`.

### B3. The bridge's HTTP contract (the helper app is **not** in this repo)

Document this in the plan/report so the helper can be written against it.

```
GET  {BRIDGE}/status
  → 200 application/json
    { "ok": true, "version": "1.0.0", "printers": { "label": true, "receipt": true } }

POST {BRIDGE}/print
  Content-Type: application/json
    { "target":   "label" | "receipt",
      "language": "ZPL"   | "ESCPOS",
      "encoding": "utf8"  | "base64",
      "data":     "<string>" }
  → 200 { "ok": true }
  → 4xx/5xx { "ok": false, "error": "<human readable>" }
```

- **ZPL is sent `encoding: "utf8"`** (pure ASCII commands).
  **ESC/POS is sent `encoding: "base64"`** — it contains raw control bytes (`0x1B`, `0x1D`, `0x00`)
  that do not survive JSON string round-tripping safely.
- **CORS the helper must implement:** `Access-Control-Allow-Origin` (the app origin or `*`),
  `Access-Control-Allow-Headers: Content-Type`, `Access-Control-Allow-Methods: GET, POST, OPTIONS`,
  and it must answer the `OPTIONS` preflight.
- **Chrome Private Network Access:** when a public/HTTPS page requests a private/loopback address,
  Chrome sends `Access-Control-Request-Private-Network: true` on the preflight and expects
  `Access-Control-Allow-Private-Network: true` back. *I am flagging this with deliberate
  uncertainty — Chrome's enforcement timeline for PNA has shifted repeatedly, so it may warn rather
  than block on the current version. The helper should send the header regardless; it costs nothing
  and future-proofs it.*

### B4. `src/lib/zpl.ts` — label generation

At **203 dpi = 7.99 dots/mm** (a 50 × 25 mm label = 400 × 200 dots). Make the dpi a named constant
with a comment that 300 dpi Zebras exist and need `^BY3` instead of `^BY2`.

```
^XA
^CI28                          ; UTF-8 input — REQUIRED for French accents
^PW400                         ; print width in dots
^LL200                         ; label length in dots
^LH0,0
^FO8,10^A0N,17,17^FD<line 1>^FS
^FO8,29^A0N,17,17^FD<line 2>^FS
...
^BY2,,72                       ; module = 2 dots = 0.250 mm exactly; bar height 72 dots = 9 mm
^FO8,120^BCN,72,Y,N,N^FD<reference>^FS
^PQ<quantity>
^XZ
```

- `^A0N,h,w` — scalable font 0; 6 pt ≈ 2.12 mm ≈ **17 dots**.
- `^BCN,<h>,Y,N,N` — Code 128, normal rotation, print interpretation line **Y**, not above, no
  check digit.
- `^PQ<n>` sets copies and must precede `^XZ`.
- **`^FD` escaping:** `^`, `~` and `\` are ZPL control characters. Sanitise every interpolated value
  (customer names are free text). Either strip them or switch to `^FH` + `_XX` hex escapes; stripping
  is simpler and these characters are vanishingly rare in names.

### B5. `src/lib/escpos.ts` — 80 mm receipt generation

**This is a second receipt renderer, not a translation of the DOM.** At 203 dpi an 80 mm roll gives
576 printable dots = **48 columns** in Font A (12 dots wide). The React receipt's `<table>` columns
must be re-expressed as a fixed-width 48-character text grid (pad/truncate per column). Budget this
as real work — it is the largest single piece in Part B.

Command set:

| Purpose | Bytes |
|---|---|
| Initialise | `1B 40` (`ESC @`) |
| Code page | `1B 74 10` (`ESC t 16` → WPC1252) |
| Align L/C/R | `1B 61 00|01|02` |
| Bold on/off | `1B 45 01|00` |
| Double size | `1D 21 11` (`GS ! n`), back to normal `1D 21 00` |
| Line feed | `0A` |
| Feed & cut | `1D 56 42 00` (`GS V B n` — partial cut; wider support than `GS V 0`) |

- **French accents are the real trap.** Selecting WPC1252 is not enough — the *bytes* must be CP1252,
  and JS strings are UTF-16 with only a UTF-8 `TextEncoder` built in. A small hand-rolled CP1252
  encoder is required (CP1252 ≈ Latin-1 over `0xA0–0xFF`, which covers `é è à ç ù â ê î ô û ë ï ü`;
  `œ` is `0x9C`). Stripping accents instead would be visibly wrong on a French customer receipt.
- **Skip the store logo in ESC/POS mode.** Raster printing (`GS v 0`) needs the PNG fetched from R2
  (cross-origin), drawn to a canvas, thresholded to 1-bit and packed — and the logo is a remote URL
  that may not even be CORS-readable. Print the **store name as bold double-height text** instead.
  State this as a deliberate, recorded limitation: the thermal receipt has no logo, the browser
  fallback still does.

### B6. Mode selection and fallback semantics

- `src/hooks/use-print-bridge.ts` — `usePrintBridge()` → `{ available, checking }`, probing once per
  session via `probeBridge()`.
- `src/components/shared/printer-mode-field.tsx` — a `Select` with **Thermal printer** (default) and
  **Browser**. When `available === false` the thermal option is disabled with an explanatory hint,
  and the field falls to Browser.
- **Receipts get no field** (D4): a new `printReceiptSmart()` tries ESC/POS when the bridge is
  available and calls the existing `printReceipt()` on any failure.
- **No double printing.** The browser fallback fires **only** on a definite failure — unreachable,
  timeout, or non-2xx. A successful send must never also open the print dialog.
- **User feedback:** success is **silent** (printing is the highest-frequency action in the shop); a
  fallback shows one `toast.warning` naming the reason, so a dead helper is visible rather than
  mysterious.

---

## Files

**New (all `Apps/web/src`)**
- `types/print-bridge.types.ts` — mode enum, job/status shapes, bridge constants
- `lib/print-bridge.ts` — probe + send
- `lib/zpl.ts` — ZPL builder + `^FD` sanitiser
- `lib/escpos.ts` — ESC/POS builder + CP1252 encoder + 48-col grid helpers
- `hooks/use-print-bridge.ts`
- `components/shared/printer-mode-field.tsx`
- `pages/staff/repairs/components/RepairLabelDialog.tsx`

**Modified**
- `components/shared/barcode-label-sheet.tsx` — `textLines?`, `showStoreColumn?`
- `hooks/use-label-size.ts` — parameterise by storage key
- `pages/staff/repairs/components/RepairTicketDetail.tsx` — new button + dialog
- `pages/admin/products/components/barcode-label-dialog.tsx`,
  `pages/admin/supplier-invoices/components/barcode-labels-dialog.tsx` — printer-mode field + ZPL path
- `pages/staff/pos/StaffPos.tsx`, `pages/staff/repairs/components/RepairTicketDetail.tsx` — receipt thermal path
- `.env`, `.env.example`, `.env.test`
- `config/translations.json` — new keys, `{en, fr, ar:""}`, flat dotted

**Ordering:** types → bridge client → ZPL/ESC-POS generators → hook + mode field → `BarcodeLabelSheet`
extension → repair dialog + button → wire the two existing dialogs → receipt path → translations.

---

## Risks

1. **Barcode scannability at 50 mm** — marginal by arithmetic (above). Must be verified by scanning a
   real printed tag, not judged by eye. Escape hatch documented in the constraint section.
2. **`index.css:287`'s `#label-print-portal > div > .label-page` selector** is bound to the portal's
   exact DOM nesting; the `BarcodeLabelSheet` extension must not change that shape or pagination
   breaks silently.
3. **`LabelSizeField` has hardcoded element ids** — it must never be mounted twice at once. The new
   repair dialog and the existing label dialogs are on different routes, so this is safe today;
   worth a comment.
4. **CP1252 encoding** — get it wrong and every French receipt prints mojibake.
5. **Mixed content** if the bridge is pointed at a non-localhost HTTP address (B1).
6. **Chrome PNA** preflight (B3) — flagged with genuine uncertainty about current enforcement.
7. **The helper app does not exist yet.** This set ships only the client half. Until the helper is
   written and installed, every thermal path falls back to the browser — which is correct behaviour
   (D4) but means **Part B cannot be fully verified in the browser** the way every prior set was.

---

## Verification checklist

**Part A — repair label**
1. `/staff/repairs` → open a ticket → a second button sits beside **Print receipt** in the header.
2. It is present on a `PICKED_UP` and a `CANCELLED` ticket too (no `readOnly` gate).
3. The dialog shows a preview, a label-size picker and a printer-mode field.
4. Print → one label per copy; text lines read name / phone / device / problem / reference, each on
   its own line, none overlapping, none clipped.
5. The label has **no vertical store-name column** (deliberate — it would push the barcode under the
   scanning floor).
6. A repair with **no device** (no label, brand or model) omits the device line rather than printing
   an empty one.
7. A repair with issue **OTHER** plus free text shows `Other (…)`.
8. **Scan the printed tag with the handheld reader** — it must decode to exactly `REP-YYYY-NNNN`.
   Scan one from the *end* of a multi-label run too.
9. `/admin/repairs` → the same button is present and behaves identically.
10. The label size is remembered separately from the product-label size: change one, confirm the
    other is unaffected.
11. Switch to **FR** — every label line and dialog string is French, no raw keys.
12. Confirm **no cost or profit** appears anywhere on the label while logged in as **ADMIN**.

**Part B — thermal path (requires the helper app running)**
13. With `VITE_PRINT_BRIDGE_URL` unset → every Print behaves exactly as before this set (browser
    dialog), and the thermal option is disabled with its hint.
14. With the helper running → the barcode dialog defaults to **Thermal printer**; Print sends ZPL and
    the Zebra prints directly, with **no browser print dialog appearing at all**.
15. Print a POS receipt with the helper running → prints via ESC/POS, no browser dialog.
16. French accents (`é è à ç`) print correctly on the ESC/POS receipt, not as mojibake.
17. The thermal receipt has **no logo** (recorded limitation); the browser fallback still shows it.
18. **Stop the helper app mid-session**, then Print → a single warning toast appears **and** the
    browser print dialog opens. Exactly one output, never both.
19. Restart the helper, reload, Print → back to thermal.
20. Select **Browser** explicitly with the helper running → the browser dialog opens, nothing is sent
    to the helper.
21. Scan a ZPL-printed product label and a ZPL-printed repair tag — both decode first time.

---

## Addendum — findings from the design pass (these override/extend the sections above)

**A1. `.env.test` must set `VITE_PRINT_BRIDGE_URL` EMPTY — hard constraint.**
`Apps/web/tests/fixtures/wrappers/setup.ts` runs MSW with `onUnhandledRequest: "error"`, and
`tests/unit/pages/staff-repairs/repairs.test.tsx` renders `<StaffRepairs />` directly — which
contains `RepairTicketDetail`. A bridge probe mounted there would fire an unmocked request and
**fail a test I am forbidden to modify**. Mitigation: `getBridgeBaseUrl()` returns `null` for an
empty/unset var, and the probe query is `enabled: getBridgeBaseUrl() != null`. `.env.test` keeps it
empty with a comment naming this reason.

**A2. Sharper rationale for the bridge NOT using the shared axios.** Beyond "different origin": the
`api` request interceptor would attach the app's **bearer token to a third-party local process**,
and its response interceptor treats any `401` as an expired session — a bridge returning 401 would
**log the user out of the app**. Put this in `print-bridge.ts`'s header comment.

**A3. ZPL quiet-zone offset — the highest-value line in `zpl.ts`.** `^BC` does **not** print quiet
zones, but `renderBarcodeSvg().totalModules` **includes** them (JsBarcode draws them via
`marginLeft/Right`). So the symbol must be inset by a full quiet zone:
```
printableDots = dots(widthMm) - 2*dots(LABEL_PADDING_MM)
moduleDots    = clamp(floor(printableDots / totalModules), 1, 10)   // quiet zones stay in the divisor
barX          = dots(LABEL_PADDING_MM) + QUIET_ZONE_MODULES * moduleDots
```
Placing the symbol at the padding instead gives 4 modules of quiet zone against Code 128's required
10, and the label simply will not scan. Also size against the all-subset-B worst case
(`11*(len+2)+13 + 2*QUIET_ZONE_MODULES`) since JsBarcode's subset-auto and the Zebra's need not
agree (±11 modules); over-reserving can only widen bars.

**A4. `Intl.NumberFormat("fr-FR")` emits U+202F (narrow no-break space)** as its thousands
separator — present in every `formatDZD` output, and in **no** ESC/POS code page. `encodeText` must
normalise U+202F/U+00A0/U+2009 to `0x20` **first**, or every amount prints as garbage. Only shows up
on real hardware.

**A5. The success toast is mandatory, not polish.** On the thermal path nothing visible happens (no
print dialog). Without confirmation the user assumes the click missed and presses again → a genuine
double print. Pair with an `isPrinting` state that disables the button while a job is in flight.

**A6. Keep the common fallback paths synchronous** (user-gesture safety for `window.print()` after
an `await`): mode==="browser", no bridge URL, and already-probed-false all call the browser path
**without awaiting anything**. Only "bridge present but this job failed" is async. This is the real
justification for keeping the probe at all.

**A7. Move `barcode-label.tsx` to `components/shared/`.** It currently lives in
`pages/admin/products/components/`; importing it from a staff page is a layering violation. Move it
(its sibling `barcode-label-sheet.tsx` is already in `components/shared/`) and fix the one import.

**A8. Scope confirmed unchanged — the POS receipt stays IN.** The design pass recommended deferring
it to 27.2; declined, because the owner's request was "all the print receipt and code bar" and they
chose "Both in one set". `lib/escpos.ts` serves both receipts.

**A9. Pre-existing broken test fixture (report, do not fix).**
`Apps/web/tests/fixtures/data/catalog.mock.ts:140` builds `mockAdminProduct` via
`AdminProductResponseSchema.parse(...)` without `avgPrice`, which the schema requires
(`catalog.dtos.ts:91`). It throws at module load, and since `catalog.handlers.ts` imports it, it
blocks the **entire web suite at collection**. Pre-existing, unrelated to this set, and in a test
file I may not modify — record it in the report.

**A10. No CSS change is needed for the two print roots to coexist.** `printing-labels` hides
`body > *:not(#label-print-portal)`, removing `#root` and the receipt with it; `printing-receipt`
sets `body.printing-receipt * { visibility: hidden }`, and the portal is a `body` descendant so it
is hidden. Do not "fix" this.

---

## Execution protocol

One set. Validation is `tsc --noEmit` + lint on `Apps/contract`, `Apps/api`, `Apps/web` — **do not
modify or run tests**. The API carries a known pre-existing baseline of 184 `test/**` tsc errors and
7 lint errors (`prisma/seed.ts`, `validate-request.middleware.ts`, `orders.service.ts`) that are not
this set's to fix. Finish by writing `Docs/Stage-04-Fixes/results/report-S27-1.md`, ending with the
checklist above and recording explicitly: whether the repair barcode scanned at 50 mm, and that the
helper app is a separate deliverable not contained in this repo.
