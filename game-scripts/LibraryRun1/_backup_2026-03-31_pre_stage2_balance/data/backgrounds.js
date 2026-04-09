const STORY_BACKGROUND_PRESETS = {
  default: {
    key: "default",
    rootClassName: "",
    layers: [],
  },
  memory: {
    key: "memory",
    rootClassName: "story-bg-memory",
    layers: [
      { className: "story-backdrop story-backdrop-memory-base" },
      { className: "story-backdrop story-backdrop-memory-glow" },
      { className: "story-backdrop story-backdrop-memory-vignette" },
    ],
  },
  bloodflash: {
    key: "bloodflash",
    rootClassName: "story-bg-bloodflash",
    layers: [
      { className: "story-backdrop story-backdrop-blood-dark" },
      { className: "story-backdrop story-backdrop-blood-mid" },
      { className: "story-backdrop story-backdrop-blood-bright" },
    ],
  },
  infinity: {
    key: "infinity",
    rootClassName: "story-bg-infinity",
    layers: [
      { className: "story-backdrop story-backdrop-infinity-base" },
      { className: "story-backdrop story-backdrop-infinity-waves-a" },
      { className: "story-backdrop story-backdrop-infinity-waves-b" },
      { className: "story-backdrop story-backdrop-infinity-sigil" },
    ],
  },
};

function normalizeBackgroundInput(input) {
  if (!input) {
    return { key: "default" };
  }
  if (typeof input === "string") {
    return { key: input };
  }
  if (typeof input === "object") {
    return {
      key: input.key || "default",
      ...input,
    };
  }
  return { key: "default" };
}

function getStoryBackground(input) {
  const normalized = normalizeBackgroundInput(input);
  const preset = STORY_BACKGROUND_PRESETS[normalized.key] || STORY_BACKGROUND_PRESETS.default;

  return {
    key: preset.key,
    rootClassName: preset.rootClassName,
    layers: preset.layers || [],
  };
}

module.exports = {
  STORY_BACKGROUND_PRESETS,
  getStoryBackground,
};
