// A quiet impact played when a shockwave goes off (the desert or the chrome
// blob, tapped or charged and released). Follows the same
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

// Blasts further from the camera sound quieter, falling off like a sound in
// space would: full volume out to NEAR_DISTANCE, then inversely with
// distance at a rate set by ROLLOFF (about half at 10 world units, a quarter
// at 25).
const NEAR_DISTANCE = 4; // world units
const ROLLOFF = 0.1;

// power: 0 for a plain tap up to 1 for a fully charged blast, which is
// louder and lower. distance: world units from the camera to the blast.
export function playImpactSound(power = 0, distance = 0) {
  if (!enabled || !buffer) return;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const gain = ctx.createGain();
  const beyond = Math.max(distance - NEAR_DISTANCE, 0);
  const falloff = NEAR_DISTANCE / (NEAR_DISTANCE + ROLLOFF * beyond);
  gain.gain.value = VOLUME * (1 + power * 2.2) * falloff;
  source.playbackRate.value = 1 - power * 0.35;
  source.connect(gain).connect(master);
  source.start();
}

// The sound of charging the blob: filtered noise that swells and brightens
// over `riseSeconds`, then holds at full with a restless shimmer until it's
// stopped. Stopping lets it fall away over a short tail under the impact.
const CHARGE_VOLUME = 0.1;
const CHARGE_FILTER_FROM = 25; // Hz at the start of the rise
const CHARGE_FILTER_TO = 280; // Hz once fully charged
const CHARGE_RELEASE = 1.2; // seconds for the charge to die away after release

let noiseBuffer = null;
let charging = null;

function getNoiseBuffer() {
  if (noiseBuffer) return noiseBuffer;
  const length = ctx.sampleRate * 2;
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  // Pink-ish noise (a running average of white) is less hissy than white.
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = last * 0.82 + (Math.random() * 2 - 1) * 0.18;
    data[i] = last * 3.2;
  }
  return noiseBuffer;
}

export function startChargeSound(riseSeconds) {
  if (!enabled || !ctx || charging) return;
  const now = ctx.currentTime;

  const source = ctx.createBufferSource();
  source.buffer = getNoiseBuffer();
  source.loop = true;

  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.Q.value = 0.8;
  filter.frequency.setValueAtTime(CHARGE_FILTER_FROM, now);
  filter.frequency.exponentialRampToValueAtTime(CHARGE_FILTER_TO, now + riseSeconds);
  filter.Q.setValueAtTime(0.8, now);
  filter.Q.linearRampToValueAtTime(3, now + riseSeconds);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(CHARGE_VOLUME, now + riseSeconds);

  // Once the rise is done, a fast wobble in the filter keeps the hold alive.
  const lfo = ctx.createOscillator();
  const lfoDepth = ctx.createGain();
  lfo.frequency.value = 9;
  lfoDepth.gain.setValueAtTime(0, now);
  lfoDepth.gain.linearRampToValueAtTime(250, now + riseSeconds);
  lfo.connect(lfoDepth).connect(filter.detune);

  source.connect(filter).connect(gain).connect(master);
  source.start();
  lfo.start();
  charging = { source, lfo, gain, filter };
}

export function stopChargeSound() {
  if (!charging) return;
  const { source, lfo, gain, filter } = charging;
  charging = null;
  const now = ctx.currentTime;
  const end = now + CHARGE_RELEASE;
  // The tail falls away: volume decays and the filter slides back down
  // from wherever the charge had reached, so it sounds like energy letting go.
  gain.gain.cancelScheduledValues(now);
  gain.gain.setValueAtTime(Math.max(gain.gain.value, 0.0001), now);
  gain.gain.exponentialRampToValueAtTime(0.0001, end);
  const from = Math.max(filter.frequency.value, CHARGE_FILTER_FROM);
  filter.frequency.cancelScheduledValues(now);
  filter.frequency.setValueAtTime(from, now);
  filter.frequency.exponentialRampToValueAtTime(CHARGE_FILTER_FROM, end);
  source.stop(end + 0.05);
  lfo.stop(end + 0.05);
}
