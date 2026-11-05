/*
 * qrough core runtime: redraws elements of Quarto revealjs slides with rough.js.
 *
 * Element types live in `elements/<name>.js` and register themselves with
 * `qrough.register({ name, selector, rough, readStyle, draw })`:
 *   - `rough`     rough.js options for this element (stroke width, fill style...)
 *   - `readStyle` reads theme colours while the native styles are still visible
 *   - `draw`      draws into the element's overlay, given a `ctx` (see redraw())
 *
 * Each patched element ("host") gets an absolutely positioned <svg> overlay
 * behind its content. Native borders/backgrounds are hidden by the element
 * CSS, scoped to `html.qrough`, so decks without JS keep Quarto's look.
 * Drawing follows the Reveal lifecycle through the qrough revealjs plugin.
 */
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const PAD = 6; // overlay overhang so sketchy strokes are not clipped

  // The only user options. Quarto emits `window.QROUGH_CONFIG` *after* this
  // file, so it is read lazily by loadConfig() before the first draw.
  const user = { roughness: 1, seed: 42 };
  let configLoaded = false;

  function loadConfig() {
    if (configLoaded) return;
    configLoaded = true;
    const cfg = window.QROUGH_CONFIG || {};
    if (typeof cfg.roughness === "number") user.roughness = cfg.roughness;
    if (typeof cfg.seed === "number") user.seed = cfg.seed;
  }

  const patchers = [];
  const hosts = new Map(); // host element -> { patcher, svg, style, seed }
  let nextSeed = 0;
  let pending = new Set();
  let frame = 0;

  const resizeObserver = new ResizeObserver(function (entries) {
    for (const entry of entries) schedule(entry.target);
  });

  function schedule(host) {
    pending.add(host);
    if (!frame) frame = requestAnimationFrame(flush);
  }

  function flush() {
    frame = 0;
    const batch = pending;
    pending = new Set();
    batch.forEach(redraw);
  }

  /* ------------------------------------------------------------------ */
  /* Shared helpers for element files                                    */
  /* ------------------------------------------------------------------ */

  // Position of `el` relative to `host`, in layout pixels. Walking offsetParent
  // ignores CSS transforms, so this stays correct inside scaled Reveal slides.
  function offsetWithin(el, host) {
    let x = 0;
    let y = 0;
    let node = el;
    while (node && node !== host) {
      x += node.offsetLeft;
      y += node.offsetTop;
      node = node.offsetParent;
    }
    return { x: x, y: y, width: el.offsetWidth, height: el.offsetHeight };
  }

  // A reveal theme colour such as `--r-link-color`, with fallbacks.
  function themeColor() {
    const cs = getComputedStyle(document.documentElement);
    for (const name of arguments) {
      const value = cs.getPropertyValue(name).trim();
      if (value) return value;
    }
    return "currentColor";
  }

  /* ------------------------------------------------------------------ */
  /* Patching and drawing                                                */
  /* ------------------------------------------------------------------ */

  function readStyles(entries) {
    // Computed colours are only meaningful while the native styles are visible.
    const root = document.documentElement;
    const active = root.classList.contains("qrough");
    root.classList.remove("qrough");
    for (const [host, state] of entries) {
      state.style = state.patcher.readStyle ? state.patcher.readStyle(host) : {};
    }
    if (active) root.classList.add("qrough");
  }

  function patch(host, patcher) {
    if (hosts.has(host)) return;
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "qrough-overlay");
    svg.setAttribute("aria-hidden", "true");
    host.insertBefore(svg, host.firstChild);
    host.classList.add("qrough-host", "qrough-" + patcher.name);
    nextSeed += 1;
    hosts.set(host, { patcher: patcher, svg: svg, style: null, seed: nextSeed });
    resizeObserver.observe(host);
  }

  function redraw(host) {
    const state = hosts.get(host);
    if (!state || !host.isConnected) return;
    const width = host.offsetWidth;
    const height = host.offsetHeight;
    const svg = state.svg;
    while (svg.lastChild) svg.removeChild(svg.lastChild);
    if (!width || !height) return; // not laid out (e.g. a hidden slide)
    svg.setAttribute("width", width + 2 * PAD);
    svg.setAttribute("height", height + 2 * PAD);
    svg.setAttribute("viewBox", [-PAD, -PAD, width + 2 * PAD, height + 2 * PAD].join(" "));

    const rc = rough.svg(svg);
    const base = Object.assign({}, state.patcher.rough, {
      roughness: user.roughness,
      seed: user.seed + state.seed * 10,
    });
    const ctx = {
      rc: rc,
      svg: svg,
      host: host,
      width: width,
      height: height,
      style: state.style,
      offsetWithin: offsetWithin,
      // rough.js options: the element's own, the user's roughness, and a
      // fixed per-shape seed (`n` picks a distinct one) so redraws don't jitter.
      opts: function (overrides, n) {
        return Object.assign({}, base, overrides, { seed: base.seed + (n || 0) });
      },
      // Append a rough.js shape to the overlay, optionally semi-transparent.
      add: function (node, opacity) {
        if (opacity != null) node.setAttribute("opacity", String(opacity));
        svg.appendChild(node);
        return node;
      },
    };
    state.patcher.draw(ctx);
  }

  function drawAll(root) {
    loadConfig();
    root = root || document;
    const fresh = [];
    for (const patcher of patchers) {
      root.querySelectorAll(patcher.selector).forEach(function (host) {
        if (!hosts.has(host)) {
          patch(host, patcher);
          fresh.push([host, hosts.get(host)]);
        }
      });
    }
    readStyles(fresh);
    document.documentElement.classList.add("qrough");
    hosts.forEach(function (state, host) {
      if (root === document || root.contains(host)) redraw(host);
    });
  }

  function register(patcher) {
    patchers.push(patcher);
  }

  /* ------------------------------------------------------------------ */
  /* Reveal lifecycle                                                    */
  /* ------------------------------------------------------------------ */

  let revealAttached = false;

  function attachReveal(deck) {
    revealAttached = true;
    const all = function () { drawAll(deck.getRevealElement()); };
    const current = function () {
      const slide = deck.getCurrentSlide();
      if (slide) drawAll(slide);
    };
    if (deck.isReady()) all();
    else deck.on("ready", all);
    deck.on("slidechanged", current);
    deck.on("resize", current);
    deck.on("overviewshown", all);
    deck.on("overviewhidden", current);
    deck.on("pdf-ready", all);
  }

  function start() {
    // Normally the plugin calls attachReveal(); without it, draw once the page
    // has loaded and rely on the ResizeObservers for slides shown later.
    window.addEventListener("load", function () {
      if (revealAttached) return;
      console.info(
        "qrough: revealjs plugin not loaded; use `format: qrough-revealjs` for reliable slide redraws."
      );
      drawAll(document.querySelector(".reveal") || document);
    });
    // Font swaps change element sizes; the ResizeObserver catches most of it,
    // but redraw once fonts settle to be sure.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        hosts.forEach(function (_, host) { schedule(host); });
      });
    }
  }

  window.qrough = {
    register: register,
    drawAll: drawAll,
    redraw: redraw,
    attachReveal: attachReveal,
    themeColor: themeColor,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
