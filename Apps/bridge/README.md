# dtbridge — local print helper

`dtbridge` runs on the counter PC and lets the web app print ZPL labels and ESC/POS receipts
directly to the shop's thermal printers, instead of going through the browser's print dialog. It
implements the HTTP contract in
[`Docs/Stage-04-Fixes/plans/bridge/print-bridge-protocol.md`](../../Docs/Stage-04-Fixes/plans/bridge/print-bridge-protocol.md).

**Nothing breaks without it.** Until `dtbridge` is installed and running, every print falls back
to today's browser print dialog — that is the intended behaviour, not an error state.

---

## Installing on a counter PC (Windows)

1. Copy `dtbridge.exe` (see [Building](#building), below) and `config.example.json` to a folder on
   the counter PC, e.g. `C:\dtbridge\`.
2. Rename `config.example.json` to `config.json` and edit it — see [Configuration](#configuration).
3. Find your printers' exact names/addresses:
   - **USB printer (installed via a Windows driver):** open `cmd.exe` in the `dtbridge` folder and
     run:
     ```
     dtbridge.exe list-printers
     ```
     Copy the exact printer name into `config.json`'s `queueName` — it must match character for
     character (Windows queue names commonly have spaces, e.g. `ZDesigner GK420d`).
   - **Network printer:** use the IP address already configured on the printer itself (check its
     self-test page or its own network settings menu). Port `9100` is the standard raw-print port
     almost every label/receipt printer listens on.
4. Start it:
   ```
   dtbridge.exe --config config.json
   ```
   A console window opens and logs stay on screen (and in `dtbridge.log` next to the exe). Leave
   this window open — closing it stops the helper and every print falls back to the browser again,
   which is safe, just not thermal.
5. Confirm it's alive: open `http://localhost:9110/status` in a browser on the same PC. You should
   see `{"ok":true,...}`.
6. Point the web app at it. The app is already configured for `http://localhost:9110` by default
   (`VITE_PRINT_BRIDGE_URL`). If this counter's helper runs on a different port, open the browser
   console on that PC once and run:
   ```js
   localStorage.setItem("dt_print_bridge_url", "http://localhost:9110");
   ```
   (substituting the real port). This is a one-time, per-browser setting — see the protocol doc's
   "Configuration on the web side" section for why.

**No auto-start in this version.** `dtbridge` must be started manually each time the counter PC
reboots (double-click `dtbridge.exe`, or pin a shortcut to it). Running it as a Windows service
that starts automatically is planned but out of scope for v1.0 — see the plan's D6. Until then, a
simple `.bat` file with `dtbridge.exe --config config.json` in it, placed in the Windows Startup
folder, is a reasonable stand-in.

## Configuration

`config.json` — see [`config.example.json`](config.example.json) for the full shape. The
process **refuses to start** if this file is invalid, and prints every problem it found at once.

| Field | Meaning |
|---|---|
| `port` | Where `dtbridge` listens. `9110` by default — must match what the web app is configured to reach. |
| `allowedOrigins` | `["*"]` (default) works for any deployment of the web app, including preview URLs, and is safe here — see the protocol doc's CORS section. Set an explicit list (e.g. `["https://your-shop.vercel.app"]`) only if you want to lock this down. |
| `printers.label` / `printers.receipt` | One block per printer. `transport` is `"spooler"` (Windows-installed USB/driver printer), `"tcp"` (network printer, raw port), or `"file"` (a device path — Linux/testing only). |
| `printers.label.language` | **`"ZPL"` or `"EPL"` — get this right or nothing prints.** Modern Zebras speak ZPL; pre-"Plus" desktop units such as the **LP 2824** are EPL2-only and silently discard ZPL. The web reads this from `/status` and builds labels in that language. Use `test-print --language` (above) to find out which yours speaks. |
| `printers.label.dpi` | Your Zebra's real resolution — `203` or `300`. Reported back to the web via `/status` so labels print at the correct physical size. |
| `printers.receipt.cutCommand` | `"auto"` (matches the web's default and is correct for most printers) or an override if your clone only supports one cut variant — see the protocol doc. |
| `printers.receipt.codePage` | `null` (default, correct for most printers) or `"CP1252"`/`"CP858"` if your printer doesn't support CP437 — see the protocol doc. |
| `printers.receipt.logo` | Prints the shop's logo at the top of receipts. `enabled: false` prints the bold store-name text instead (what every receipt did before this existed) — never a failure either way. |

## Testing a printer directly (`test-print`)

When a print silently does nothing, this sends bytes straight at the printer — bypassing the web
app, the HTTP layer and the queue — so the failure can be attributed to exactly one layer:

```
dtbridge.exe test-print --target label                 # built-in test in the configured language
dtbridge.exe test-print --target label --language EPL  # force a different label language
dtbridge.exe test-print --target receipt               # the 80mm receipt printer
dtbridge.exe test-print --file mylabel.txt --target label   # send your own raw bytes
```

**Label printers do not all speak the same language, and one given the wrong one typically does
nothing at all** — no error, no LED, no paper. `--language` exists to settle that in one command:
if `--language EPL` prints and the default `ZPL` does not, the printer is an EPL2 model (common on
pre-"Plus" Zebra desktop units such as the LP 2824) and the app must be configured to match.

`--file` sends a file's bytes verbatim, which is the fastest way to try command variants without
rebuilding anything. Note EPL2 requires **CRLF** line endings — Notepad produces these by default,
many programmer's editors do not.

## Troubleshooting

- **`/status` doesn't respond.** Check the console window is still open and didn't print an error
  on startup — an invalid `config.json` refuses to start entirely.
- **Web app shows "helper not detected".** Confirm the port in `VITE_PRINT_BRIDGE_URL` /
  `dt_print_bridge_url` matches `config.json`'s `port`. Also confirm nothing else (antivirus,
  another program) is already using that port.
- **Browser shows a one-time network permission prompt on first print.** That's expected — Chrome
  asks permission before a public HTTPS page can reach a loopback address. Approving it once is
  enough; it should not reappear. See the protocol doc's "Private Network Access" section if it
  keeps happening.
- **Label prints at the wrong size.** Check `printers.label.dpi` matches the printer's real
  resolution (most desktop Zebras are 203; some are 300).
- **Labels print nothing at all, but receipts are fine.** Almost certainly `printers.label.language`
  is wrong. Run `test-print --target label --language EPL` and then `--language ZPL`: whichever
  prints is what the printer speaks, and that is the value to put in `config.json`. A Zebra given
  the other one does not complain — it just ignores the job entirely.
- **Barcodes print but won't scan.** The bars are too narrow for the reader. The label dialog warns
  when the calculated module width falls under 0.25 mm; widening the label, shortening the barcode,
  or clearing the store-name column all buy width back.
- **Receipt prints garbled accented characters.** Your printer likely doesn't support CP437 — try
  setting `printers.receipt.codePage` to `"CP1252"`.
- **Labels come out doubled, or receipts print twice.** This is exactly the bug class the
  `copies` rule exists to prevent — please report it rather than working around it; it means
  something is wrong in `dtbridge` itself, not your printer.
- **The log says the job was accepted but nothing printed.** `job accepted by device` means only
  that every byte was handed over successfully — for a USB printer, that the Windows spooler
  queued it. It is not proof paper moved. Check the Windows print queue: if the job appears and
  then vanishes, the bytes reached the printer and it discarded them, which almost always means
  the wrong label language — use `test-print --language` above to find the right one. If the job
  sticks in the queue instead, it is a port/offline/driver problem and never reached the printer.
- **Logs.** `dtbridge.log` next to the exe has one line per print job, including why any print
  fell back or failed. It's the first place to look for anything above.

---

## Building

Requires Go 1.22+. From `Apps/bridge`:

```sh
make build           # native binary, for local testing on this machine
make build-windows   # dtbridge.exe (windows/amd64) — the real deliverable
make build-all       # + windows/386 and windows/arm64, for unusual counter PCs
make test            # go test ./... -race
make vet
```

`test-print` (above) also accepts `--dry-run`, so the command can be exercised with no printer
attached at all.

`--dry-run --dry-run-dir <path>` runs `dtbridge` against no real hardware at all: every print job
is captured to a `.bin` file in `<path>` instead of being written to a device. This is how the
whole pipeline — HTTP, queue, copies rule, rewrites, the logo pipeline — was verified without a
physical printer; see `Docs/Stage-04-Fixes/plans/bridge/print-bridge-plan-v1.md` §7.

```
dtbridge --config config.json --dry-run --dry-run-dir ./captured
```

### Layout

```
cmd/dtbridge/     entry point, flag parsing, wiring
internal/config/  config.json loading + validation
internal/httpapi/ /status, /print, CORS
internal/job/     request validation + decoding
internal/dedupe/  jobId de-duplication
internal/queue/   one worker per printer, the copies rule, ack-on-enqueue
internal/device/  Writer backends: TCP, file, Windows spooler, --dry-run capture
internal/escpos/  ESC/POS byte-level edits: cut command, code page, raster commands
internal/logo/    receipt logo: fetch, decode, downscale, threshold, cache
internal/logging/ stdout + file logging
```
