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
 * behind its content.
 *
 * A patcher with `text: true` targets inline text (code, em, strong, del).
 * Inline boxes can wrap across lines and are invisible to ResizeObserver, so
 * such elements share one overlay on their nearest block ancestor (p, li,
 * h2...), and `draw` gets `ctx.rects`: one box per line fragment, in the
 * block's layout pixels. With `front: true` the patcher draws into a second
 * overlay above the text instead of behind it. An optional `match(el)` filters
 * the selector's matches; elements it rejects stay free for other patchers. Native borders/backgrounds are hidden by the element
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
  // Text patchers: block element -> { back, front, items: [{ el, patcher, style, seed }] }
  const textBlocks = new Map();
  const textItems = new WeakSet(); // inline elements already patched
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

  // rough.js options for one shape: the element's own, the user's roughness,
  // and a fixed seed so redraws don't jitter (`n` picks a distinct one).
  function optsFor(patcher, seed) {
    const base = Object.assign({}, patcher.rough, {
      roughness: user.roughness,
      seed: user.seed + seed * 10,
    });
    return function (overrides, n) {
      return Object.assign({}, base, overrides, { seed: base.seed + (n || 0) });
    };
  }

  function makeOverlay(host, extraClass) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "qrough-overlay" + (extraClass ? " " + extraClass : ""));
    svg.setAttribute("aria-hidden", "true");
    host.insertBefore(svg, host.firstChild);
    return svg;
  }

  // Clear an overlay and size it to `width` x `height` plus PAD on every side.
  function resetOverlay(svg, width, height) {
    while (svg.lastChild) svg.removeChild(svg.lastChild);
    svg.setAttribute("width", width + 2 * PAD);
    svg.setAttribute("height", height + 2 * PAD);
    svg.setAttribute("viewBox", [-PAD, -PAD, width + 2 * PAD, height + 2 * PAD].join(" "));
  }

  function appender(svg) {
    // Append a rough.js shape to the overlay, optionally semi-transparent.
    return function (node, opacity) {
      if (opacity != null) node.setAttribute("opacity", String(opacity));
      svg.appendChild(node);
      return node;
    };
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
    const svg = makeOverlay(host);
    host.classList.add("qrough-host", "qrough-" + patcher.name);
    nextSeed += 1;
    hosts.set(host, { patcher: patcher, svg: svg, style: null, seed: nextSeed });
    resizeObserver.observe(host);
  }

  // True when `el` (an em or strong) and a strong/em directly around or inside
  // it wrap exactly the same text, i.e. Markdown `***text***`.
  function isBoldItalic(el) {
    const other = el.tagName === "EM" ? "STRONG" : "EM";
    const parent = el.parentElement;
    if (parent && parent.tagName === other && parent.textContent === el.textContent) return true;
    const child = el.firstElementChild;
    return !!child && child.tagName === other && child.textContent === el.textContent;
  }

  // Nearest ancestor that lays out as a block (not `display: inline`).
  function blockOf(el) {
    let node = el.parentElement;
    while (node && node.parentElement) {
      const display = getComputedStyle(node).display;
      if (display !== "inline" && display !== "contents") return node;
      node = node.parentElement;
    }
    return node;
  }

  // Returns the new item, or null if `el` is skipped or already patched.
  function patchText(el, patcher) {
    if (textItems.has(el)) return null;
    if (patcher.match && !patcher.match(el)) return null;
    textItems.add(el);
    if (el.closest("svg")) return null; // e.g. labels inside diagrams
    const block = blockOf(el);
    if (!block) return null;
    let state = textBlocks.get(block);
    if (!state) {
      state = { back: null, front: null, items: [] };
      textBlocks.set(block, state);
      block.classList.add("qrough-host", "qrough-text-host");
      resizeObserver.observe(block);
    }
    if (patcher.front) {
      if (!state.front) state.front = makeOverlay(block, "qrough-front");
    } else if (!state.back) {
      state.back = makeOverlay(block);
    }
    el.classList.add("qrough-" + patcher.name);
    nextSeed += 1;
    const item = { el: el, patcher: patcher, style: null, seed: nextSeed };
    state.items.push(item);
    return item;
  }

  function redraw(host) {
    if (textBlocks.has(host)) redrawText(host);
    const state = hosts.get(host);
    if (!state || !host.isConnected) return;
    const width = host.offsetWidth;
    const height = host.offsetHeight;
    const svg = state.svg;
    resetOverlay(svg, width, height);
    if (!width || !height) return; // not laid out (e.g. a hidden slide)

    state.patcher.draw({
      rc: rough.svg(svg),
      svg: svg,
      host: host,
      width: width,
      height: height,
      style: state.style,
      offsetWithin: offsetWithin,
      opts: optsFor(state.patcher, state.seed),
      add: appender(svg),
    });
  }

  function redrawText(block) {
    const state = textBlocks.get(block);
    if (!block.isConnected) return;
    const width = block.offsetWidth;
    const height = block.offsetHeight;
    const layers = [state.back, state.front].filter(Boolean);
    layers.forEach(function (svg) { resetOverlay(svg, width, height); });
    if (!width || !height) return;

    // Client rects include Reveal's `transform: scale`; divide it back out.
    // Overlays are positioned from the padding box, hence clientLeft/Top.
    const box = block.getBoundingClientRect();
    const scale = box.width / width || 1;
    const rcs = new Map(layers.map(function (svg) { return [svg, rough.svg(svg)]; }));
    for (const item of state.items) {
      if (!item.el.isConnected) continue;
      const rects = [];
      for (const r of item.el.getClientRects()) {
        if (r.width < 1 || r.height < 1) continue;
        rects.push({
          x: (r.left - box.left) / scale - block.clientLeft,
          y: (r.top - box.top) / scale - block.clientTop,
          width: r.width / scale,
          height: r.height / scale,
        });
      }
      if (!rects.length) continue;
      const svg = item.patcher.front ? state.front : state.back;
      item.patcher.draw({
        rc: rcs.get(svg),
        svg: svg,
        host: item.el,
        block: block,
        rects: rects,
        style: item.style,
        opts: optsFor(item.patcher, item.seed),
        add: appender(svg),
      });
    }
  }

  function drawAll(root) {
    loadConfig();
    root = root || document;
    const fresh = [];
    for (const patcher of patchers) {
      root.querySelectorAll(patcher.selector).forEach(function (host) {
        if (patcher.text) {
          const item = patchText(host, patcher);
          if (item) fresh.push([host, item]);
        } else if (!hosts.has(host)) {
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
    textBlocks.forEach(function (state, block) {
      if (!hosts.has(block) && (root === document || root.contains(block))) redrawText(block);
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
        textBlocks.forEach(function (_, block) { schedule(block); });
      });
    }
  }

  window.qrough = {
    register: register,
    drawAll: drawAll,
    redraw: redraw,
    attachReveal: attachReveal,
    themeColor: themeColor,
    isBoldItalic: isBoldItalic,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
