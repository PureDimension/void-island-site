const TUTORIAL_STAGE_ID = "stage0-hive";
const STAGE_1_ID = "stage1-io";
const STAGE_2_ID = "stage2-quarantine";

const FLOW = [
  { type: "story", sceneId: "tutorial-pre" },
  { type: "battle", stageId: TUTORIAL_STAGE_ID },
  { type: "story", sceneId: "tutorial-post" },
  { type: "story", sceneId: "stage1-pre" },
  { type: "battle", stageId: STAGE_1_ID },
  { type: "story", sceneId: "stage2-pre" },
  { type: "battle", stageId: STAGE_2_ID },
];

module.exports = {
  FLOW,
  TUTORIAL_STAGE_ID,
  STAGE_1_ID,
  STAGE_2_ID,
};
