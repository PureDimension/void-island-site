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
};

function buildAssetUrl(fileName) {
  const key = fileName.replace(/\.mp3$/i, "");
  return `/api/library-run1-audio/${key}`;
}

function resolveMusicTrack(gameState) {
  if (!gameState) {
    return TRACKS.tutorial;
  }

  if (gameState.phase === "STORY") {
    if (gameState.flowIndex <= 3) {
      return TRACKS.tutorial;
    }
    return TRACKS.story;
  }

  const stageId = gameState.battle?.stageId;
  if (stageId === TUTORIAL_STAGE_ID) {
    return TRACKS.tutorial;
  }
  if (stageId === STAGE_1_ID) {
    return TRACKS.stage1;
  }
  if (stageId === STAGE_2_ID) {
    return TRACKS.stage2;
  }

  return TRACKS.story;
}

module.exports = {
  TRACKS,
  buildAssetUrl,
  resolveMusicTrack,
};
