import * as THREE from "three";

// A 1D blend tree, like a Unity Blend Tree or an Unreal Blend Space 1D: clips
// placed along one parameter (here, speed), with the two either side of its
// current value blended by how close it is to each.
//
//   speed    0 ─────────── 2.1 ─────────── 3.6
//   clip    idle          walk            run
//
// Clips given a groundSpeed are strides (walk, run). They play in step: they
// share one cycle, a phase from 0 to 1, so their feet land together mid-blend
// instead of scissoring, and the cycle plays at whatever rate keeps the feet
// planted at the current speed. Other clips (idle) keep their own time.
//
// motions: [{ clip, at, groundSpeed?, phase? }], in order of `at`, where
//  - at: the parameter value where this clip plays alone
//  - groundSpeed: for a stride, how fast it covers ground at normal speed
//  - phase: for a stride, where its cycle starts relative to the others, so
//    the same foot lands at the same phase in each

const MIN_RATE = 0.4; // slowest a stride plays, as a fraction of normal
const MAX_RATE = 2;

export function createBlendTree1D(mixer, motions) {
  const entries = motions.map((motion) => {
    const action = mixer.clipAction(motion.clip);
    action.play();
    action.setEffectiveWeight(0);
    const stride = motion.groundSpeed !== undefined;
    // Strides are posed by phase each frame instead of by the mixer's clock.
    if (stride) action.setEffectiveTimeScale(0);
    return { ...motion, action, stride, weight: 0 };
  });
  let phase = 0;

  // value: the blend parameter. A negative value blends as its size but
  // plays the strides backwards, e.g. for stepping back.
  function update(deltaTime, value) {
    const amount = Math.abs(value);

    // Weights: all on one clip at the ends, split between neighbours between.
    entries.forEach((entry) => (entry.weight = 0));
    const last = entries.length - 1;
    if (amount <= entries[0].at) entries[0].weight = 1;
    else if (amount >= entries[last].at) entries[last].weight = 1;
    else {
      const i = entries.findIndex((entry, j) => amount < entries[j + 1].at);
      const t = (amount - entries[i].at) / (entries[i + 1].at - entries[i].at);
      entries[i].weight = 1 - t;
      entries[i + 1].weight = t;
    }

    // Strides: one cycle, as long as and covering ground like their weighted
    // mix, played fast enough to keep up with the actual speed.
    let strideWeight = 0;
    let cycle = 0;
    let groundSpeed = 0;
    for (const entry of entries) {
      if (!entry.stride || !entry.weight) continue;
      strideWeight += entry.weight;
      cycle += entry.weight * entry.clip.duration;
      groundSpeed += entry.weight * entry.groundSpeed;
    }
    if (strideWeight > 0) {
      cycle /= strideWeight;
      groundSpeed /= strideWeight;
      const rate = THREE.MathUtils.clamp(amount / groundSpeed, MIN_RATE, MAX_RATE);
      phase = THREE.MathUtils.euclideanModulo(phase + (Math.sign(value) * rate * deltaTime) / cycle, 1);
    }

    for (const entry of entries) {
      entry.action.setEffectiveWeight(entry.weight);
      if (entry.stride) {
        entry.action.time = THREE.MathUtils.euclideanModulo(phase + (entry.phase ?? 0), 1) * entry.clip.duration;
      }
    }
  }

  return { update };
}
