import gsap from "gsap";
import { createTextReveal } from "./textReveal.js";

// The menu: one modal panel over the end of the hallway, holding a stack of
// screens like a game's pause menu.
//
//   menu  ->  selected works  ->  a project's details
//         ->  about
//         ->  contact
//
// It grows out of whatever opened it (the menu button, the contact button)
// the way a project grows out of its card, and shrinks back
// into the menu button on close. A project's details are the deepest screen:
// workModal.js grows them out of their card inside this same panel, passed
// in as `detail`. The bar along the top shows where you are as a breadcrumb,
// any step of which can be clicked to go back to it; Esc goes back one step,
// and ✕ closes the lot.
//
// It can also open straight into one project with no menu behind it
// (openWork), e.g. from a picture on the gallery wall: the project grows out
// of the picture, the breadcrumb reads "gallery / <project>", and going back
// shrinks it back into the picture and closes the modal.
//
// onChange reports the current screen ("menu", "work", "about", "contact"), or null
// once closed, e.g. to highlight the matching nav dot.

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const OPEN_DURATION = reduceMotion ? 0.01 : 0.75;
const CLOSE_DURATION = reduceMotion ? 0.01 : 0.6;
const ITEM_STAGGER = 0.07; // seconds between each menu item's scramble-in

const SCREEN_TITLES = { menu: "menu", work: "selected works", about: "about", contact: "contact" };

const lerp = (a, b, t) => a + (b - a) * t;

export function createGameMenu({ detail, onChange = () => {}, onBackToStart = () => {} }) {
  const ctaEl = document.querySelector(".menu-cta");
  const menuButtonEl = document.querySelector(".menu-button");
  // The menu button is hidden while loading.
  const menuButtonShown = () =>
    menuButtonEl.getClientRects().length > 0 && !document.body.classList.contains("is-loading");
  const root = document.querySelector(".menu-modal");
  const backdropEl = root.querySelector(".menu-modal-backdrop");
  const panelEl = root.querySelector(".menu-modal-panel");
  const barEl = root.querySelector(".menu-modal-bar");
  const crumbsEl = root.querySelector(".menu-modal-crumbs");
  const closeEl = root.querySelector(".menu-modal-close");
  const screens = Object.fromEntries(
    Array.from(root.querySelectorAll(".menu-screen")).map((el) => [el.dataset.screen, el]),
  );
  const items = Array.from(root.querySelectorAll(".game-menu-item"));

  // Menu labels scramble in as the modal opens onto the menu, like the hero
  // title; coming back to the menu from a screen leaves them settled.
  // Widths aren't locked: the screen is hidden when this runs, so there's
  // nothing to measure, and the font is monospaced anyway.
  const itemReveals = items.map((item) =>
    createTextReveal(item.querySelector(".game-menu-label"), { lockWidths: false }),
  );

  let isOpen = false;
  let screen = null;
  let detailTitle = null; // set while a project's details are open
  let detailOnly = false; // opened straight into a project (openWork)
  let ctaWanted = false;
  let tween = null;
  const morph = { value: 0 };
  let rects = null;

  function syncCta() {
    ctaEl.classList.toggle("is-shown", ctaWanted && !isOpen);
  }

  // --- Breadcrumb ---------------------------------------------------------

  function crumbButton(label, onClick, { current = false } = {}) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "menu-crumb";
    button.textContent = label;
    if (current) button.setAttribute("aria-current", "page");
    else button.addEventListener("click", onClick);
    return button;
  }

  function renderCrumbs() {
    if (detailOnly) {
      crumbsEl.replaceChildren();
      const backButton = crumbButton("\u2190", back);
      backButton.classList.add("menu-crumb-back");
      backButton.setAttribute("aria-label", "Back");
      const sep = document.createElement("span");
      sep.className = "menu-crumb-sep";
      sep.textContent = "/";
      sep.setAttribute("aria-hidden", "true");
      crumbsEl.append(backButton, crumbButton("gallery", back));
      if (detailTitle) {
        crumbsEl.append(sep, crumbButton(detailTitle.toLowerCase(), () => {}, { current: true }));
      }
      return;
    }
    const steps = [{ label: SCREEN_TITLES.menu, go: () => showScreen("menu") }];
    if (screen && screen !== "menu") {
      // From a project, its screen is one step back: shrink it into its card.
      steps.push({ label: SCREEN_TITLES[screen], go: () => detail.close() });
    }
    if (detailTitle) steps.push({ label: detailTitle.toLowerCase(), go: () => {} });

    crumbsEl.replaceChildren();
    if (steps.length > 1) {
      const backButton = crumbButton("←", back);
      backButton.classList.add("menu-crumb-back");
      backButton.setAttribute("aria-label", "Back");
      crumbsEl.append(backButton);
    }
    steps.forEach((step, i) => {
      if (i > 0) {
        const sep = document.createElement("span");
        sep.className = "menu-crumb-sep";
        sep.textContent = "/";
        sep.setAttribute("aria-hidden", "true");
        crumbsEl.append(sep);
      }
      crumbsEl.append(crumbButton(step.label, step.go, { current: i === steps.length - 1 }));
    });
  }

  // --- Screens ------------------------------------------------------------

  // name: "menu", "work", "about" or "contact". reveal: scramble the menu
  // labels in, only as the modal opens.
  function showScreen(name, { reveal = false } = {}) {
    if (detail.isOpen()) detail.closeImmediately();
    const changed = name !== screen;
    screen = name;
    for (const [key, el] of Object.entries(screens)) el.hidden = key !== name;
    if (changed) screens[name].scrollTop = 0;

    if (name === "menu" && reveal) {
      itemReveals.forEach((reveal, i) => gsap.delayedCall(i * ITEM_STAGGER, () => reveal.play()));
    }

    renderCrumbs();
    if (name === "menu") items[0].focus({ preventScroll: true });
    else (crumbsEl.querySelector(".menu-crumb-back") ?? closeEl).focus({ preventScroll: true });
    onChange(screen);
  }

  // One step back: out of a project, out of a screen, or out of the menu.
  function back() {
    if (detailOnly) {
      detail.close();
      return;
    }
    if (detail.isOpen()) detail.close();
    else if (screen !== "menu") showScreen("menu");
    else close();
  }

  // Opens straight into one project, grown out of fromRect (a function
  // returning a screen rect, e.g. a picture on the gallery wall), with no
  // menu behind it. Closing it shrinks it back there and closes the modal.
  function openWork(cell, { fromRect }) {
    if (isOpen) return;
    isOpen = true;
    detailOnly = true;
    screen = "work";
    syncCta();
    root.classList.add("is-detail-only");
    root.hidden = false;
    for (const el of Object.values(screens)) el.hidden = true;
    clearMorph();
    gsap.fromTo(backdropEl, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" });
    // The bar waits until the project has mostly grown out.
    gsap.fromTo(barEl, { opacity: 0 }, { opacity: 1, duration: 0.4, delay: 0.55 });
    detail.open(cell, { fromRect });
    onChange(screen);
  }

  // Called by workModal.js (via main.js) once a project has finished
  // closing. Opened on its own (openWork), that closes the modal too.
  function detailClosed() {
    if (!detailOnly) return;
    gsap.to(backdropEl, {
      opacity: 0,
      duration: 0.35,
      ease: "power2.inOut",
      onComplete: () => {
        root.hidden = true;
        root.classList.remove("is-detail-only");
        gsap.set(barEl, { opacity: 1 });
        isOpen = false;
        detailOnly = false;
        screen = null;
        detailTitle = null;
        syncCta();
        onChange(null);
      },
    });
  }

  // Called by workModal.js (via main.js) as a project opens or closes.
  function setDetail(title) {
    detailTitle = title;
    renderCrumbs();
    // Keyboard focus follows into the project, onto its way back out.
    if (title) crumbsEl.querySelector(".menu-crumb-back")?.focus({ preventScroll: true });
  }

  // --- Open / close morph -------------------------------------------------

  function measure(fromEl) {
    const panel = panelEl.getBoundingClientRect();
    const panelRadius = parseFloat(getComputedStyle(panelEl).borderTopLeftRadius) || 0;
    if (!fromEl) return { from: null, panel, panelRadius };
    const from = fromEl.getBoundingClientRect();
    const fromRadius = Math.min(
      parseFloat(getComputedStyle(fromEl).borderTopLeftRadius) || 0,
      from.height / 2,
      from.width / 2,
    );
    return { from, fromRadius, panel, panelRadius };
  }

  // Clips the panel down to the opener's rect at 0, out to its full size at
  // 1. With no opener it scales up slightly from the center instead.
  function renderMorph() {
    const t = morph.value;
    const { from, fromRadius, panel, panelRadius } = rects;
    if (!from) {
      panelEl.style.opacity = String(t);
      panelEl.style.transform = `scale(${lerp(0.96, 1, t)})`;
      return;
    }
    const top = lerp(from.top, panel.top, t);
    const left = lerp(from.left, panel.left, t);
    const bottom = lerp(from.bottom, panel.bottom, t);
    const right = lerp(from.right, panel.right, t);
    panelEl.style.clipPath =
      `inset(${top - panel.top}px ${panel.right - right}px ` +
      `${panel.bottom - bottom}px ${left - panel.left}px ` +
      `round ${lerp(fromRadius, panelRadius, t)}px)`;
  }

  function clearMorph() {
    panelEl.style.clipPath = "";
    panelEl.style.opacity = "";
    panelEl.style.transform = "";
  }

  // screenName: which screen to show. from: the element it grows out of.
  function open(screenName = "menu", { from = null } = {}) {
    if (isOpen && !tween?.isActive()) {
      showScreen(screenName);
      return;
    }
    tween?.kill();
    const wasClosed = !isOpen;
    isOpen = true;
    syncCta();
    root.hidden = false;
    showScreen(screenName, { reveal: wasClosed });

    if (!wasClosed) {
      // Reopened mid-close: run the same morph forward from where it is.
      tween = gsap.to(morph, { value: 1, duration: OPEN_DURATION, ease: "power3.inOut", onUpdate: renderMorph, onComplete: clearMorph });
      gsap.to(backdropEl, { opacity: 1, duration: 0.4 });
      return;
    }
    rects = measure(from);
    morph.value = 0;
    renderMorph();
    gsap.fromTo(backdropEl, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: "power2.out" });
    tween = gsap.to(morph, {
      value: 1,
      duration: OPEN_DURATION,
      ease: "power3.inOut",
      onUpdate: renderMorph,
      onComplete: clearMorph,
    });
  }

  function close() {
    if (!isOpen) return;
    // Opened on its own: shrink the project back to where it came from,
    // after which detailClosed closes the modal.
    if (detailOnly) {
      detail.close();
      return;
    }
    tween?.kill();
    isOpen = false;
    // Shrink back into the menu button if it's on screen, otherwise fade.
    const target = menuButtonShown() ? menuButtonEl : null;
    rects = measure(target);
    morph.value = 1;
    gsap.to(backdropEl, { opacity: 0, duration: 0.5, delay: 0.1, ease: "power2.inOut" });
    tween = gsap.to(morph, {
      value: 0,
      duration: CLOSE_DURATION,
      ease: "power3.inOut",
      onUpdate: renderMorph,
      onComplete: () => {
        root.hidden = true;
        clearMorph();
        detail.closeImmediately();
        screen = null;
        detailTitle = null;
        for (const el of Object.values(screens)) el.hidden = true;
        syncCta();
        onChange(null);
        if (target) menuButtonEl.focus({ preventScroll: true });
      },
    });
  }

  // The invitation to walk the gallery: shown once the end of the hallway is
  // reached; hidden while the menu is open or after scrolling back up.
  function setCtaVisible(visible) {
    if (visible === ctaWanted) return;
    ctaWanted = visible;
    syncCta();
  }

  // --- Wiring -------------------------------------------------------------

  menuButtonEl.addEventListener("click", () => open("menu", { from: menuButtonEl }));
  closeEl.addEventListener("click", close);
  backdropEl.addEventListener("click", close);

  for (const item of items) {
    item.addEventListener("click", () => {
      const target = item.dataset.open;
      if (target === "top") {
        close();
        onBackToStart();
      } else showScreen(target);
    });
    // Hovering an item selects it, as in a game menu, so the keyboard picks
    // up from wherever the pointer left off. The highlight follows focus.
    item.addEventListener("pointerenter", () => item.focus({ preventScroll: true }));
    item.addEventListener("focus", () => item.classList.add("is-selected"));
    item.addEventListener("blur", () => item.classList.remove("is-selected"));
  }

  // Wheel and touch scrolling over the modal scroll whichever screen is
  // under them, and never the page (and the hallway) underneath.
  function blockPageScroll(event) {
    const scroller = event.target.closest(".work-modal-scroll, .menu-screen");
    if (!scroller || scroller.scrollHeight <= scroller.clientHeight) event.preventDefault();
  }
  root.addEventListener("wheel", blockPageScroll, { passive: false });
  root.addEventListener("touchmove", blockPageScroll, { passive: false });

  // The portrait viewer opens over the menu and handles Esc itself, as does
  // a project's details (closing back to the works screen).
  const viewerIsOpen = () => document.querySelector(".portrait-viewer:not([hidden])") !== null;

  window.addEventListener("keydown", (event) => {
    if (viewerIsOpen()) return;

    if (event.key === "Escape") {
      if (isOpen && !detail.isOpen()) {
        back();
        // Handled, so it doesn't also e.g. leave the gallery walk underneath.
        event.preventDefault();
      }
      return;
    }

    if (isOpen && screen === "menu" && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const current = items.indexOf(document.activeElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = current === -1 ? 0 : (current + step + items.length) % items.length;
      items[next].focus({ preventScroll: true });
      return;
    }

    // Enter opens the menu, unless it's being used on some other control.
    if (
      event.key === "Enter" &&
      !isOpen &&
      menuButtonShown() &&
      (document.activeElement === document.body || document.activeElement === menuButtonEl)
    ) {
      event.preventDefault();
      open("menu", { from: menuButtonEl });
    }
  });

  return {
    setCtaVisible,
    open,
    close,
    setDetail,
    openWork,
    detailClosed,
    getState: () => (isOpen ? screen : null),
  };
}
