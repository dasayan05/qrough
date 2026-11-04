/*
 * qrough runtime: redraws elements of Quarto revealjs slides with rough.js.
 *
 * Each patched element ("host") gets an absolutely positioned <svg> overlay
 * behind its content. Native borders/backgrounds are hidden by qrough.css,
 * but only once `html.qrough` is set, so decks without JS keep Quarto's look.
 * Drawing follows the Reveal lifecycle through the qrough revealjs plugin.
 */
(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const PAD = 6; // overlay overhang so sketchy strokes are not clipped

  // Quarto emits the `window.QROUGH_CONFIG` script *after* this file, so the
  // config cannot be read at load time. These objects start with the defaults
  // and are filled in place by loadConfig() before the first draw.
  const config = { rough: {}, patchers: {}, fillStyle: "hachure" };
  const roughDefaults = { roughness: 1, bowing: 1, strokeWidth: 1.5, seed: 42 };
  let configLoaded = false;

  function loadConfig() {
    if (configLoaded) return;
    configLoaded = true;
    Object.assign(config, window.QROUGH_CONFIG || {});
    Object.assign(roughDefaults, config.rough);
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

  function readStyles(entries) {
    // Computed colours are only meaningful while the native styles are visible.
    const root = document.documentElement;
    const active = root.classList.contains("qrough");
    root.classList.remove("qrough");
    for (const [host, state] of entries) state.style = state.patcher.readStyle(host);
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
    hosts.set(host, { patcher: patcher, svg: svg, style: null, seed: roughDefaults.seed + nextSeed });
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
    const opts = Object.assign({}, roughDefaults, { seed: state.seed });
    state.patcher.draw({
      rc: rc,
      svg: svg,
      host: host,
      width: width,
      height: height,
      style: state.style,
      opts: opts,
      config: config,
      offsetWithin: offsetWithin,
    });
  }

  function drawAll(root) {
    loadConfig();
    root = root || document;
    const fresh = [];
    for (const patcher of patchers) {
      if (config.patchers[patcher.name] === false) continue;
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
    config: config,
    register: register,
    drawAll: drawAll,
    redraw: redraw,
    attachReveal: attachReveal,
  };

  /* ------------------------------------------------------------------ */
  /* Patchers                                                            */
  /* ------------------------------------------------------------------ */

  // Callouts. In revealjs output the header is `.callout-body > .callout-title`.
  register({
    name: "callouts",
    selector: "div.callout",

    header: function (host) {
      return host.querySelector(":scope > .callout-body > .callout-title");
    },

    readStyle: function (host) {
      const cs = getComputedStyle(host);
      const header = this.header(host);
      return {
        accent: cs.borderLeftColor,
        accentWidth: parseFloat(cs.borderLeftWidth) || 5,
        outline: cs.borderTopColor,
        headerFill: header ? getComputedStyle(header).backgroundColor : null,
        simple: host.classList.contains("callout-style-simple"),
      };
    },

    draw: function (ctx) {
      const rc = ctx.rc;
      const s = ctx.style;
      const w = ctx.width;
      const h = ctx.height;
      const opts = ctx.opts;
      const fillStyle = ctx.config.fillStyle || "hachure";

      // Header band: hachure lines in the accent colour (Excalidraw-like) or a
      // solid block in Quarto's own header tint.
      const header = this.header(ctx.host);
      if (header && !s.simple && s.headerFill) {
        const box = ctx.offsetWithin(header, ctx.host);
        const solid = fillStyle === "solid";
        const band = rc.rectangle(2, box.y + 1, w - 4, box.height - 2, Object.assign({}, opts, {
          stroke: "none",
          fill: solid ? s.headerFill : s.accent,
          fillStyle: fillStyle,
          fillWeight: opts.fillWeight || opts.strokeWidth / 2,
          seed: opts.seed + 1,
        }));
        if (!solid) band.setAttribute("opacity", "0.35");
        ctx.svg.appendChild(band);
        if (box.y + box.height < h - 4) {
          ctx.svg.appendChild(rc.line(0, box.y + box.height, w, box.y + box.height, Object.assign({}, opts, {
            stroke: s.accent,
            strokeWidth: opts.strokeWidth * 0.75,
            seed: opts.seed + 2,
          })));
        }
      }

      // Outline: accent colour for the default style, the theme's neutral
      // border colour for the simple/minimal styles.
      ctx.svg.appendChild(rc.rectangle(0, 0, w, h, Object.assign({}, opts, {
        stroke: s.simple ? s.outline : s.accent,
      })));

      // Thick left edge, echoing Quarto's coloured left bar.
      ctx.svg.appendChild(rc.line(0, 0, 0, h, Object.assign({}, opts, {
        stroke: s.accent,
        strokeWidth: Math.max(opts.strokeWidth * 2, s.accentWidth * 0.8),
        seed: opts.seed + 3,
      })));
    },
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
