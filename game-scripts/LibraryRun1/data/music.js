const { TUTORIAL_STAGE_ID, STAGE_1_ID, STAGE_2_ID } = require("./flow");

const TRACKS = {
  tutorial: {
    key: "tutorial",
    fileName: "tutorial.mp3",
    source: "《ever17》",
    title: "Kosmisher Wal",
    credit: "阿保剛",
  },
  story: {
    key: "story",
    fileName: "story.mp3",
    source: "《素晴日》",
    title: "Tractatus Logico-philosophicus",
    credit: "松本文紀",
  },
  stage1: {
    key: "stage1",
    fileName: "stage1.mp3",
    source: "《密室的祭品》",
    title: "Truth",
    credit: "月下江明",
  },
  stage2: {
    key: "stage2",
    fileName: "stage2.mp3",
    source: "《废墟图书馆》",
    title: "KetherBattle02",
    credit: "K1roku",
  },
  stage3StoryA: {
    key: "stage3_story_a",
    fileName: "stage3_story_a.mp3",
    source: "\u300a\u6d77\u732b\u9e23\u6ce3\u4e4b\u65f6\u300b",
    title: "ALIVE",
    credit: "V.A.",
  },
  stage3StoryB: {
    key: "stage3_story_b",
    fileName: "stage3_story_b.mp3",
    source: "\u300a\u7d20\u6674\u65e5\u300b",
    title: "\u96fb\u78c1\u6ce2\u30c8\u4e16\u754c\u306e\u95a2\u4fc2",
    credit: "\u677e\u672c\u6587\u7d00",
  },
  stage3Battle: {
    key: "stage3_battle",
    fileName: "stage3_battle.mp3",
    source: "\u300a\u6d77\u732b\u9e23\u6ce3\u4e4b\u65f6\u300b",
    title: "Victima_propiciatoria",
    credit: "V.A.",
  },
  stage3StoryC: {
    key: "stage3_story_c",
    fileName: "stage3_story_c.mp3",
    source: "\u300a\u5b64\u5c9b\u5b66\u9662\u300b",
    title: "\u51b7\u6de1\u306a\u5ba3\u544a",
    credit: "MOSAIC.WAV",
  },
  finale: {
    key: "finale",
    fileName: "finale.mp3",
    source: "\u300a\u5bc6\u5ba4\u7684\u796d\u54c1\u300b",
    title: "Embrace",
    credit: "\u6708\u4e0b\u6c5f\u660e",
  },
};

function buildAssetUrl(fileName) {
  const key = fileName.replace(/\.mp3$/i, "");
  return `/api/library-run1-audio/${key}`;
}

function resolveStoryTrack(gameState) {
  const sceneId = gameState.story?.sceneId || "";
  const pageIndex = Number(gameState.story?.index || 0);
  const page = gameState.story?.pages?.[pageIndex];
  const musicTrack = page?.musicTrack;

  if (musicTrack) {
    if (musicTrack === "tutorial") {
      return TRACKS.tutorial;
    }
    if (musicTrack === "story") {
      return TRACKS.story;
    }
    if (musicTrack === "stage1") {
      return TRACKS.stage1;
    }
    if (musicTrack === "stage2") {
      return TRACKS.stage2;
    }
    if (musicTrack === "stage3_story_a") {
      return TRACKS.stage3StoryA;
    }
    if (musicTrack === "stage3_story_b") {
      return TRACKS.stage3StoryB;
    }
    if (musicTrack === "stage3_story_c") {
      return TRACKS.stage3StoryC;
    }
    if (musicTrack === "finale") {
      return TRACKS.finale;
    }
  }

  if (sceneId.startsWith("final")) {
    return TRACKS.finale;
  }

  return TRACKS.story;
}

function resolveBattleTrack(stageId) {
  if (stageId === TUTORIAL_STAGE_ID) {
    return TRACKS.tutorial;
  }
  if (stageId === STAGE_1_ID) {
    return TRACKS.stage1;
  }
  if (stageId === STAGE_2_ID) {
    return TRACKS.stage2;
  }
  if (stageId === "stage3-core") {
    return TRACKS.stage3Battle;
  }

  return TRACKS.story;
}

function resolveMusicTrack(gameState) {
  if (!gameState) {
    return TRACKS.tutorial;
  }

  if (gameState.phase === "MODE_SELECT") {
    return TRACKS.tutorial;
  }

  if (gameState.phase === "STORY") {
    return resolveStoryTrack(gameState);
  }

  return resolveBattleTrack(gameState.battle?.stageId);
}

module.exports = {
  TRACKS,
  buildAssetUrl,
  resolveMusicTrack,
};
