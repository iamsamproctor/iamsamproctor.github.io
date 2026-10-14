import * as THREE from "three";

// A quote lettered on the hallway's end wall, above the portrait, like an
// epigraph over a work in a gallery. It's HTML rather than 3D text so it stays
// crisp at any distance: each frame its anchor on the wall is projected to
// the screen and the block is moved and scaled to match. Tapping it fades to
// another quote.

// Bottom-center of the text block, on the end wall just above the frame.
const ANCHOR = new THREE.Vector3(0, 2.62, -0.09);
const DESIGN_PX_PER_UNIT = 100; // the CSS is laid out at 100px per world unit
const MAX_LENGTH = 120; // longer quotes don't fit the wall above the frame
const SWAP_SECONDS = 0.6; // must match the .hallway-quote-inner transition

function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char],
  );
}

export function createHallwayQuote(el, quotes) {
  const innerEl = el.querySelector(".hallway-quote-inner");
  const textEl = el.querySelector(".hallway-quote-text");
  const authorEl = el.querySelector(".hallway-quote-author");

  const pool = quotes.filter(
    (quote) => quote.display_enabled && quote.quote.length <= MAX_LENGTH,
  );
  let currentIndex = -1;
  let swapping = false;

  function pickNext() {
    if (pool.length < 2) return 0;
    let index;
    do {
      index = Math.floor(Math.random() * pool.length);
    } while (index === currentIndex);
    return index;
  }

  function render(index) {
    currentIndex = index;
    const { quote, author } = pool[index];
    // Line breaks in verse are stored as " / ".
    textEl.innerHTML = quote.split(/\s*\/\s*/).map(escapeHtml).join("<br />");
    authorEl.textContent = author;
  }

  function next() {
    if (swapping || pool.length < 2) return;
    swapping = true;
    innerEl.classList.add("is-swapping");
    setTimeout(() => {
      render(pickNext());
      innerEl.classList.remove("is-swapping");
      swapping = false;
    }, SWAP_SECONDS * 1000);
  }

  if (pool.length) render(pickNext());
  el.addEventListener("click", next);

  let shown = false;

  // project: hallway.projectWallPoint. progress: the hallway's 0-1 progress.
  function update(project, progress) {
    if (!pool.length) return;
    const { x, y, pxPerUnit, visibility } = project(ANCHOR, window.innerWidth, window.innerHeight);
    const scale = pxPerUnit / DESIGN_PX_PER_UNIT;
    // Fades in as it comes clear of the top of the screen, out with the fog.
    const arrive = THREE.MathUtils.smoothstep(progress, 0.03, 0.12);
    const opacity = arrive * visibility;
    el.style.transform = `translate(${x}px, ${y}px) scale(${scale}) translate(-50%, -100%)`;
    el.style.opacity = String(opacity);
    el.style.pointerEvents = opacity > 0.3 ? "auto" : "none";
    shown = true;
  }

  function hide() {
    if (!shown) return;
    shown = false;
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
  }

  return { update, hide };
}
