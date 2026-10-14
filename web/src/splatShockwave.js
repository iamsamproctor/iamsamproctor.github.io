import * as THREE from "three";
import { dyno } from "@sparkjsdev/spark";

// A shockwave through a splat: a ring that expands outward from a point,
// lifting and pushing splats as it passes and briefly brightening them, and
// fading as it spreads. Triggered when the chrome blob is tapped.
//
// It's a stage for a world-space modifier rather than a modifier of its own,
// since a splat has only one world modifier slot; see dustDevil.js's
// `stages` option, which runs it after the dust devil.

const SPEED = 3; // world units per second the ring travels
const WIDTH = 0.45; // thickness of the ring
const LIFT = 0.22; // how far splats are pushed out and up at the crest
const GLOW = 0.7; // how much the crest brightens splats
const LIFE = 3.5; // seconds until the wave has fully died out

// A fully charged blast (power 1) is this many times the plain tap's size.
const POWER_LIFT = 3.2;
const POWER_SPEED = 1.8;
const POWER_WIDTH = 1.6;
const POWER_LIFE = 1.6;
const POWER_GLOW = 0.8;

export function createSplatShockwave() {
  const time = dyno.dynoFloat(0);
  const start = dyno.dynoFloat(-1000);
  const origin = dyno.dynoVec3(new THREE.Vector3());
  const power = dyno.dynoFloat(0);

  const shockwave = new dyno.Dyno({
    inTypes: { gsplat: dyno.Gsplat, t: "float", start: "float", origin: "vec3", power: "float" },
    outTypes: { gsplat: dyno.Gsplat },
    statements: ({ inputs, outputs }) => dyno.unindentLines(/* glsl */ `
      ${outputs.gsplat} = ${inputs.gsplat};

      float power = ${inputs.power};
      float life = ${LIFE.toFixed(3)} * (1. + power * ${(POWER_LIFE - 1).toFixed(3)});
      float speed = ${SPEED.toFixed(3)} * (1. + power * ${(POWER_SPEED - 1).toFixed(3)});
      float width = ${WIDTH.toFixed(3)} * (1. + power * ${(POWER_WIDTH - 1).toFixed(3)});
      float lift = ${LIFT.toFixed(3)} * (1. + power * ${(POWER_LIFT - 1).toFixed(3)});
      float glow = ${GLOW.toFixed(3)} * (1. + power * ${(POWER_GLOW - 1).toFixed(3)});

      float age = ${inputs.t} - ${inputs.start};
      if (age > 0. && age < life) {
        vec3 p = ${inputs.gsplat}.center;
        vec3 offset = p - ${inputs.origin};
        float dist = length(offset);

        float x = (dist - age * speed) / width;
        float fade = 1. - age / life;
        float crest = exp(-x * x) * fade * fade;

        if (crest > 0.002) {
          vec3 outward = dist > 0.0001 ? offset / dist : vec3(0., 1., 0.);
          ${outputs.gsplat}.center = p + (outward + vec3(0., 0.8, 0.)) * lift * crest;
          ${outputs.gsplat}.rgba.rgb = ${inputs.gsplat}.rgba.rgb + vec3(glow) * crest;
        }
      }
    `),
  });

  // A stage for a world-space dynoBlock: gsplat in, gsplat out.
  function apply(gsplat) {
    return shockwave.apply({ gsplat, t: time, start, origin, power }).gsplat;
  }

  // at: world-space point the ring starts from. seconds: page time.
  // strength: 0 for a plain tap up to 1 for a fully charged blast.
  function trigger(at, seconds, strength = 0) {
    origin.value.copy(at);
    power.value = strength;
    start.value = seconds;
  }

  // seconds: page time in seconds. Call before splat.updateVersion().
  function update(seconds) {
    time.value = seconds;
  }

  return { apply, trigger, update };
}
