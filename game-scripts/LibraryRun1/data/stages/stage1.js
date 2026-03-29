const { STAGE_1_ID } = require("../flow");

module.exports = {
  stageId: STAGE_1_ID,
  title: "第一关·IO区",
  objective: "击败全部敌人，包括密文",
  enemyLogicText: [
    "读取上一个主动攻击的敌方单位。",
    "该单位不存在或已失活时，本回合不攻击。",
    "否则，在己方中寻找 POWER 高于该单位且最低的一个单位。",
    "找到后，由该单位攻击前述敌方单位。",
    "找不到时，本回合不攻击。",
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
      { template: "gamma", id: "e-gamma", slot: 5, side: "enemy", name: "安全护卫γ" },
      { template: "cipher", id: "e-cipher", slot: 7, side: "enemy", name: "密文" },
    ],
  },
  initialLogText: "第一关开始。",
};
