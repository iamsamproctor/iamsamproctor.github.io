import * as THREE from "three";
import { dyno } from "@sparkjsdev/spark";

// Shockwaves through a splat that behave like water rather than a single
// elastic bump: each one sends a leading crest across the desert followed by
// a train of smaller crests and troughs, like a stone dropped in a pond.
// Splats roll as the waves pass, moving in small circles (up and forward on
// a crest, down and back in a trough) instead of being shoved out and
// springing back. The waves lengthen and flatten as they spread, the fronts
// wander a little so they're never perfect circles, and the spot where it
// started dips and bobs back up. Crests briefly brighten the splats on them.
// Triggered by tapping, or charging and releasing, the desert (or the
// chrome blob).
//
// Several can be under way at once, so tapping repeatedly sends out ring
// after ring; where they cross, their waves add up. Each new one takes the
// slot of the oldest.
//
// It's a stage for a world modifier rather than a modifier of its own,
// since a splat has only one world modifier slot; see dustDevil.js's
// `stages` option, which runs it after the dust devil.

const SLOTS = 6; // shockwaves alive at once
const SPEED = 2; // world units per second the leading front travels
const WAVELENGTH = 2; // distance between crests at the start
const STRETCH = 0.45; // how much the wavelength grows per second as it spreads
const TRAIL = 1.4; // how far behind the front the following waves die out
const LIFT = 0.2; // height of the leading crest, before it spreads
const SWAY = 0.45; // forward/back roll, as a fraction of the up/down
const SPREAD_LOSS = 0.3; // how quickly waves flatten with distance travelled
const WOBBLE = 0.12; // how far the fronts wander from a perfect circle
const SPLASH = 0.4; // the dip and bob where it started, as a fraction of LIFT
const SPLASH_SPEED = 5; // how quickly that bobs (radians per second)
// Seconds the waves take to swell to full height, so they rise out of the
// ground rather than appearing at once, which reads as a gunshot.
const ATTACK = 0.45;
const GLOW = 0.3; // how much a crest brightens splats
const LIFE = 4; // seconds until the waves have fully died out

// A fully charged blast (power 1) is this many times the plain tap's size.
const POWER_LIFT = 3.2;
const POWER_SPEED = 1.8;
const POWER_WAVELENGTH = 1.6;
const POWER_LIFE = 1.6;
const POWER_GLOW = 0.8;

// Cap on the brightening where several crests overlap: about one crest's
// worth, so stacked rings push harder but don't wash the splats out white.
const MAX_GLOW = 0.75;

export function createSplatShockwave() {
  const time = dyno.dynoFloat(0);
  // Each slot: xyz = where it started, w = when (page seconds).
  const slots = Array.from({ length: SLOTS }, () =>
    dyno.dynoVec4(new THREE.Vector4(0, 0, 0, -1000)),
  );
  const powers = Array.from({ length: SLOTS }, () => dyno.dynoFloat(0));

  const inTypes = { gsplat: dyno.Gsplat, t: "float" };
  for (let i = 0; i < SLOTS; i++) {
    inTypes[`w${i}`] = "vec4";
    inTypes[`p${i}`] = "float";
  }

  const f = (n) => n.toFixed(4);

  const shockwave = new dyno.Dyno({
    inTypes,
    outTypes: { gsplat: dyno.Gsplat },
    statements: ({ inputs, outputs }) => {
      const perSlot = [];
      for (let i = 0; i < SLOTS; i++) {
        perSlot.push(/* glsl */ `
        {
          vec4 w = ${inputs[`w${i}`]};
          float power = ${inputs[`p${i}`]};
          float life = ${f(LIFE)} * (1. + power * ${f(POWER_LIFE - 1)});
          float age = ${inputs.t} - w.w;
          if (age > 0. && age < life) {
            float speed = ${f(SPEED)} * (1. + power * ${f(POWER_SPEED - 1)});
            float lift = ${f(LIFT)} * (1. + power * ${f(POWER_LIFT - 1)});
            float glowAmount = ${f(GLOW)} * (1. + power * ${f(POWER_GLOW - 1)});
            float wavelength = ${f(WAVELENGTH)} * (1. + power * ${f(POWER_WAVELENGTH - 1)})
              * (1. + age * ${f(STRETCH)});
            float trail = ${f(TRAIL)} * (1. + power * ${f(POWER_WAVELENGTH - 1)});

            // Waves run across the ground, so distance is measured flat.
            vec2 offset = p.xz - w.xz;
            float dist = length(offset);
            vec2 outward = dist > 0.0001 ? offset / dist : vec2(0.);

            // Signed distance behind the leading front (negative = behind),
            // with the front wandering a little so it isn't a perfect ring.
            float wander = sin(p.x * 2.3 + p.z * 1.7 + w.w) * 0.5
              + sin(p.x * -1.3 + p.z * 3.1 + w.w * 2.) * 0.5;
            float x = dist - age * speed + wander * ${f(WOBBLE)};

            // Strongest at the front, dying off over the trail behind it and
            // quickly ahead of it; lower the further it has spread, and
            // fading out over its life.
            float ahead = exp(-max(x, 0.) * max(x, 0.) / (wavelength * wavelength * 0.08));
            float behind = exp(min(x, 0.) / trail);
            float fade = 1. - age / life;
            float swell = smoothstep(0., ${f(ATTACK)}, age);
            // Calmer right at the start point, so the first crest builds as
            // it moves out instead of erupting from a single spot.
            float settle = mix(0.35, 1., smoothstep(0., wavelength * 0.5, dist));
            float amp = lift * ahead * behind * fade * fade * swell * settle
              / (1. + dist * ${f(SPREAD_LOSS)});

            // Rolling motion: up and forward on a crest, down and back in a
            // trough. The phase puts the leading crest right at the front.
            float phase = x * 6.2832 / wavelength;
            float rise = cos(phase) * amp;
            float roll = sin(phase) * amp * ${f(SWAY)};
            move += vec3(outward.x * roll, rise, outward.y * roll);
            glow += max(rise, 0.) / lift * glowAmount;

            // Where it started, the ground dips and bobs back up a few times.
            float centre = exp(-dist * dist / 0.12);
            move.y -= centre * lift * ${f(SPLASH)} * swell
              * sin(age * ${f(SPLASH_SPEED)}) * exp(-age * 1.6);
          }
        }`);
      }
      return dyno.unindentLines(/* glsl */ `
        ${outputs.gsplat} = ${inputs.gsplat};
        vec3 p = ${inputs.gsplat}.center;
        vec3 move = vec3(0.);
        float glow = 0.;
        ${perSlot.join("\n")}
        if (move != vec3(0.)) {
          ${outputs.gsplat}.center = p + move;
          ${outputs.gsplat}.rgba.rgb = ${inputs.gsplat}.rgba.rgb + vec3(min(glow, ${f(MAX_GLOW)}));
        }
      `);
    },
  });

  // A stage for a world-space dynoBlock: gsplat in, gsplat out.
  function apply(gsplat) {
    const inputs = { gsplat, t: time };
    for (let i = 0; i < SLOTS; i++) {
      inputs[`w${i}`] = slots[i];
      inputs[`p${i}`] = powers[i];
    }
    return shockwave.apply(inputs).gsplat;
  }

  // at: world-space point the waves start from. seconds: page time.
  // strength: 0 for a plain tap up to 1 for a fully charged blast.
  function trigger(at, seconds, strength = 0) {
    // The oldest slot, which is either finished or closest to it.
    let oldest = 0;
    for (let i = 1; i < SLOTS; i++) {
      if (slots[i].value.w < slots[oldest].value.w) oldest = i;
    }
    slots[oldest].value.set(at.x, at.y, at.z, seconds);
    powers[oldest].value = strength;
  }

  // seconds: page time in seconds. Call before splat.updateVersion().
  function update(seconds) {
    time.value = seconds;
  }

  return { apply, trigger, update };
}
