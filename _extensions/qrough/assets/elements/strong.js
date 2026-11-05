/*
 * qrough element: strong (**bold**).
 * A hand-drawn rectangle around each line fragment of the text, no fill.
 */
(function () {
  "use strict";

  const ROUGH = {
    bowing: 1,
    strokeWidth: 1.25,
    fill: "none",
  };
  const OVERHANG = 3; // px the rectangle reaches past the text box

  window.qrough.register({
    name: "strong",
    // Callout titles are `<strong>` in Quarto's markup; the callout patcher owns them.
    selector: ".reveal .slides strong:not(.callout-title strong)",
    text: true,
    rough: ROUGH,

    readStyle: function () {
      return { accent: window.qrough.themeColor("--r-link-color", "--r-heading-color") };
    },

    draw: function (ctx) {
      ctx.rects.forEach(function (r, i) {
        ctx.add(ctx.rc.rectangle(r.x - OVERHANG, r.y - 1, r.width + 2 * OVERHANG, r.height + 2,
          ctx.opts({ stroke: ctx.style.accent }, i)));
      });
    },
  });
})();
