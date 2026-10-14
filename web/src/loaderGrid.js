// A faint grid behind the loading screen that bends toward the pointer and
// lights up around it. The grid lines are drawn as finely subdivided
// polylines, and every point is pulled toward the (smoothed) pointer with a
// soft falloff, so the lines bow like they're under a lens. Lines near the
// pointer are drawn a second time, brighter, on top of the faint base grid.

const SPACING = 48; // px between grid lines
const STEP = 8; // px between points along each line
const RADIUS = 190; // px reach of the bend and glow
const PULL = 20; // px the grid is pulled toward the pointer at its center
const BASE_ALPHA = 0.14;
const GLOW_ALPHA = 0.4;
const FOLLOW = 7; // how quickly the effect chases the pointer (per second)

export function createLoaderGrid(container) {
  const canvas = document.createElement("canvas");
  canvas.className = "loader-grid";
  canvas.setAttribute("aria-hidden", "true");
  container.prepend(canvas);
  const ctx = canvas.getContext("2d");

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 0;
  let height = 0;
  const target = { x: 0, y: 0, active: 0 };
  const pointer = { x: 0, y: 0, active: 0 };

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (reduceMotion) draw();
  }

  const onMove = (event) => {
    target.x = event.clientX;
    target.y = event.clientY;
    if (!target.active) {
      // Start the smoothed pointer where the pointer appeared, so the effect
      // fades in in place rather than sweeping in from a corner.
      pointer.x = target.x;
      pointer.y = target.y;
    }
    target.active = 1;
  };
  const onLeave = () => {
    target.active = 0;
  };

  // How strongly a point at (x, y) is affected, 0..1.
  function influence(x, y) {
    const dx = x - pointer.x;
    const dy = y - pointer.y;
    const d2 = (dx * dx + dy * dy) / (RADIUS * RADIUS);
    return Math.exp(-d2 * 2.2) * pointer.active;
  }

  function displaced(x, y, out) {
    const f = influence(x, y);
    out.x = x + (pointer.x - x) * f * (PULL / RADIUS) * 2;
    out.y = y + (pointer.y - y) * f * (PULL / RADIUS) * 2;
    out.f = f;
    return out;
  }

  const point = { x: 0, y: 0, f: 0 };

  // Traces one grid line: vertical when `vertical`, at offset `at`.
  function traceLine(vertical, at, path, glowSegments) {
    const length = vertical ? height : width;
    let prevX = 0;
    let prevY = 0;
    for (let s = -STEP; s <= length + STEP; s += STEP) {
      displaced(vertical ? at : s, vertical ? s : at, point);
      if (s === -STEP) path.moveTo(point.x, point.y);
      else {
        path.lineTo(point.x, point.y);
        if (point.f > 0.02) glowSegments.push(prevX, prevY, point.x, point.y, point.f);
      }
      prevX = point.x;
      prevY = point.y;
    }
  }

  function draw() {
    ctx.clearRect(0, 0, width, height);

    const base = new Path2D();
    const glow = [];
    const offsetX = (width % SPACING) / 2;
    const offsetY = (height % SPACING) / 2;
    for (let x = offsetX; x <= width; x += SPACING) traceLine(true, x, base, glow);
    for (let y = offsetY; y <= height; y += SPACING) traceLine(false, y, base, glow);

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
  let last = performance.now();
  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    const k = 1 - Math.exp(-FOLLOW * dt);
    pointer.x += (target.x - pointer.x) * k;
    pointer.y += (target.y - pointer.y) * k;
    pointer.active += (target.active - pointer.active) * k;
    draw();
    frame = requestAnimationFrame(tick);
  }

  resize();
  window.addEventListener("resize", resize);
  if (!reduceMotion) {
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("pointerleave", onLeave);
    frame = requestAnimationFrame(tick);
  }

  return {
    canvas,
    destroy() {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      canvas.remove();
    },
  };
}
