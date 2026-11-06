# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project goal

`qrough` is a Quarto extension that restyles Quarto **revealjs presentations only** with a hand-drawn, sketchy (Excalidraw-like) look powered by [rough.js](https://roughjs.com). It does not touch fonts: users pick one (e.g. the system-installed Excalifont) with Quarto's own `mainfont:` in their deck's front matter, as `example.qmd` and `template.qmd` do. Plain `html` documents/websites are out of scope: the filter skips them with a warning, so do not add HTML-format-specific code (Bootstrap selectors, light/dark toggle, collapsible callouts). It does not add new markup: it "patches" existing Quarto slide elements (callouts, code blocks, tables, figures, slide decorations, etc.) by drawing rough.js SVG borders/fills on top of / behind them and hiding their regular CSS borders and backgrounds. Example: a callout box keeps its normal Quarto structure, but its border becomes a squiggly rough.js rectangle.

v0.1 patches callouts, slide titles, code blocks, tables, blockquotes and inline text (inline code, italic, bold, bold italic, strikethrough; see `README.md`). Every element type is always patched; there are no per-element switches. Users can set only `roughness` and `seed`; every other style parameter (stroke width, fill style, opacities, ...) is fixed per element in that element's own JS file.

## Repository layout

This directory is the publishable extension repo, in Quarto's standard layout. `quarto add` installs only `_extensions/qrough/`; everything else here is repo-only and never reaches users.

| Path | Role |
|------|------|
| `_extensions/qrough/` | The extension itself: `_extension.yml` plus its Lua/JS/CSS assets. |
| `example.qmd` | The test deck exercising every patched element. It finds the extension in the neighbouring `_extensions/`, so edits show up live without installing. Add new test slides here. |
| `template.qmd` | Starter deck copied by `quarto use template <repo>`. Keep it short. |
| `README.md` | User-facing docs (install, options). |
| `CLAUDE.md`, `.claude/` | Claude Code guidance and settings (`launch.json` defines the `example` preview). Local only: git-ignored, never committed. |
| `.gitignore` | Keeps rendered output (`example.html`, `example_files/`, `.quarto/`) and all Claude Code files (`CLAUDE.md`, `.claude/`) out of git. |
| `LICENSE` | MIT licence for qrough (rough.js keeps its own in `assets/LICENSE-roughjs`). |
| `images/` | README screenshot. |

## Commands

`quarto` (1.11.x) and `npm` are already installed system-wide. Use these system tools; do not download or install other software (no extra Quarto/Node versions, global npm packages, or other toolchains).

```bash
# Scaffold extension pieces (in a scratch directory, then copy what you need)
quarto create extension filter
quarto create extension revealjs-plugin

# Live-preview / render the test deck in place
quarto preview example.qmd
quarto render example.qmd

# Before a release: check the real install path in a throwaway project
# (outside this repo, e.g. the scratchpad)
quarto add /path/to/qrough --no-prompt
```

Run Quarto from this directory: started from a parent directory, the extension (and so `format: qrough-revealjs`) fails to resolve. The in-place setup reads the extension where it lives and so does not test `quarto add`, which copies only `_extensions/`. Do the throwaway-project check before publishing.

### rough.js bundle

`_extensions/qrough/assets/rough.js` is the self-contained, minified IIFE build of rough.js v4.6.6 (upstream commit `56a2762`), exposing the global `rough`, with its MIT licence in `assets/LICENSE-roughjs`. It was built from source and the source checkout has since been removed. Treat the bundle as vendored and do not edit it. To upgrade or patch it, clone https://github.com/rough-stuff/rough into a temporary directory outside this repo, then run `npm install && npm run build` there (`npm install` for rough.js's own declared devDependencies is allowed). Copy `bundled/rough.js` (and `LICENSE` if it changed) over the asset, and record the new version here.

## Architecture

The rendering work happens client-side in the browser, because rough.js needs the final laid-out size of each element. Users enable it only with `format: qrough-revealjs` (the `contributes: formats: revealjs` entry, which lists the filter and the plugin). The filter and plugin are deliberately not registered on their own at the top level of `contributes`, so there is no by-hand `filters: [qrough]` / `revealjs-plugins: [qrough]` route. The only options are `roughness` and `seed`, under a `qrough:` key, either at the top level or nested under `format: qrough-revealjs:`. Do not add more front-matter options.

The plugin lives in its own folder (`reveal/plugin.yml`) because a format's `revealjs-plugins` entry must be a path; a plugin name defined inline in `_extension.yml` does not resolve there.

1. **Lua filter** (`qrough.lua`, listed in the format's `filters`) — runs at render time, only when `quarto.doc.is_format("revealjs")`. It calls `quarto.doc.add_html_dependency{...}` to inject `rough.js`, `core.js`/`core.css` and, for each name in its `ELEMENTS` list, `elements/<name>.js`/`.css` (in that order), and passes `{ roughness, seed }` to JS as `window.QROUGH_CONFIG`.
2. **Core runtime** (`assets/core.js`) — a registry of element types (`qrough.register({ name, selector, rough, readStyle, draw })`) plus the shared machinery. It finds Quarto's slide elements by CSS selector, inserts an absolutely-positioned `<svg>` overlay per element, and draws with `rough.svg(svg)`. Reads theme colours before hiding native styles; redraws through a `ResizeObserver`. Sizes use `offsetWidth`/`offsetTop` (layout pixels), which ignore Reveal's `transform: scale`. `draw(ctx)` gets the size, the colours from `readStyle`, `ctx.opts(overrides, n)` (the element's `rough` options merged with the user's `roughness` and a fixed seed; `n` picks a distinct seed per shape), `ctx.add(node, opacity)` and `ctx.offsetWithin(el, host)`. `qrough.themeColor(...vars)` reads reveal theme variables.
   A patcher with `text: true` (inline code, emphasis, strong, strong-emphasis, strikethrough) targets inline elements, which wrap across lines and are invisible to `ResizeObserver`. They share one overlay on their nearest non-inline ancestor, which is the element that gets observed. Those blocks live in a separate `textBlocks` map, so a block can also be a regular host such as a slide title's `h2`. `draw` gets `ctx.rects`, one box per line fragment from `getClientRects()`, divided by the block's scale to undo Reveal's transform. `front: true` draws into a second overlay above the text (strikethrough). An optional `match(el)` filters a patcher's selector matches, leaving rejected elements to other patchers: `***text***` (`<strong><em>`, detected by `qrough.isBoldItalic`) is boxed by `strong-emphasis` instead of getting the bold underline and the italic ellipse. Callout titles are `<strong>`, so the strong selectors exclude `.callout-title`.
3. **Element files** (`assets/elements/<name>.js` + `.css`) — one pair per element type. The JS holds the element's fixed style (a `ROUGH` options object and any constants) and calls `qrough.register`; the CSS hides the element's native borders/backgrounds. To add an element: write both files and add its name to `ELEMENTS` in `qrough.lua`.
4. **Core CSS** (`assets/core.css`) — scoped to `html.qrough` (set by the JS) so decks without JS keep the native look; puts overlays behind content.
5. **revealjs plugin** (`reveal/qrough-reveal.js`, listed in the format's `revealjs-plugins`) — slides that are not current are not laid out (zero size), so it hooks `ready`, `slidechanged`, `resize`, overview and `pdf-ready` events and calls `qrough.attachReveal(deck)`.

Note that revealjs callout markup differs from HTML output: the header is `.callout > .callout-body > .callout-title`, and callouts cannot collapse.

Keep the output deterministic between redraws by passing a fixed `seed` option to rough.js, otherwise shapes "jitter" every time they are redrawn on resize.

## Quarto extension documentation

- Extensions overview: https://quarto.org/docs/extensions/creating.html
- Filters (`_extension.yml`, `quarto create extension filter`, `example.qmd` workflow): https://quarto.org/docs/extensions/filters.html
- Lua development: https://quarto.org/docs/extensions/lua.html
- Lua API reference (`quarto.doc.add_html_dependency`, `quarto.doc.is_format`): https://quarto.org/docs/extensions/lua-api.html#html-dependencies
- Custom formats (`contributes: formats`, `common`, `<ext>-html`/`<ext>-revealjs`): https://quarto.org/docs/extensions/formats.html
- Revealjs plugins: https://quarto.org/docs/extensions/revealjs.html
- Shortcodes: https://quarto.org/docs/extensions/shortcodes.html
- Metadata extensions: https://quarto.org/docs/extensions/metadata.html
- Distribution (`quarto add`, `_extensions/` layout, `quarto-required`): https://quarto.org/docs/extensions/distributing.html
- Callouts (the elements being restyled): https://quarto.org/docs/authoring/callouts.html
- Reveal.js format: https://quarto.org/docs/presentations/revealjs/
- Example extensions from the Quarto team: https://github.com/quarto-ext/
- rough.js API (options such as `roughness`, `fillStyle`, `hachureGap`, `seed`): https://github.com/rough-stuff/rough/wiki
