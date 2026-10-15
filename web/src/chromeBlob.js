import * as THREE from "three";
import { SparkRenderer } from "@sparkjsdev/spark";

// A floating liquid-chrome blob for the landing scene. It has no lighting of
// its own: a mirror only shows its surroundings, so once it's given an
// environment map made from the splat scene (see captureEnvironment) it
// looks lit by the desert automatically, and keeps doing so if the
// environment is swapped.
//
// A true reflection from the blob's position is mostly empty, because a scan
// only covers the directions its camera saw. So instead of a physically
// correct capture, one wide snapshot of the view is mirrored into a seamless
// panorama and wrapped all the way around: not accurate, but the blob shows
// desert from every angle, which is what reads as chrome.
//
// With realReflection (see captureEnvironment), that panorama becomes the
// backdrop for a true 360° capture of the splats from the blob's own
// position: it reflects the actual scene around it where the scan has data,
// and falls back to the panorama where it doesn't, instead of to black.
//
// The surface ripples slowly: a smooth noise field displaces the sphere
// along its normals in the vertex shader, and normals are rebuilt from the
// displaced neighbors so reflections bend with the ripples.

const RADIUS = 0.384;
const RIPPLE = 0.055; // displacement, as a fraction of the radius
const RIPPLE_SPEED = 0.55;
const BOB_HEIGHT = 0.06;
const BOB_SPEED = 0.7; // radians per second
const SPIN_SPEED = 0.15; // radians per second
const HIT_WOBBLE = 2.6; // extra ripple right after a tap, in units of RIPPLE
const HIT_POP = 0.12; // how much it swells and shrinks right after a tap
const CHARGE_SQUEEZE = 0.22; // how far it draws in when fully charged
const CHARGE_SHIVER = 1.2; // wobble while charging, in units of a tap's
const CHARGE_BLAST = 2.2; // extra wobble and swell from a full release
const HIT_DECAY = 3; // how quickly a tap's wobble dies down (per second)

// When the blob travels (e.g. rising as the page scrolls), it pulls into a
// teardrop: a broad, slightly flattened front leading the way and a narrow
// tail trailing behind. The stretch follows its speed through a spring, so it
// lags as it sets off and overshoots into a liquid wobble when it stops.
const STRETCH_PER_SPEED = 0.5; // stretch per world unit/second of travel
const STRETCH_MAX = 0.4;
const STRETCH_STIFFNESS = 60; // spring pull toward the target stretch
const STRETCH_DAMPING = 9; // lower = more wobble when it stops
const TEAR_TAIL = 0.55; // how far the tail draws out at full stretch, in radii
const TEAR_TAPER = 0.35; // how much the tail narrows
const TEAR_WIDEN = 0.06; // how much the front broadens
const TEAR_FLATTEN = 0.06; // how much the leading face flattens

const SNAPSHOT_WIDTH = 1024;
const SNAPSHOT_HEIGHT = 512;
const SNAPSHOT_FOV = 75; // vertical degrees; wider shows more of the scene
// Pixels per cube face for the true capture. The blob is small on screen, and
// this is redrawn several times a second when refreshed live.
const REAL_REFLECTION_SIZE = 256;

// Turns one snapshot into a 2:1 equirectangular panorama: the snapshot and
// its mirror image side by side fill the band around the horizon (so the
// wrap has no seam), and the rows at its top and bottom edges are stretched
// out to the poles.
function buildPanorama(snapshotCanvas) {
  const width = SNAPSHOT_WIDTH * 2;
  const height = SNAPSHOT_WIDTH;
  const bandTop = (height - SNAPSHOT_HEIGHT) / 2;
  const bandBottom = bandTop + SNAPSHOT_HEIGHT;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  ctx.drawImage(snapshotCanvas, 0, bandTop);
  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(snapshotCanvas, 0, bandTop);
  ctx.restore();

  fillPole(ctx, canvas, width, bandTop, 0, bandTop, true);
  fillPole(ctx, canvas, width, bandBottom - 1, bandBottom, height - bandBottom, false);
  return canvas;
}

// Fills the area above or below the snapshot band. Stretching the edge row
// straight to the pole smears it into long streaks, so the edge is averaged
// into a few broad color patches (a coarse, smooth version of the same
// colors) that then fade to the row's overall average color at the pole.
function fillPole(ctx, source, width, edgeRow, poleTop, poleHeight, isTop) {
  const PATCHES = 12;
  const small = document.createElement("canvas");
  small.width = PATCHES;
  small.height = 1;
  const sctx = small.getContext("2d");
  sctx.imageSmoothingQuality = "high";
  sctx.drawImage(source, 0, edgeRow - (isTop ? 0 : 7), width, 8, 0, 0, PATCHES, 1);

  const mean = document.createElement("canvas");
  mean.width = 1;
  mean.height = 1;
  mean.getContext("2d").drawImage(small, 0, 0, PATCHES, 1, 0, 0, 1, 1);

  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(small, 0, 0, PATCHES, 1, 0, poleTop, width, poleHeight);
  // Fade from the patches at the band edge to the flat average at the pole.
  const grad = ctx.createLinearGradient(0, poleTop, 0, poleTop + poleHeight);
  const near = isTop ? 1 : 0;
  grad.addColorStop(near, "rgba(0,0,0,0)");
  grad.addColorStop(1 - near, "rgba(0,0,0,1)");
  const flat = document.createElement("canvas");
  flat.width = 1;
  flat.height = poleHeight;
  const fctx = flat.getContext("2d");
  fctx.drawImage(mean, 0, 0, 1, 1, 0, 0, 1, poleHeight);
  fctx.globalCompositeOperation = "destination-in";
  fctx.fillStyle = grad;
  fctx.fillRect(0, 0, 1, poleHeight);
  ctx.drawImage(flat, 0, 0, 1, poleHeight, 0, poleTop, width, poleHeight);
  ctx.restore();
}

export function createChromeBlob() {
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    metalness: 1,
    roughness: 0.06,
  });

  const time = { value: 0 };
  const impact = { value: 0 }; // 1 right after a tap, decaying to 0
  const stretchUniform = { value: 0 };
  const stretchDir = { value: new THREE.Vector3(0, 1, 0) };
  // The spring behind the teardrop: signed stretch (+ = travelling up) and
  // how fast it's changing.
  let stretch = 0;
  let stretchVelocity = 0;
  let lastAnchorY = null;
  let lastSeconds = null;
  const worldTravel = new THREE.Vector3();
  const inverseRotation = new THREE.Quaternion();
  let hitAt = -1000;
  let hitPower = 0;
  let charge = 0; // 0..1 while the blob is being held down
  // Three only encodes output to sRGB when drawing to the screen. The hallway
  // draws this scene into a render target (as the portrait), where the blob
  // would come out in linear values and look black next to Spark's sRGB
  // splats, so it encodes itself there.
  const encodeOutput = { value: 0 };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uBlobEncode = encodeOutput;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        /* glsl */ `
        #include <common>
        uniform float uBlobEncode;
        `,
      )
      .replace(
        "#include <colorspace_fragment>",
        /* glsl */ `
        #include <colorspace_fragment>
        if (uBlobEncode > 0.5) {
          gl_FragColor.rgb = mix(
            gl_FragColor.rgb * 12.92,
            1.055 * pow(gl_FragColor.rgb, vec3(1.0 / 2.4)) - 0.055,
            step(0.0031308, gl_FragColor.rgb)
          );
        }
        `,
      );
    shader.uniforms.uBlobTime = time;
    shader.uniforms.uBlobImpact = impact;
    shader.uniforms.uBlobStretch = stretchUniform;
    shader.uniforms.uBlobStretchDir = stretchDir;
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        /* glsl */ `
        #include <common>
        uniform float uBlobTime;
        uniform float uBlobImpact;
        uniform float uBlobStretch;
        uniform vec3 uBlobStretchDir; // direction of travel, in object space

        // n: point on the unit sphere. q: where the ripples put it.
        vec3 blobTeardrop(vec3 n, vec3 q) {
          float a = uBlobStretch;
          if (a <= 0.) return q;
          vec3 d = uBlobStretchDir;
          float s = dot(n, d);
          float back = max(-s, 0.);
          float front = max(s, 0.);
          float along = dot(q, d);
          vec3 across = q - d * along;
          across *= 1. + a * (${TEAR_WIDEN.toFixed(3)} * (1. - back) - ${TEAR_TAPER.toFixed(3)} * back * back);
          along *= 1. + a * (${TEAR_TAIL.toFixed(3)} * pow(back, 1.5) - ${TEAR_FLATTEN.toFixed(3)} * front);
          return across + d * along;
        }

        float blobField(vec3 p) {
          float t = uBlobTime * ${RIPPLE_SPEED.toFixed(3)};
          float d = sin(p.x * 1.7 + t * 1.1) * sin(p.y * 2.1 - t * 0.8) * sin(p.z * 1.6 + t * 0.9);
          d += 0.35 * sin(p.x * 3.1 + p.z * 2.3 - t * 1.4) * sin(p.y * 2.7 + t);
          // A tap sets off a fast, tighter wobble that dies away.
          d += uBlobImpact * ${HIT_WOBBLE.toFixed(3)}
            * sin(p.x * 5.3 + uBlobTime * 17.) * sin(p.y * 4.1 - uBlobTime * 13.) * sin(p.z * 4.7 + uBlobTime * 11.);
          return d * ${RIPPLE.toFixed(3)};
        }

        vec3 blobPoint(vec3 p) {
          vec3 n = normalize(p);
          return blobTeardrop(n, n + n * blobField(n));
        }
        `,
      )
      .replace(
        "#include <beginnormal_vertex>",
        /* glsl */ `
        // Rebuild the normal from two displaced neighbors on the sphere.
        vec3 n0 = normalize(position);
        vec3 tangent0 = normalize(cross(n0, abs(n0.y) < 0.99 ? vec3(0., 1., 0.) : vec3(1., 0., 0.)));
        vec3 bitangent0 = cross(n0, tangent0);
        vec3 q0 = blobPoint(n0);
        vec3 qa = blobPoint(n0 + tangent0 * 0.01);
        vec3 qb = blobPoint(n0 + bitangent0 * 0.01);
        vec3 objectNormal = normalize(cross(qa - q0, qb - q0));
        `,
      )
      .replace(
        "#include <begin_vertex>",
        /* glsl */ `
        vec3 transformed = q0;
        `,
      );
  };

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 160, 120), material);
  mesh.onBeforeRender = (renderer) => {
    encodeOutput.value = renderer.getRenderTarget() ? 1 : 0;
  };
  mesh.scale.setScalar(RADIUS);
  // The teardrop's tail reaches past the sphere's bounds, which would get it
  // culled early at the edge of the view.
  mesh.frustumCulled = false;
  // Hidden until it has something to reflect; a mirror with no environment
  // is just a black ball.
  mesh.visible = false;

  const anchor = new THREE.Vector3();

  // Snapshots the scene once and wraps it around the blob as its reflection.
  // viewCamera: the camera the scene is viewed through; the snapshot is taken
  // from the same spot (where the splats are already sorted for) with a
  // wider lens. Call after the environment splat has loaded.
  //
  // real: also make the true capture from the blob's position (see the top
  // of this file); call refreshReflection() after that to keep it current.
  async function captureEnvironment(renderer, scene, viewCamera, { real = false } = {}) {
    panorama = capturePanorama(renderer, scene, viewCamera);
    material.envMap = panorama;
    material.needsUpdate = true;
    mesh.visible = true;
    if (!real) return;

    // A second, offscreen SparkRenderer for the capture, with its own sort
    // order, so sorting the splats around the blob never disturbs the main
    // view's. Being offscreen, it writes linear color, matching the cube and
    // the decoded panorama behind it. Its target is never drawn to, but splats
    // are sized against its dimensions, so it must match a cube face. It's
    // sorted by hand before each capture, so it doesn't update itself.
    reflectionSpark = new SparkRenderer({
      renderer,
      autoUpdate: false,
      target: { width: REAL_REFLECTION_SIZE, height: REAL_REFLECTION_SIZE },
    });
    reflectionScene = scene;
    await refreshReflection();
  }

  let panorama = null;
  let reflectionSpark = null;
  let reflectionScene = null;
  let reflectionCube = null; // the cube texture the blob reflects, once captured
  let refreshing = false;
  const reflectionSortCamera = new THREE.Camera();

  // Recaptures the true reflection from where the blob is now, so it shows
  // the scene as it currently is (the sparkle, ripples) from its current
  // height. Skipped if a refresh is still in progress. Needs
  // captureEnvironment(..., { real: true }) first.
  async function refreshReflection() {
    if (!reflectionSpark || refreshing) return;
    refreshing = true;
    try {
      const center = mesh.position;
      reflectionSortCamera.position.copy(center);
      await reflectionSpark.update({ scene: reflectionScene, camera: reflectionSortCamera });

      // With the splats already sorted, the capture itself runs without
      // waiting, so the panorama is only the scene's backdrop for these six
      // renders and never shows in an on-screen frame.
      const previousBackground = reflectionScene.background;
      reflectionScene.background = panorama;
      try {
        const cube = await reflectionSpark.renderCubeMap({
          scene: reflectionScene,
          worldCenter: center,
          size: REAL_REFLECTION_SIZE,
          hideObjects: [mesh],
          update: false,
          filter: true,
        });
        // Three re-filters a render-target cube for reflections whenever this
        // is flagged, reusing the same buffers each time.
        cube.needsPMREMUpdate = true;
        if (reflectionCube !== cube) {
          reflectionCube = cube;
          material.envMap = cube;
          material.needsUpdate = true;
        }
      } finally {
        reflectionScene.background = previousBackground;
      }
    } finally {
      refreshing = false;
    }
  }

  function capturePanorama(renderer, scene, viewCamera) {
    const target = new THREE.WebGLRenderTarget(SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT);
    const snapshotCamera = new THREE.PerspectiveCamera(
      SNAPSHOT_FOV,
      SNAPSHOT_WIDTH / SNAPSHOT_HEIGHT,
      0.05,
      200,
    );
    snapshotCamera.position.copy(viewCamera.position);
    snapshotCamera.quaternion.copy(viewCamera.quaternion);

    const pixels = new Uint8Array(SNAPSHOT_WIDTH * SNAPSHOT_HEIGHT * 4);
    const previousTarget = renderer.getRenderTarget();
    // Spark reads splat data back asynchronously through a pixel-pack
    // buffer; if one is still bound, a plain readPixels into an array fails.
    // Unbind it for this read and put it back afterwards.
    const gl = renderer.getContext();
    const boundPackBuffer = gl.getParameter(gl.PIXEL_PACK_BUFFER_BINDING);
    mesh.visible = false;
    try {
      renderer.setRenderTarget(target);
      renderer.render(scene, snapshotCamera);
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
      renderer.readRenderTargetPixels(target, 0, 0, SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT, pixels);
    } finally {
      gl.bindBuffer(gl.PIXEL_PACK_BUFFER, boundPackBuffer);
      renderer.setRenderTarget(previousTarget);
      target.dispose();
    }

    // Pixels come back bottom row first; flip them into a canvas. Spark
    // writes sRGB values directly, so they're used as-is.
    const snapshotCanvas = document.createElement("canvas");
    snapshotCanvas.width = SNAPSHOT_WIDTH;
    snapshotCanvas.height = SNAPSHOT_HEIGHT;
    const image = new ImageData(SNAPSHOT_WIDTH, SNAPSHOT_HEIGHT);
    const rowBytes = SNAPSHOT_WIDTH * 4;
    for (let y = 0; y < SNAPSHOT_HEIGHT; y++) {
      const from = (SNAPSHOT_HEIGHT - 1 - y) * rowBytes;
      image.data.set(pixels.subarray(from, from + rowBytes), y * rowBytes);
    }
    for (let i = 3; i < image.data.length; i += 4) image.data[i] = 255;
    snapshotCanvas.getContext("2d").putImageData(image, 0, 0);

    const envMap = new THREE.CanvasTexture(buildPanorama(snapshotCanvas));
    envMap.mapping = THREE.EquirectangularReflectionMapping;
    envMap.colorSpace = THREE.SRGBColorSpace;
    return envMap;
  }

  // seconds: page time when it was tapped.
  // power: 0 for a plain tap up to 1 for a fully charged release.
  function hit(seconds, power = 0) {
    hitAt = seconds;
    hitPower = power;
  }

  // While held, the blob draws in and shivers harder as it charges.
  function setCharge(value) {
    charge = value;
  }

  // center: where to float, e.g. a point partway up the dust devil.
  function update(seconds, center) {
    time.value = seconds;
    const sinceHit = seconds - hitAt;
    const decay = HIT_DECAY / (1 + hitPower * 0.6);
    const hitImpact = sinceHit >= 0 ? Math.exp(-sinceHit * decay) : 0;
    const strength = 1 + hitPower * CHARGE_BLAST;
    impact.value = hitImpact * strength + charge * charge * CHARGE_SHIVER;
    const swell = HIT_POP * hitImpact * strength * Math.sin(sinceHit * 18);
    const squeeze = charge * CHARGE_SQUEEZE;
    mesh.scale.setScalar(RADIUS * (1 + swell - squeeze));
    anchor.copy(center);
    mesh.position.set(anchor.x, anchor.y + Math.sin(seconds * BOB_SPEED) * BOB_HEIGHT, anchor.z);
    mesh.rotation.y = seconds * SPIN_SPEED;
    mesh.rotation.x = Math.sin(seconds * 0.23) * 0.3;
    updateStretch(seconds);
  }

  // Measured from the anchor, not the bob, so only real travel stretches it.
  function updateStretch(seconds) {
    const dt = lastSeconds === null ? 0 : Math.min(seconds - lastSeconds, 0.05);
    if (dt > 0) {
      const speed = (anchor.y - lastAnchorY) / dt;
      const target = THREE.MathUtils.clamp(speed * STRETCH_PER_SPEED, -STRETCH_MAX, STRETCH_MAX);
      stretchVelocity +=
        (STRETCH_STIFFNESS * (target - stretch) - STRETCH_DAMPING * stretchVelocity) * dt;
      stretch += stretchVelocity * dt;
    }
    lastSeconds = seconds;
    lastAnchorY = anchor.y;

    // The shader stretches toward one direction by a positive amount, so a
    // negative stretch (falling, or the wobble overshooting) points it down.
    // That direction is given in the blob's own space, since it spins.
    stretchUniform.value = Math.abs(stretch);
    worldTravel.set(0, Math.sign(stretch) || 1, 0);
    inverseRotation.copy(mesh.quaternion).invert();
    stretchDir.value.copy(worldTravel).applyQuaternion(inverseRotation);
  }

  return { mesh, captureEnvironment, refreshReflection, update, hit, setCharge };
}
