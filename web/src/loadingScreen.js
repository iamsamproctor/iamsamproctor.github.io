import gsap from "gsap";
import { createLoaderGrid } from "./loaderGrid.js";

// Downloading is the bulk of the wait, but the splats still need to decode
// after the last byte arrives. Hold the bar short of full until that settles
// so 100% means "ready", not "downloaded".
const DOWNLOAD_SHARE = 0.95;

export function createLoadingScreen({ assets, onEnter, onEnterWithAudio }) {
  const root = document.querySelector(".loader");
  const valueEl = root.querySelector(".loader-percent-value");
  const fillEl = root.querySelector(".loader-bar-fill");
  const enterEl = root.querySelector(".loader-enter");
  const enterMutedEl = root.querySelector(".loader-enter-muted");
  const markEl = root.querySelector(".loader-mark");
  const grid = createLoaderGrid(root);

  const tracked = new Map(
    assets.map((asset) => [asset.id, { loaded: 0, total: asset.bytes }]),
  );

  const progress = { value: 0 };
  let finished = false;

  document.body.classList.add("is-loading");

  const render = () => {
    valueEl.textContent = String(Math.round(progress.value * 100));
    fillEl.style.transform = `scaleX(${progress.value})`;
  };

  const tweenTo = (value, onComplete) => {
    gsap.to(progress, {
      value,
      duration: 0.6,
      ease: "power2.out",
      overwrite: true,
      onUpdate: render,
      onComplete,
    });
  };

  const revealEnter = () => {
    enterEl.classList.add("is-ready");
    enterMutedEl.classList.add("is-ready");
    gsap.to([enterEl, enterMutedEl], {
      opacity: 1,
      duration: 0.5,
      ease: "power2.out",
    });
  };

  // The readout fades on its own, then the black overlay is swapped out in a
  // single frame for the equally black reveal-burn covering the canvas. The
  // handoff is invisible, and the burn takes over from there — so the loader
  // never fades itself out, and `is-loading` stays on until the burn says so.
  const enter = () => {
    gsap
      .timeline()
      .to([grid.canvas, markEl, valueEl.parentElement, fillEl.parentElement, enterEl, enterMutedEl], {
        opacity: 0,
        duration: 0.4,
        ease: "power2.in",
      })
      .add(() => {
        root.style.display = "none";
        grid.destroy();
        window.scrollTo(0, 0);
        if (onEnter) onEnter();
      });
  };

  // Audio has to be started synchronously inside the click — browsers won't
  // let it start later from the fade timeline — so this runs before `enter`.
  enterEl.addEventListener("click", () => {
    if (onEnterWithAudio) onEnterWithAudio();
    enter();
  });
  enterMutedEl.addEventListener("click", enter);

  return {
    report(id, loaded, total) {
      if (finished) return;
      const entry = tracked.get(id);
      if (!entry) return;
      entry.loaded = loaded;
      if (total) entry.total = total;

      let sumLoaded = 0;
      let sumTotal = 0;
      tracked.forEach((item) => {
        sumLoaded += item.loaded;
        sumTotal += item.total;
      });

      const ratio = sumTotal ? Math.min(sumLoaded / sumTotal, 1) : 0;
      tweenTo(ratio * DOWNLOAD_SHARE);
    },

    finish() {
      if (finished) return;
      finished = true;
      tweenTo(1, revealEnter);
    },
  };
}
