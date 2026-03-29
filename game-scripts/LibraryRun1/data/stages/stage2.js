const { STAGE_2_ID } = require("../flow");

module.exports = {
  stageId: STAGE_2_ID,
  title: "第二关·隔离区",
  objective: "清除隔离区守备并继续下潜",
  enemyLogicText: [
    "游戏开局时：影子获得【标记】。",
    "以下三个单位将会按照如下次序轮流攻击，一回合一次：巨噬细胞-指挥 → 调度B细胞-网关 → 杀手T细胞-协议 → 巨噬细胞-指挥。",
    "如未在电脑方单位中找到当前轮到的攻击单位，或该单位无合法攻击目标，则跳过该单位的攻击机会，继续寻找下一个单位。",
    "三者都无法行动时，本回合不攻击，下回合轮值后移一位。",
    "【标记】BUFF全场至多同时存在一个，其他单位获得【标记】时原来的单位失去【标记】。",
  ],
  enemyAi: "stage2-rotation-defense",
  runtimeState: {
    rotationIndex: 0,
  },
  lineup: {
    playerUnits: [
      { template: "robot", id: "p-robot", slot: 2, side: "player", buffs: { mark: 1 } },
      { template: "lantern", id: "p-lantern", slot: 4, side: "player" },
      { template: "rattlesnake", id: "p-rattlesnake", slot: 6, side: "player" },
      { template: "phage", id: "p-phage", slot: 8, side: "player" },
      { template: "fever-module", id: "p-fever-module", slot: 10, side: "player" },
      { template: "puzzle", id: "p-puzzle", slot: 12, side: "player" },
    ],
    enemyUnits: [
      { template: "macrophage-command", id: "s2-macrophage", slot: 1, side: "enemy" },
      {
        template: "gateway-b-cell",
        id: "s2-gateway",
        slot: 3,
        side: "enemy",
        description: "◆：若本单位被选为攻击者，则令己方中 POWER 最高且没有任何 BUFF 的一个单位获得【抗体】。攻击目标为没有【标记】【抗体】且 POWER 最高的一个其他单位。仅当本单位作为攻击者时，才不直接战斗，而是令己方所有存活的“巡检单核体”“清理溶酶虫”依次攻击目标；若本单位作为被攻击者，则按自身 POWER 正常参与战斗。▼：行动结束后，复活己方所有已阵亡的“巡检单核体”“清理溶酶虫”“补体屏障”。",
      },
      { template: "killer-t-protocol", id: "s2-killer", slot: 5, side: "enemy" },
      { template: "patrol-monocyte", id: "s2-monocyte", slot: 7, side: "enemy" },
      { template: "cleaner-lysosome", id: "s2-lysosome", slot: 9, side: "enemy" },
      { template: "complement-barrier", id: "s2-complement", slot: 11, side: "enemy" },
    ],
  },
  initialLogText: "第二关开始。萤草正在旁路中协助分析敌方动作。",
};
