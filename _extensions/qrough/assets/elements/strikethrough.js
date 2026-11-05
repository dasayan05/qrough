/*
 * qrough element: strikethrough (~~text~~, Pandoc's `<del>`).
 * A rough line across each line fragment of the text, drawn above the text.
 */
(function () {
  "use strict";

  const ROUGH = {
    bowing: 2,
    strokeWidth: 2,
  };
  const MID = 0.55;  // line height, as a fraction of the text box from the top
  const TILT = 2;    // px the line rises from left to right
  const OVERHANG = 3; // px the line reaches past the text box

  window.qrough.register({
    name: "strikethrough",
    selector: ".reveal .slides del",
    text: true,
    front: true,
    rough: ROUGH,

    readStyle: function () {
      return { accent: window.qrough.themeColor("--r-link-color", "--r-heading-color") };
    },

    draw: function (ctx) {
      ctx.rects.forEach(function (r, i) {
        const y = r.y + r.height * MID;
        ctx.add(ctx.rc.line(r.x - OVERHANG, y + TILT / 2, r.x + r.width + OVERHANG, y - TILT / 2,
          ctx.opts({ stroke: ctx.style.accent }, i)));
      });
    },
  });
})();
