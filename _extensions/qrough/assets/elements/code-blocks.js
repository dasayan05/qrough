/*
 * qrough element: code blocks.
 * Replaces the thin border around a fenced code block with a rough outline in
 * the same colour; the background is left as Quarto draws it. The border sits
 * on `div.sourceCode`, which wraps `pre.sourceCode > code`.
 */
(function () {
  "use strict";

  // rough.js options for the outline.
  const ROUGH = {
    bowing: 1,
    strokeWidth: 1.25,
  };

  window.qrough.register({
    name: "code-blocks",
    selector: ".reveal .slides div.sourceCode",
    rough: ROUGH,

    readStyle: function (host) {
      return { outline: getComputedStyle(host).borderTopColor };
    },

    draw: function (ctx) {
      ctx.add(ctx.rc.rectangle(0, 0, ctx.width, ctx.height,
        ctx.opts({ stroke: ctx.style.outline })));
    },
  });
})();
