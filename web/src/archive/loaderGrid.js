import { createPointerGrid } from "./pointerGrid.js";

// The bending grid (pointerGrid.js) as a full-screen layer behind the
// loading screen.
export function createLoaderGrid(container) {
  const canvas = document.createElement("canvas");
  canvas.className = "loader-grid";
  canvas.setAttribute("aria-hidden", "true");
  container.prepend(canvas);
  const grid = createPointerGrid(canvas);

  return {
    canvas,
    destroy() {
      grid.destroy();
      canvas.remove();
    },
  };
}
