/*
 * qrough element: blockquotes.
 * A rough line replaces the solid bar on the left of a `> quote`, in the same
 * colour and about the same width.
 */
(function () {
  "use strict";

  // rough.js options for the bar.
  const ROUGH = {
    bowing: 2,
  };
  const BAR_SCALE = 0.8; // bar width, relative to Quarto's border

  window.qrough.register({
    name: "blockquotes",
    selector: ".reveal .slides blockquote",
    rough: ROUGH,

    readStyle: function (host) {
      const cs = getComputedStyle(host);
      return {
        color: cs.borderLeftColor,
        width: parseFloat(cs.borderLeftWidth) || 4,
      };
    },

    draw: function (ctx) {
      // Centred on the native border, which keeps its width (now transparent).
      const x = ctx.style.width / 2;
      ctx.add(ctx.rc.line(x, 0, x, ctx.height, ctx.opts({
        stroke: ctx.style.color,
        strokeWidth: ctx.style.width * BAR_SCALE,
      })));
    },
  });
})();
