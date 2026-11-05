/*
 * qrough element: emphasis (*italic*).
 * A hand-drawn ellipse around each line fragment of the text, no fill.
 */
(function () {
  "use strict";

  const ROUGH = {
    strokeWidth: 1.25,
    fill: "none",
  };
  const GROW_X = 1.08; // ellipse size relative to the text box, so it
  const GROW_Y = 1.35; // circles the words instead of cutting through them
  const PAD_X = 6;     // extra px of width on short words

  window.qrough.register({
    name: "emphasis",
    selector: ".reveal .slides em:not(.callout-title em)",
    text: true,
    rough: ROUGH,

    readStyle: function () {
      return { accent: window.qrough.themeColor("--r-link-color", "--r-heading-color") };
    },

    draw: function (ctx) {
      ctx.rects.forEach(function (r, i) {
        ctx.add(ctx.rc.ellipse(r.x + r.width / 2, r.y + r.height / 2,
          r.width * GROW_X + PAD_X, r.height * GROW_Y,
          ctx.opts({ stroke: ctx.style.accent }, i)));
      });
    },
  });
})();
