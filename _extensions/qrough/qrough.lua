--[[
qrough: inject rough.js and the qrough runtime into
revealjs output, and hand the `qrough:` metadata to the runtime.
qrough only supports revealjs; other formats are left untouched.
]]

-- YAML key -> rough.js option name. Values are coerced to numbers.
local NUMERIC_OPTIONS = {
  ["roughness"] = "roughness",
  ["bowing"] = "bowing",
  ["stroke-width"] = "strokeWidth",
  ["fill-weight"] = "fillWeight",
  ["hachure-gap"] = "hachureGap",
  ["hachure-angle"] = "hachureAngle",
  ["seed"] = "seed",
}

-- YAML key -> runtime option name. Values are kept as strings.
local STRING_OPTIONS = {
  ["fill-style"] = "fillStyle",
}

-- Patchers that can be switched on/off individually (all on by default).
local PATCHERS = { "callouts" }

local function to_boolean(value, default)
  if value == nil then
    return default
  end
  if type(value) == "boolean" then
    return value
  end
  local s = pandoc.utils.stringify(value):lower()
  if s == "false" or s == "no" or s == "off" or s == "0" then
    return false
  end
  return true
end

local function read_config(meta)
  local opts = meta["qrough"]
  local config = { rough = {}, patchers = {} }
  if opts == nil or type(opts) == "boolean" then
    for _, name in ipairs(PATCHERS) do
      config.patchers[name] = true
    end
    return config
  end

  for key, name in pairs(NUMERIC_OPTIONS) do
    if opts[key] ~= nil then
      local n = tonumber(pandoc.utils.stringify(opts[key]))
      if n == nil then
        quarto.log.warning("qrough: `" .. key .. "` must be a number, ignoring it")
      else
        config.rough[name] = n
      end
    end
  end
  for key, name in pairs(STRING_OPTIONS) do
    if opts[key] ~= nil then
      config[name] = pandoc.utils.stringify(opts[key])
    end
  end
  for _, name in ipairs(PATCHERS) do
    config.patchers[name] = to_boolean(opts[name], true)
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

  local config = read_config(meta)

  quarto.doc.add_html_dependency({
    name = "qrough",
    version = "0.1.0",
    scripts = { "assets/rough.js", "assets/qrough.js" },
    stylesheets = { "assets/qrough.css" },
    head = "<script>window.QROUGH_CONFIG = " .. quarto.json.encode(config) .. ";</script>",
  })

  return nil
end
