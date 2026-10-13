// Data-stream sound that accompanies the text scramble reveal. Each reveal
// plays a slice of loading.wav from a random point so repeats don't sound
// identical, and fades it out early if the text scrolls away or fades out
// before the animation finishes.

const SRC = "/assets/audio/loading.wav";
const VOLUME = 0.15;
const FADE_IN = 0.08; // seconds
const FADE_OUT = 0.3; // seconds; also used when cutting it short
const HIDDEN_OPACITY = 0.35; // below this the text counts as gone

// Fetch early so it's ready by the time the first heading scrambles; decoding
// waits for the AudioContext, which needs a click to exist.
const fileRequest = fetch(SRC).then((res) => res.arrayBuffer());

let ctx = null;
let master = null;
let buffer = null;
let enabled = false;

// Must be called from inside a click/tap handler the first time it's enabled.
export function setRevealSoundEnabled(on) {
  enabled = on;
  if (on && !ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.connect(ctx.destination);
    fileRequest
      .then((data) => ctx.decodeAudioData(data))
      .then((decoded) => {
        buffer = decoded;
      })
      .catch(() => {});
  }
  if (!ctx) return;
  if (on) ctx.resume();
  // Ramping the master fades out anything mid-play when toggled off.
  master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.1);
}

function effectiveOpacity(el) {
  let opacity = 1;
  for (let node = el; node && node !== document.body; node = node.parentElement) {
    opacity *= parseFloat(getComputedStyle(node).opacity);
  }
  return opacity;
}

function isGone(el) {
  const rect = el.getBoundingClientRect();
  if (rect.bottom < 0 || rect.top > window.innerHeight) return true;
  return effectiveOpacity(el) < HIDDEN_OPACITY;
}

export function playRevealSound(el, duration) {
  if (!enabled || !buffer) return;

  const now = ctx.currentTime;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true; // in case the animation outlasts the remaining clip

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(VOLUME, now + FADE_IN);
  // Fade so it ends right as the last character settles.
  const fadeAt = Math.max(now + FADE_IN, now + duration - FADE_OUT);
  gain.gain.setValueAtTime(VOLUME, fadeAt);
  gain.gain.linearRampToValueAtTime(0, fadeAt + FADE_OUT);

  source.connect(gain).connect(master);
  const offset = Math.random() * Math.max(buffer.duration - duration, 0);
  source.start(now, offset);
  source.stop(fadeAt + FADE_OUT);

  let stopped = false;
  source.onended = () => {
    stopped = true;
  };

  // Text often scrambles while its container is still fading in, so only
  // treat it as gone once it has actually been seen.
  let seen = false;
  const watch = () => {
    if (stopped) return;
    const gone = isGone(el);
    if (!gone) seen = true;
    if (seen && gone) {
      stopped = true;
      const t = ctx.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0, t + FADE_OUT);
      source.stop(t + FADE_OUT);
      return;
    }
    requestAnimationFrame(watch);
  };
  requestAnimationFrame(watch);
}
