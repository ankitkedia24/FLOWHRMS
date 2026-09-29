/**
 * The notification sound.
 *
 * Synthesised with WebAudio rather than shipped as a file, for three
 * reasons that all matter on a warehouse phone: no network request on a bad
 * connection, no decode delay, and nothing to 404 after a deploy.
 *
 * Two constraints are not ours to argue with:
 *
 * 1. **Browsers refuse to play audio before a user gesture.** An
 *    AudioContext created on page load starts suspended. So we create it on
 *    the first real interaction and keep it — trying to play before then
 *    fails silently, which would look like a broken feature.
 * 2. **A sound is an interruption.** It is off unless the person turns it
 *    on, the preference is remembered, and it never plays more than once
 *    for a batch. Somebody working a shift should not be pinged eleven
 *    times because eleven things arrived at once.
 *
 * Two soft notes, a rising fourth. Short, quiet, and nothing like an alarm
 * — this asks for attention, it does not demand it.
 */

const STORAGE_KEY = "flowhrms-action-sound";

type AudioContextCtor = typeof AudioContext;

function audioContextCtor(): AudioContextCtor | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor })
      .webkitAudioContext ??
    null
  );
}

export function soundSupported(): boolean {
  return audioContextCtor() !== null;
}

export function soundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

/**
 * A tiny store so React can read the preference with
 * `useSyncExternalStore` instead of copying it into state inside an
 * effect — the copy is what produces a hydration flash and a cascading
 * render.
 */
const listeners = new Set<() => void>();

export function subscribeSound(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Server render has no localStorage; off is the honest default. */
export function soundServerSnapshot(): boolean {
  return false;
}

export function setSoundEnabled(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Private mode: the preference simply does not persist.
  }
  for (const listener of listeners) listener();
}

let context: AudioContext | null = null;

/** Call from a click handler — outside a gesture the context stays suspended. */
export function unlockAudio(): void {
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  context ??= new Ctor();
  if (context.state === "suspended") void context.resume();
}

function tone(ctx: AudioContext, freq: number, startAt: number, length: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;

  // Ramped, not switched: a square-edged gain change clicks audibly.
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(0.14, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + length);

  osc.connect(gain).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + length + 0.02);
}

/** Play the chime. A no-op when unsupported, muted or still locked. */
export function playChime(): void {
  if (!soundEnabled()) return;
  const Ctor = audioContextCtor();
  if (!Ctor) return;
  context ??= new Ctor();
  if (context.state !== "running") return;

  const now = context.currentTime;
  tone(context, 587.33, now, 0.16); // D5
  tone(context, 783.99, now + 0.13, 0.22); // G5
}
