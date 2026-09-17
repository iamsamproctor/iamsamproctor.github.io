import gsap from "gsap";

// Downloading is the bulk of the wait, but the splats still need to decode
// after the last byte arrives. Hold the bar short of full until that settles
// so 100% means "ready", not "downloaded".
const DOWNLOAD_SHARE = 0.95;

export function createLoadingScreen({ assets, onEnter }) {
  const root = document.querySelector(".loader");
  const valueEl = root.querySelector(".loader-percent-value");
  const fillEl = root.querySelector(".loader-bar-fill");
  const enterEl = root.querySelector(".loader-enter");

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
    gsap.to(enterEl, { opacity: 1, duration: 0.5, ease: "power2.out" });
  };

  enterEl.addEventListener("click", () => {
    gsap
      .timeline()
      .to([valueEl.parentElement, fillEl.parentElement, enterEl], {
        opacity: 0,
        duration: 0.4,
        ease: "power2.in",
      })
      .to(root, {
        opacity: 0,
        duration: 0.8,
        ease: "power2.inOut",
        onStart: () => {
          document.body.classList.remove("is-loading");
          window.scrollTo(0, 0);
          if (onEnter) onEnter();
        },
        onComplete: () => {
          root.style.display = "none";
        },
      });
  });

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
