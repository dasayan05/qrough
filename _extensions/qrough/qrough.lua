--[[
qrough: inject rough.js, the qrough runtime and its element files into
revealjs output, and hand the `qrough:` options to the runtime.
qrough only supports revealjs; other formats are left untouched.
]]

-- Element types, each with `assets/elements/<name>.js` and `<name>.css`.
-- Every element is always patched.
local ELEMENTS = { "callouts", "slide-titles", "code-blocks", "tables", "inline-code", "emphasis", "strong", "strong-emphasis", "strikethrough" }

-- The only user options: `qrough: { roughness, seed }`. Everything else about
-- an element's look is fixed in its own JS file.
local OPTIONS = { "roughness", "seed" }

local function read_config(meta)
  local opts = meta["qrough"]
  local config = {}
  if type(opts) ~= "table" then
    return config
  end
  for _, key in ipairs(OPTIONS) do
    if opts[key] ~= nil then
      local n = tonumber(pandoc.utils.stringify(opts[key]))
      if n == nil then
        quarto.log.warning("qrough: `" .. key .. "` must be a number, ignoring it")
      else
        config[key] = n
      end
    end
  end
  return config
end

function Meta(meta)
  if not quarto.doc.is_format("revealjs") then
    if quarto.doc.is_format("html") then
      quarto.log.warning("qrough only supports revealjs presentations; skipping this document")
    end
    return nil
  end

  local scripts = { "assets/rough.js", "assets/core.js" }
  local stylesheets = { "assets/core.css" }
  for _, name in ipairs(ELEMENTS) do
    table.insert(scripts, "assets/elements/" .. name .. ".js")
    table.insert(stylesheets, "assets/elements/" .. name .. ".css")
  end

  quarto.doc.add_html_dependency({
    name = "qrough",
    version = "0.1.0",
    scripts = scripts,
    stylesheets = stylesheets,
    head = "<script>window.QROUGH_CONFIG = " .. quarto.json.encode(read_config(meta)) .. ";</script>",
  })

  return nil
end
