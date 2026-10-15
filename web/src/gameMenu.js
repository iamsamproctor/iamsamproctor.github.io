import { createTextReveal } from "./textReveal.js";

// The page ends where the hallway fades to black. There a menu button
// appears (setCtaVisible), opening a game-style menu over the scene whose
// items open Work and About as full-screen panels, each of which can step
// back to the menu or close everything. Esc steps back one level, and the
// arrow keys move through the menu.
//
// State is one of: null (nothing open), "menu", or a panel name ("work",
// "about"). onChange reports it, e.g. to highlight the matching nav dot.

const FADE_MS = 350; // must match the .game-menu / .menu-panel transitions
const ITEM_STAGGER_MS = 70; // between each menu item's scramble-in

export function createGameMenu({ onChange = () => {}, onBackToStart = () => {} } = {}) {
  const ctaEl = document.querySelector(".menu-cta");
  const ctaButtonEl = ctaEl.querySelector(".menu-cta-button");
  const menuEl = document.querySelector(".game-menu");
  const items = Array.from(menuEl.querySelectorAll(".game-menu-item"));
  const panels = Object.fromEntries(
    Array.from(document.querySelectorAll(".menu-panel")).map((el) => [el.dataset.panel, el]),
  );

  // Menu labels scramble in each time the menu opens, like the hero title.
  // Widths aren't locked: the menu is hidden when this runs, so there's
  // nothing to measure, and the font is monospaced anyway.
  const itemReveals = items.map((item) =>
    createTextReveal(item.querySelector(".game-menu-label"), { lockWidths: false }),
  );

  let state = null;
  let ctaWanted = false;
  const hideTimers = new Map();

  function show(el) {
    clearTimeout(hideTimers.get(el));
    el.hidden = false;
    // Let the browser apply the hidden-state styles before transitioning.
    void el.offsetWidth;
    el.classList.add("is-open");
  }

  function hide(el) {
    el.classList.remove("is-open");
    clearTimeout(hideTimers.get(el));
    hideTimers.set(
      el,
      setTimeout(() => {
        if (!el.classList.contains("is-open")) el.hidden = true;
      }, FADE_MS),
    );
  }

  function setState(next) {
    state = next;
    ctaEl.classList.toggle("is-shown", ctaWanted && state === null);
    onChange(state);
  }

  function openMenu() {
    for (const panel of Object.values(panels)) hide(panel);
    const wasOpen = state === "menu";
    show(menuEl);
    setState("menu");
    if (!wasOpen) {
      itemReveals.forEach((reveal, i) => setTimeout(() => reveal.play(), i * ITEM_STAGGER_MS));
    }
    items[0].focus({ preventScroll: true });
  }

  // name: "work" or "about". scrollTo: id of an element in the panel to
  // scroll to once open, e.g. "contact".
  function openPanel(name, { scrollTo = null } = {}) {
    const panel = panels[name];
    if (!panel) return;
    for (const other of Object.values(panels)) if (other !== panel) hide(other);
    hide(menuEl);
    show(panel);
    panel.scrollTop = 0;
    if (scrollTo) {
      const target = panel.querySelector(`#${scrollTo}`);
      if (target) {
        requestAnimationFrame(() => target.scrollIntoView({ behavior: "smooth" }));
      }
    }
    setState(name);
    panel.querySelector(".menu-panel-back")?.focus({ preventScroll: true });
  }

  function closeAll() {
    const wasOpen = state !== null;
    hide(menuEl);
    for (const panel of Object.values(panels)) hide(panel);
    setState(null);
    if (wasOpen && ctaWanted) ctaButtonEl.focus({ preventScroll: true });
  }

  // Shown once the end of the hallway is reached; hidden while anything is
  // open or after scrolling back up.
  function setCtaVisible(visible) {
    if (visible === ctaWanted) return;
    ctaWanted = visible;
    ctaEl.classList.toggle("is-shown", ctaWanted && state === null);
  }

  ctaButtonEl.addEventListener("click", openMenu);
  menuEl.querySelector(".game-menu-close").addEventListener("click", closeAll);
  for (const item of items) {
    item.addEventListener("click", () => {
      const target = item.dataset.open;
      if (target === "contact") openPanel("about", { scrollTo: "contact" });
      else if (target === "top") {
        closeAll();
        onBackToStart();
      } else openPanel(target);
    });
    // Hovering an item selects it, as in a game menu, so the keyboard picks
    // up from wherever the pointer left off. The highlight follows focus.
    item.addEventListener("pointerenter", () => item.focus({ preventScroll: true }));
    item.addEventListener("focus", () => item.classList.add("is-selected"));
    item.addEventListener("blur", () => item.classList.remove("is-selected"));
  }
  for (const panel of Object.values(panels)) {
    panel.querySelector(".menu-panel-back").addEventListener("click", openMenu);
    panel.querySelector(".menu-panel-close").addEventListener("click", closeAll);
  }

  // The menu itself doesn't scroll; keep wheel and touch scrolling over it
  // from moving the page (and the hallway) underneath.
  const blockScroll = (event) => event.preventDefault();
  menuEl.addEventListener("wheel", blockScroll, { passive: false });
  menuEl.addEventListener("touchmove", blockScroll, { passive: false });

  // The work modal and portrait viewer open over the panels and handle Esc
  // themselves; leave it to them while either is up.
  const modalIsOpen = () =>
    document.querySelector(".work-modal:not([hidden]), .portrait-viewer:not([hidden])") !== null;

  window.addEventListener("keydown", (event) => {
    if (modalIsOpen()) return;

    if (event.key === "Escape") {
      if (state === "menu") closeAll();
      else if (state !== null) openMenu();
      return;
    }

    if (state === "menu" && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault();
      const current = items.indexOf(document.activeElement);
      const step = event.key === "ArrowDown" ? 1 : -1;
      const next = current === -1 ? 0 : (current + step + items.length) % items.length;
      items[next].focus({ preventScroll: true });
      return;
    }

    // Enter opens the menu from the end of the hallway, unless it's being
    // used on some other control.
    if (
      event.key === "Enter" &&
      state === null &&
      ctaWanted &&
      (document.activeElement === document.body || document.activeElement === ctaButtonEl)
    ) {
      event.preventDefault();
      openMenu();
    }
  });

  return { setCtaVisible, openMenu, openPanel, closeAll, getState: () => state };
}
