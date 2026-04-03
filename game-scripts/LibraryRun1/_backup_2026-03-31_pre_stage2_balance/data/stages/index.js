const tutorialStage = require("./tutorial");
const stage1 = require("./stage1");
const stage2 = require("./stage2");

const STAGE_DEFS = {
  [tutorialStage.stageId]: tutorialStage,
  [stage1.stageId]: stage1,
  [stage2.stageId]: stage2,
};

module.exports = { STAGE_DEFS };
