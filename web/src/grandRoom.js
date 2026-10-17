import * as THREE from "three";
import gsap from "gsap";
import { createPlacard } from "./placard.js";

// The grand room through the doors at the far end of the hallway: a tall hall
// under a round skylight, a fountain in the middle, and exhibits on pedestals
// around it. The hallway shows the work; this room shows the person behind
// it, with each exhibit's placard carrying a line about them.
//
// A greybox for now: every exhibit is a stand-in shape in plain clay, to be
// swapped for a scan or model later, and touching one (click to face it,
// click again) plays a stand-in reaction.
//
// Laid out from its entrance: entranceZ is the room-side face of the wall it
// shares with the hallway, and the room runs from there along +z.

const WIDTH = 24;
const DEPTH = 26;
const HEIGHT = 9;
const FOUNTAIN_Z = 12; // from the entrance
const FOUNTAIN_RADIUS = 2.8;
const OCULUS_RADIUS = 2.4; // the skylight over the fountain
const RING_RADIUS = 6.5; // pedestals stand in a ring this far from the fountain
const PEDESTAL_SIZE = 0.6;
const PEDESTAL_HEIGHT = 1;
const PIANO_Z = 21.5;
const PILASTER_SPACING = 4;

const clay = new THREE.MeshStandardMaterial({ color: 0x9a958e, roughness: 0.8 });
const clayLight = new THREE.MeshStandardMaterial({ color: 0xb8b2a8, roughness: 0.75 });
const clayDark = new THREE.MeshStandardMaterial({ color: 0x5f5b55, roughness: 0.8 });

// Around the fountain, by angle from the entrance side (0° faces the doors,
// so the way in stays clear). build() makes the stand-in, sitting on y = 0;
// interact() is its reaction to being touched, and action what the prompt
// calls that (none if there's nothing to do).
const EXHIBITS = [
  { title: "Cat", note: "Pet her to hear her purr", action: "pet her", angle: -32, build: buildCat, interact: purr },
  { title: "DJ controller", note: "Tap to drop a loop", action: "drop a loop", angle: 32, build: buildDeck, interact: spinPlatters },
  { title: "The desert", note: "Where I live", action: "give it a nudge", angle: -90, build: buildCactus, interact: sway },
  { title: "The donut", note: "My first 3D model", action: "spin it", angle: 90, build: buildDonut, interact: hop },
  { title: "Open plinth", note: "Something new, soon", angle: -148, build: () => new THREE.Group(), interact: () => {} },
  { title: "Open plinth", note: "Something new, soon", angle: 148, build: () => new THREE.Group(), interact: () => {} },
];

export function createGrandRoom({ entranceZ, doorWidth, doorHeight, wallThickness }) {
  const group = new THREE.Group();
  const toWorld = (x, z) => new THREE.Vector3(x, 0, entranceZ + z);
  const fountainCenter = toWorld(0, FOUNTAIN_Z);
  const halfWidth = WIDTH / 2;

  // --- Shell ------------------------------------------------------------

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.9 });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x34302b, roughness: 0.7 });

  // Polished stone, running back under the doorway to meet the hallway.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH, DEPTH + wallThickness),
    new THREE.MeshStandardMaterial({ color: 0x3a3631, roughness: 0.35 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, entranceZ + (DEPTH - wallThickness) / 2);
  group.add(floor);

  // Entrance wall, with the doorway cut out of it.
  const entranceWall = new THREE.Mesh(
    new THREE.ShapeGeometry(doorwayWallShape(WIDTH, HEIGHT, doorWidth, doorHeight)),
    wallMaterial,
  );
  entranceWall.position.z = entranceZ;
  group.add(entranceWall);

  const farWall = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, HEIGHT), wallMaterial);
  farWall.rotation.y = Math.PI;
  farWall.position.set(0, HEIGHT / 2, entranceZ + DEPTH);
  group.add(farWall);

  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(DEPTH, HEIGHT), wallMaterial);
    wall.rotation.y = -side * Math.PI / 2;
    wall.position.set(side * halfWidth, HEIGHT / 2, entranceZ + DEPTH / 2);
    group.add(wall);

    // Pilasters along the walls, echoing the hallway's ribs at a grander
    // scale, and a cornice running along the top.
    for (let z = PILASTER_SPACING; z < DEPTH; z += PILASTER_SPACING) {
      const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.4, HEIGHT, 0.7), trimMaterial);
      pilaster.position.set(side * (halfWidth - 0.2), HEIGHT / 2, entranceZ + z);
      group.add(pilaster);
    }
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, DEPTH), trimMaterial);
    cornice.position.set(side * (halfWidth - 0.3), HEIGHT - 0.25, entranceZ + DEPTH / 2);
    group.add(cornice);
  }

  // Ceiling, open over the fountain to a skylight.
  const ceilingShape = new THREE.Shape()
    .moveTo(-halfWidth, 0)
    .lineTo(halfWidth, 0)
    .lineTo(halfWidth, DEPTH)
    .lineTo(-halfWidth, DEPTH)
    .closePath();
  ceilingShape.holes.push(new THREE.Path().absarc(0, FOUNTAIN_Z, OCULUS_RADIUS, 0, Math.PI * 2, true));
  const ceiling = new THREE.Mesh(new THREE.ShapeGeometry(ceilingShape, 48), wallMaterial);
  ceiling.rotation.x = Math.PI / 2; // facing down, the shape's y running along +z
  ceiling.position.set(0, HEIGHT, entranceZ);
  group.add(ceiling);

  const well = new THREE.Mesh(
    new THREE.CylinderGeometry(OCULUS_RADIUS, OCULUS_RADIUS, 0.8, 48, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.9, side: THREE.BackSide }),
  );
  well.position.set(fountainCenter.x, HEIGHT + 0.4, fountainCenter.z);
  const sky = new THREE.Mesh(
    new THREE.CircleGeometry(OCULUS_RADIUS, 48),
    new THREE.MeshBasicMaterial({ color: 0xdfe8f5 }),
  );
  sky.rotation.x = Math.PI / 2;
  sky.position.set(fountainCenter.x, HEIGHT + 0.8, fountainCenter.z);
  group.add(well, sky);

  // --- Light ------------------------------------------------------------

  // Daylight down through the skylight onto the fountain.
  const daylight = new THREE.SpotLight(0xe4ecff, 420, 0, 0.62, 0.8, 2);
  daylight.position.set(fountainCenter.x, HEIGHT + 0.6, fountainCenter.z);
  daylight.target.position.copy(fountainCenter);
  group.add(daylight, daylight.target);

  // A soft fill from the ceiling, so the room reads as one big space.
  const fill = new THREE.RectAreaLight(0xfff0dd, 1.6, WIDTH * 0.6, DEPTH * 0.6);
  fill.rotation.x = -Math.PI / 2;
  fill.position.set(0, HEIGHT - 0.05, entranceZ + DEPTH / 2);
  group.add(fill);

  // --- Fountain ---------------------------------------------------------

  const stone = new THREE.MeshStandardMaterial({ color: 0x8d877e, roughness: 0.6 });
  const water = new THREE.MeshStandardMaterial({ color: 0x1d2a33, roughness: 0.08, metalness: 0.2 });
  const fountain = new THREE.Group();
  fountain.position.copy(fountainCenter);
  const basinWall = new THREE.Mesh(
    new THREE.CylinderGeometry(FOUNTAIN_RADIUS, FOUNTAIN_RADIUS + 0.1, 0.55, 64, 1, true),
    stone,
  );
  basinWall.position.y = 0.275;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(FOUNTAIN_RADIUS - 0.08, 0.12, 12, 64), stone);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.55;
  const pool = new THREE.Mesh(new THREE.CircleGeometry(FOUNTAIN_RADIUS - 0.1, 64), water);
  pool.rotation.x = -Math.PI / 2;
  pool.position.y = 0.42;
  const column = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.4, 1.5, 24), stone);
  column.position.y = 0.75;
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 0.35, 0.3, 48), stone);
  bowl.position.y = 1.6;
  const bowlWater = new THREE.Mesh(new THREE.CircleGeometry(1, 48), water);
  bowlWater.rotation.x = -Math.PI / 2;
  bowlWater.position.y = 1.72;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.18, 24, 16), stone);
  finial.position.y = 1.95;
  fountain.add(basinWall, rim, pool, column, bowl, bowlWater, finial);
  group.add(fountain);

  // --- Exhibits ---------------------------------------------------------

  const pedestalMaterial = new THREE.MeshStandardMaterial({ color: 0xc9c3b8, roughness: 0.55 });
  const pedestalGeometry = new THREE.BoxGeometry(PEDESTAL_SIZE, PEDESTAL_HEIGHT, PEDESTAL_SIZE);
  const exhibits = [];
  const obstacles = [{ x: fountainCenter.x, z: fountainCenter.z, radius: FOUNTAIN_RADIUS + 0.1 }];

  // A pedestal (or other base) facing the fountain, its exhibit on top, a
  // placard on its front, a spotlight from the ceiling, and a hitbox over the
  // lot for picking.
  function addExhibit({ title, note, action, build, interact }, position, facing, options = {}) {
    const { baseHeight = PEDESTAL_HEIGHT, base, hitSize = [0.9, 1.6, 0.9], viewDistance = 2.3 } = options;
    const stand = new THREE.Group();
    stand.position.copy(position);
    stand.rotation.y = facing;
    group.add(stand);

    stand.add(base ?? mesh(pedestalGeometry, pedestalMaterial, 0, PEDESTAL_HEIGHT / 2, 0));
    const object = build();
    object.position.y = baseHeight;
    stand.add(object);

    const placard = createPlacard({ title, lines: [note], width: 0.42 });
    placard.position.set(0, options.placardY ?? baseHeight * 0.72, (options.placardZ ?? PEDESTAL_SIZE / 2) + 0.012);
    placard.rotation.x = -0.2;
    stand.add(placard);

    // Hit volume: invisible, but still picked by the raycaster.
    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(...hitSize),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    hitbox.position.y = hitSize[1] / 2;
    stand.add(hitbox);

    const front = new THREE.Vector3(Math.sin(facing), 0, Math.cos(facing));
    const spot = new THREE.SpotLight(0xffe6c8, 230, 0, options.spotAngle ?? 0.13, 0.6, 2);
    spot.position.copy(position).addScaledVector(front, 1.4).setY(HEIGHT - 0.4);
    spot.target.position.copy(position).setY(baseHeight + 0.15);
    group.add(spot, spot.target);

    exhibits.push({
      title,
      hitbox,
      // Where the camera goes to face it: in front, a little above.
      focusPosition: position.clone().addScaledVector(front, viewDistance).setY(1.6),
      focusTarget: position.clone().setY(baseHeight + 0.2),
      action,
      interact: () => interact(object),
    });
  }

  for (const exhibit of EXHIBITS) {
    const angle = THREE.MathUtils.degToRad(exhibit.angle);
    const position = new THREE.Vector3(
      fountainCenter.x + Math.sin(angle) * RING_RADIUS,
      0,
      fountainCenter.z - Math.cos(angle) * RING_RADIUS,
    );
    // Face the fountain: local +z toward it.
    addExhibit(exhibit, position, -angle);
    obstacles.push({ x: position.x, z: position.z, radius: PEDESTAL_SIZE * 0.72 });
  }

  // The piano, full size on a low stage beyond the fountain, played facing
  // the room.
  const stage = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 4), trimMaterial);
  stage.position.y = 0.1;
  addExhibit(
    { title: "Piano", note: "Tap to play", action: "play it", build: buildPiano, interact: liftLid },
    toWorld(0, PIANO_Z),
    Math.PI,
    { baseHeight: 0.2, base: stage, hitSize: [3, 2, 3], viewDistance: 4.5, spotAngle: 0.28, placardY: 0.1, placardZ: 2 },
  );
  obstacles.push({
    min: toWorld(-2.5, PIANO_Z - 2).setY(0),
    max: toWorld(2.5, PIANO_Z + 2).setY(0),
  });

  // Walkable floor, inside the pilasters.
  const area = {
    minX: -halfWidth + 0.4,
    maxX: halfWidth - 0.4,
    minZ: entranceZ,
    maxZ: entranceZ + DEPTH,
    height: HEIGHT,
  };

  return { group, area, obstacles, exhibits };
}

// A wall WIDTH x HEIGHT with a doorway at the bottom middle, facing +z.
export function doorwayWallShape(width, height, doorWidth, doorHeight) {
  return new THREE.Shape()
    .moveTo(-width / 2, 0)
    .lineTo(-doorWidth / 2, 0)
    .lineTo(-doorWidth / 2, doorHeight)
    .lineTo(doorWidth / 2, doorHeight)
    .lineTo(doorWidth / 2, 0)
    .lineTo(width / 2, 0)
    .lineTo(width / 2, height)
    .lineTo(-width / 2, height)
    .closePath();
}

// --- Stand-ins --------------------------------------------------------------

function mesh(geometry, material, x = 0, y = 0, z = 0) {
  const result = new THREE.Mesh(geometry, material);
  result.position.set(x, y, z);
  return result;
}

function buildCat() {
  const cat = new THREE.Group();
  const body = mesh(new THREE.SphereGeometry(1, 24, 16), clay, 0, 0.13, 0);
  body.scale.set(0.17, 0.13, 0.26);
  const head = mesh(new THREE.SphereGeometry(0.1, 20, 14), clay, 0, 0.22, 0.2);
  const ears = [-1, 1].map((side) => {
    const ear = mesh(new THREE.ConeGeometry(0.035, 0.08, 10), clay, side * 0.05, 0.32, 0.2);
    ear.rotation.z = -side * 0.25;
    return ear;
  });
  const tail = mesh(new THREE.TorusGeometry(0.12, 0.025, 8, 20, Math.PI), clay, 0.02, 0.04, -0.12);
  tail.rotation.x = -Math.PI / 2;
  cat.add(body, head, ...ears, tail);
  return cat;
}

function buildDeck() {
  const deck = new THREE.Group();
  deck.add(mesh(new THREE.BoxGeometry(0.62, 0.05, 0.36), clayDark, 0, 0.025, 0));
  deck.userData.platters = [-1, 1].map((side) => {
    const platter = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.016, 32), clay, side * 0.17, 0.058, -0.01);
    platter.add(mesh(new THREE.BoxGeometry(0.012, 0.004, 0.09), clayLight, 0, 0.01, 0.04)); // so it shows turning
    deck.add(platter);
    return platter;
  });
  deck.add(mesh(new THREE.BoxGeometry(0.11, 0.02, 0.28), clay, 0, 0.06, 0));
  return deck;
}

function buildCactus() {
  const cactus = new THREE.Group();
  cactus.add(mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.05, 32), clayLight, 0, 0.025, 0));
  cactus.add(mesh(new THREE.CapsuleGeometry(0.06, 0.5, 6, 16), clay, 0, 0.33, 0));
  for (const [side, height, reach] of [[-1, 0.3, 0.13], [1, 0.4, 0.11]]) {
    const elbow = mesh(new THREE.CapsuleGeometry(0.04, reach, 6, 12), clay, side * reach / 2, height, 0);
    elbow.rotation.z = Math.PI / 2;
    const arm = mesh(new THREE.CapsuleGeometry(0.04, 0.14, 6, 12), clay, side * reach, height + 0.09, 0);
    cactus.add(elbow, arm);
  }
  return cactus;
}

function buildDonut() {
  const donut = new THREE.Group();
  const dough = mesh(new THREE.TorusGeometry(0.13, 0.065, 20, 40), clay, 0, 0.07, 0);
  dough.rotation.x = Math.PI / 2;
  const icing = mesh(new THREE.TorusGeometry(0.13, 0.067, 20, 40), clayLight, 0, 0.09, 0);
  icing.rotation.x = Math.PI / 2;
  icing.scale.z = 0.55;
  donut.add(dough, icing);
  return donut;
}

function buildPiano() {
  // A grand piano, its keyboard toward local +z (the room).
  const piano = new THREE.Group();
  piano.add(mesh(new THREE.BoxGeometry(1.5, 0.3, 1.8), clayDark, 0, 0.85, -0.2));
  piano.add(mesh(new THREE.BoxGeometry(1.4, 0.05, 0.22), clayLight, 0, 0.74, 0.8));
  for (const [x, z] of [[-0.65, 0.55], [0.65, 0.55], [0, -1]]) {
    piano.add(mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.7, 12), clayDark, x, 0.35, z));
  }
  const lid = new THREE.Group(); // hinged along the left edge
  lid.position.set(-0.75, 1.0, -0.2);
  lid.add(mesh(new THREE.BoxGeometry(1.5, 0.025, 1.8), clayDark, 0.75, 0, 0));
  lid.rotation.z = 0.5;
  piano.add(lid);
  piano.userData.lid = lid;
  piano.add(mesh(new THREE.BoxGeometry(0.8, 0.48, 0.35), clayDark, 0, 0.24, 1.35)); // bench
  return piano;
}

// --- Reactions ---------------------------------------------------------------

function purr(cat) {
  gsap.fromTo(cat.scale, { y: 1 }, { y: 1.035, duration: 0.07, yoyo: true, repeat: 11, ease: "sine.inOut" });
}

function spinPlatters(deck) {
  for (const platter of deck.userData.platters) {
    gsap.to(platter.rotation, { y: `+=${Math.PI * 4}`, duration: 1.4, ease: "power2.out" });
  }
}

function sway(object) {
  gsap.fromTo(object.rotation, { z: 0 }, { z: 0.06, duration: 0.25, yoyo: true, repeat: 3, ease: "sine.inOut" });
}

function hop(object) {
  gsap.timeline()
    .to(object.position, { y: "+=0.12", duration: 0.22, ease: "power2.out" })
    .to(object.position, { y: "-=0.12", duration: 0.3, ease: "bounce.out" });
  gsap.to(object.rotation, { y: `+=${Math.PI * 2}`, duration: 0.55, ease: "power2.inOut" });
}

function liftLid(piano) {
  const lid = piano.userData.lid;
  gsap.timeline().to(lid.rotation, { z: 0.8, duration: 0.3, ease: "power2.out" }).to(lid.rotation, { z: 0.5, duration: 0.5, ease: "bounce.out" });
}
