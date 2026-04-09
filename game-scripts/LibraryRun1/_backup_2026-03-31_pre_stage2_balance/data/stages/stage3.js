const { STAGE_3_ID } = require("../flow");

function page(speaker, text, options = {}) {
  return {
    speaker,
    text,
    tone: options.tone || "normal",
  };
}

function stage3EnemyLogicText(state) {
  const runtime = state?.battle?.stageRuntime || {};
  const lines = [
    "根据当前回合数 TURN 模 5 的结果，取[元素之书，力量之书，灵魂之书，时空之书，炼金术士卡特]对应的单位，对影子发动攻击。",
    "【正逆位结界】：POWER 为 1-4 时视为【正位】；不可被摧毁；攻击时不发动战斗，而是先发动【正位】效果，再触发【真伪逆转】。",
    "POWER 为 6-9 时视为【逆位】；不可被摧毁；攻击时正常发动战斗，并按能力文本触发【逆位】效果，战后再触发【真伪逆转】。",
    "POWER 为 0 或 5 时视为【平衡】；攻击前摧毁该单位。",
    "【真伪逆转】：使自身 POWER 变为 10 - 原本 POWER。",
  ];

  if (runtime.stage3CooperationEnabled) {
    lines.push("【协同攻击-<上一个单位>】：仅敌方五个主单位持有；自己攻击且非【平衡】状态时，若上一个单位与自身正逆相反，则攻击后对同一目标追加一次攻击；该追加攻击也可继续连锁。");
  }

  if (runtime.stage3ForceFirstFailedCoop) {
    lines.push("【TURN10】：每回合首个失败的协同攻击改为成功触发。");
  }

  return lines;
}

function rememberBaseDescription(unit) {
  unit.runtimeState = unit.runtimeState || {};
  if (!unit.runtimeState.stage3BaseDescription) {
    unit.runtimeState.stage3BaseDescription = unit.description;
  }
}

function refreshStage3Descriptions(runtime, state) {
  const battle = state?.battle;
  if (!battle) {
    return;
  }

  const coopEnabled = !!battle.stageRuntime?.stage3CooperationEnabled;
  const turn10Enabled = !!battle.stageRuntime?.stage3ForceFirstFailedCoop;

  [...battle.playerUnits, ...battle.enemyUnits].forEach((unit) => {
    rememberBaseDescription(unit);
    const parts = [unit.runtimeState.stage3BaseDescription].filter(Boolean);

    if (coopEnabled && unit.side === "enemy" && unit.runtimeState?.stage3CoopPartnerId) {
      const partner = runtime.findUnit(battle, unit.runtimeState.stage3CoopPartnerId);
      if (partner) {
        parts.push(`●【协同攻击-${partner.name}】：自己攻击且非【平衡】状态时，若 ${partner.name} 与自身正逆相反，则在战后追加一次同目标攻击。`);
      }
    }

    if (turn10Enabled && unit.runtimeState?.stage3CoopPartnerId) {
      parts.push("●【TURN10】：本回合首个失败的协同攻击改为成功。");
    }

    runtime.updateUnitPresentation(unit, { description: parts.join("") });
  });
}

function assignStage3Cooperation(runtime, state) {
  const battle = state?.battle;
  if (!battle) {
    return;
  }

  const order = [
    "s3-book-element",
    "s3-book-strength",
    "s3-book-soul",
    "s3-book-space",
    "s3-alchemist-carter",
  ];

  order.forEach((unitId, index) => {
    const unit = runtime.findUnit(battle, unitId);
    if (!unit) {
      return;
    }
    const previous = runtime.findUnit(battle, order[(index - 1 + order.length) % order.length]);
    unit.runtimeState = unit.runtimeState || {};
    unit.runtimeState.stage3CoopPartnerId = previous?.id || null;
  });
}

function summonPlayer(runtime, state, template, id, slot) {
  return runtime.summonUnit(state, { template, id, slot, side: "player" });
}

function summonEnemy(runtime, state, template, id, slot) {
  return runtime.summonUnit(state, { template, id, slot, side: "enemy" });
}

function applyStage3Turn1(runtime, state) {
  runtime.setEnemyLogicText(state, stage3EnemyLogicText(state));
  summonPlayer(runtime, state, "s3-memory-impurity", "s3-memory-impurity-1", 4);
  refreshStage3Descriptions(runtime, state);
}

function applyStage3Turn2(runtime, state) {
  summonEnemy(runtime, state, "s3-book-strength", "s3-book-strength", 3);
  summonPlayer(runtime, state, "s3-memory-impurity", "s3-memory-impurity-2", 6);
  refreshStage3Descriptions(runtime, state);
}

function applyStage3Turn3(runtime, state) {
  summonEnemy(runtime, state, "s3-book-soul", "s3-book-soul", 5);
  summonPlayer(runtime, state, "s3-memory-matrix", "s3-memory-matrix-1", 8);
  refreshStage3Descriptions(runtime, state);
}

function applyStage3Turn4(runtime, state) {
  summonEnemy(runtime, state, "s3-book-space", "s3-book-space", 7);
  summonPlayer(runtime, state, "s3-memory-matrix", "s3-memory-matrix-2", 10);
  refreshStage3Descriptions(runtime, state);
}

function applyStage3Turn5(runtime, state) {
  const battle = state.battle;
  [...battle.playerUnits, ...battle.enemyUnits]
    .filter((unit) => !unit.alive)
    .filter((unit) => unit.abilityCode === "s3-memory-impurity" || unit.abilityCode === "s3-memory-matrix")
    .forEach((unit) => runtime.removeUnitFromBattle(state, unit));
  summonPlayer(runtime, state, "s3-memory-raw", "s3-memory-raw", 12);
  const carter = runtime.findUnit(battle, "s3-alchemist-carter");
  if (carter?.alive) {
    carter.basePower = (carter.basePower ?? carter.power ?? 0) + 1;
    carter.power += 1;
    runtime.addLog(state, "hook", `${carter.name} 在【TURN5】开始时 POWER 永久 +1。`, {
      unitId: carter.id,
    });
  }

  battle.stageRuntime.stage3CooperationEnabled = true;
  runtime.stage3InvertUnit(state, runtime.findUnit(battle, "s3-book-element"));
  runtime.stage3InvertUnit(state, runtime.findUnit(battle, "s3-book-soul"));
  assignStage3Cooperation(runtime, state);
  runtime.setEnemyLogicText(state, stage3EnemyLogicText(state));
  refreshStage3Descriptions(runtime, state);
}

function applyStage3Turn10(runtime, state) {
  state.battle.stageRuntime.stage3ForceFirstFailedCoop = true;
  runtime.setEnemyLogicText(state, stage3EnemyLogicText(state));
  refreshStage3Descriptions(runtime, state);
}

function onStage3TurnStart(runtime, state) {
  const battle = state?.battle;
  const carter = runtime.findUnit(battle, "s3-alchemist-carter");
  if (!carter) {
    return;
  }

  if (!carter.alive) {
    carter.alive = true;
    carter.destroyedAtTurn = null;
    carter.buffs = Object.fromEntries(Object.keys(carter.buffs || {}).map((key) => [key, 0]));
    carter.combat.lastBattleUnitId = null;
    runtime.updateUnitPresentation(carter);
    runtime.addLog(state, "hook", `${carter.name} 在己方回合开始时恢复行动。`, {
      unitId: carter.id,
    });
  }

  if (carter.power === 10) {
    return;
  }

  battle.enemyUnits
    .filter((unit) => unit.id !== carter.id && !unit.alive)
    .forEach((unit) => {
      runtime.reviveUnit(state, unit, "stage3-carter-eternity", carter, "enemy");
    });

  refreshStage3Descriptions(runtime, state);
}

module.exports = {
  stageId: STAGE_3_ID,
  title: "第三关·六书回廊",
  objective: "穿过回廊，击破六书系统。",
  enemyLogicText: stage3EnemyLogicText({ battle: { stageRuntime: {} } }),
  enemyAi: "stage3-turn-books",
  runtimeState: {
    stage3CooperationEnabled: false,
    stage3ForceFirstFailedCoop: false,
    stage3ForcedEnemyTargetTurn: null,
    stage3ForcedEnemyTargetId: null,
    stage3SignalBoostTurn: null,
    stage3BuffNullifyTurn: null,
    stage3BuffNullifySide: null,
  },
  lineup: {
    playerUnits: [
      {
        template: "robot",
        templateByMode: {
          story: "robot-stage3-story",
          challenge: "robot",
        },
        id: "p-robot",
        slot: 2,
        side: "player",
      },
    ],
    enemyUnits: [
      { template: "s3-book-element", id: "s3-book-element", slot: 1, side: "enemy" },
      { template: "s3-alchemist-carter", id: "s3-alchemist-carter", slot: 9, side: "enemy" },
    ],
  },
  initialLogText: "第三关开始。核心区的墙体崩塌，四面墙化作四本书，为这出舞台剧拉开帷幕。",
  onTurnStart: onStage3TurnStart,
  battleEvents: [
    {
      key: "stage3-turn1-opening",
      trigger: "turn-start",
      turn: 1,
      apply: applyStage3Turn1,
      pages: [
        page("【炼金术士卡特】", "时空域有一个古老的传说..."),
        page("【炼金术士卡特】", "不同的世界由不同的法则支配，而在众多法则中，时空域建立于这四个法则之上。"),
        page("【炼金术士卡特】", "构成世间基本粒子的【元素之书】啊，请解析万物的根源，为伟大之术铺路。"),
        page("【旁白】", "第一本书从左侧墙的中央带着无数的粒子模型飞了进来，所及之物全部降解为了冰冷的微粒，悬浮在它的周围。"),
        page("【萤草】", "听好了，卡特的书灵活多变，最重要的是它的【正逆位结界】，这个结界赋予了他们全部的能力，并保护他们不被摧毁。"),
        page("【萤草】", "POWER值1-4的书处于【正位】，会发绿光。此时敌方单位不会发动攻击，而是直接释放正位能力，通常而言威胁比较低。"),
        page("【萤草】", "POWER值6-9的书处于【逆位】，会发红光。此时敌方单位既会发动攻击，又会释放逆位能力，必须要保护好【影子】。"),
        page("【萤草】", "卡特的书攻击结束都会发动【真伪逆转】，即令自身的POWER变为10-原本POWER。"),
        page("【萤草】", "你曾经窥探过世界真相，你的记忆就是对付他们最好的武器。"),
        page("【影子】", "我的记忆吗... 这些残缺的记忆片段虽然不完整，但足以让我看清他们的弱点。"),
        page("【影子】", "那么就用这个来对付【元素之书】吧。"),
      ],
    },
    {
      key: "stage3-turn2-opening",
      trigger: "turn-start",
      turn: 2,
      apply: applyStage3Turn2,
      pages: [
        page("【炼金术士卡特】", "描绘世间万物交流法则的【力量之书】啊，请重塑世界的动力，赐予我无上的力量。"),
        page("【萤草】", "唔，以防你忘记我决定再说一遍，卡特的书攻击结束都会发动【真伪逆转】，这些可以在敌方行动栏看到。"),
        page("【萤草】", "不要太想着破坏这些书页。看到【炼金术士卡特】的能力了吗？他会在每回合开始复活所有书页的。"),
        page("【萤草】", "但是破坏书页却可以让对应的书页本轮无法攻击，阻碍对方一轮行动。"),
        page("【萤草】", "被正位或逆位的书页不会被战斗摧毁，却可以因为POWER越界干扰了正逆位判定而被摧毁。如果POWER落在0或5上，称为【平衡】，此时也可以被摧毁，而且一旦轮到他攻击，攻击之前会立刻自毁，浪费敌人一轮攻击机会。"),
        page("【系统】", "右侧的墙轰然倒塌，无数数据流涌入进来，一瞬间将小半个房间压成废墟。而在浮尘和废墟之上，【力量之书】凝结成了实体飘了进来。"),
        page("【萤草】", "小心，【力量之书】来了，你还能应付吧？"),
        page("【影子】", "没问题，虽然还有点晕，姑且还能应付。就用新的记忆碎片来对付【力量之书】吧。"),
      ],
    },
    {
      key: "stage3-turn3-opening",
      trigger: "turn-start",
      turn: 3,
      apply: applyStage3Turn3,
      pages: [
        page("【炼金术士卡特】", "刻画时空域生灵的【灵魂之书】啊，请感受他们的爱恨情仇，为这可怜的故事降下恩惠。"),
        page("【系统】", "不知不觉间，后面的墙开始失去了实体，凝结成无数条游动的光纹，像无数个浮游生物跳动着、成长、进食、汇聚成更大的生物。最后，他们凝固在此处，构成了【灵魂之书】的封面。"),
        page("【影子】", "（眼前的景象不禁幻视成了那些海豚们，令影子险些跌倒）"),
        page("【萤草】", "小心，这本比前面的那两本书都要危险。【力量之书】只是简单的一次性攻击，【元素之书】处理得当甚至能提高己方能力。但是这本会附加上永久性的【认知干扰】，让受影响的单位被永久削弱。"),
        page("【影子】", "听上去又是相当对我不利的情况...不过经历了刚刚那种事情，我已经冷静下来了。更稳定的记忆碎片也开始成形，就用这个净化它吧。"),
      ],
    },
    {
      key: "stage3-turn4-opening",
      trigger: "turn-start",
      turn: 4,
      apply: applyStage3Turn4,
      pages: [
        page("【炼金术士卡特】", "为交界图书馆埋下根基的【时空之书】啊，请洞悉世间真理，排除一切错误！"),
        page("【系统】", "这次是对面的墙体吗？不，这次连带着头顶和脚下的墙体，一起碎裂崩塌了。影子发现自身一下子置身在了一片宇宙背景中，四周是盘旋着的四本书，眼前是炼金术士卡特紧闭着双眼，指挥着书的运动。"),
        page("【萤草】", "嘛，这本书更是要小心，一旦感染上【时空闭环】，不仅会影响持有BUFF者一方的所有单位，而且随时可能导致玩家落败。"),
        page("【系统】", "由于有着可能导致玩家落败的广域能力，双方玩家持有的本BUFF情况都将同步显示在背景数字上。"),
        page("【萤草】", "但愿你还能撑住，我还在尝试解析这个大块头的弱点，再撑一会儿吧。"),
        page("【影子】", "也多亏了这份舞台，我突然想起来了很多事情，关于我存在的意义和我的旅途。没问题的。"),
      ],
    },
    {
      key: "stage3-turn5-shift",
      trigger: "turn-start",
      turn: 5,
      apply: applyStage3Turn5,
      pages: [
        page("【影子】", "凝视着这片由宇宙基质创造的战斗场地，所有过往的回忆终于撕开了外壳。新的碎片一口气涌了出来，但是还需要稍稍整理一下。"),
        page("【炼金术士卡特】", "我承认至今为止你的表现都很不错。可是，你和你那可笑的记忆碎片，又该如何抗衡真正的力量呢？", {
          tone: "red",
        }),
        page("【系统】", "【炼金术士卡特】发动了全员强化，自身POWER永久+1，使【元素之书】【灵魂之书】【真伪逆转】，敌方所有单位获得【协同攻击-<上一个/左侧单位>】，敌方所有单位能力描述已更新。", {
          tone: "red",
        }),
        page("【萤草】", "竟然是很罕见的高速连击...请务必要小心，"),
      ],
    },
    {
      key: "stage3-turn10-shift",
      trigger: "turn-start",
      turn: 10,
      apply: applyStage3Turn10,
      pages: [
        page("【系统】", "【TURN10】回廊开始强制修正协同链。每回合首个失败的协同攻击将改为成功。", {
          tone: "red",
        }),
      ],
    },
  ],
};
