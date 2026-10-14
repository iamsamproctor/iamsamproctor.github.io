# Archive

Effects that were built and then set aside. Nothing here is imported by the
site; it's kept so it can be brought back.

## Bending grid (`pointerGrid.js`, `loaderGrid.js`)

A faint grid that bends toward the pointer and lights up around it, with a
slow liquid wobble in the lines. Set aside because it was too disorienting
behind the page content. Tuning constants are at the top of `pointerGrid.js`.

To bring it back, move both files into `src/` and:

**Loading screen.** In `loadingScreen.js`:

```js
import { createLoaderGrid } from "./loaderGrid.js";
// after markEl:
const grid = createLoaderGrid(root);
// add grid.canvas to the fade-out list in enter(), and call grid.destroy()
// next to root.style.display = "none".
```

```css
.loader-grid {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

/* so the Enter buttons stay above the canvas */
.loader-enter-group {
  position: relative;
}
```

**Behind Work and About.** They're already wrapped in `.pages`. In `main.js`:

```js
import { createPointerGrid } from "./pointerGrid.js";

const pagesEl = document.querySelector(".pages");
if (pagesEl) {
  const layer = document.createElement("div");
  layer.className = "pages-grid";
  layer.setAttribute("aria-hidden", "true");
  const canvas = document.createElement("canvas");
  layer.appendChild(canvas);
  pagesEl.prepend(layer);
  createPointerGrid(canvas, { anchor: pagesEl, observe: layer });
}
```

```css
/* The canvas is viewport-sized and sticks while the pages scroll by. */
.pages-grid {
  position: absolute;
  inset: 0;
  z-index: 0;
  overflow: clip;
  pointer-events: none;
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, #000 50vh);
  mask-image: linear-gradient(to bottom, transparent 0, #000 50vh);
}

.pages-grid canvas {
  position: sticky;
  top: 0;
  display: block;
  width: 100%;
  height: 100vh;
}
```
