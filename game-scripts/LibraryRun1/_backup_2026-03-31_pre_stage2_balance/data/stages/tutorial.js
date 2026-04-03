const { TUTORIAL_STAGE_ID } = require("../flow");

const tutorialStage = {
  stageId: TUTORIAL_STAGE_ID,
  title: "教程关 蜂巢外围",
  objective: "清除全部工蜂并学会基础操作",
  enemyLogicText: [
    "如果 相对于玩家最右侧的电脑方单位 存在：",
    "  如果 相对于玩家最右侧的玩家方单位 存在：",
    "    前者 对 后者 发动一次攻击",
  ],
  enemyAi: "tutorial-max-slot",
  lineup: {
    playerUnits: [
      { template: "robot", id: "p-robot", slot: 1, side: "player" },
      { template: "waterbell", id: "p-waterbell", slot: 2, side: "player" },
    ],
    enemyUnits: [
      { template: "signal-bee", id: "t-signal-1", slot: 1, side: "enemy", name: "信号工蜂1号" },
      { template: "signal-bee", id: "t-signal-2", slot: 2, side: "enemy", name: "信号工蜂2号" },
      { template: "monitor-bee", id: "t-monitor", slot: 3, side: "enemy", name: "监控工蜂" },
    ],
  },
  initialLogText: "教程关开始。",
};

module.exports = tutorialStage;
