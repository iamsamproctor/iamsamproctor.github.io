import * as THREE from "three";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

// Josh, the gallery's character: a Mixamo model in a T-pose (FBX, with skin)
// and his animations, each exported from Mixamo without skin. They share the
// mixamorig skeleton, so any of the clips plays on him.
//
// The model is large (~50 MB with its textures), so nothing is fetched until
// loadJosh() is first called; after that every caller shares the one load.

const MODEL_URL = "/assets/models/Josh.fbx";
const CLIP_URLS = {
  idle: "/assets/animations/Idle.fbx",
  walk: "/assets/animations/Walking.fbx",
  run: "/assets/animations/Running.fbx",
  sittingIdle: "/assets/animations/SittingIdle.fbx",
};

export const JOSH_HEIGHT = 1.75; // standing height he's scaled to, in world units (m)

let loading = null;

// Resolves to { clips, create }: clips by name (see CLIP_URLS), and create()
// for a new Josh with his own skeleton, so several can be posed at once. The
// copies share geometry and textures.
export function loadJosh() {
  if (loading) return loading;
  const loader = new FBXLoader();
  const names = Object.keys(CLIP_URLS);
  loading = Promise.all([
    loader.loadAsync(MODEL_URL),
    ...names.map((name) => loader.loadAsync(CLIP_URLS[name])),
  ]).then(([model, ...animations]) => {
    // Mixamo exports in centimeters; scale by the bind-pose height instead
    // of assuming, so any character comes out the same size.
    const box = new THREE.Box3().setFromObject(model);
    model.scale.setScalar(JOSH_HEIGHT / (box.max.y - box.min.y));
    model.traverse((node) => {
      if (node.isSkinnedMesh) node.frustumCulled = false;
    });

    const clips = Object.fromEntries(names.map((name, i) => [name, animations[i].animations[0]]));
    return { clips, create: () => SkeletonUtils.clone(model) };
  });
  return loading;
}
