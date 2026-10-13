import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";

// A gallery bench with someone sitting on it, watching the portrait at the
// end of the hallway. Seen from behind in a dark hall lit by the portrait,
// they read mostly as a silhouette.
//
// The figure is a Mixamo character exported with a sitting-idle animation
// (FBX, with skin). It's large, so it's only fetched when load() is called,
// which main.js does partway through the landing scene. The bench is built
// here and fitted to the animation: its seat goes just under where the hips
// sit in the seated pose, so any sitting animation lines up.

const FIGURE_HEIGHT = 1.75; // standing height the figure is scaled to, in world units (m)
const SEAT_BELOW_HIPS = 0.09; // how far the seat top sits below the hip joint
const BENCH_LENGTH = 1.6;
const BENCH_DEPTH = 0.42;
const BENCH_THICKNESS = 0.06;

export function createMuseumVisitor({ url }) {
  // Faces local -Z, toward the portrait, once placed in the hallway.
  const group = new THREE.Group();
  group.rotation.y = Math.PI;

  const benchMaterial = new THREE.MeshStandardMaterial({ color: 0x2b2722, roughness: 0.55 });
  const bench = new THREE.Group();
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(BENCH_LENGTH, BENCH_THICKNESS, BENCH_DEPTH),
    benchMaterial,
  );
  bench.add(seat);
  const supports = [-1, 1].map((side) => {
    const support = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1, BENCH_DEPTH * 0.8), benchMaterial);
    support.position.x = side * (BENCH_LENGTH / 2 - 0.18);
    bench.add(support);
    return support;
  });
  group.add(bench);

  // Until the figure loads the bench sits at a typical seat height.
  fitBench(0.45, 0, 0);

  function fitBench(seatTop, x, z) {
    seat.position.set(0, seatTop - BENCH_THICKNESS / 2, 0);
    supports.forEach((support) => {
      const height = seatTop - BENCH_THICKNESS;
      support.scale.y = height;
      support.position.y = height / 2;
    });
    bench.position.set(x, 0, z);
  }

  let mixer = null;
  let loading = null;

  function load() {
    if (loading) return loading;
    loading = new FBXLoader().loadAsync(url).then((figure) => {
      // Mixamo exports in centimeters; scale by the bind-pose height instead
      // of assuming, so any character comes out the same size.
      const box = new THREE.Box3().setFromObject(figure);
      const height = box.max.y - box.min.y;
      figure.scale.setScalar(FIGURE_HEIGHT / height);

      figure.traverse((node) => {
        if (node.isSkinnedMesh) node.frustumCulled = false;
      });
      group.add(figure);

      mixer = new THREE.AnimationMixer(figure);
      const clip = figure.animations[0];
      if (clip) mixer.clipAction(clip).play();
      mixer.update(0);

      // Fit the bench under the seated hips, and shift the figure sideways
      // so figure and bench are both centered on the group's origin.
      const hips = figure.getObjectByName("mixamorigHips");
      if (hips) {
        group.updateMatrixWorld(true);
        const hipsInGroup = group.worldToLocal(hips.getWorldPosition(new THREE.Vector3()));
        figure.position.x -= hipsInGroup.x;
        fitBench(hipsInGroup.y - SEAT_BELOW_HIPS, 0, hipsInGroup.z - 0.06);
      }
      return figure;
    });
    return loading;
  }

  // deltaTime: seconds since the last frame.
  function update(deltaTime) {
    mixer?.update(deltaTime);
  }

  return { group, load, update };
}
