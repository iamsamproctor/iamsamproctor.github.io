// Interface sounds: a short tick as the selection moves (between the menu's
// items, and between the project cards), a fuller one when a project is
// picked, a click for every other button, a swell as the menu opens, and a
// close as any window (the menu, a project, the portrait viewer) closes.
// Same pattern as impactSound.js: the files are fetched up front, decoded
// once the AudioContext exists (which needs a click), and only play while
// sound is on.

const SOUNDS = {
  switch: { src: "/assets/audio/SwitchTab.mp3", volume: 0.2 },
  // Above 1 is a boost: the file peaks at -12 dB, so this stays clear of
  // clipping up to about 3.5.
  select: { src: "/assets/audio/Selection.mp3", volume: 1.6 },
  click: { src: "/assets/audio/ButtonClick.mp3", volume: 0.6 },
  // The file peaks at -20 dB, so this boost stays clear of clipping up to
  // about 10.
  open: { src: "/assets/audio/ModalOpen.mp3", volume: 2 },
  close: { src: "/assets/audio/Close.mp3", volume: 0.35 },
};

const fileRequests = Object.fromEntries(
  Object.entries(SOUNDS).map(([name, { src }]) => [
    name,
    fetch(src).then((res) => res.arrayBuffer()),
  ]),
);

let ctx = null;
const buffers = {};
let enabled = false;

// Must be called from inside a click/tap handler the first time it's enabled.
export function setUiSoundEnabled(on) {
  enabled = on;
  if (on && !ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    for (const [name, request] of Object.entries(fileRequests)) {
      request
        .then((data) => ctx.decodeAudioData(data))
        .then((decoded) => {
          buffers[name] = decoded;
        })
        .catch(() => {});
    }
  }
  if (on) ctx.resume();
}

function play(name) {
  if (!enabled || !buffers[name]) return;
  const source = ctx.createBufferSource();
  source.buffer = buffers[name];
  const gain = ctx.createGain();
  gain.gain.value = SOUNDS[name].volume;
  source.connect(gain).connect(ctx.destination);
  source.start();
}

export const playSwitchSound = () => play("switch");
export const playSelectSound = () => play("select");
// Set while the event that played the close sound is still being handled, so
// the button that closed the window doesn't click as well. A timeout, not a
// microtask: microtasks run between an event's listeners.
let closedThisEvent = false;

export const playClickSound = () => {
  if (!closedThisEvent) play("click");
};
export const playOpenSound = () => play("open");
export const playCloseSound = () => {
  play("close");
  closedThisEvent = true;
  setTimeout(() => {
    closedThisEvent = false;
  });
};
