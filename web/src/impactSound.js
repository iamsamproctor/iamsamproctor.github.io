// A quiet impact played when the chrome blob is tapped. Follows the same
// pattern as revealSound.js: the file is fetched up front, decoded once the
// AudioContext exists (which needs a click), and only plays while sound is on.

const SRC = "/assets/audio/far_impact.wav";
const VOLUME = 0.3;

const fileRequest = fetch(SRC).then((res) => res.arrayBuffer());

let ctx = null;
let master = null;
let buffer = null;
let enabled = false;

// Must be called from inside a click/tap handler the first time it's enabled.
export function setImpactSoundEnabled(on) {
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
  // Ramping the master fades out a ringing tail when toggled off.
  master.gain.setTargetAtTime(on ? 1 : 0, ctx.currentTime, 0.1);
}

export function playImpactSound() {
  if (!enabled || !buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  gain.gain.value = VOLUME;
  source.connect(gain).connect(master);
  source.start();
}
