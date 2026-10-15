import * as THREE from "three";
import { dyno } from "@sparkjsdev/spark";

// The sparkle effect: every so often every splat shrinks to a pinpoint where
// it stands, so for a few seconds the scene becomes a field of stars in its
// own shape, twinkling, before the splats swell back. The shrink spreads outward from the chrome
// blob, so it reads as the blob doing it.
//
// Like splatShockwave.js, it's a stage for the splat's world modifier (see
// dustDevil.js's `stages`). It runs first, so ripples and shockwaves still
// travel through the stars.

const INTERVAL = 5; // seconds of the normal scene before each sparkle
const SHRINK = 8; // seconds to shrink to stars
const HOLD = 8; // seconds the stars hold
const GROW = 8; // seconds to swell back

// The outward spread: a splat this far from the blob (world units) starts
// as late as it can, SPREAD of the way through the transition.
const SPREAD = 0.6;
const SPREAD_DISTANCE = 10;

const STAR_SIZE = 0.006; // world-space radius of a star, seen from STAR_SIZE_DISTANCE
// Stars grow with the camera's distance from the blob beyond this, so they
// keep their size on screen as the view zooms out instead of shrinking below
// a pixel and fading away.
const STAR_SIZE_DISTANCE = 5;
const STAR_BOOST = 0.4; // how much brighter stars are than their splat
const TWINKLE = 0.6; // how far a star's brightness dips as it twinkles

export function createSplatSparkle() {
  const time = dyno.dynoFloat(0);
  const amount = dyno.dynoFloat(0); // 0 = the scene, 1 = all stars
  const origin = dyno.dynoVec3(new THREE.Vector3());
  const starSize = dyno.dynoFloat(STAR_SIZE);

  const f = (n) => n.toFixed(4);

  const stars = new dyno.Dyno({
    inTypes: {
      gsplat: dyno.Gsplat,
      t: "float",
      amount: "float",
      origin: "vec3",
      starSize: "float",
    },
    outTypes: { gsplat: dyno.Gsplat },
    globals: () => [
      dyno.unindent(/* glsl */ `
        vec2 starHash(int i) {
          uint a = uint(i) * 747796405u + 2891336453u;
          a = ((a >> ((a >> 28u) + 4u)) ^ a) * 277803737u;
          a = (a >> 22u) ^ a;
          uint b = a * 747796405u + 2891336453u;
          b = ((b >> ((b >> 28u) + 4u)) ^ b) * 277803737u;
          b = (b >> 22u) ^ b;
          return vec2(uvec2(a, b)) / 4294967295.;
        }
      `),
    ],
    statements: ({ inputs, outputs }) => dyno.unindentLines(/* glsl */ `
      ${outputs.gsplat} = ${inputs.gsplat};

      float amount = ${inputs.amount};
      if (amount > 0.) {
        vec3 p = ${inputs.gsplat}.center;
        vec4 rgba = ${inputs.gsplat}.rgba;
        vec2 h = starHash(${inputs.gsplat}.index);

        float delay = clamp(length(p.xz - ${inputs.origin}.xz) / ${f(SPREAD_DISTANCE)}, 0., 1.)
          * ${f(SPREAD * 0.8)} + h.x * ${f(SPREAD * 0.2)};
        float e = smoothstep(0., 1., clamp(amount * ${f(1 + SPREAD)} - delay, 0., 1.));

        float twinkle = 1. - ${f(TWINKLE)} * (0.5 + 0.5 * sin(${inputs.t} * (2. + h.y * 4.) + h.x * 6.2832));
        vec3 star = rgba.rgb * (1. + ${f(STAR_BOOST)}) * twinkle;

        ${outputs.gsplat}.scales = mix(${inputs.gsplat}.scales, vec3(${inputs.starSize}), e);
        ${outputs.gsplat}.rgba = vec4(mix(rgba.rgb, star, e), mix(rgba.a, 1., e));
      }
    `),
  });

  function apply(gsplat) {
    return stars.apply({ gsplat, t: time, amount, origin, starSize }).gsplat;
  }

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let nextAt = null; // page time the next sparkle starts
  let startedAt = null; // page time the current one started, if one is running

  // seconds: page time. at: world-space point the shrink spreads from (the
  // blob). active: whether a new sparkle may start, i.e. the scene is on
  // screen; one already running always finishes. viewDistance: how far the
  // camera is from the blob, for sizing the stars. Call before
  // splat.updateVersion().
  function update(seconds, at, active, viewDistance = STAR_SIZE_DISTANCE) {
    time.value = seconds;
    origin.value.copy(at);
    starSize.value = STAR_SIZE * Math.max(1, viewDistance / STAR_SIZE_DISTANCE);

    if (startedAt === null) {
      if (!active || reducedMotion) {
        nextAt = null;
        return;
      }
      if (nextAt === null) nextAt = seconds + INTERVAL;
      if (seconds < nextAt) return;
      startedAt = seconds;
    }

    const age = seconds - startedAt;
    if (age < SHRINK) {
      amount.value = age / SHRINK;
    } else if (age < SHRINK + HOLD) {
      amount.value = 1;
    } else if (age < SHRINK + HOLD + GROW) {
      amount.value = 1 - (age - SHRINK - HOLD) / GROW;
    } else {
      amount.value = 0;
      startedAt = null;
      nextAt = seconds + INTERVAL;
    }
  }

  // Starts the next sparkle right away (for trying it out).
  function triggerNow() {
    nextAt = -Infinity;
  }

  return { apply, update, triggerNow };
}
