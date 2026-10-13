// Looping background track. Playback has to begin inside a click, so `start()`
// is called from the Enter button with the volume at zero, and `fadeIn()` is
// called separately when the scene actually opens. Volume goes through a Web
// Audio gain node because iOS Safari ignores `audio.volume`.

export function createBackgroundMusic({
  src = "/assets/audio/background.mp3",
  volume = 0.5, // target loudness (0-1) once faded in
} = {}) {
  // Created up front so the file buffers while the loading screen is showing.
  const audio = new Audio(src);
  audio.loop = true;
  audio.preload = "auto";

  let ctx = null;
  let gain = null;
  let on = false;
  let pauseTimer = null;

  function onVisibility() {
    if (document.hidden) ctx.suspend();
    else if (on) ctx.resume();
  }

  function rampTo(value, seconds) {
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(value, now + seconds);
  }

  return {
    // Must be called from inside a click/tap handler. Starts silent; call
    // fadeIn() to bring it up.
    start() {
      on = true;
      clearTimeout(pauseTimer);
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        gain = ctx.createGain();
        gain.gain.value = 0;
        ctx.createMediaElementSource(audio).connect(gain).connect(ctx.destination);
        document.addEventListener("visibilitychange", onVisibility);
      }
      ctx.resume();
      audio.play().catch(() => {});
    },

    fadeIn(seconds = 4) {
      if (!on) return;
      rampTo(volume, seconds);
    },

    // Fades out, then pauses so the track picks up where it left off.
    stop(seconds = 0.8) {
      if (!on) return;
      on = false;
      rampTo(0, seconds);
      pauseTimer = setTimeout(() => {
        audio.pause();
        ctx.suspend();
      }, seconds * 1000);
    },
  };
}
