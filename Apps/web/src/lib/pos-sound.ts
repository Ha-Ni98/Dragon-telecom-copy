// POS audio feedback — a short "beep" when a product goes onto the ticket (clicked or scanned) and
// a low double buzz when nothing was added (unknown barcode, no stock left), so the cashier hears
// the outcome without looking at the screen. Synthesised with the Web Audio API: no audio file to
// ship or cache, no dependency.
//
// One AudioContext is created lazily and reused. Browsers start it "suspended" until a user
// gesture; a click and a barcode scanner's keystrokes (a scanner is a keyboard) both count, so
// resume() inside the handler is enough. Every call is guarded: a missing or failing AudioContext
// (old browser, jsdom in tests) is a silent no-op — a beep must never break a sale.

// Success: one short, bright beep, like a supermarket scanner.
const SUCCESS_FREQUENCY_HZ = 1500;
const SUCCESS_DURATION_S = 0.09;
// Error: two low buzzes with a short gap — clearly different from the success beep.
const ERROR_FREQUENCY_HZ = 220;
const ERROR_DURATION_S = 0.12;
const ERROR_GAP_S = 0.08;
// Peak gain and the attack/release ramps that keep the tone from clicking at its edges.
const PEAK_GAIN = 0.2;
const RAMP_S = 0.005;

let context: AudioContext | null = null;

function getContext(): AudioContext | null {
  try {
    if (!context) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
    }
    if (context.state === "suspended") void context.resume();
    return context;
  } catch {
    return null;
  }
}

function tone(ctx: AudioContext, frequency: number, startAt: number, duration: number): void {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(PEAK_GAIN, startAt + RAMP_S);
  gain.gain.setValueAtTime(PEAK_GAIN, startAt + duration - RAMP_S);
  gain.gain.linearRampToValueAtTime(0, startAt + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + duration);
}

export function playPosSuccess(): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    tone(ctx, SUCCESS_FREQUENCY_HZ, ctx.currentTime, SUCCESS_DURATION_S);
  } catch {
    // Audio is best-effort only.
  }
}

export function playPosError(): void {
  const ctx = getContext();
  if (!ctx) return;
  try {
    const start = ctx.currentTime;
    tone(ctx, ERROR_FREQUENCY_HZ, start, ERROR_DURATION_S);
    tone(ctx, ERROR_FREQUENCY_HZ, start + ERROR_DURATION_S + ERROR_GAP_S, ERROR_DURATION_S);
  } catch {
    // Audio is best-effort only.
  }
}
