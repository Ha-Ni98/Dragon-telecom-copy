# Local print helper ("print bridge") — HTTP protocol

**Status:** specified by set S27.1. **The helper itself is NOT in this repository** — S27.1 ships
only the web-side client. Until a helper is written and installed, every thermal path falls back to
the browser print dialog, which is the intended behaviour, not a failure.

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
ZPL; absent ⇒ 203 is assumed. `connected` is informational in S27.1 — the web does not pre-gate on
it, because the print POST is the real test.

## `POST {base}/print`

```json
Content-Type: application/json
{
  "jobId":    "b3f1…",
  "target":   "label" | "receipt",
  "language": "ZPL" | "ESCPOS",
  "encoding": "base64",
  "payload":  "<base64 of the raw bytes to write to the device>",
  "copies":   1
}
```

```json
200 OK   { "ok": true }
4xx/5xx  { "ok": false, "error": "printer offline" }
```

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

Both endpoints:

```
Access-Control-Allow-Origin: <the exact web origin>
Vary: Origin
```

`application/json` makes `/print` a non-simple request, so it always preflights:

```
OPTIONS /print
Access-Control-Allow-Origin: <origin>
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: content-type
Access-Control-Max-Age: 600
Access-Control-Allow-Private-Network: true
```

Do **not** send `Access-Control-Allow-Credentials` — the web sends `credentials: "omit"` and never
attaches the user's session token to the helper.

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

The web makes two assumptions it cannot verify from a browser. If either is wrong for the actual
hardware, **the helper is the right place to fix it** — it knows the device, the web does not.

1. **ESC/POS cut command.** The web emits `GS V 66 0` (`1D 56 42 00`, function B partial cut after
   a feed), which has the widest support across Epson-compatible clones. Some clones implement only
   `GS V 0` (full) or `GS V 1` (partial). If yours differs, substitute the trailing cut sequence.

2. **ESC/POS code page.** The web emits `ESC t 0` (CP437) and encodes text as CP437 bytes. CP437
   covers the accents French needs (`é è à ç ù â ê î ô û ë ï ü ÿ`, `É Ç Ñ Ö Ü`). If the printer
   prefers CP1252 (`ESC t 16`) or CP858 (`ESC t 19`), the helper may rewrite the leading code-page
   selector and transcode — but note the web has already normalised U+202F/U+00A0/U+2009 to plain
   spaces, which is the trap that makes French amounts print as garbage otherwise.

3. **ZPL input encoding.** The web emits `^CI28` (UTF-8). Older Zebra firmware may need `^CI13`/
   `^CI27` with Latin-1 bytes instead.

## Known limitation — no logo on thermal receipts

Thermal receipts print the **store name in bold double-height text** where the browser receipt
prints the store logo. ESC/POS raster printing would require fetching the R2-hosted logo, drawing
it to a canvas, thresholding to 1-bit and bit-packing — and `getImageData` throws on a cross-origin
image unless the bucket sends CORS headers, which could not be verified. If the logo is wanted
later, the **helper** is the better home: it can fetch the URL server-side with no CORS constraint,
convert once and cache.
