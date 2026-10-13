// Procedural wind that follows scroll speed. No audio files: a looping buffer
// of pink noise is shaped by filters, and the filter brightness and loudness
// chase how fast the page is moving. To swap in a recorded sample later,
// replace the generated buffer in buildGraph() with a decoded audio file —
// the filters and scroll mapping below work the same on any looping source.

export function createWindScroll({
  maxGain = 0.16, // loudness ceiling (0-1); kept low so it sits in the background
  speedForMax = 2500, // px/sec of scrolling that counts as "full wind"
  attack = 0.35, // seconds; how gently the wind swells when scrolling starts
  release = 1.4, // seconds; how long it lingers after scrolling stops
  speedSmoothing = 0.18, // seconds; evens out jittery wheel/trackpad events
} = {}) {
  let ctx = null;
  let nodes = null;
  let on = false;
  let rafId = 0;

  let lastY = window.scrollY;
  let lastT = performance.now();
  let speed = 0; // smoothed px/sec

  function buildGraph() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();

    // Pink noise rather than white: energy falls off toward the highs, so it
    // reads as soft air instead of static. (Paul Kellet's filter approximation.)
    const seconds = 6;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    // Two layers: a low body and a breathier band on top.
    const body = ctx.createBiquadFilter();
    body.type = "lowpass";
    body.frequency.value = 220;
    body.Q.value = 0.4;
    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.8;

    const breath = ctx.createBiquadFilter();
    breath.type = "bandpass";
    breath.frequency.value = 400;
    breath.Q.value = 0.5;
    const breathGain = ctx.createGain();
    breathGain.gain.value = 0.5;

    // Slow gust wobble so the wind drifts even at a steady scroll speed.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 80;
    lfo.connect(lfoDepth).connect(breath.frequency);

    // A gentle lowpass on the whole mix rounds off any remaining hiss.
    const soften = ctx.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = 1800;
    soften.Q.value = 0.3;

    const master = ctx.createGain();
    master.gain.value = 0;

    src.connect(body).connect(bodyGain).connect(soften);
    src.connect(breath).connect(breathGain).connect(soften);
    soften.connect(master).connect(ctx.destination);

    src.start();
    lfo.start();

    nodes = { body, breath, master };
  }

  function tick() {
    const now = performance.now();
    const dt = (now - lastT) / 1000;
    if (dt > 0) {
      const y = window.scrollY;
      const instant = Math.abs(y - lastY) / dt;
      speed += (instant - speed) * (1 - Math.exp(-dt / speedSmoothing));
      lastY = y;
      lastT = now;
    }

    // Power curve < 1 lets slow scrolls be faintly audible without fast
    // flicks getting loud.
    const intensity = Math.pow(Math.min(speed / speedForMax, 1), 0.7);
    const target = intensity * maxGain;

    const ct = ctx.currentTime;
    const rising = target > nodes.master.gain.value;
    nodes.master.gain.setTargetAtTime(target, ct, rising ? attack : release);
    // Faster scroll brightens the wind a little, but stays in a mellow range.
    nodes.breath.frequency.setTargetAtTime(320 + intensity * 700, ct, 0.25);
    nodes.body.frequency.setTargetAtTime(180 + intensity * 220, ct, 0.25);

    rafId = requestAnimationFrame(tick);
  }

  function onVisibility() {
    if (document.hidden) ctx.suspend();
    else if (on) ctx.resume();
  }

  // Must be called from inside a click/tap handler, or the browser keeps the
  // audio context suspended.
  function enable() {
    if (on) return;
    if (!ctx) buildGraph();
    ctx.resume();
    on = true;
    lastY = window.scrollY;
    lastT = performance.now();
    speed = 0;
    document.addEventListener("visibilitychange", onVisibility);
    rafId = requestAnimationFrame(tick);
  }

  function disable() {
    if (!on) return;
    on = false;
    cancelAnimationFrame(rafId);
    document.removeEventListener("visibilitychange", onVisibility);
    nodes.master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
    setTimeout(() => {
      if (!on) ctx.suspend();
    }, 600);
  }

  return {
    enable,
    disable,
    toggle: () => (on ? disable() : enable()),
    isOn: () => on,
  };
}
