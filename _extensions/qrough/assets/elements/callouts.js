/*
 * qrough element: callouts.
 * Rough outline, a thick left edge in the callout's accent colour, and a
 * hachured header band. In revealjs output the header is
 * `.callout > .callout-body > .callout-title`, and callouts cannot collapse.
 */
(function () {
  "use strict";

  // rough.js options for every callout shape.
  const ROUGH = {
    bowing: 1,
    strokeWidth: 1.5,
    fillStyle: "hachure",
    fillWeight: 0.75,
    hachureGap: 6,
    hachureAngle: -41,
  };
  const HEADER_OPACITY = 0.35; // header band fill
  const DIVIDER_SCALE = 0.75;  // header divider width, relative to strokeWidth
  const ACCENT_SCALE = 0.8;    // left edge width, relative to Quarto's border

  function header(host) {
    return host.querySelector(":scope > .callout-body > .callout-title");
  }

  window.qrough.register({
    name: "callouts",
    selector: "div.callout",
    rough: ROUGH,

    readStyle: function (host) {
      const cs = getComputedStyle(host);
      return {
        accent: cs.borderLeftColor,
        accentWidth: parseFloat(cs.borderLeftWidth) || 5,
        outline: cs.borderTopColor,
        simple: host.classList.contains("callout-style-simple"),
      };
    },

    draw: function (ctx) {
      const rc = ctx.rc;
      const s = ctx.style;
      const w = ctx.width;
      const h = ctx.height;

      // Header band, with a divider line underneath it.
      const head = header(ctx.host);
      if (head && !s.simple) {
        const box = ctx.offsetWithin(head, ctx.host);
        ctx.add(rc.rectangle(2, box.y + 1, w - 4, box.height - 2,
          ctx.opts({ stroke: "none", fill: s.accent }, 1)), HEADER_OPACITY);
        const y = box.y + box.height;
        if (y < h - 4) {
          ctx.add(rc.line(0, y, w, y, ctx.opts({
            stroke: s.accent,
            strokeWidth: ROUGH.strokeWidth * DIVIDER_SCALE,
          }, 2)));
        }
      }

      // Outline: accent colour for the default style, the theme's neutral
      // border colour for the simple/minimal styles.
      ctx.add(rc.rectangle(0, 0, w, h, ctx.opts({ stroke: s.simple ? s.outline : s.accent })));

      // Thick left edge, echoing Quarto's coloured left bar.
      ctx.add(rc.line(0, 0, 0, h, ctx.opts({
        stroke: s.accent,
        strokeWidth: Math.max(ROUGH.strokeWidth * 2, s.accentWidth * ACCENT_SCALE),
      }, 3)));
    },
  });
})();
