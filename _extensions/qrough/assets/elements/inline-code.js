/*
 * qrough element: inline code.
 * A light, solid hand-drawn highlight behind each `code` span (not code
 * blocks), in the theme's accent colour. No border.
 */
(function () {
  "use strict";

  const ROUGH = {
    fillStyle: "solid",
    stroke: "none",
  };
  const FILL_OPACITY = 0.2;
  const OVERHANG = 2; // px the highlight reaches past the text box

  window.qrough.register({
    name: "inline-code",
    selector: ".reveal .slides :not(pre) > code",
    text: true,
    rough: ROUGH,

    readStyle: function () {
      return { accent: window.qrough.themeColor("--r-link-color", "--r-heading-color") };
    },

    draw: function (ctx) {
      ctx.rects.forEach(function (r, i) {
        ctx.add(ctx.rc.rectangle(r.x - OVERHANG, r.y, r.width + 2 * OVERHANG, r.height,
          ctx.opts({ fill: ctx.style.accent }, i)), FILL_OPACITY);
      });
    },
  });
})();
