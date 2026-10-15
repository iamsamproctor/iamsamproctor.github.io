import * as THREE from "three";
import { dyno } from "@sparkjsdev/spark";

// Holding the pointer down on the desert charges up the splats right there:
// they gather in toward a point just above the ground, shiver harder and
// harder, and glow warmer the longer it's held. Letting go snaps them back
// as the shockwave (splatShockwave.js) goes out from the same spot, which
// main.js triggers along with the impact sound.
//
// Like splatShockwave.js, it's a stage for the splat's world modifier (see
// dustDevil.js's `stages`).

const RADIUS = 1.1; // world units around the held point that take part
const LIFT = 0.35; // how far above the ground the gathering point sits
const PULL = 0.32; // fraction of the way splats are drawn in at full charge
const SHIVER = 0.03; // world units of jitter at full charge
const SHIVER_SPEED = 38; // jitter frequency
const GLOW = new THREE.Color(1.0, 0.72, 0.38); // warm ember color they brighten toward
const GLOW_AMOUNT = 0.9; // how far toward it at full charge, at the center
const RELEASE = 0.5; // seconds the gathered splats take to ease back on release

export function createSplatCharge() {
  const time = dyno.dynoFloat(0);
  const origin = dyno.dynoVec3(new THREE.Vector3());
  const charge = dyno.dynoFloat(0);

  const f = (n) => n.toFixed(4);

  const stage = new dyno.Dyno({
    inTypes: { gsplat: dyno.Gsplat, t: "float", origin: "vec3", charge: "float" },
    outTypes: { gsplat: dyno.Gsplat },
    globals: () => [
      dyno.unindent(/* glsl */ `
        vec3 chargeHash(int i) {
          uint a = uint(i) * 747796405u + 2891336453u;
          a = ((a >> ((a >> 28u) + 4u)) ^ a) * 277803737u;
          a = (a >> 22u) ^ a;
          uint b = a * 747796405u + 2891336453u;
          b = ((b >> ((b >> 28u) + 4u)) ^ b) * 277803737u;
          b = (b >> 22u) ^ b;
          uint c = b * 747796405u + 2891336453u;
          c = ((c >> ((c >> 28u) + 4u)) ^ c) * 277803737u;
          c = (c >> 22u) ^ c;
          return vec3(uvec3(a, b, c)) / 4294967295.;
        }
      `),
    ],
    statements: ({ inputs, outputs }) => dyno.unindentLines(/* glsl */ `
      ${outputs.gsplat} = ${inputs.gsplat};

      float charge = ${inputs.charge};
      if (charge > 0.) {
        vec3 p = ${inputs.gsplat}.center;
        vec3 core = ${inputs.origin} + vec3(0., ${f(LIFT)}, 0.);
        float dist = length(p - ${inputs.origin});
        float falloff = 1. - smoothstep(0., ${f(RADIUS)}, dist);

        if (falloff > 0.) {
          vec3 h = chargeHash(${inputs.gsplat}.index);
          float pull = ${f(PULL)} * charge * falloff;
          vec3 jitter = (h - 0.5) * 2.
            * sin(${inputs.t} * ${f(SHIVER_SPEED)} * (0.7 + h.x * 0.6) + h.y * 6.2832);
          vec3 gathered = mix(p, core, pull)
            + jitter * ${f(SHIVER)} * charge * charge * falloff;
          ${outputs.gsplat}.center = gathered;

          vec3 glow = vec3(${f(GLOW.r)}, ${f(GLOW.g)}, ${f(GLOW.b)});
          vec3 rgb = ${inputs.gsplat}.rgba.rgb;
          ${outputs.gsplat}.rgba.rgb = mix(rgb, glow, ${f(GLOW_AMOUNT)} * charge * falloff * falloff)
            + glow * 0.25 * charge * falloff * falloff;
        }
      }
    `),
  });

  // A stage for a world-space dynoBlock: gsplat in, gsplat out.
  function apply(gsplat) {
    return stage.apply({ gsplat, t: time, origin, charge }).gsplat;
  }

  let releasing = null; // { from, start } while easing back after a release

  // at: world-space point on the ground being held. amount: 0-1, how
  // charged it is.
  function set(at, amount) {
    if (at) origin.value.copy(at);
    releasing = null;
    charge.value = amount;
  }

  // Lets go: the gathered splats ease back over RELEASE seconds rather than
  // snapping back in one frame, which looked like a gunshot.
  function release() {
    if (charge.value > 0) releasing = { from: charge.value, start: time.value };
  }

  // seconds: page time. Call before splat.updateVersion().
  function update(seconds) {
    time.value = seconds;
    if (releasing) {
      const t = Math.min((seconds - releasing.start) / RELEASE, 1);
      // Eases out: quick at first, settling gently.
      charge.value = releasing.from * (1 - t) * (1 - t);
      if (t >= 1) releasing = null;
    }
  }

  return { apply, set, release, update };
}
