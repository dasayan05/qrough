/*
 * qrough revealjs plugin: slides that are not shown are not laid out, so let
 * the qrough runtime (injected by the qrough filter) follow Reveal's lifecycle.
 */
window.QRough = function () {
  return {
    id: "qrough",
    init: function (deck) {
      if (!window.qrough) {
        console.warn("qrough: runtime not found; use `format: qrough-revealjs` for this document.");
        return;
      }
      window.qrough.attachReveal(deck);
    },
  };
};
