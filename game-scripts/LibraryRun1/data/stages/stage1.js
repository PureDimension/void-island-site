const { STAGE_1_ID } = require("../flow");

const stage1 = {
  stageId: STAGE_1_ID,
  title: "第一关·IO 区",
  objective: "击败所有敌人（包括密文）",
  enemyLogicText: [
    "如果 上一个主动攻击的玩家方单位存活：",
    "  如果 电脑方单位中存在 POWER 高于它且最低的一个单位：",
    "    该单位 对 玩家方单位 发动攻击"
  ],
  enemyAi: "stage1-passive-defense",
  lineup: {
    playerUnits: [
      { template: "robot", id: "p-robot", slot: 2, side: "player" },
      { template: "battle-module", id: "p-battle-module", slot: 4, side: "player" },
      { template: "emp-module", id: "p-emp-module", slot: 6, side: "player" },
      { template: "growth-module", id: "p-growth-module", slot: 8, side: "player" },
      { template: "disguise-module", id: "p-disguise-module", slot: 10, side: "player" },
    ],
    enemyUnits: [
      { template: "alpha", id: "e-alpha", slot: 1, side: "enemy", name: "安全护卫α" },
      { template: "beta", id: "e-beta", slot: 3, side: "enemy", name: "安全护卫β" },
      { template: "gamma", id: "e-gamma", slot: 5, side: "enemy", name: "【纸鸢】" },
      { template: "cipher", id: "e-cipher", slot: 7, side: "enemy", name: "密文" },
    ],
  },
  initialLogText: "第一关开始。",
};

module.exports = stage1;
