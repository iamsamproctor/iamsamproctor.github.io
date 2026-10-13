import * as THREE from "three";
import { dyno } from "@sparkjsdev/spark";

// A dust devil made from the environment splat's own splats: a fraction of
// the splats near the center lift off the ground, get swept into a spiral
// that narrows into a core and flares out as it rises, then fade at the top
// and drop back to where they started. Because it's the scene's own splats,
// it's lit and colored by the scene for free.
//
// Runs as a world-space modifier, so "up" is world +Y regardless of how the
// splat itself is rotated, and it leaves the splat's own (object-space)
// modifier alone.
//
// It runs continuously, and the column wanders a little so it doesn't sit
// in one spot. `strength` (0-1) scales the whole effect if it ever needs to
// be faded in or out.

const RADIUS = 1.5; // world units: how far from the column splats get pulled in
const DENSITY = 0.55; // fraction of splats in range that take part
const HEIGHT = 5; // how high splats rise before fading
const RISE_SPEED = 0.05; // cycles per second for one splat's trip up
const SPIN = 1.4; // radians per second the column rotates
const TURNS = 2.5; // extra turns a splat makes on its way up
const CORE_RADIUS = 0.12; // radius of the narrow base
const FLARE = 0.75; // how much wider the column gets at the top

const WANDER = 0.35; // how far the column drifts from its home point
const DUST_COLOR = new THREE.Color(0.86, 0.72, 0.52); // sunlit sand the airborne splats tint toward
const DUST_TINT = 0.55; // how far toward DUST_COLOR they go at the top
const DUST_SIZE = 0.018; // world-space radius of an airborne puff near the ground
const DUST_OPACITY = 0.1; // opacity of an airborne puff

export function addDustDevil(splat, { home = new THREE.Vector3(0, 0, 0) } = {}) {
  const time = dyno.dynoFloat(0);
  const strength = dyno.dynoFloat(1);
  const center = dyno.dynoVec3(home.clone());

  splat.worldModifier = dyno.dynoBlock(
    { gsplat: dyno.Gsplat },
    { gsplat: dyno.Gsplat },
    ({ gsplat }) => {
      const d = new dyno.Dyno({
        inTypes: {
          gsplat: dyno.Gsplat,
          t: "float",
          strength: "float",
          center: "vec3",
        },
        outTypes: { gsplat: dyno.Gsplat },
        globals: () => [
          dyno.unindent(/* glsl */ `
            vec3 devilHash(vec3 p) {
              p = fract(p * vec3(443.897, 441.423, 437.195));
              p += dot(p, p.yzx + 19.19);
              return fract((p.xxy + p.yzz) * p.zyx);
            }
          `),
        ],
        statements: ({ inputs, outputs }) => dyno.unindentLines(/* glsl */ `
          ${outputs.gsplat} = ${inputs.gsplat};

          vec3 p = ${inputs.gsplat}.center;
          vec2 offset = p.xz - ${inputs.center}.xz;
          float r0 = length(offset);

          vec3 h = devilHash(p);
          float inRange = 1. - smoothstep(${RADIUS.toFixed(3)} * 0.5, ${RADIUS.toFixed(3)}, r0);
          float chosen = step(h.x, ${DENSITY.toFixed(3)});
          float w = inRange * chosen * ${inputs.strength};

          if (w > 0.) {
            // Each splat runs its own trip up on a staggered phase.
            float phase = fract(${inputs.t} * ${RISE_SPEED.toFixed(3)} + h.y);

            float theta = atan(offset.y, offset.x)
              + ${inputs.t} * ${SPIN.toFixed(3)}
              + phase * ${TURNS.toFixed(3)} * 6.2831853;
            float coreR = ${CORE_RADIUS.toFixed(3)} + ${FLARE.toFixed(3)} * phase * phase + h.z * 0.12;
            // Pulled in toward the core early on, then carried up and out.
            float rr = mix(r0, coreR, smoothstep(0., 0.3, phase));
            float lift = ${HEIGHT.toFixed(3)} * pow(phase, 1.4);

            vec3 vortex = vec3(
              ${inputs.center}.x + cos(theta) * rr,
              p.y + lift,
              ${inputs.center}.z + sin(theta) * rr
            );

            // Eases out of its resting spot at the start of each trip, so
            // the wrap from top back to ground is never a visible jump.
            float takeoff = smoothstep(0., 0.12, phase);
            float amount = w * takeoff;
            ${outputs.gsplat}.center = mix(p, vortex, amount);

            // Airborne splats become small round puffs of sunlit sand. The
            // scene's own splats are often long needles or broad ground
            // patches, which fly up as streaks and blobs if left as-is.
            float fadeTop = 1. - smoothstep(0.65, 1., phase);
            float puff = mix(${DUST_SIZE.toFixed(3)}, ${DUST_SIZE.toFixed(3)} * 1.8, phase) * (0.6 + h.z * 0.8);
            ${outputs.gsplat}.scales = mix(${inputs.gsplat}.scales, vec3(puff), amount);
            ${outputs.gsplat}.rgba.a = mix(${inputs.gsplat}.rgba.a, ${DUST_OPACITY.toFixed(3)} * fadeTop, amount);

            vec3 dust = vec3(${DUST_COLOR.r.toFixed(3)}, ${DUST_COLOR.g.toFixed(3)}, ${DUST_COLOR.b.toFixed(3)});
            ${outputs.gsplat}.rgba.rgb = mix(
              ${inputs.gsplat}.rgba.rgb,
              dust,
              amount * ${DUST_TINT.toFixed(3)} * smoothstep(0., 0.5, phase)
            );
          }
        `),
      });

      gsplat = d.apply({ gsplat, t: time, strength, center }).gsplat;
      return { gsplat };
    },
  );
  splat.updateGenerator();

  // seconds: page time in seconds. Call before splat.updateVersion().
  function update(seconds) {
    time.value = seconds;

    center.value.set(
      home.x + Math.sin(seconds * 0.13) * WANDER,
      home.y,
      home.z + Math.cos(seconds * 0.09) * WANDER,
    );
  }

  return { update };
}
