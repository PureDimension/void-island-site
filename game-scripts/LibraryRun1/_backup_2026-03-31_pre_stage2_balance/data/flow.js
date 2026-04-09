const TUTORIAL_STAGE_ID = "stage0-hive";
const STAGE_1_ID = "stage1-io";
const STAGE_2_ID = "stage2-quarantine";
const STAGE_3_ID = "stage3-core";
const FINAL_SCENE_ID = "final-story";

const FLOW = [
  { type: "story", sceneId: "tutorial-pre" },
  { type: "battle", stageId: TUTORIAL_STAGE_ID },
  { type: "story", sceneId: "tutorial-post" },
  { type: "story", sceneId: "tutorial-post-unlock", requiresMode: "story" },
  { type: "story", sceneId: "stage1-pre" },
  { type: "battle", stageId: STAGE_1_ID },
  { type: "story", sceneId: "stage2-pre" },
  { type: "battle", stageId: STAGE_2_ID },
  { type: "story", sceneId: "stage3-pre" },
  { type: "battle", stageId: STAGE_3_ID },
  { type: "story", sceneId: FINAL_SCENE_ID },
];

const FLOW_JUMP_TARGETS = {
  disabled: null,
  stage1Story: 4,
  stage1Battle: 5,
  stage2Story: 6,
  stage2Battle: 7,
  stage3Story: 8,
  stage3Battle: 9,
  finalStory: 10,
};

module.exports = {
  FLOW,
  TUTORIAL_STAGE_ID,
  STAGE_1_ID,
  STAGE_2_ID,
  STAGE_3_ID,
  FINAL_SCENE_ID,
  FLOW_JUMP_TARGETS,
};
