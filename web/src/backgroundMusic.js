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
  let ducked = false;
  let pauseTimer = null;

  // The element pauses along with the context. Left playing into a
  // suspended context, it piles up audio that plays back fast, and so
  // sharp, once the context resumes.
  function onVisibility() {
    if (document.hidden) {
      audio.pause();
      ctx.suspend();
    } else if (on) {
      ctx.resume().then(() => {
        if (on && !document.hidden) audio.play().catch(() => {});
      });
    }
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
        // The first play has to happen inside the click (iOS), so it can't
        // wait for the context; it starts silent anyway.
        ctx.resume();
        audio.play().catch(() => {});
        return;
      }
      // Turned back on after stop(): wait for the context before playing,
      // as in onVisibility. The element has played before, so it may play
      // outside the click.
      ctx.resume().then(() => {
        if (on) audio.play().catch(() => {});
      });
    },

    fadeIn(seconds = 4) {
      if (!on || ducked) return;
      rampTo(volume, seconds);
    },

    // Dips the track out of the way while something else plays with sound,
    // e.g. a work's audio example, then brings it back. It keeps playing
    // underneath, so it picks up in step.
    duck(down, seconds = 0.6) {
      ducked = down;
      if (!on) return;
      rampTo(down ? 0 : volume, seconds);
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
