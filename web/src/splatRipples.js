import * as THREE from "three";
import { dyno } from "@sparkjsdev/spark";

// Ripples through the desert floor wherever the pointer moves over it, like
// dragging a hand through water. Moving the pointer drops ripples at the
// spot it's over on the ground; each spreads out as a few small, fading
// crests that lift splats and let them settle. Faster motion makes stronger
// ripples, and holding still lets the ground go calm.
//
// Like splatShockwave.js, it's a stage for the splat's world modifier (see
// dustDevil.js's `stages`), so it composes with the shockwave.

const SLOTS = 12; // ripples alive at once; new ones replace the oldest
const SPEED = 0.2; // world units per second the crests travel
const WAVELENGTH = 2; // distance between crests
const WIDTH = 0.5; // how wide the band of crests is
const LIFT = 0.07; // how far a full-strength crest lifts splats
const GLOW = 0.12; // how much a crest brightens splats
const LIFE = 2.2; // seconds until a ripple has died out
const ATTACK = 0.35; // seconds a ripple takes to swell in, so it doesn't pop

const SPACING = 0.22; // world units the pointer travels between ripples
// Never drop faster than slots free up, or a live ripple would be replaced
// mid-wave and vanish in a single frame.
const MIN_INTERVAL = LIFE / SLOTS;
const FULL_SPEED = 2; // world units per second that counts as a fast sweep
const MAX_DISTANCE = 25; // ignore ground hits farther than this from the camera

export function createSplatRipples() {
  const time = dyno.dynoFloat(0);
  // Each slot: xyz = where on the ground, w = start time.
  const slots = Array.from({ length: SLOTS }, () =>
    dyno.dynoVec4(new THREE.Vector4(0, 0, 0, -1000)),
  );
  const strengths = Array.from({ length: SLOTS }, () => dyno.dynoFloat(0));

  const inTypes = { gsplat: dyno.Gsplat, t: "float" };
  for (let i = 0; i < SLOTS; i++) {
    inTypes[`r${i}`] = "vec4";
    inTypes[`s${i}`] = "float";
  }

  const ripples = new dyno.Dyno({
    inTypes,
    outTypes: { gsplat: dyno.Gsplat },
    statements: ({ inputs, outputs }) => {
      const perSlot = [];
      for (let i = 0; i < SLOTS; i++) {
        perSlot.push(/* glsl */ `
        {
          vec4 r = ${inputs[`r${i}`]};
          float age = ${inputs.t} - r.w;
          if (age > 0. && age < ${LIFE.toFixed(3)}) {
            // Spread across the ground, so distance is measured flat.
            float dist = length(p.xz - r.xz);
            float x = dist - age * ${SPEED.toFixed(3)};
            float band = exp(-(x * x) / ${(WIDTH * WIDTH).toFixed(4)});
            float fade = 1. - age / ${LIFE.toFixed(3)};
            float swell = smoothstep(0., ${ATTACK.toFixed(3)}, age);
            float wave = sin(x * ${((2 * Math.PI) / WAVELENGTH).toFixed(4)}) * band * fade * fade * swell
              * ${inputs[`s${i}`]};
            lift += wave;
            glow += abs(wave);
          }
        }`);
      }
      return dyno.unindentLines(/* glsl */ `
        ${outputs.gsplat} = ${inputs.gsplat};
        vec3 p = ${inputs.gsplat}.center;
        float lift = 0.;
        float glow = 0.;
        ${perSlot.join("\n")}
        if (glow > 0.001) {
          ${outputs.gsplat}.center = p + vec3(0., lift * ${LIFT.toFixed(3)}, 0.);
          ${outputs.gsplat}.rgba.rgb = ${inputs.gsplat}.rgba.rgb + vec3(${GLOW.toFixed(3)}) * min(glow, 1.);
        }
      `);
    },
  });

  function apply(gsplat) {
    const inputs = { gsplat, t: time };
    for (let i = 0; i < SLOTS; i++) {
      inputs[`r${i}`] = slots[i];
      inputs[`s${i}`] = strengths[i];
    }
    return ripples.apply(inputs).gsplat;
  }

  let next = 0;
  function drop(at, seconds, strength) {
    slots[next].value.set(at.x, at.y, at.z, seconds);
    strengths[next].value = strength;
    next = (next + 1) % SLOTS;
  }

  // Following the pointer: where it last dropped a ripple, and when.
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const hit = new THREE.Vector3();
  const lastDrop = new THREE.Vector3();
  let lastDropAt = -1;
  let ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // groundY: world height of the desert floor.
  function setGround(groundY) {
    ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY);
  }

  // Call on pointer movement over the scene. x/y: normalized device
  // coordinates (-1..1). seconds: page time.
  function pointerMoved(x, y, camera, seconds) {
    ndc.set(x, y);
    raycaster.setFromCamera(ndc, camera);
    if (!raycaster.ray.intersectPlane(ground, hit)) return;
    if (hit.distanceTo(camera.position) > MAX_DISTANCE) return;

    if (lastDropAt < 0) {
      lastDrop.copy(hit);
      lastDropAt = seconds;
      return;
    }
    const moved = hit.distanceTo(lastDrop);
    if (moved < SPACING || seconds - lastDropAt < MIN_INTERVAL) return;
    const speed = moved / Math.max(seconds - lastDropAt, 0.016);
    const strength = THREE.MathUtils.clamp(speed / FULL_SPEED, 0.25, 1);
    drop(hit, seconds, strength);
    lastDrop.copy(hit);
    lastDropAt = seconds;
  }

  // seconds: page time. Call before splat.updateVersion().
  function update(seconds) {
    time.value = seconds;
  }

  return { apply, update, pointerMoved, setGround };
}
