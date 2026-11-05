# qrough

A Quarto extension that gives **revealjs presentations** an Excalidraw-style,
hand-drawn look. It adds no new markup: Quarto's own slide elements are redrawn
in the browser with [rough.js](https://roughjs.com).

![A qrough slide: a hatched title band, a sketched note callout and warning callout, and inline text that is underlined, circled, boxed, highlighted and struck through](images/screenshot.png)

qrough only supports revealjs. Other formats are left untouched, and HTML
documents get a render warning.

Version 0.1 patches **callouts** (all types, `default`/`simple`/`minimal`
appearances, nested, and callouts inside columns and fragments) and
**slide titles** (a full-width hand-drawn band behind each `##` title, in
the theme's accent colour). It also marks up inline text: `inline code` gets a
light hand-drawn highlight, *italic* text is circled, **bold** text is underlined,
***bold italic*** text is boxed,
and ~~strikethrough~~ gets a rough line across it, all following the text when
it wraps onto several lines.

## Install

```bash
quarto add dasayan05/qrough
```

Or start a new deck from the bundled template:

```bash
quarto use template dasayan05/qrough
```

### Font

qrough does not set or ship any font. For the full Excalidraw look, install
[Excalifont](https://plus.excalidraw.com/excalifont) on your system and set it
with Quarto's own `mainfont` option in your deck's front matter:

```yaml
format:
  qrough-revealjs:
    mainfont: Excalifont
```

`mainfont` only names the font; it does not embed it in the rendered deck.
The font has to be installed on the computer that *views* the deck, not just
the one that renders it. That is fine when you present from your own laptop,
but anyone else who opens the HTML (a shared link, a published deck, a
colleague's machine) without Excalifont installed sees the browser's default
font instead, usually a serif such as Times. The rough.js drawings still
appear; only the lettering changes.

To give a fallback, list several fonts. The browser uses the first one it
has:

```yaml
format:
  qrough-revealjs:
    mainfont: "Excalifont, 'Comic Sans MS', cursive"
```

To make the font travel with the deck, serve it as a web font instead: put
the font file next to your deck and load it with an `@font-face` rule in a
custom CSS file (`css: fonts.css`). Check the font's licence before you
publish its file.

## Use

```yaml
format: qrough-revealjs
```

`qrough-revealjs` is regular `revealjs` with the qrough filter and plugin
switched on, so every revealjs option still works under it:

```yaml
format:
  qrough-revealjs:
    slide-number: true
    qrough:
      roughness: 1.5
```

Under the hood the format runs a filter that injects the assets and your
options, and a plugin that redraws slides as Reveal shows them, as well as in
overview and `?print-pdf` mode.

## Options

Every supported element is restyled; the look of each one is fixed by qrough.
Only two options can be set, under `qrough:`, either nested in the format (as
above) or at the top level of the document:

```yaml
qrough:
  roughness: 1.2       # how sketchy the lines are (default 1, 0 = straight)
  seed: 42             # base seed; fixed so shapes do not jitter on redraw
```

Colours come from the active reveal theme. Without JavaScript the deck falls
back to Quarto's normal styling.

## Development

`example.qmd` is the test deck. It picks up the extension from the
neighbouring `_extensions/` folder, so you can edit and preview in place:

```bash
quarto preview example.qmd
```

## Credits

- rough.js © Preet Shihn, MIT licence (`assets/LICENSE-roughjs`).
