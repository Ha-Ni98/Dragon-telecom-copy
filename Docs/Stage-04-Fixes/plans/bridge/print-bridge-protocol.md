# Local print helper ("print bridge") — HTTP protocol

**Protocol version 1.1.** Originally specified by set S27.1, which shipped only the web-side
client — at that point the helper genuinely did not exist in this repository. It has since been
built: Go, lives at [`Apps/bridge`](../../../../Apps/bridge) (`dtbridge`), see
[`print-bridge-plan-v1.md`](print-bridge-plan-v1.md) for the build plan and
[`Apps/bridge/README.md`](../../../../Apps/bridge/README.md) for installing it on a counter PC.
Until it is installed and running, every thermal path falls back to the browser print dialog,
which remains the intended behaviour, not a failure — nothing about shipping the helper changes
that fallback contract.

See [Changelog](#changelog-1--11) at the bottom for exactly what changed between 1.0 and 1.1.

---

## Why a helper exists at all

A browser cannot write raw ZPL or ESC/POS bytes to a USB or network printer — no web API does this.
The API server runs on Fly.io and cannot reach a printer sitting behind the shop's NAT. WebUSB was
evaluated and rejected: on Windows the vendor print driver claims the device so `claimInterface()`
fails, and the usual Zadig/WinUSB workaround then breaks ordinary printing for that same printer —
i.e. it would destroy the browser fallback the whole design depends on.

A small helper process on the counter PC, addressed over loopback HTTP, is the remaining option.

## Two printers, two languages

| Target | Hardware | Language |
|---|---|---|
| `label` | Zebra label printer | **ZPL II** |
| `receipt` | 80 mm thermal receipt printer | **ESC/POS** |

These are not interchangeable — a receipt printer does not understand ZPL. The web generates both;
the helper is a byte pipe and must not re-render anything. That division is deliberate: every
layout change would otherwise mean reinstalling the helper on every counter PC.

## Configuration on the web side

`VITE_PRINT_BRIDGE_URL` — base origin only, e.g. `http://localhost:9110`. Empty or unset turns the
feature entirely off.

A per-workstation override exists at the `localStorage` key **`dt_print_bridge_url`**, which wins
over the env var. It has no UI in S27.1 — the app ships as one build serving every counter, so this
is the escape hatch for a shop whose helper is not on the default host.

⚠️ **The URL must be loopback (`http://localhost:…` / `http://127.0.0.1:…`) or `https://`.** The app
is served over HTTPS in production, and loopback origins are the only plain-HTTP ones a browser
treats as "potentially trustworthy". A LAN address such as `http://192.168.1.50:9110` **will be
blocked as mixed content**.

---

## `GET {base}/status`

No authentication. Must answer well inside 1.5 s (the web aborts at that point).

```json
200 OK   Content-Type: application/json
{
  "ok": true,
  "version": "1.0.0",
  "printers": {
    "label":   { "connected": true, "language": "ZPL",    "dpi": 203 },
    "receipt": { "connected": true, "language": "ESCPOS", "widthMm": 80 }
  }
}
```

Only `ok: true` is required. `printers.label.dpi` is read by the web to pick the mm→dots factor for
ZPL; absent ⇒ 203 is assumed. `connected` is informational — the web does not pre-gate on it,
because the print POST is the real test. `dtbridge` fills it from a background prober (dials the
TCP port / stats the file path / checks the Windows spooler queue every 10 s) so this endpoint
never has to do blocking I/O of its own to answer — it must stay well inside the web's 1.5 s abort.

## `POST {base}/print`

```json
Content-Type: application/json
{
  "jobId":    "b3f1…",
  "target":   "label" | "receipt",
  "language": "ZPL" | "ESCPOS",
  "encoding": "base64",
  "payload":  "<base64 of the raw bytes to write to the device>",
  "copies":   1,
  "logoUrl":  "<optional — receipt jobs only, see below>"
}
```

```json
200 OK   { "ok": true }
4xx/5xx  { "ok": false, "error": "printer offline" }
4xx/5xx  { "ok": false, "error": "print queue full" }
```

### `logoUrl` (protocol 1.1)

Optional, receipt jobs only. The store's print logo URL (`store.printLogoUrl` from
`GET /platform/settings/public`, falling back to `store.logoUrl` — both public, no auth). The
helper fetches it **server-side**, so the browser's cross-origin `getImageData` restriction that
blocked this from being done web-side never applies; the R2 bucket serving these images has no
CORS restriction and every URL is public.

Backward compatible in both directions: an old web client simply never sends the field, and a
helper that doesn't recognise it prints exactly as it always did — the receipt's bold,
double-height store name is the fallback either way, so nothing about the receipt is ever blocked
on the logo. **Fail-open on every error path** — an absent/empty field, a 404, a wrong content
type, a body that doesn't decode as PNG, a fetch that times out, or the receipt printer's own
`logo.enabled: false` config all produce the exact same outcome: the receipt prints, in full,
without a logo, and the helper logs one line about why. None of these can turn into a failed print
or a browser-fallback — a logo problem is never allowed to become a print problem.

The logo block (an ESC/POS raster image, `GS v 0`) is placed **before** the web's own payload and
is never subject to the `cutCommand`/`codePage` overrides below — it is raw binary pixel data, not
text, and running it through a code-page transcode would corrupt it. With `copies > 1`, the whole
logo-plus-receipt pair repeats per copy, matching how ZPL and ESC/POS `copies` already work above.

### Rules the helper must honour

1. **`payload` is always base64**, even for ZPL. One rule, no charset negotiation — and ESC/POS
   payloads are arbitrary bytes (`0x1B`, `0x1D`, code-page-encoded accents) that are not valid
   UTF-8 and cannot survive a JSON string. Decode, then write the bytes to the device unmodified.

2. **`copies` semantics differ by language, and this is the most likely thing to get wrong:**
   - `language: "ZPL"` → **send the payload exactly once.** Copy count is already carried inside
     the payload as `^PQ`, and a multi-block batch carries one `^PQ` per block. Sending it
     `copies` times would multiply every label.
   - `language: "ESCPOS"` → **write the payload `copies` times.**

3. **Acknowledge on queue, not on paper.** Respond as soon as the bytes are handed to the device or
   queued. The web's print timeout is 5 s and is an *ack* timeout. A helper that waits for physical
   completion will time out on a long receipt, the web will fall back to the browser dialog, and
   the customer gets **two** copies.

4. **The web never retries a print.** `jobId` exists so the helper can de-duplicate if a human
   presses Print twice, and for log correlation.

### CORS

The web sends `credentials: "omit"` on every request to the helper and never attaches the user's
session token — which is what makes a **wildcard origin the correct default**, not just a
convenient one: `Access-Control-Allow-Origin: *` is only forbidden for credentialed requests. This
is `dtbridge`'s default (`allowedOrigins: ["*"]`), and it means one build/install works against
production, every preview deploy, and local dev, with nothing to reconfigure when a domain
changes. The cost, stated plainly: any page a browser on the counter PC happens to open could POST
to the helper and waste a label or a receipt — no data is readable (the helper only ever answers
`{"ok":true}`/`{"ok":false,...}`) and no credential is involved, so the blast radius is one sheet
of paper on one PC.

A shop that wants this tightened can set `allowedOrigins` to an explicit list in `config.json`
(e.g. `["https://your-shop.vercel.app"]`). In that mode the helper echoes back the exact matched
origin plus `Vary: Origin`, and rejects a disallowed origin's preflight outright:

```
# wildcard mode (default)
Access-Control-Allow-Origin: *

# explicit-list mode
Access-Control-Allow-Origin: <the exact origin that matched>
Vary: Origin
```

`application/json` makes `/print` a non-simple request, so it always preflights, in either mode:

```
OPTIONS /print
Access-Control-Allow-Origin: <* or the exact origin, per the mode above>
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: content-type
Access-Control-Max-Age: 600
Access-Control-Allow-Private-Network: true
```

Do **not** send `Access-Control-Allow-Credentials` in either mode — the web sends
`credentials: "omit"` and never attaches the user's session token to the helper; sending this
header would be actively wrong regardless of which origin mode is configured.

### Private Network Access — stated uncertainty

Chrome sends `Access-Control-Request-Private-Network: true` on the preflight when a public/HTTPS
page requests a loopback address, and expects `Access-Control-Allow-Private-Network: true` back.
**Chrome's enforcement of this has shifted across versions** — warning-only, then enforced, then a
rename toward "Local Network Access" with a user permission prompt. Which model the shop's browser
uses cannot be determined from this repository.

Send the header regardless: it costs nothing and is necessary under every model. If a one-time
permission prompt appears on first print, that is expected — document it for counter staff.

**Plan B if PNA hard-blocks:** serve the helper over HTTPS on a loopback-resolving hostname with a
locally-trusted certificate (what Zebra Browser Print and DYMO Connect do). Cost: certificate
management per counter PC.

Every one of these failure modes lands in the browser fallback, so none of them can stop the shop
printing — worst case it keeps today's behaviour.

---

## Hardware-specific details the helper may need to override

The web makes assumptions it cannot verify from a browser. If one is wrong for the actual
hardware, **the helper is the right place to fix it** — it knows the device, the web does not. Two
of the three below have a `dtbridge` config field; the third is a documented gap, not silently
dropped — see its own note.

1. **ESC/POS cut command.** The web emits `GS V 66 0` (`1D 56 42 00`, function B partial cut after
   a feed), which has the widest support across Epson-compatible clones. Some clones implement only
   `GS V 0` (full) or `GS V 1` (partial). If yours differs, substitute the trailing cut sequence —
   in `dtbridge`, set `printers.receipt.cutCommand` to `"GSV0"`, `"GSV1"`, `"none"` (strip the cut
   entirely, feed-only), or leave it `"auto"` (the default; reproduces the web's own bytes exactly).

2. **ESC/POS code page.** The web emits `ESC t 0` (CP437) and encodes text as CP437 bytes. CP437
   covers the accents French needs (`é è à ç ù â ê î ô û ë ï ü ÿ`, `É Ç Ñ Ö Ü`). If the printer
   prefers CP1252 (`ESC t 16`) or CP858 (`ESC t 19`), the helper may rewrite the leading code-page
   selector and transcode — but note the web has already normalised U+202F/U+00A0/U+2009 to plain
   spaces, which is the trap that makes French amounts print as garbage otherwise. In `dtbridge`,
   set `printers.receipt.codePage` to `"CP1252"` or `"CP858"`; both transcode via the verified
   `golang.org/x/text/encoding/charmap` tables rather than a hand-built mapping — CP858 in
   particular diverges from CP437 in the cent/yen signs in a way that's easy to get subtly wrong
   from a hand-rolled table. Leave it `null` (the default) for CP437, no rewrite.

3. **ZPL input encoding.** The web emits `^CI28` (UTF-8). Older Zebra firmware may need `^CI13`/
   `^CI27` with Latin-1 bytes instead. **Not implemented in v1.0** — there is no config field for
   this override; it was never in the committed build plan's config schema, unlike the two ESC/POS
   overrides above. Flagged here as a known gap, not silently dropped. If your printer needs this,
   the label byte-pipe rule still applies: this would be a helper-side rewrite of the `^CI28`
   sequence and any non-ASCII bytes that follow it, symmetrical to the code-page rewrite above.

## Receipt logo (protocol 1.1)

Thermal receipts print the **store logo**, fetched and rastered by the helper from `logoUrl` (see
above) — not by the browser. This replaces protocol 1.0's limitation, where thermal receipts could
only ever print the store name in bold double-height text (the R2 CORS constraint that blocked
doing this from the browser turned out not to exist — see the changelog). That bold store-name
line is still emitted by the web on every receipt regardless; the logo, when it can be built,
prints above it — the two are not exclusive, and the store name is what still prints if the logo
fails for any reason (see `logoUrl`, above).

The pipeline, for a helper implementing this protocol: decode the fetched PNG, downscale (box
filter, preserving aspect ratio) to the receipt's printable width, threshold to 1-bit — a straight
threshold, not dithering, since `printLogoUrl` is already stored monochrome — and wrap the packed
bitmap in `GS v 0`, banded to ≤128 rows per command (some clones misbehave on a single very tall
raster command). `dtbridge`'s implementation caches the rastered result both in memory and on disk
(keyed by URL) so a restart doesn't mean re-fetching on the next receipt, and negative-caches a
failed fetch for 60 s so a broken URL can't add a multi-second delay to every receipt during a
busy hour.

---

## Changelog (1.0 → 1.1)

- **The helper exists now.** `Apps/bridge` (`dtbridge`, Go) — protocol 1.0 described a contract
  with nothing on the other end of it; 1.1 describes one with a real, tested implementation. See
  `Docs/Stage-04-Fixes/plans/bridge/print-bridge-plan-v1.md` for how it was built and verified, and
  `Apps/bridge/README.md` for installing it.
- **`logoUrl`** added to `POST /print` — receipt jobs only, optional, fully fail-open. Thermal
  receipts print the store's real logo now, not just the bold store-name fallback. See
  [Receipt logo](#receipt-logo-protocol-11), above. The R2 CORS constraint that originally blocked
  this (protocol 1.0's "Known limitation") was re-verified and found not to apply — every stored
  image URL is public with no CORS restriction.
- **CORS default clarified as wildcard**, not "echo the exact origin" — see [CORS](#cors), above.
  This was always legal (the web has sent `credentials: "omit"` since S27.1) but 1.0's text
  described only the explicit-origin-echo mode, which is now documented as the opt-in tightening
  it actually is.
- **Hardware overrides now have real config field names** (`cutCommand`, `codePage`) rather than
  only prose descriptions, and the ZPL `^CI28` override is explicitly flagged as unimplemented in
  v1.0 rather than left ambiguous.
- **`/status`'s `printers.label.dpi`** is genuinely read and used now (`Apps/web`'s label dialogs
  thread it into the mm→dots calculation) — 1.0's text already claimed this, but it was dead code
  on the web side until this set.
