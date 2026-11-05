/*
 * qrough element: strong emphasis (***bold italic***, `<strong><em>`).
 * A hand-drawn rectangle around each line fragment of the text, no fill,
 * replacing the bold underline and the italic ellipse.
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
    name: "strong-emphasis",
    // Each `***text***` has exactly one <strong>, so it gets exactly one box.
    selector: ".reveal .slides strong:not(.callout-title strong)",
    text: true,
    match: function (el) { return window.qrough.isBoldItalic(el); },
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
