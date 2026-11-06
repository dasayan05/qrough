/*
 * qrough element: tables.
 * Rough lines replace the thin row rules (heavier under the header), and the
 * header row gets a light cross-hatched band in the theme's accent colour.
 * Tables with `.striped` (Quarto adds `table-striped`) get the same
 * cross-hatch on every odd body row; revealjs has no native striping.
 * Captions are left alone.
 */
(function () {
  "use strict";

  // rough.js options for every table shape.
  const ROUGH = {
    bowing: 1,
    strokeWidth: 1.25,
    fillStyle: "cross-hatch",
    fillWeight: 0.6,
    hachureGap: 7,
    hachureAngle: -41,
  };
  const BAND_OPACITY = 0.3;   // header band and stripes
  const HEADER_RULE = 2;      // header rule width, relative to strokeWidth
  const BAND_INSET = 1;       // keeps the fill off the rules

  function rows(table) {
    return Array.prototype.filter.call(table.rows, function (tr) { return tr.cells.length; });
  }

  window.qrough.register({
    name: "tables",
    selector: ".reveal .slides table:not(.sourceCode)",
    rough: ROUGH,

    // Per row: whether it is a header row, a stripe, and its native rule.
    readStyle: function (host) {
      const striped = host.classList.contains("table-striped") || host.classList.contains("striped");
      let bodyIndex = 0;
      return {
        accent: window.qrough.themeColor("--r-link-color", "--r-heading-color"),
        rows: rows(host).map(function (tr) {
          const cs = getComputedStyle(tr.cells[0]);
          const header = tr.parentElement.tagName === "THEAD";
          const stripe = striped && tr.parentElement.tagName === "TBODY" && bodyIndex++ % 2 === 0;
          return {
            el: tr,
            header: header,
            stripe: stripe,
            rule: parseFloat(cs.borderBottomWidth) > 0 && cs.borderBottomStyle !== "none",
            color: cs.borderBottomColor,
          };
        }),
      };
    },

    draw: function (ctx) {
      const rc = ctx.rc;
      const w = ctx.width;
      let n = 0;

      // Fills first, so the rules sit on top of them.
      for (const row of ctx.style.rows) {
        if (!row.header && !row.stripe) continue;
        const box = ctx.offsetWithin(row.el, ctx.host);
        if (!box.height) continue;
        ctx.add(rc.rectangle(BAND_INSET, box.y + BAND_INSET, w - 2 * BAND_INSET, box.height - 2 * BAND_INSET,
          ctx.opts({ stroke: "none", fill: ctx.style.accent }, ++n)), BAND_OPACITY);
      }

      for (const row of ctx.style.rows) {
        if (!row.rule) continue;
        const box = ctx.offsetWithin(row.el, ctx.host);
        const y = box.y + box.height;
        ctx.add(rc.line(0, y, w, y, ctx.opts({
          stroke: row.color,
          strokeWidth: ROUGH.strokeWidth * (row.header ? HEADER_RULE : 1),
        }, ++n)));
      }
    },
  });
})();
