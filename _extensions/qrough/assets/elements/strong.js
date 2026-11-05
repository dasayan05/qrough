/*
 * qrough element: strong (**bold**).
 * A rough underline below each line fragment of the text. Bold italic
 * (`***text***`) is boxed by `strong-emphasis` instead.
 */
(function () {
  "use strict";

  const ROUGH = {
    bowing: 2,
    strokeWidth: 1.75,
  };
  const DROP = 1;     // px the line sits above the bottom of the text box
  const TILT = 1.5;   // px the line rises from left to right
  const OVERHANG = 2; // px the line reaches past the text box

  window.qrough.register({
    name: "strong",
    // Callout titles are `<strong>` in Quarto's markup; the callout patcher owns them.
    selector: ".reveal .slides strong:not(.callout-title strong)",
    text: true,
    match: function (el) { return !window.qrough.isBoldItalic(el); },
    rough: ROUGH,

    readStyle: function () {
      return { accent: window.qrough.themeColor("--r-link-color", "--r-heading-color") };
    },

    draw: function (ctx) {
      ctx.rects.forEach(function (r, i) {
        const y = r.y + r.height - DROP;
        ctx.add(ctx.rc.line(r.x - OVERHANG, y + TILT / 2, r.x + r.width + OVERHANG, y - TILT / 2,
          ctx.opts({ stroke: ctx.style.accent }, i)));
      });
    },
  });
})();
