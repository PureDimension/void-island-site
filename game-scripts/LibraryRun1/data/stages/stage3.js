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
    "根据当前回合数 TURN 模 5 的结果，取[元素之书，力量之书，灵魂之书，时空之书，炼金术士卡特]对应的单位，对玩家方最右侧发动过攻击的单位发动攻击。",
    "【正逆位结界】：POWER 为 0-4 时视为【正位】；攻击时发动【正位】效果，之后【真伪逆转】。",
    "POWER 为 5-9 时视为【逆位】；攻击时发动【逆位】效果，之后【真伪逆转】。",
    "【真伪逆转】：使自身 POWER 变为 9 - 原本 POWER。",
  ];

  if (runtime.stage3CooperationEnabled) {
    lines.push("【协同攻击-<上一个单位>】：仅敌方五个主单位持有；自己攻击时，若上一个单位与自身正逆相反，则攻击后对同一目标追加一次攻击；该追加攻击也可继续连锁。");
  }

  if (runtime.stage3ForceFirstFailedCoop) {
    lines.push("【TURN10】：每回合首个失败的协同攻击改为成功触发。");
    lines.push("【TURN10】：【永恒】增强为敌方单位死亡时立刻复活，且复活回合可以攻击与协同攻击。");
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
        parts.push(`●【协同攻击-${partner.name}】：自己攻击时，若 ${partner.name} 与自身正逆相反，则在战后追加一次同目标攻击。`);
      }
    }

    if (turn10Enabled && unit.runtimeState?.stage3CoopPartnerId) {
      parts.push("●【TURN10】：本回合首个失败的协同攻击改为成功。");
    }

    if (turn10Enabled && unit.id === "s3-alchemist-carter") {
      parts.push("●【TURN10】：【永恒】增强为敌方单位死亡时立刻复活，且复活回合可以攻击与协同攻击。");
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
  const raw = summonPlayer(runtime, state, "s3-memory-raw", "s3-memory-raw", 12);
  if (raw) {
    raw.power = 1;
    raw.basePower = 1;
    runtime.updateUnitPresentation(raw);
  }
  const carter = runtime.findUnit(battle, "s3-alchemist-carter");
  battle.enemyUnits
    .filter((unit) => unit.id !== carter?.id && !unit.alive)
    .forEach((unit) => {
      if (runtime.reviveUnit(state, unit, "stage3-turn5-full-revive", carter || null, "enemy")) {
        unit.runtimeState = unit.runtimeState || {};
        delete unit.runtimeState.stage3NoAttackTurn;
      }
    });

  battle.stageRuntime.stage3CooperationEnabled = true;
  runtime.stage3InvertUnit(state, runtime.findUnit(battle, "s3-book-element"));
  runtime.stage3InvertUnit(state, runtime.findUnit(battle, "s3-book-soul"));
  assignStage3Cooperation(runtime, state);
  runtime.setEnemyLogicText(state, stage3EnemyLogicText(state));
  refreshStage3Descriptions(runtime, state);
}

function applyStage3Turn10(runtime, state) {
  state.battle.stageRuntime.stage3ForceFirstFailedCoop = true;
  state.battle.stageRuntime.stage3InstantReviveEnabled = true;
  runtime.setEnemyLogicText(state, stage3EnemyLogicText(state));
  refreshStage3Descriptions(runtime, state);
}

function onStage3TurnStart(runtime, state) {
  const battle = state?.battle;
  const carter = runtime.findUnit(battle, "s3-alchemist-carter");
  if (!battle) {
    return;
  }

  battle.enemyUnits.forEach((unit) => {
    if (unit?.runtimeState?.stage3NoAttackTurn === battle.turn) {
      delete unit.runtimeState.stage3NoAttackTurn;
    }
  });

  if (!carter) {
    return;
  }

  if (!carter.alive) {
    carter.alive = true;
    carter.destroyedAtTurn = null;
    carter.buffs = Object.fromEntries(Object.keys(carter.buffs || {}).map((key) => [key, 0]));
    carter.combat.lastBattleUnitId = null;
    carter.runtimeState = carter.runtimeState || {};
    delete carter.runtimeState.stage3NoAttackTurn;
    runtime.updateUnitPresentation(carter);
    runtime.addLog(state, "hook", `${carter.name} 在己方回合开始时恢复行动。`, {
      unitId: carter.id,
    });
  }

  refreshStage3Descriptions(runtime, state);
}

function onStage3EnemyTurnStart(runtime, state) {
  const battle = state?.battle;
  const carter = runtime.findUnit(battle, "s3-alchemist-carter");
  if (!(battle && carter && carter.alive) || carter.power === 10) {
    return;
  }

  battle.enemyUnits
    .filter((unit) => unit.id !== carter.id && !unit.alive)
    .forEach((unit) => {
      if (runtime.reviveUnit(state, unit, "stage3-carter-eternity", carter, "enemy")) {
        if (!battle.stageRuntime?.stage3InstantReviveEnabled) {
          unit.runtimeState = unit.runtimeState || {};
          unit.runtimeState.stage3NoAttackTurn = battle.turn;
        }
      }
    });

  refreshStage3Descriptions(runtime, state);
}

function stage3EnemyLogicText(state) {
  const runtime = state?.battle?.stageRuntime || {};
  const lines = [
    "根据当前回合数 TURN 模 5 的结果，取[元素之书，力量之书，灵魂之书，时空之书，炼金术士卡特]对应的单位，对影子发动攻击。",
    "在每个己方回合开始和敌方回合开始时，根据单位当前 POWER 判定其为正位或逆位。",
    "【正逆位结界】：POWER 为 0-4 时视为【正位】；POWER 为 5-9 时视为【逆位】；攻击时发动对应效果，之后【真伪逆转】。",
    "【真伪逆转】：使自身 POWER 变为 9 - 原本 POWER。",
  ];

  if (runtime.stage3CooperationEnabled) {
    lines.push("【协同攻击-<上一个单位>】：仅敌方五个主单位持有；自己攻击时，若上一个单位与自身正逆位相反，则攻击后对同一目标追加一次攻击；该追加攻击也可继续连锁。");
  }

  if (runtime.stage3ForceFirstFailedCoop) {
    lines.push("【TURN10】：每回合首个失败的协同攻击改为成功触发。");
    lines.push("【TURN10】：【永恒】增强为敌方单位死亡时立刻复活，且复活回合可以攻击与协同攻击。");
  }

  return lines;
}

function onStage3TurnStart(runtime, state) {
  const battle = state?.battle;
  const carter = runtime.findUnit(battle, "s3-alchemist-carter");
  if (!battle) {
    return;
  }

  runtime.syncStage3StanceSnapshots(state);
  battle.enemyUnits.forEach((unit) => {
    if (unit?.runtimeState?.stage3NoAttackTurn === battle.turn) {
      delete unit.runtimeState.stage3NoAttackTurn;
    }
  });

  if (!carter) {
    return;
  }

  if (!carter.alive) {
    carter.alive = true;
    carter.destroyedAtTurn = null;
    carter.buffs = Object.fromEntries(Object.keys(carter.buffs || {}).map((key) => [key, 0]));
    carter.combat.lastBattleUnitId = null;
    carter.runtimeState = carter.runtimeState || {};
    delete carter.runtimeState.stage3NoAttackTurn;
    runtime.updateUnitPresentation(carter);
    runtime.addLog(state, "hook", `${carter.name} 在己方回合开始时恢复行动。`, {
      unitId: carter.id,
    });
  }

  refreshStage3Descriptions(runtime, state);
}

function onStage3EnemyTurnStart(runtime, state) {
  const battle = state?.battle;
  const carter = runtime.findUnit(battle, "s3-alchemist-carter");
  if (!battle) {
    return;
  }

  runtime.syncStage3StanceSnapshots(state);

  if (!(carter && carter.alive) || carter.power === 10) {
    refreshStage3Descriptions(runtime, state);
    return;
  }

  battle.enemyUnits
    .filter((unit) => unit.id !== carter.id && !unit.alive)
    .forEach((unit) => {
      if (runtime.reviveUnit(state, unit, "stage3-carter-eternity", carter, "enemy")) {
        if (!battle.stageRuntime?.stage3InstantReviveEnabled) {
          unit.runtimeState = unit.runtimeState || {};
          unit.runtimeState.stage3NoAttackTurn = battle.turn;
        }
      }
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
    stage3SignalBoostTurn: null,
    stage3BuffNullifyTurn: null,
    stage3BuffNullifySide: null,
    stage3TimeLoopProtect: [],
    stage3TimeLoopDestroy: [],
    stage3PendingTimeLoopProtect: [],
    stage3PendingTimeLoopDestroy: [],
  },
  lineup: {
    playerUnits: [
      {
        template: "robot",
        templateByMode: {
          story: "robot-stage3-story-v2",
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
  onEnemyTurnStart: onStage3EnemyTurnStart,
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
        page("【萤草】", "听好了，卡特的书灵活多变，最重要的是它的【正逆位结界】，这个结界赋予了他们全部的能力。"),
        page("【萤草】", "POWER值0-4的书处于【正位】，会发绿光。此时敌方单位将会释放正位能力，通常而言威胁比较低。"),
        page("【萤草】", "POWER值5-9的书处于【逆位】，会发红光。此时敌方单位将会释放逆位能力，必须要保护好【影子】。"),
        page("【萤草】", "卡特的书攻击结束都会发动【真伪逆转】，即令自身的POWER变为9-原本POWER。"),
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
        page("【萤草】", "看起来你通过摧毁【正位】的书页规避了他的一次能力，这是正确的处理方式。"),
        page("【萤草】", "不过不要想着永久性破坏这些书页。看到【炼金术士卡特】的能力了吗？他会在敌方回合开始时复活所有书页的。"),
        page("【萤草】", "但是破坏书页却可以让对应的书页本轮无法攻击，且下回合被复活时也无法攻击，阻碍对方两轮行动。"),
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
        page("【萤草】", "小心，这本比前面的那两本书都要危险。这本会附加上难以处理的【认知干扰】，让受影响的单位被永久削弱或增强。"),
        page("【萤草】", "此外，前两本书的能力发动时点都是<攻击之后>，而后两本书的能力发动时点都是<攻击前>，这意味着它们不会因为被摧毁就不发动能力，即使是正位也有一定的威胁。"),
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
        page("【萤草】", "这本书更是要小心，【时空闭环】会随着战斗的进行而逐渐累积。第一次记录某个POWER时，会使得战斗中该POWER值的敌方获得强化。第二次记录相同POWER时，会使玩家直接落败。"),
        page("【系统】", "由于有着可能导致玩家落败的广域能力，本BUFF情况都将同步显示在背景数字上。"),
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
        page("【萤草】", "竟然是很罕见的高速连击...请务必要小心，至今为止你参与的战斗，除了B细胞以外都没有单回合多次攻击的能力。"),
        page("【萤草】", "而卡特可以轻易地发动多轮攻击，请综合考虑多轮攻击的后果。"),
        page("【萤草】", "不过，要想战胜她，就必须要将卡特的POWER提高至10，即在卡特死亡的情况下多次触发敌方的攻击。如果拖太久了也会对己方不利。"),
        page("【萤草】", "比如这一轮，既可以保守一点，攻击【时空之书】或【炼金术士卡特】，也可以再多触发几次，推进胜利进度？"),
        page("【萤草】", "唔，以防你忘记我决定再说一遍，卡特的书攻击结束都会发动【真伪逆转】，这些可以在敌方行动栏看到。"),
        page("【萤草】", "之后的战斗我就无法协助你了，祝你好运！"),
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
