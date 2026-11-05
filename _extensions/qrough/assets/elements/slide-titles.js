/*
 * qrough element: slide titles.
 * A full-width filled band behind each slide's `## Heading`, in the theme's
 * accent (link) colour.
 */
(function () {
  "use strict";

  // rough.js options for the title band.
  const ROUGH = {
    bowing: 1,
    strokeWidth: 1.5,
    fillStyle: "zigzag-line",
    fillWeight: 0.75,
    hachureGap: 6,
    hachureAngle: -41,
  };
  const BAND_OPACITY = 0.35;

  window.qrough.register({
    name: "slide-titles",
    selector: ".reveal .slides section.slide > h2",
    rough: ROUGH,

    readStyle: function () {
      return { accent: window.qrough.themeColor("--r-link-color", "--r-heading-color") };
    },

    draw: function (ctx) {
      ctx.add(ctx.rc.rectangle(0, 0, ctx.width, ctx.height,
        ctx.opts({ stroke: "none", fill: ctx.style.accent })), BAND_OPACITY);
    },
  });
})();
