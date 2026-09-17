# Print bridge helper — v1.0 build plan

**Component:** `Apps/bridge` (new). **Language:** Go. **Consumes:** `Docs/print-bridge-protocol.md`.
**Status:** plan only — no code written yet.

This plan builds the counter-PC helper that `Docs/print-bridge-protocol.md` specifies and that
S27.1 shipped the web half of. Until it exists every thermal path falls back to the browser print
dialog, which is correct behaviour, not a failure — so nothing here is allowed to make the fallback
worse.

---

## 1. Owner decisions taken for this set

| | Decision |
|---|---|
| **D1** | **Both transports are built**: USB (Windows spooler, RAW datatype) and network (TCP :9100). Which one each printer uses is a **config setting**, not a build. |
| **D2** | **Language is per-printer config too** (`ZPL` or `ESCPOS`), so a shop with unusual hardware can re-map without a new binary. |
| **D3** | **Stack is Go.** Single static `.exe`, no runtime to install on the counter PC, cross-compiled from the Linux dev machine. |
| **D4** | **Lives at `Apps/bridge/` in this repo.** The protocol doc's "the helper itself is NOT in this repository" line described S27.1's scope and is now stale — this set amends it. |
| **D5** | **v1.0 scope = core + receipt logo.** `/status`, `/print`, CORS/PNA, jobId de-duplication, logging, **and** helper-side logo raster on thermal receipts. |
| **D6** | **Out of scope for v1.0**, deliberately: Windows service installer / auto-start, tray icon and settings UI, HTTPS "plan B" with a locally-trusted certificate, auto-update. v1.0 runs as a console app started by hand. |
| **D7** | **The web side is in scope for this set.** Where the correct fix belongs in `Apps/web` rather than in the helper, it is made there — see G1 and G3 below. |

### Why Go, in one paragraph

The whole problem is writing raw bytes to a USB printer that already has a vendor driver bound to
it. libusb-class access is what got WebUSB rejected in the first place, and `node-usb` hits the
identical wall; the only route that coexists with the driver is the Win32 spooler with the `RAW`
datatype (`OpenPrinter` → `StartDocPrinter("RAW")` → `WritePrinter`) — what Zebra Browser Print
itself does. From Go that is a plain `golang.org/x/sys/windows` syscall; from Node it is a native
addon with `node-gyp`, per-Node-version prebuilds and Windows build tools. Go additionally
cross-compiles windows/amd64 from this Linux box and produces one ~8 MB file with nothing to
install beside it. The helper shares no code with the web — all byte generation is web-side by
design — so the usual "keep one language" argument buys very little here.

---

## 2. What the helper must satisfy — verified against the code, not the prose

Read from `Apps/web/src/lib/print-bridge.ts`, `Apps/web/src/types/print-bridge.types.ts`,
`Apps/web/src/lib/zpl.ts`, `Apps/web/src/lib/escpos.ts` and all five call sites.

1. `GET /status` — no auth, must answer **well inside 1500 ms** (`AbortSignal.timeout`, client
   aborts). Only `{"ok":true}` is required.
2. `POST /print` — ack within **5000 ms**. The web treats success as *HTTP 2xx **and** `ok:true` in
   the body*; anything else (non-2xx, unparseable body, `ok:false`, timeout) is a failure and
   triggers the browser fallback.
3. **Ack on queue, never on paper.** A helper that waits for physical completion times out on a long
   receipt, the web falls back, and the customer gets two copies.
4. **Copies rule** — `ZPL`: write the payload **exactly once** (`^PQ` is already inside it, and a
   batch carries one `^PQ` per `^XA…^XZ` block). `ESCPOS`: write the payload **`copies` times**.
5. `payload` is **always base64**, both languages.
6. **The web never retries.** `jobId` exists so the helper can de-duplicate a double-click.
7. CORS on both endpoints, `Access-Control-Allow-Private-Network: true` on the preflight, and
   **never** `Access-Control-Allow-Credentials` — the web sends `credentials: "omit"`. See §4.1:
   that same `credentials: "omit"` is what makes a wildcard `Access-Control-Allow-Origin: *` legal
   here, which is how G5 is settled.

### The five callers

| Call site | target | language | copies | Notes |
|---|---|---|---|---|
| `admin/products/components/barcode-label-dialog.tsx` | `label` | ZPL | quantity | one `^XA…^XZ` |
| `admin/supplier-invoices/components/barcode-labels-dialog.tsx` | `label` | ZPL | N | **one POST, N blocks** — payload can be tens of KB |
| `staff/repairs/components/RepairLabelDialog.tsx` | `label` | ZPL | quantity | |
| `staff/pos/StaffPos.tsx` | `receipt` | ESCPOS | 1 | logo target |
| `staff/repairs/components/RepairTicketDetail.tsx` | `receipt` | ESCPOS | 1 | logo target |

---

## 3. Gaps found, and how each is settled

These were real conflicts between the protocol doc and the shipped code. All five are now decided;
none blocks the start of work. Two of them are fixed in `Apps/web`, per D7.

**G1 — the `dpi` in `/status` is dead code on the web side. → Fix the web.**
The protocol doc says `printers.label.dpi` "is read by the web to pick the mm→dots factor for ZPL".
It is not. All three label call sites pass the hardcoded constant
`PRINT_BRIDGE_DEFAULT_LABEL_DPI` (203) into `buildZplLabel`, so on a 300 dpi Zebra every label
would print at roughly 68 % of its intended size — and the helper cannot correct that without
parsing and re-rendering ZPL, which the byte-pipe rule forbids.

The fix belongs on the web because the web is the only party that does the mm→dots arithmetic.
`usePrintBridgeStatus()` **already returns the parsed `status` object** and already dedupes the
probe across dialogs, so this is small and additive:

- `Apps/web/src/hooks/use-print-bridge.ts` — expose a derived
  `labelDpi = status?.printers?.label?.dpi ?? PRINT_BRIDGE_DEFAULT_LABEL_DPI`, so the fallback lives
  in exactly one place and every consumer gets a number, never `undefined`.
- `barcode-label-dialog.tsx`, `barcode-labels-dialog.tsx`, `RepairLabelDialog.tsx` — pass that
  `labelDpi` into `buildZplLabel`/`buildZplBatch` instead of the constant.

`PRINT_BRIDGE_DEFAULT_LABEL_DPI` stays as the fallback for "helper reachable but silent about dpi"
and for the browser-fallback path. The helper reports `dpi` from `printers.label.dpi` in its config,
so the shop's actual resolution is declared once, on the machine that knows it. **Net effect: the
hardware question stops being a blocker — a 300 dpi Zebra is now a one-line config change.**

**G2 — protocol doc says the helper is not in this repository.** `Apps/bridge/` already exists
(empty, untracked). Amend `Docs/print-bridge-protocol.md` lines 3–5 in Sprint 7.

**G3 — the logo needs one new optional field on the print job. → The web sends it.** *(confirmed)*
Three options were considered: helper config holding the URL (goes stale whenever the owner changes
the logo in admin — rejected); the helper calling `GET /platform/settings/public` itself
(self-updating, but couples the helper to the API's base URL and route shape for one string —
rejected); and the web sending it, which is what we do.

`PrintJob` gains an **optional** `logoUrl?: string`, populated only by the two receipt call sites
from `publicSettings.data?.store.printLogoUrl ?? publicSettings.data?.store.logoUrl`. This is a
**protocol 1.1 addition, backward compatible in both directions**: an old helper ignores the unknown
field, a new helper receiving no field prints exactly as today. Cost on the web: one field in
`print-bridge.types.ts` plus two call-site lines.

Nothing else on the web changes — in particular `pos-receipt-escpos.ts` and
`repair-receipt-escpos.ts` keep emitting the bold double-height store name, because the HTML receipt
prints the logo *and* the name (`PosReceiptView.tsx:150-162`), so prepending the raster above the
name is parity rather than duplication.

**The helper never turns a logo problem into a print problem.** Absent field, empty string, `null`,
404, non-PNG content type, decode failure, timeout, oversize image, `logo.enabled: false` — every
one of these logs a warning at `WARN` and prints the receipt **without** the logo, still returning
`200 {"ok":true}`. There is no error path in which a missing logo costs the shop a receipt. Spelled
out again in §5.

**G4 — Go toolchain. → Present.** `go1.27.1 linux/amd64` is installed at `/usr/local/go`, but it is
**not on the PATH of non-login shells**; build commands and the `Makefile` must use
`export PATH=$PATH:/usr/local/go/bin` (or the absolute `/usr/local/go/bin/go`). A stale
`golang-1.13` apt package is also present on this machine — do not use it, it predates `log/slog`
and modules-by-default. `GOOS=windows GOARCH=amd64` cross-compilation is confirmed working.
`go.mod` declares `go 1.22` as the language floor; the dev toolchain is 1.27.1.

**G5 — the production web origin. → No allow-list needed; the default is `*`.** *(confirmed: no CORS
constraint)*
`Apps/web/src/lib/print-bridge.ts` sends `credentials: "omit"` on both requests and never attaches
the session token. The wildcard `Access-Control-Allow-Origin: *` is forbidden **only** for
credentialed requests, so it is fully legal here — which means the helper does not need to know the
Vercel URL at all, and one binary works on every counter and every deploy preview. Details and the
lock-down escape hatch in §4.1.

---

## 4. Architecture

```text
Apps/bridge/
├── go.mod                        module dragon-telecom/bridge  (go 1.22)
├── Makefile                      build, build-windows, test, fmt, vet
├── README.md                     install + config guide for the counter PC
├── config.example.json
├── cmd/dtbridge/
│   └── main.go                   flags, subcommands, config load, graceful shutdown
└── internal/
    ├── config/                   load + validate config.json, defaults, env overrides
    ├── httpapi/                  /status, /print, OPTIONS, CORS middleware, body cap
    ├── job/                      request schema, base64 decode, copies rule, language guard
    ├── dedupe/                   jobId LRU + TTL
    ├── queue/                    one worker goroutine per printer; ack-on-enqueue
    ├── device/                   Writer interface + backends
    │   ├── device.go               type Writer interface { Open() error; Write([]byte) error }
    │   ├── spooler_windows.go      winspool.drv RAW  (build tag windows)
    │   ├── spooler_other.go        stub returning "not supported on this OS"
    │   ├── tcp.go                  dial host:9100, write, close
    │   ├── file.go                 /dev/usb/lp0, LPT1, or a path — dev + Linux counters
    │   └── sink.go                 --dry-run: writes jobs to .bin files, used by every test
    ├── escpos/                    raster command builder (GS v 0), band chunking
    ├── logo/                      fetch → decode PNG → downscale → 1-bit → cache
    └── logging/                   slog to stdout + rotating file, jobId on every line
```

**Dependency policy.** Standard library only, plus `golang.org/x/sys/windows` — unavoidable for the
spooler syscalls, and an official Go module. No HTTP framework (net/http is enough), no logging
library (`log/slog`), no image library (`image/png` is stdlib; the box-filter downscale is ~30
lines). Anything beyond this list needs owner sign-off per the project rules.

### Configuration

`config.json` beside the executable; `--config <path>` overrides. Validated at startup, and the
process **refuses to start** on an invalid config rather than failing later at print time.

```jsonc
{
  "port": 9110,
  "allowedOrigins": ["*"],            // default; see §4.1. An explicit list locks it down.
  "logFile": "dtbridge.log",
  "printers": {
    "label": {
      "language": "ZPL",
      "transport": "spooler",           // "spooler" | "tcp" | "file"
      "queueName": "ZDesigner GK420d",  // spooler only — exact Windows queue name
      "dpi": 203
    },
    "receipt": {
      "language": "ESCPOS",
      "transport": "tcp",               // the same three choices, independently
      "host": "192.168.1.50",
      "port": 9100,
      "widthMm": 80,
      "widthDots": 576,
      "cutCommand": "auto",             // "auto" | "GSV66" | "GSV0" | "GSV1" | "none"
      "codePage": null,                 // null = leave the web's ESC t 0 alone
      "logo": { "enabled": true, "maxWidthDots": 384, "threshold": 128 }
    }
  }
}
```

`printers.<target>.language` is what makes D2 real: the helper **rejects a job whose `language` does
not match the configured printer's** with `400 {"ok":false,"error":"language mismatch"}` rather than
sending ZPL to a receipt head and spooling a metre of ASCII.

`cutCommand` and `codePage` are the two hardware overrides the protocol doc reserves for the helper.
`"auto"` means "leave the web's bytes untouched"; any other value rewrites the trailing cut sequence
(and, for `codePage`, the leading `ESC t n` selector) — the one place the helper is allowed to edit a
payload, because it is the only party that knows the device.

`printers.label.dpi` is what `/status` reports and what the web now consumes for its mm→dots
arithmetic (G1). It is the single place the shop's label resolution is declared.

### 4.1 CORS, and why the traffic only goes one way

**CORS is not optional, but it is trivial here.** The browser enforces it regardless of what our
code wants: the page is served from `https://…vercel.app` and the helper answers on
`http://localhost:9110`, which are different origins, and `Content-Type: application/json` makes
`/print` a non-simple request that always preflights. So the helper must answer `OPTIONS` and must
send the headers. What the "no CORS constraint" answer settles is *which* origins to allow, not
whether to speak CORS at all.

Two modes, and the default needs no configuration:

- **`allowedOrigins: ["*"]` (default)** → `Access-Control-Allow-Origin: *`, no `Vary` needed. Legal
  precisely because `print-bridge.ts` uses `credentials: "omit"`; the wildcard is only rejected for
  credentialed requests. One binary then works against production, every Vercel preview URL, and
  `http://localhost:5173` in dev, with nothing to update when a domain changes.
- **An explicit list** → echo the request's `Origin` when it matches, add `Vary: Origin`, and answer
  `403` otherwise.

Both modes always send `Access-Control-Allow-Private-Network: true` on the preflight and **never**
send `Access-Control-Allow-Credentials`.

The cost of the wildcard, stated plainly: any web page the cashier happens to open could POST to
`localhost:9110` and waste paper. The blast radius is a roll of thermal paper on one PC — no data is
readable (the helper returns only `{"ok":true}`) and no credential is involved. The allow-list mode
exists for a shop that wants it tightened; it is a config edit, not a rebuild.

**On direction — yes, you are right: traffic is web → helper only, and that is by design.**

1. The helper is an HTTP *server*; the page is the client. A browser page cannot accept an inbound
   connection — there is nothing for the helper to call *into*. Any channel has to be opened by the
   page.
2. There is nothing to push. Protocol rule 3 makes `/print` fire-and-forget by design (ack on queue,
   not on paper), and the one piece of state the web does care about — "is the helper alive" — is
   already pulled: `usePrintBridgeStatus()` re-probes `/status` on a 30 s `staleTime`.
3. Keeping it one-way keeps the helper credential-free. It never talks to our API, never holds a
   token, and `credentials: "omit"` on the web side is the other half of that guarantee.

The helper makes exactly **one** outbound request of its own: fetching the logo PNG from R2 (§5).
It never calls our API and never calls the browser.

If we later want a push channel — a "printer out of paper" toast, say — that would be SSE on a
`GET /events` endpoint, still opened by the browser. It is a v1.1 candidate and is not needed for
anything v1.0 does.

### Request lifecycle

```text
POST /print
  → CORS middleware (origin allow-list, Vary, PNA)
  → body cap 8 MB (a 14-line supplier-invoice ZPL batch is tens of KB; the cap is anti-abuse)
  → decode + validate job; unknown target / language mismatch / bad base64 → 4xx
  → dedupe.Seen(jobId)? → 200 {"ok":true}, log "deduped", print nothing
  → build byte stream:
        ZPL    : payload, once
        ESCPOS : (logoBlock? + payload) × copies
  → queue.Enqueue(target, bytes)   ← non-blocking; fails only if the queue is full
  → 200 {"ok":true}                ← ACK HERE, per protocol rule 3
  ── worker goroutine, off the request path ──
  → device.Open() → Write() → Close(); errors go to the log, never to the client
```

One worker per target serialises writes to that device, so two cashiers hammering Print cannot
interleave two receipts into one stream. A full queue (default depth 16) is the *only* enqueue-time
failure and answers `503 {"ok":false,"error":"print queue full"}` → the web falls back to the
browser, which is the right outcome.

**Ack-on-queue and reporting device errors are in tension by design.** The protocol chose the ack;
a printer that is out of paper therefore returns `200` and the failure shows up in the log and in
the next `/status`. v1.0 does not try to be cleverer than the protocol.

### `/status`

```json
{"ok":true,"version":"1.0.0",
 "printers":{"label":{"connected":true,"language":"ZPL","dpi":203},
             "receipt":{"connected":true,"language":"ESCPOS","widthMm":80}}}
```

`connected` is **best-effort and never blocks the response**: a background prober checks each device
every 10 s (TCP dial with a 500 ms timeout; spooler queue exists and is not in an error state) and
`/status` reports the last cached result. Probing inside the handler would risk the web's 1.5 s
abort. The web does not gate on `connected` anyway — the POST is the real test.

### De-duplication

In-memory map + LRU, **500 entries / 10 minute TTL**, keyed on `jobId`. A repeat inside the window
returns `200 {"ok":true}` and prints nothing. Deliberately not persisted across restarts: a restart
is rare, and a lost dedupe entry costs one duplicate receipt at worst, whereas a stale on-disk cache
could silently swallow a genuine reprint.

---

## 5. Logo pipeline (the one non-obvious part)

`store.printLogoUrl` already exists in `PublicSettingsResponseSchema`
(`Apps/contract/src/modules/platform/platform.dtos.ts:81`) and S26.1 defined it precisely for this:
a **PNG, already black-and-white, stored without lossy encoding, capped at
`PRINT_LOGO_MAX_WIDTH` = 600 px**. The R2 bucket serves it publicly, and the helper fetches
server-side, so the `getImageData` cross-origin problem that blocked this web-side does not exist
here.

```text
job.logoUrl  →  cache hit?  →  emit cached raster bytes
     │ miss
     ├─ GET url, 3 s timeout, 2 MB cap, must be image/png
     ├─ decode (image/png), downscale by box filter to min(maxWidthDots, widthDots) keeping aspect
     ├─ threshold at config.threshold (default 128) → 1-bit, MSB-first, row-padded to whole bytes
     ├─ emit  ESC @ | ESC a 1 | GS v 0 m=0 xL xH yL yH <data> | LF | ESC a 0
     └─ cache in memory keyed by URL (+ on disk beside the exe), evict on URL change
```

**Why no dithering.** `printLogoUrl` is uploaded already monochrome; Floyd–Steinberg on an image
that is already 1-bit only adds noise a thermal head renders as speckle. A straight threshold is
correct here, and `threshold` is exposed in config for a logo that turns out to be grey-ish.

**Why `GS v 0` and not `GS ( L`.** `GS v 0` is the obsolete-but-universally-implemented raster
command; `GS ( L` is cleaner and less widely supported on the Epson-compatible clones this shop is
likely to have. Height is chunked into bands of 128 dot-rows, because some clones misbehave above a
few hundred rows in a single command.

**Why prepend rather than splice.** The web's payload opens with `ESC @` (INIT), which resets
formatting — so emitting the logo block *before* the payload needs no parsing of the payload at all
and cannot corrupt it. With `copies > 1` the whole `logoBlock + payload` pair repeats per copy.

**Fail-open, always — owner-confirmed.** Field absent, empty string, `null`, HTTP 404 or any non-2xx,
non-PNG content type, body over the 2 MB cap, decode failure, fetch timeout, `logo.enabled: false` —
every one of these logs a single `WARN` line carrying the `jobId` and prints the receipt **without**
the logo, still returning `200 {"ok":true}`. There is no branch in which a logo problem becomes a
print error or a browser fallback. The bold double-height store name the web emits is always
present, so the receipt always identifies the shop.

A failed URL is negative-cached for 60 s so a broken logo cannot add a 3 s fetch attempt to every
receipt during a busy hour.

---

## 6. Sprints

| # | Goal | Done when |
|---|---|---|
| **0** | ~~Resolve G1–G5.~~ **Done** — all five settled in §3. Nothing blocks Sprint 1. | — |
| **1** | Scaffold: `go.mod`, `cmd/dtbridge`, config load + validation + defaults, `log/slog` to stdout and file, `--config` / `--dry-run` / `--version` flags. | `dtbridge --config config.example.json` starts, logs its resolved config, exits cleanly on SIGINT. |
| **2** | HTTP layer: `/status`, `/print`, `OPTIONS`, CORS + PNA middleware, body cap, read/write timeouts, job validation, dedupe. Device calls still stubbed to the sink. | `httptest` suite green: exact-origin echo, `Vary`, PNA header, no `Allow-Credentials`, 4xx shapes, dedupe returns 200 and prints once. |
| **3** | Device layer: `Writer` interface, `tcp.go`, `file.go`, `sink.go`, background connectivity prober feeding `/status`. | A fake TCP listener receives exactly the expected bytes; `--dry-run` writes `.bin` files. |
| **4** | Windows spooler backend (`spooler_windows.go`, build-tagged) + `dtbridge list-printers`. | Cross-compiles clean for windows/amd64; `go vet` clean on both tags. Real-hardware verification is deferred to §8. |
| **5** | Queue + worker per target, ack-on-enqueue, **copies rule**, language guard, `cutCommand`/`codePage` overrides. | Golden-file tests: ZPL written once for `copies: 5`; ESC/POS written 5×; mismatched language 400; cut-byte substitution correct. |
| **6** | Logo pipeline: fetch, decode, downscale, threshold, `GS v 0` banding, cache, negative-cache, fail-open on every error path. | Byte-exact golden test against a fixture PNG; every failure mode produces the receipt minus the logo, a `200`, and one `WARN` line. |
| **7** | **Web-side changes (D7)**, in `Apps/web`: G1 — derive `labelDpi` in `use-print-bridge.ts` and thread it through the three label dialogs; G3 — add `logoUrl?: string` to `PrintJob` and populate it in the two receipt call sites. | `tsc --noEmit` → 0, `lint` → 0 on every touched file, existing web suite still green. |
| **8** | Packaging + docs: `Makefile` cross-compile (with the `/usr/local/go/bin` PATH note), `README.md` install guide for counter staff, `config.example.json`, `.gitignore` for build output, and **amend `Docs/print-bridge-protocol.md`** — in-repo location, the `logoUrl` field, the `*` CORS default, protocol 1.1. | `make build-windows` produces `dtbridge.exe` on the Linux box; docs merged. |

Sprints 1–3 and 5–7 are fully testable on this Linux machine. Sprint 4 is the only one that cannot
be verified without Windows.

Sprint 7 is deliberately last among the code sprints: the helper must already answer `/status` with
a real `dpi` before the web starts trusting it, and `logoUrl` should not appear on the wire before
something knows what to do with it.

---

## 7. Testing without hardware

- `sink.go` + `--dry-run` capture every job as a `.bin`, so the byte stream is assertable end to end.
- **Golden files** for the copies rule, the cut-command override, and the logo raster, generated from
  payloads captured from the real web app (a browser devtools "copy as fetch" of a genuine `/print`
  POST is the fixture source — no guessing at what the web emits).
- `httptest` covers the whole CORS/PNA surface, which is the part most likely to break silently in a
  browser.
- A fake TCP listener stands in for a network printer; `file.go` against a temp file stands in for a
  USB one.
- A `scripts/replay.sh` replaying captured jobs against a running helper, for the eventual
  hardware day.

There is no browser automation in this environment, so **the web↔helper handshake is verified by the
owner in a real browser**, per §8.

---

## 8. Hardware / browser acceptance (owner, after Sprint 8)

1. `dtbridge` starts, logs both printers, `curl http://localhost:9110/status` returns `ok:true`.
2. Set `VITE_PRINT_BRIDGE_URL=http://localhost:9110` (or the `dt_print_bridge_url` localStorage key)
   → the printer-mode hint flips to "detected".
3. Product label, Thermal, quantity 3 → **three** labels, no browser dialog. (Quantity 1 first: this
   is where a wrong copies rule shows up as 9 labels.)
4. Supplier-invoice batch of N lines → N labels from **one** POST.
5. Repair label → prints; barcode scans with a real scanner.
6. POS receipt → prints, **logo at the top**, French accents correct, amounts not garbled
   (the U+202F trap), paper cuts.
7. Repair receipt → same.
7b. **Break the logo on purpose** — set `printLogoUrl` to a 404 in admin settings, print a receipt.
   The receipt must still print, in full, without the logo, with no toast and no browser dialog.
7c. **Change `printers.label.dpi` in the helper config** (e.g. 203 → 300), restart, reload the app,
   print a label. The label geometry must change — that proves G1's `/status` → web path is live
   rather than still reading the hardcoded 203.
8. Press Print twice fast → **one** receipt (dedupe).
9. Stop the helper mid-session, Print → exactly one warning toast **and** the browser dialog; no
   double print. Restart, reload, Print → back to thermal.
10. Choose **Browser** explicitly with the helper running → browser dialog, nothing reaches the
    helper.
11. First print from the HTTPS production site: note whether Chrome shows a Private Network Access
    permission prompt, and record which Chrome version — this is the one thing the repo cannot
    predict.

---

## 9. Risks

| Risk | Handling |
|---|---|
| Chrome PNA hard-blocks loopback from HTTPS | The header is sent regardless. If blocked, the fallback still prints — worst case is today's behaviour. The HTTPS-on-loopback "plan B" stays out of v1.0 and becomes v1.1 only if item 11 above fails. |
| Wrong cut command on a clone | `cutCommand` config override, no rebuild. |
| Wrong code page on a clone | `codePage` config override, no rebuild. |
| 300 dpi Zebra | Handled by G1: the helper declares `dpi` in config and reports it on `/status`; the web reads it from Sprint 7 on. A one-line config change, no rebuild. |
| Wildcard CORS lets any site print junk | Accepted for v1.0 — the blast radius is one roll of paper on one PC, nothing is readable, no credential is involved. `allowedOrigins` takes an explicit list if the shop wants it tightened. |
| Broken or slow logo URL slows every receipt | Fail-open plus a 60 s negative cache; the fetch is capped at 3 s and never blocks the ack, which happens at enqueue. |
| Spooler backend untestable here | Isolated behind `Writer`, build-tagged, and every other backend is tested. It is ~80 lines of syscall. |
| Counter PC without Go/Node/.NET | That is the point of D3 — one file, copy and run. |
| Helper not running after a reboot | Accepted for v1.0 (D6): the browser fallback covers it. Auto-start is the first v1.1 candidate. |
