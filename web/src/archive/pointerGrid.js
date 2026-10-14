// A faint grid that bends toward the pointer and lights up around it. The
// grid lines are drawn as finely subdivided polylines, and every point is
// pulled toward the (smoothed) pointer with a soft falloff, so the lines bow
// like they're under a lens. Lines near the pointer are drawn a second time,
// brighter, on top of the faint base grid.
//
// Used behind the loading screen (loaderGrid.js) and behind the page
// sections (main.js), where the canvas is a viewport-sized sticky layer and
// the grid is aligned to the pages so it scrolls with them.

const SPACING = 48; // px between grid lines
const STEP = 8; // px between points along each line
const RADIUS = 190; // px reach of the bend and glow
const PULL = 20; // px the grid is pulled toward the pointer at its center
const BASE_ALPHA = 0.14;
const GLOW_ALPHA = 0.4;
const FOLLOW = 7; // how quickly the effect chases the pointer (per second)
// A slow, liquid drift in the lines even when the pointer is still, echoing
// the soft, wobbly space of the splat scene.
const WOBBLE = 10; // px the lines sway at most
const WOBBLE_SPEED = 1; // how quickly the sway evolves
const WOBBLE_SCALE = 0.02; // 1/px: lower = broader, smoother waves

// canvas: drawn at its own CSS size.
// anchor: optional element the grid lines are aligned to, so they move with
//   it as the page scrolls. Without one the grid is centered in the canvas.
// observe: optional element whose visibility on screen gates the animation.
export function createPointerGrid(canvas, { anchor = null, observe = null } = {}) {
  const ctx = canvas.getContext("2d");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  let rect = canvas.getBoundingClientRect();
  const client = { x: 0, y: 0, seen: false }; // last pointer position, viewport px
  const target = { x: 0, y: 0, active: 0 };
  const pointer = { x: 0, y: 0, active: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduceMotion) draw();
  }

  const onMove = (event) => {
    client.x = event.clientX;
    client.y = event.clientY;
    client.seen = true;
  };
  const onLeave = () => {
    client.seen = false;
  };

  // How strongly a point at (x, y) is affected, 0..1.
  function influence(x, y) {
    const dx = x - pointer.x;
    const dy = y - pointer.y;
    const d2 = (dx * dx + dy * dy) / (RADIUS * RADIUS);
    return Math.exp(-d2 * 2.2) * pointer.active;
  }

  // Where the grid's origin is on the canvas, so the wobble pattern is
  // pinned to the page (and scrolls with it) rather than to the screen.
  const origin = { x: 0, y: 0 };
  let time = 0;

  const point = { x: 0, y: 0, f: 0 };
  function displaced(x, y) {
    const f = influence(x, y);
    const u = (x - origin.x) * WOBBLE_SCALE;
    const v = (y - origin.y) * WOBBLE_SCALE;
    const t = time * WOBBLE_SPEED;
    const swayX = Math.sin(v * 1.3 + t) * 0.6 + Math.sin((u + v) * 0.8 - t * 0.7) * 0.4;
    const swayY = Math.sin(u * 1.1 - t * 0.9) * 0.6 + Math.sin((u - v) * 0.9 + t * 0.6) * 0.4;
    point.x = x + (pointer.x - x) * f * (PULL / RADIUS) * 2 + swayX * WOBBLE;
    point.y = y + (pointer.y - y) * f * (PULL / RADIUS) * 2 + swayY * WOBBLE;
    point.f = f;
  }

  // Traces one grid line: vertical when `vertical`, at offset `at`.
  function traceLine(vertical, at, path, glowSegments) {
    const length = vertical ? height : width;
    let prevX = 0;
    let prevY = 0;
    for (let s = -STEP; s <= length + STEP; s += STEP) {
      displaced(vertical ? at : s, vertical ? s : at);
      if (s === -STEP) path.moveTo(point.x, point.y);
      else {
        path.lineTo(point.x, point.y);
        if (point.f > 0.02) glowSegments.push(prevX, prevY, point.x, point.y, point.f);
      }
      prevX = point.x;
      prevY = point.y;
    }
  }

  const mod = (value, n) => ((value % n) + n) % n;

  function draw() {
    ctx.clearRect(0, 0, width, height);

    origin.x = width / 2;
    origin.y = height / 2;
    if (anchor) {
      const anchorRect = anchor.getBoundingClientRect();
      origin.x = anchorRect.left + anchorRect.width / 2 - rect.left;
      origin.y = anchorRect.top - rect.top;
    }
    const offsetX = mod(origin.x, SPACING);
    const offsetY = mod(origin.y, SPACING);

    const base = new Path2D();
    const glow = [];
    for (let x = offsetX - SPACING; x <= width + SPACING; x += SPACING) traceLine(true, x, base, glow);
    for (let y = offsetY - SPACING; y <= height + SPACING; y += SPACING) traceLine(false, y, base, glow);

    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(255, 255, 255, ${BASE_ALPHA})`;
    ctx.stroke(base);

    // Brighter overdraw near the pointer, bucketed by brightness so it's a
    // handful of strokes rather than one per segment.
    const BUCKETS = 8;
    const buckets = Array.from({ length: BUCKETS }, () => new Path2D());
    for (let i = 0; i < glow.length; i += 5) {
      const b = Math.min(BUCKETS - 1, Math.floor(glow[i + 4] * BUCKETS));
      buckets[b].moveTo(glow[i], glow[i + 1]);
      buckets[b].lineTo(glow[i + 2], glow[i + 3]);
    }
    ctx.lineWidth = 1.25;
    buckets.forEach((path, b) => {
      const f = (b + 0.5) / BUCKETS;
      ctx.strokeStyle = `rgba(255, 255, 255, ${GLOW_ALPHA * f * f})`;
      ctx.stroke(path);
    });

    // A soft light under the pointer.
    if (pointer.active > 0.01) {
      const light = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, RADIUS);
      light.addColorStop(0, `rgba(255, 255, 255, ${0.03 * pointer.active})`);
      light.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = light;
      ctx.fillRect(pointer.x - RADIUS, pointer.y - RADIUS, RADIUS * 2, RADIUS * 2);
    }
  }

  let frame = 0;
  let running = false;
  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    time += dt;
    rect = canvas.getBoundingClientRect();

    // The pointer only counts while it's over the visible part of the canvas.
    const x = client.x - rect.left;
    const y = client.y - rect.top;
    const inside = client.seen && x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
    if (inside && !target.active) {
      // Start the smoothed pointer where the pointer appeared, so the effect
      // fades in in place rather than sweeping in from a corner.
      pointer.x = x;
      pointer.y = y;
    }
    if (inside) {
      target.x = x;
      target.y = y;
    }
    target.active = inside ? 1 : 0;

    const k = 1 - Math.exp(-FOLLOW * dt);
    pointer.x += (target.x - pointer.x) * k;
    pointer.y += (target.y - pointer.y) * k;
    pointer.active += (target.active - pointer.active) * k;
    draw();
    frame = requestAnimationFrame(tick);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    last = performance.now();
    frame = requestAnimationFrame(tick);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(frame);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  resize();

  window.addEventListener("pointermove", onMove);
  document.documentElement.addEventListener("pointerleave", onLeave);

  let visibilityObserver = null;
  if (observe) {
    visibilityObserver = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) start();
      else stop();
    });
    visibilityObserver.observe(observe);
  } else {
    start();
  }
  if (reduceMotion) draw();

  return {
    destroy() {
      stop();
      resizeObserver.disconnect();
      visibilityObserver?.disconnect();
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    },
  };
}
