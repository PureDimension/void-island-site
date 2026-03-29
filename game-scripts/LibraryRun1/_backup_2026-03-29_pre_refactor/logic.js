const BaseGame = require("../BaseGame");

const TUTORIAL_STAGE_ID = "stage0-hive";
const STAGE_1_ID = "stage1-io";
const EMP_BUFF = "electromagnetic-interference";

const STORY_SCENES = {
  "tutorial-pre": [
    {
      paragraphs: [
        "蜂巢外沿的巡逻节奏有了一个极细小的空拍，像是谁在庞大的机械心跳里故意漏掉了一次呼吸。",
        "“别紧张。”水铃儿轻轻笑了一下，“在真正潜进图书馆之前，我先带你认识最基础的战斗方式。先学会活下来，再学会赢。”",
      ],
    },
  ],
  "tutorial-post": [
    {
      paragraphs: [
        "最后一只工蜂坠进断续闪烁的蜂巢光带里，周围终于安静下来。",
        "“差不多了。”水铃儿抬手把残余噪点拨开，“接下来才是真正的图书馆外围。你已经能看懂它们怎么动手了，剩下的是学会怎么先它们一步。”",
      ],
    },
  ],
  "stage1-pre": [
    {
      paragraphs: [
        "交界图书馆的外壳像一枚缓慢旋转的立方体，冷光沿着棱线滑动，仿佛整座建筑正把自己藏进数据的阴影里。",
        "在 3 层与 IO 区的外圈，一道短暂暴露的通信缝隙正在开启，这会是唯一能悄悄钻进去的入口。",
      ],
    },
    {
      paragraphs: [
        "真正的入侵路线被 1 层的用户管理区死死锁住，正面突破只会让整座图书馆提前醒来。",
        "所以这次行动的目标很简单，在消息发出之前截下一段密码，把它变成继续下潜所需的钥匙。",
      ],
    },
    {
      paragraphs: [
        "护卫节点已经围住了这份机密消息，任何迟疑都会让它重新沉进噪声流里。",
        "从这一刻开始，所有越界的能量都会立刻崩坏。要么精准切开防线，要么和它们一起坍毁。",
      ],
    },
  ],
};

const FLOW = [
  { type: "story", sceneId: "tutorial-pre" },
  { type: "battle", stageId: TUTORIAL_STAGE_ID },
  { type: "story", sceneId: "tutorial-post" },
  { type: "story", sceneId: "stage1-pre" },
  { type: "battle", stageId: STAGE_1_ID },
];

const RULE_TEXT = {
  sides: "战场上方是敌方，下方是己方。点击单位可以查看详情。",
  power: "POWER 是单位强度。任意时刻 POWER > 9 或 < 0，单位都会立刻被摧毁。",
  turn: "每回合先由己方主动攻击一次，再由敌方按行动伪代码行动。",
  combat: "一次攻击就是一次 POWER 比拼。POWER 高者存活，低者被摧毁；平局则双方同毁。",
  tags: "绝大多数单位都有其能力。◆ 表示主动发动，▲ 表示战斗中发动，▼ 表示战斗后发动，● 表示被动效果。",
  buffs: "除了这些触发时点能力外，单位身上还可能带有 BUFF；BUFF 也视为一种能力。",
  manifest: "影子的【显现】整局只能使用一次，会把本回合 POWER 改成你指定的值。所有关卡都保证不用它也能通关。",
  logs: "右上角 LOG 可以查看完整过程，屏幕中间只显示简略信息。",
  back: "右上角 BACK 可以回到上一步。",
  rules: "右上角 RULES 会整理到目前为止学到的所有规则。",
  emp: "【EMP】会让单位 POWER -3；若带着它的单位被摧毁，会把【EMP】传给最后一次与之战斗的单位。",
  cipher: "密文不会被系统自动选为攻击目标，需要通过规则联动来处理。",
};

const GUIDE_SETS = {
  [TUTORIAL_STAGE_ID]: [
    {
      id: "layout",
      speaker: "水铃儿",
      text: "先认一下战场吧。上面那排小方框是敌方单位，下面这排的是我们单位。你点任何一个小方框，都能在右侧看到它的详细信息。每个关卡的胜利目标是摧毁所有敌方单位，并且保证【影子】不被摧毁。",
      mode: "manual",
      highlights: [{ type: "area", id: "enemy-row" }, { type: "area", id: "player-row" }],
      addRules: ["sides"],
    },
    {
      id: "power",
      speaker: "水铃儿",
      text: "每个单位最显眼的数字就是 POWER。它不只是胜负判定，还会决定单位会不会越界崩坏。记住，任何时候（无论非战斗时刻还是战斗进行中）POWER值大于 9 或小于 0，都会立刻被摧毁。",
      mode: "manual",
      highlights: [{ type: "area", id: "power-readout" }],
      addRules: ["power"],
    },
    {
      id: "turn",
      speaker: "水铃儿",
      text: "回合顺序也很简单：每回合先由你主动选择攻击者与攻击目标并主动攻击一次，然后敌方再按自己的行动伪代码行动。所以你每次出手，都要想清楚接下来会换来什么。",
      mode: "manual",
      highlights: [{ type: "panel", id: "enemy-script" }],
      addRules: ["turn"],
    },
    {
      id: "attack-monitor",
      speaker: "水铃儿",
      text: "来，试一次。先选中影子，再选中监控工蜂发动攻击。你会亲眼看到，战斗本质上就是一次 POWER 比拼。",
      mode: "attack",
      requirement: {
        attackerId: "p-robot",
        targetId: "t-monitor",
      },
      highlights: [{ type: "unit", id: "p-robot" }, { type: "unit", id: "t-monitor" }, { type: "area", id: "action-button" }],
      addRules: ["combat"],
    },
    {
      id: "enemy-confirm",
      speaker: "水铃儿",
      text: "接下来轮到它们反击了。中间会给出简略结果，右下角会变成 CONFIRM。先看看这次结算，再点一下确认。",
      mode: "confirm",
      placement: "side",
      highlights: [{ type: "area", id: "action-button" }, { type: "area", id: "center-feed" }],
    },
    {
      id: "inspect-bee",
      speaker: "水铃儿",
      text: "现在看看信号工蜂2号。刚才它攻击时，上一个发动攻击并且仍然存活的单位是【影子】，所以它在那次战斗里拿到了额外的 3 点 POWER。现在战斗已经结束，因此“上一个攻击者”也更新成了刚刚出手的信号工蜂。绝大多数单位都有自己的能力。◆ 表示主动发动，▲ 表示战斗中发动，▼ 表示战斗后发动，● 表示被动效果。",
      mode: "manual",
      highlights: [
        { type: "unit", id: "t-signal-2" },
        { type: "area", id: "unit-tags" },
        { type: "area", id: "panel-description" },
        { type: "area", id: "power-readout" },
      ],
      addRules: ["tags", "manifest"],
    },
    {
      id: "rewind",
      speaker: "水铃儿",
      text: "这样下去我们会输，所以先点一下右上角的 BACK。它会把局面退回上一步，你以后出错时也能这样补救。",
      mode: "undo",
      highlights: [{ type: "area", id: "toolbar-back" }],
      addRules: ["back"],
    },
    {
      id: "toolbar-log",
      speaker: "水铃儿",
      text: "LOG 会把完整过程都记下来。战斗中间只显示必要信息，想复盘细节的时候，再去这里看就够了。",
      mode: "manual",
      highlights: [{ type: "area", id: "toolbar-log" }],
      addRules: ["logs"],
    },
    {
      id: "toolbar-rules",
      speaker: "水铃儿",
      text: "RULES 会把你已经学到的规则整理起来。后面每一关开始前，我也会继续往里面补新的提醒。",
      mode: "manual",
      highlights: [{ type: "area", id: "toolbar-rules" }],
      addRules: ["rules"],
    },
    {
      id: "free-play",
      speaker: "水铃儿",
      text: "好啦，现在开始自由行动吧。先把剩下的工蜂清掉，我们就能离开蜂巢。",
      mode: "free",
      highlights: [],
    },
  ],
  [STAGE_1_ID]: [
    {
      id: "stage1-buff",
      speaker: "水铃儿",
      text: "这一关里，除了前面见过的那些能力时点，我们还多了一种东西叫 BUFF。BUFF 也可以看作是一种能力，只是它会临时挂在单位身上，并跟着单位一起流转。",
      mode: "manual",
      highlights: [{ type: "unit", id: "p-emp-module" }, { type: "area", id: "panel-buffs" }],
      addRules: ["buffs"],
    },
    {
      id: "stage1-cipher",
      speaker: "水铃儿",
      text: "再看一眼密文。它不会被系统自动选为攻击目标，所以不能按普通敌人的思路处理，得想特殊方法。",
      mode: "manual",
      highlights: [{ type: "unit", id: "e-cipher" }, { type: "area", id: "panel-description" }],
    },
    {
      id: "stage1-disguise",
      speaker: "水铃儿",
      text: "最后看一下伪装模块。对敌方来说，它会被当成友军；对己方的选敌逻辑来说，它又会被当成敌方单位。但你仍然可以直接操控它作为攻击者，主动去攻击真正的敌人。",
      mode: "manual",
      highlights: [{ type: "unit", id: "p-disguise-module" }, { type: "area", id: "panel-description" }],
    },
  ],
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniquePush(list, item) {
  if (!list.includes(item)) {
    list.push(item);
  }
}

function createUnit({ id, slot, side, code, name, power, description, tags = [] }) {
  return {
    id,
    slot,
    side,
    code,
    name,
    power,
    basePower: power,
    description,
    tags,
    alive: true,
    destroyedAtTurn: null,
    buffs: {
      [EMP_BUFF]: 0,
    },
    combat: {
      battlesFought: 0,
      kills: 0,
      lastBattleUnitId: null,
    },
  };
}

function createGuideState(stageId) {
  const steps = clone(GUIDE_SETS[stageId] || []);
  return {
    stageId,
    steps,
    index: steps.length > 0 ? 0 : -1,
    hidden: steps.length === 0,
    checkpoint: null,
  };
}

function currentGuideStep(state) {
  const guide = state?.battle?.guide;
  if (!guide || guide.hidden || guide.index < 0) {
    return null;
  }
  return guide.steps[guide.index] || null;
}

function learnRules(state, ruleKeys = []) {
  for (const key of ruleKeys) {
    if (RULE_TEXT[key]) {
      uniquePush(state.rulebook, RULE_TEXT[key]);
    }
  }
}

function syncCurrentGuideRules(state) {
  const step = currentGuideStep(state);
  if (step?.addRules) {
    learnRules(state, step.addRules);
  }
}

function advanceGuide(state) {
  const guide = state?.battle?.guide;
  if (!guide || guide.hidden) {
    return;
  }

  if (guide.index >= guide.steps.length - 1) {
    guide.hidden = true;
    return;
  }

  guide.index += 1;
  syncCurrentGuideRules(state);
}

function buildTutorialBattle() {
  return {
    stageId: TUTORIAL_STAGE_ID,
    title: "教程关 蜂巢外沿",
    objective: "清除全部工蜂并学会基础操作",
    enemyLogicText: [
      "选择相对于玩家的最右侧的一个己方单位",
      "对相对于玩家的最右侧的一个敌方单位执行攻击",
    ],
    enemyAi: "tutorial-max-slot",
    status: "PLAYER_TURN",
    turn: 1,
    destroyedUnitIds: [],
    pendingTurnEffects: {
      overloadPower: null,
    },
    lastEnemyAttackerId: null,
    lastPlayerAttackerId: null,
    lastCombatAttackerId: null,
    lastCombatDefenderId: null,
    playerUnits: [
      createUnit({
        id: "p-robot",
        slot: 1,
        side: "player",
        code: "robot",
        name: "影子",
        power: 3,
        description: "死亡时游戏失败。技能【显现】：整局只能使用一次，把本回合 POWER 改成 1-9 的任意值。",
        tags: ["主"],
      }),
      createUnit({
        id: "p-waterbell",
        slot: 2,
        side: "player",
        code: "waterbell",
        name: "水铃儿",
        power: 3,
        description: "这关由她带你熟悉战场，没有额外能力。",
        tags: [],
      }),
    ],
    enemyUnits: [
      createUnit({
        id: "t-signal-1",
        slot: 1,
        side: "enemy",
        code: "signal-bee",
        name: "信号工蜂1号",
        power: 1,
        description: "战斗中，若上一个发动攻击者存活，则本次战斗 POWER 额外增加该单位的 POWER。",
        tags: ["中"],
      }),
      createUnit({
        id: "t-signal-2",
        slot: 2,
        side: "enemy",
        code: "signal-bee",
        name: "信号工蜂2号",
        power: 1,
        description: "战斗中，若上一个发动攻击者存活，则本次战斗 POWER 额外增加该单位的 POWER。",
        tags: ["中"],
      }),
      createUnit({
        id: "t-monitor",
        slot: 3,
        side: "enemy",
        code: "monitor-bee",
        name: "监控工蜂",
        power: 2,
        description: "战斗中，若上一个被攻击者存活，则本次战斗 POWER 额外增加该单位的 POWER。",
        tags: ["中"],
      }),
    ],
    actionLog: [
      {
        turn: 1,
        type: "system",
        text: "教程关开始。",
      },
    ],
    guide: createGuideState(TUTORIAL_STAGE_ID),
  };
}

function buildStage1Battle() {
  return {
    stageId: STAGE_1_ID,
    title: "第一关 IO 区",
    objective: "击败所有敌人（包括密文）",
    enemyLogicText: [
      "如果 上一个主动攻击的敌方单位存活：",
      "  如果 在己方单位中存在 POWER 高于它且最低的一个单位：",
      "    该单位攻击该敌方单位",
      "否则：本轮不攻击",
    ],
    enemyAi: "stage1-passive-defense",
    status: "PLAYER_TURN",
    turn: 1,
    destroyedUnitIds: [],
    pendingTurnEffects: {
      overloadPower: null,
    },
    lastEnemyAttackerId: null,
    lastPlayerAttackerId: null,
    lastCombatAttackerId: null,
    lastCombatDefenderId: null,
    playerUnits: [
      createUnit({
        id: "p-robot",
        slot: 2,
        side: "player",
        code: "robot",
        name: "影子",
        power: 3,
        description: "死亡时游戏失败。技能【显现】：整局只能使用一次，把本回合 POWER 改成 1-9 的任意值。",
        tags: ["主"],
      }),
      createUnit({
        id: "p-battle-module",
        slot: 4,
        side: "player",
        code: "battle-module",
        name: "战斗模块",
        power: 5,
        description: "不会因战斗落败被摧毁。无论战斗结果如何，战斗后 POWER 永久 -1。",
        tags: ["被"],
      }),
      createUnit({
        id: "p-emp-module",
        slot: 6,
        side: "player",
        code: "emp-module",
        name: "电磁干扰模块",
        power: 1,
        description: "在战斗中被摧毁时，使与之战斗的单位获得【EMP】。【EMP】：POWER -3；若带着它的单位被摧毁，会把【EMP】传给最后一次与之战斗的单位。",
        tags: ["后"],
      }),
      createUnit({
        id: "p-growth-module",
        slot: 8,
        side: "player",
        code: "growth-module",
        name: "成长模块",
        power: 0,
        description: "战斗中额外获得 X 点 POWER，X 为本关已被摧毁的单位数量。",
        tags: ["中"],
      }),
      createUnit({
        id: "p-disguise-module",
        slot: 10,
        side: "player",
        code: "disguise-module",
        name: "伪装模块",
        power: 3,
        description: "被视为敌方单位，但仍可由己方主动选中作为攻击者去攻击敌方单位。",
        tags: ["被"],
      }),
    ],
    enemyUnits: [
      createUnit({
        id: "e-alpha",
        slot: 1,
        side: "enemy",
        code: "alpha",
        name: "安全护卫α",
        power: 5,
        description: "将要主动攻击时，本次战斗 POWER +3。",
        tags: ["中"],
      }),
      createUnit({
        id: "e-beta",
        slot: 3,
        side: "enemy",
        code: "beta",
        name: "安全护卫β",
        power: 3,
        description: "将要被攻击时，本次战斗 POWER +3。",
        tags: ["中"],
      }),
      createUnit({
        id: "e-gamma",
        slot: 5,
        side: "enemy",
        code: "gamma",
        name: "安全护卫γ",
        power: 9,
        description: "每当 α 或 β 发生战斗，自己 POWER 永久 -1；若它们在该战斗中被摧毁，再额外 -1。",
        tags: ["被"],
      }),
      createUnit({
        id: "e-cipher",
        slot: 7,
        side: "enemy",
        code: "cipher",
        name: "密文",
        power: 1,
        description: "不会被系统自动选为被攻击目标。",
        tags: ["被"],
      }),
    ],
    actionLog: [
      {
        turn: 1,
        type: "system",
        text: "第一关开始。",
      },
    ],
    guide: createGuideState(STAGE_1_ID),
  };
}

function buildBattle(stageId) {
  if (stageId === TUTORIAL_STAGE_ID) {
    return buildTutorialBattle();
  }
  return buildStage1Battle();
}

function getAllUnits(battle) {
  return [...battle.playerUnits, ...battle.enemyUnits];
}

function findUnit(battle, unitId) {
  return getAllUnits(battle).find((unit) => unit.id === unitId) || null;
}

function getLivingUnits(units) {
  return units.filter((unit) => unit.alive);
}

function sortBySlot(units) {
  return [...units].sort((a, b) => a.slot - b.slot);
}

function isDisguiseUnit(unit) {
  return unit?.code === "disguise-module";
}

function canPlayerCommand(unit) {
  return !!(unit && unit.alive && unit.side === "player");
}

function canEnemyTreatAsPlayerTarget(unit) {
  return !!(unit && unit.alive && unit.side === "player" && !isDisguiseUnit(unit));
}

function canPlayerTargetEnemy(unit) {
  return !!(unit && unit.alive && (unit.side === "enemy" || isDisguiseUnit(unit)));
}

function canPerformEnemyOpeningStrike(unit) {
  return !!(unit && unit.alive && (unit.side === "enemy" || isDisguiseUnit(unit)));
}

function getEnemyActorPool(state) {
  return getAllUnits(state.battle).filter((unit) => canPerformEnemyOpeningStrike(unit));
}

function getPreviousCombatAttacker(state) {
  const previousAttacker = state.battle.lastCombatAttackerId
    ? findUnit(state.battle, state.battle.lastCombatAttackerId)
    : null;
  return previousAttacker?.alive ? previousAttacker : null;
}

function getPreviousCombatDefender(state) {
  const previousDefender = state.battle.lastCombatDefenderId
    ? findUnit(state.battle, state.battle.lastCombatDefenderId)
    : null;
  return previousDefender?.alive ? previousDefender : null;
}

function alivePlayerUnits(state) {
  return getLivingUnits(state.battle.playerUnits);
}

function aliveEnemyUnits(state) {
  return getLivingUnits(state.battle.enemyUnits);
}

function addLog(state, type, text, extra = {}) {
  state.battle.actionLog.push({
    turn: state.battle.turn,
    type,
    text,
    ...extra,
  });
}

function destroyedCount(state) {
  return state.battle.destroyedUnitIds.length;
}

function recordDestroyedUnit(state, unit) {
  if (!state.battle.destroyedUnitIds.includes(unit.id)) {
    state.battle.destroyedUnitIds.push(unit.id);
  }
}

function getHookBucket(unit) {
  return UNIT_HOOKS[unit.code] || EMPTY_HOOKS;
}

function runHooks(hookName, state, payload, units = null) {
  const pool = units || getAllUnits(state.battle);
  for (const unit of pool) {
    const hooks = getHookBucket(unit)[hookName] || [];
    for (const hook of hooks) {
      hook(state, { ...payload, self: unit });
    }
  }
}

function applyEmpBuff(state, recipient, sourceUnit) {
  if (!recipient || !recipient.alive) {
    return;
  }

  recipient.buffs[EMP_BUFF] += 1;
  recipient.power -= 3;
  addLog(state, "hook", `${recipient.name} 获得【EMP】，POWER -3。`, {
    unitId: recipient.id,
    sourceUnitId: sourceUnit?.id || null,
  });
  enforcePowerBounds(state, recipient, { cause: "emp", sourceUnitId: sourceUnit?.id || null });
}

function destroyUnit(state, unit, reason, payload = {}) {
  if (!unit || !unit.alive) {
    return;
  }

  unit.alive = false;
  unit.destroyedAtTurn = state.battle.turn;
  recordDestroyedUnit(state, unit);

  addLog(state, "destroy", `${unit.name} 被摧毁。`, {
    unitId: unit.id,
    reason,
  });

  runHooks("onDestroyed", state, { ...payload, reason, destroyedUnit: unit }, [unit]);

  if (unit.buffs[EMP_BUFF] > 0 && unit.combat.lastBattleUnitId) {
    const lastBattleUnit = findUnit(state.battle, unit.combat.lastBattleUnitId);
    if (lastBattleUnit && lastBattleUnit.alive) {
      addLog(state, "hook", `${unit.name} 身上的【EMP】传递给 ${lastBattleUnit.name}。`, {
        unitId: unit.id,
        targetUnitId: lastBattleUnit.id,
      });
      applyEmpBuff(state, lastBattleUnit, unit);
    }
  }
}

function enforcePowerBounds(state, unit, detail = {}) {
  if (!unit || !unit.alive) {
    return;
  }

  if (unit.power < 0 || unit.power > 9) {
    addLog(state, "rule", `${unit.name} 的 POWER 变为 ${unit.power}，越界摧毁。`, {
      unitId: unit.id,
      value: unit.power,
      ...detail,
    });
    destroyUnit(state, unit, detail.cause || "power-out-of-range", detail);
  }
}

function getCombatPower(unit, state, context) {
  let currentPower = unit.power;
  const hooks = getHookBucket(unit).modifyCombatPower || [];
  for (const hook of hooks) {
    currentPower = hook(state, { ...context, self: unit, currentPower });
  }
  return currentPower;
}

function preventCombatDestruction(state, unit, context) {
  const hooks = getHookBucket(unit).preventCombatDestruction || [];
  for (const hook of hooks) {
    if (hook(state, { ...context, self: unit })) {
      return true;
    }
  }
  return false;
}

function getCombatPreviewBonus(unit, state) {
  let bonus = 0;
  const hooks = getHookBucket(unit).previewCombatBonus || [];
  for (const hook of hooks) {
    bonus += hook(state, { self: unit }) || 0;
  }
  return bonus;
}

function buildCombatPreview(state) {
  const result = {};
  if (!state?.battle) {
    return result;
  }
  for (const unit of getAllUnits(state.battle)) {
    result[unit.id] = {
      bonus: getCombatPreviewBonus(unit, state),
    };
  }
  return result;
}

function settleCombatOutcome(state, context) {
  const attacker = context.attacker;
  const defender = context.defender;
  const previousAttacker = state.battle.lastCombatAttackerId
    ? findUnit(state.battle, state.battle.lastCombatAttackerId)
    : null;
  const previousDefender = state.battle.lastCombatDefenderId
    ? findUnit(state.battle, state.battle.lastCombatDefenderId)
    : null;

  attacker.combat.battlesFought += 1;
  defender.combat.battlesFought += 1;
  attacker.combat.lastBattleUnitId = defender.id;
  defender.combat.lastBattleUnitId = attacker.id;

  const attackerPower = getCombatPower(attacker, state, {
    ...context,
    previousAttacker,
    previousDefender,
  });
  const defenderPower = getCombatPower(defender, state, {
    ...context,
    previousAttacker,
    previousDefender,
  });

  addLog(state, "combat", `${attacker.name} 攻击 ${defender.name}。`, {
    attackerId: attacker.id,
    defenderId: defender.id,
    attackerPower,
    defenderPower,
    source: context.source || null,
  });

  let attackerDestroyed = false;
  let defenderDestroyed = false;

  if (attackerPower === defenderPower) {
    attackerDestroyed = true;
    defenderDestroyed = true;
  } else if (attackerPower > defenderPower) {
    defenderDestroyed = true;
  } else {
    attackerDestroyed = true;
  }

  if (attackerDestroyed && preventCombatDestruction(state, attacker, context)) {
    attackerDestroyed = false;
  }

  if (defenderDestroyed && preventCombatDestruction(state, defender, context)) {
    defenderDestroyed = false;
  }

  if (attackerDestroyed && attacker.alive) {
    destroyUnit(state, attacker, "combat", { ...context, opponent: defender });
  }

  if (defenderDestroyed && defender.alive) {
    destroyUnit(state, defender, "combat", { ...context, opponent: attacker });
  }

  if (!attacker.alive && defender.alive) {
    defender.combat.kills += 1;
  }

  if (!defender.alive && attacker.alive) {
    attacker.combat.kills += 1;
  }

  runHooks("afterCombat", state, {
    ...context,
    attacker,
    defender,
    attackerPower,
    defenderPower,
    attackerDestroyed,
    defenderDestroyed,
  });

  state.battle.lastCombatAttackerId = attacker.id;
  state.battle.lastCombatDefenderId = defender.id;

  for (const unit of getAllUnits(state.battle)) {
    if (unit.alive) {
      enforcePowerBounds(state, unit, { cause: "post-combat-check" });
    }
  }
}

function calculateStage1Rating(state) {
  const shadow = findUnit(state.battle, "p-robot");
  const growth = findUnit(state.battle, "p-growth-module");
  const battleModule = findUnit(state.battle, "p-battle-module");
  const disguise = findUnit(state.battle, "p-disguise-module");

  if (shadow?.alive && growth?.alive && (battleModule?.alive || disguise?.alive)) {
    return "完美";
  }

  if (shadow?.alive && (growth?.alive || battleModule?.alive || disguise?.alive)) {
    return "优秀";
  }

  return "普通";
}

function thisEnd(state, results) {
  if (state.battle) {
    state.battle.status = results.outcome === "victory" ? "CLEARED" : "FAILED";
    state.battle.pendingTurnEffects.overloadPower = null;
  }
  state.finalResults = results;
}

function setPendingDefeat(state, results) {
  state.phase = "DEFEAT";
  if (state.battle) {
    state.battle.status = "FAILED";
    state.battle.pendingTurnEffects.overloadPower = null;
  }
  state.pendingDefeat = results;
}

function chooseTutorialEnemyAttacker(state) {
  return sortBySlot(aliveEnemyUnits(state)).slice(-1)[0] || null;
}

function chooseTutorialEnemyTarget(state) {
  return sortBySlot(alivePlayerUnits(state)).slice(-1)[0] || null;
}

function chooseStage1EnemyAttacker(state) {
  const target = findUnit(state.battle, state.battle.lastPlayerAttackerId);
  if (!target || !target.alive || !canEnemyTreatAsPlayerTarget(target)) {
    return null;
  }

  const candidates = getEnemyActorPool(state)
    .filter((unit) => unit.power > target.power);

  if (candidates.length === 0) {
    return null;
  }

  const minPower = Math.min(...candidates.map((unit) => unit.power));
  return sortBySlot(candidates.filter((unit) => unit.power === minPower))[0] || null;
}

function chooseStage1EnemyTarget(state) {
  const target = findUnit(state.battle, state.battle.lastPlayerAttackerId);
  if (!target || !target.alive || !canEnemyTreatAsPlayerTarget(target)) {
    return null;
  }
  return target;
}

function resolveEnemyOpeningStrike(state) {
  if (!state.battle) {
    return;
  }

  if (state.battle.stageId === TUTORIAL_STAGE_ID) {
    const attacker = chooseTutorialEnemyAttacker(state);
    const target = chooseTutorialEnemyTarget(state);

    if (!attacker || !target) {
      addLog(state, "enemy", "本轮没有敌方回击。");
      return;
    }

    state.battle.lastEnemyAttackerId = attacker.id;
    addLog(state, "enemy", `${attacker.name} 锁定 ${target.name}。`, {
      attackerId: attacker.id,
      targetUnitId: target.id,
    });
    settleCombatOutcome(state, {
      attacker,
      defender: target,
      overloadPower: null,
      source: "enemy-open-strike",
    });
    return;
  }

  const target = chooseStage1EnemyTarget(state);
  const attacker = chooseStage1EnemyAttacker(state);

  if (!target) {
    addLog(state, "enemy", "本轮没有敌方回击。", {
      attackerId: null,
      targetUnitId: state.battle.lastPlayerAttackerId || null,
    });
    return;
  }

  if (!attacker) {
    addLog(state, "enemy", "敌方未找到合法攻击者。", {
      attackerId: null,
      targetUnitId: target.id,
    });
    return;
  }

  addLog(state, "enemy", `${attacker.name} 锁定 ${target.name}。`, {
    attackerId: attacker.id,
    targetUnitId: target.id,
  });
  state.battle.lastEnemyAttackerId = attacker.id;
  settleCombatOutcome(state, {
    attacker,
    defender: target,
    overloadPower: null,
    source: "enemy-open-strike",
  });
}

function makeHistorySnapshot(state) {
  const snapshot = clone(state);
  snapshot.history = [];
  return snapshot;
}

function pushHistory(state) {
  state.history = [...(state.history || []), makeHistorySnapshot(state)].slice(-40);
}

function buildStoryState(sceneId) {
  return {
    sceneId,
    index: 0,
    pages: clone(STORY_SCENES[sceneId] || []),
  };
}

function moveToFlow(state, flowIndex) {
  const entry = FLOW[flowIndex];
  state.flowIndex = flowIndex;
  state.pendingDefeat = null;
  state.finalResults = null;

  if (!entry) {
    thisEnd(state, {
      outcome: "victory",
      stageId: STAGE_1_ID,
      rating: state.campaign.ratings[STAGE_1_ID] || "普通",
      survivors: [],
      triggerSource: "flow-end",
    });
    return;
  }

  if (entry.type === "story") {
    state.phase = "STORY";
    state.story = buildStoryState(entry.sceneId);
    state.battle = null;
    return;
  }

  state.phase = "BATTLE";
  state.story = null;
  state.battle = buildBattle(entry.stageId);
  syncCurrentGuideRules(state);
}

function evaluateBattleState(state, triggerSource) {
  if (!state.battle) {
    return false;
  }

  const shadow = findUnit(state.battle, "p-robot");
  if (!shadow || !shadow.alive) {
    setPendingDefeat(state, {
      outcome: "defeat",
      stageId: state.battle.stageId,
      reason: "影子已被摧毁。",
      triggerSource,
    });
    return true;
  }

  if (aliveEnemyUnits(state).length === 0) {
    if (state.battle.stageId === TUTORIAL_STAGE_ID) {
      uniquePush(state.campaign.clearedStages, TUTORIAL_STAGE_ID);
      moveToFlow(state, state.flowIndex + 1);
      return true;
    }

    const rating = calculateStage1Rating(state);
    state.phase = "VICTORY";
    uniquePush(state.campaign.clearedStages, STAGE_1_ID);
    state.campaign.ratings[STAGE_1_ID] = rating;
    thisEnd(state, {
      outcome: "victory",
      stageId: STAGE_1_ID,
      rating,
      survivors: sortBySlot(alivePlayerUnits(state)).map((unit) => unit.id),
      triggerSource,
    });
    return true;
  }

  if (alivePlayerUnits(state).length === 0) {
    setPendingDefeat(state, {
      outcome: "defeat",
      stageId: state.battle.stageId,
      reason: "己方已无可行动单位。",
      triggerSource,
    });
    return true;
  }

  return false;
}

function isTutorialAttackAllowed(state, attackerId, targetId) {
  const step = currentGuideStep(state);
  if (!step || state.battle.stageId !== TUTORIAL_STAGE_ID) {
    return true;
  }

  if (step.mode === "free") {
    return true;
  }

  if (step.mode !== "attack") {
    addLog(state, "guide", "水铃儿轻轻拦住了你：先按当前教导来。");
    return false;
  }

  if (step.requirement?.attackerId === attackerId && step.requirement?.targetId === targetId) {
    return true;
  }

  addLog(state, "guide", "水铃儿提醒：先让影子去攻击监控工蜂。");
  return false;
}

const EMPTY_HOOKS = {
  modifyCombatPower: [],
  preventCombatDestruction: [],
  afterCombat: [],
  onDestroyed: [],
  previewCombatBonus: [],
};

const UNIT_HOOKS = {
  robot: {
    ...EMPTY_HOOKS,
    modifyCombatPower: [
      (state, { self, attacker, currentPower, overloadPower }) => {
        if (self.id === attacker.id && overloadPower !== null) {
          return overloadPower;
        }
        return currentPower;
      },
    ],
  },
  waterbell: EMPTY_HOOKS,
  "signal-bee": {
    ...EMPTY_HOOKS,
    modifyCombatPower: [
      (state, { currentPower }) => {
        const previousAttacker = getPreviousCombatAttacker(state);
        return previousAttacker ? currentPower + previousAttacker.power : currentPower;
      },
    ],
    previewCombatBonus: [
      (state) => {
        const previousAttacker = getPreviousCombatAttacker(state);
        return previousAttacker ? previousAttacker.power : 0;
      },
    ],
  },
  "monitor-bee": {
    ...EMPTY_HOOKS,
    modifyCombatPower: [
      (state, { currentPower }) => {
        const previousDefender = getPreviousCombatDefender(state);
        return previousDefender ? currentPower + previousDefender.power : currentPower;
      },
    ],
    previewCombatBonus: [
      (state) => {
        const previousDefender = getPreviousCombatDefender(state);
        return previousDefender ? previousDefender.power : 0;
      },
    ],
  },
  "battle-module": {
    ...EMPTY_HOOKS,
    preventCombatDestruction: [
      (state, { self }) => {
        addLog(state, "hook", `${self.name} 免于因战斗被摧毁。`, {
          unitId: self.id,
        });
        return true;
      },
    ],
    afterCombat: [
      (state, { self, attacker, defender }) => {
        if (self.id !== attacker.id && self.id !== defender.id) {
          return;
        }
        if (!self.alive) {
          return;
        }
        self.power -= 1;
        addLog(state, "hook", `${self.name} 战后 POWER -1。`, {
          unitId: self.id,
        });
        enforcePowerBounds(state, self, { cause: "battle-module-wear" });
      },
    ],
  },
  "emp-module": {
    ...EMPTY_HOOKS,
    onDestroyed: [
      (state, { self, reason, opponent }) => {
        if (reason !== "combat" || !opponent || !opponent.alive) {
          return;
        }
        applyEmpBuff(state, opponent, self);
      },
    ],
  },
  "growth-module": {
    ...EMPTY_HOOKS,
    modifyCombatPower: [
      (state, { currentPower }) => currentPower + destroyedCount(state),
    ],
    previewCombatBonus: [
      (state) => destroyedCount(state),
    ],
  },
  "disguise-module": EMPTY_HOOKS,
  alpha: {
    ...EMPTY_HOOKS,
    modifyCombatPower: [
      (state, { self, attacker, currentPower }) => (
        attacker.id === self.id ? currentPower + 3 : currentPower
      ),
    ],
    previewCombatBonus: [() => 3],
  },
  beta: {
    ...EMPTY_HOOKS,
    modifyCombatPower: [
      (state, { self, defender, currentPower }) => (
        defender.id === self.id ? currentPower + 3 : currentPower
      ),
    ],
    previewCombatBonus: [() => 3],
  },
  gamma: {
    ...EMPTY_HOOKS,
    afterCombat: [
      (state, { self, attacker, defender }) => {
        if (!self.alive) {
          return;
        }

        const watchedCodes = ["alpha", "beta"];
        const watchedInBattle =
          watchedCodes.includes(attacker.code) || watchedCodes.includes(defender.code);

        if (!watchedInBattle) {
          return;
        }

        self.power -= 1;
        addLog(state, "hook", `${self.name} 因 α/β 参战而 POWER -1。`, {
          unitId: self.id,
        });
        enforcePowerBounds(state, self, { cause: "gamma-passive" });

        const watchedDestroyed =
          (!attacker.alive && watchedCodes.includes(attacker.code))
          || (!defender.alive && watchedCodes.includes(defender.code));

        if (!self.alive || !watchedDestroyed) {
          return;
        }

        self.power -= 1;
        addLog(state, "hook", `${self.name} 因 α/β 在该战斗中被摧毁而额外 POWER -1。`, {
          unitId: self.id,
        });
        enforcePowerBounds(state, self, { cause: "gamma-bonus" });
      },
    ],
  },
  cipher: EMPTY_HOOKS,
};

module.exports = class LibraryRun1Logic extends BaseGame {
  setup() {
    const state = {
      phase: "STORY",
      flowIndex: 0,
      story: null,
      campaign: {
        overloadUsed: false,
        clearedStages: [],
        ratings: {},
      },
      history: [],
      battle: null,
      pendingDefeat: null,
      finalResults: null,
      rulebook: [],
    };

    moveToFlow(state, 0);
    return state;
  }

  filter(fullState) {
    const view = clone(fullState);
    if (fullState?.battle) {
      view.battle.combatPreview = buildCombatPreview(fullState);
      view.battle.currentGuideStep = currentGuideStep(fullState);
    }
    return view;
  }

  onAction(state, { action, data, uuid }) {
    const players = this.room.seats.filter(Boolean);
    if (!players.some((player) => player.uuid === uuid)) {
      return state;
    }

    if (state.finalResults) {
      return state;
    }

    if (action === "give-up") {
      if (!state.pendingDefeat) {
        return state;
      }
      thisEnd(state, state.pendingDefeat);
      return state;
    }

    if (action === "undo") {
      if (!state.history?.length) {
        return state;
      }
      const previous = clone(state.history[state.history.length - 1]);
      previous.history = state.history.slice(0, -1);
      previous.pendingDefeat = null;
      return previous;
    }

    if (action === "guide-undo") {
      if (state.phase !== "BATTLE" || !state.battle) {
        return state;
      }
      const step = currentGuideStep(state);
      if (!step || step.mode !== "undo" || !state.battle.guide.checkpoint) {
        return state;
      }

      const restored = clone(state.battle.guide.checkpoint);
      restored.history = [];
      restored.pendingDefeat = null;
      restored.finalResults = null;

      if (restored.battle?.guide) {
        restored.battle.guide.index = Math.min(
          state.battle.guide.index + 1,
          restored.battle.guide.steps.length - 1
        );
        restored.battle.guide.hidden = false;
      }

      restored.rulebook = clone(state.rulebook);
      syncCurrentGuideRules(restored);
      return restored;
    }

    if (action === "next-story") {
      if (state.phase !== "STORY") {
        return state;
      }

      pushHistory(state);

      if (state.story.index < state.story.pages.length - 1) {
        state.story.index += 1;
      } else {
        moveToFlow(state, state.flowIndex + 1);
        if (state.phase === "BATTLE") {
          addLog(state, "system", "剧情结束，进入战斗。");
        }
      }
      return state;
    }

    if (action === "next-guide") {
      if (state.phase !== "BATTLE" || !state.battle) {
        return state;
      }
      const step = currentGuideStep(state);
      if (!step || step.mode === "attack" || step.mode === "confirm") {
        return state;
      }
      pushHistory(state);
      advanceGuide(state);
      return state;
    }

    if (action === "confirm-enemy") {
      if (state.phase !== "BATTLE" || !state.battle) {
        return state;
      }
      const step = currentGuideStep(state);
      if (!step || step.mode !== "confirm") {
        return state;
      }
      pushHistory(state);
      advanceGuide(state);
      return state;
    }

    if (action === "set-overload") {
      if (state.phase !== "BATTLE" || state.battle.status !== "PLAYER_TURN") {
        return state;
      }

      const power = Number(data?.power);
      if (state.campaign.overloadUsed || Number.isNaN(power) || power < 1 || power > 9) {
        return state;
      }

      pushHistory(state);
      state.battle.pendingTurnEffects.overloadPower = power;
      addLog(state, "skill", `影子准备显现至 ${power}。`, {
        unitId: "p-robot",
        power,
      });
      return state;
    }

    if (action !== "attack") {
      return state;
    }

    if (state.phase !== "BATTLE" || state.battle.status !== "PLAYER_TURN") {
      return state;
    }

    const attacker = findUnit(state.battle, data?.attackerId);
    const defender = findUnit(state.battle, data?.targetId);

    if (!canPlayerCommand(attacker) || !canPlayerTargetEnemy(defender)) {
      return state;
    }

    if (!isTutorialAttackAllowed(state, attacker.id, defender.id)) {
      return state;
    }

    if (
      attacker.id !== "p-robot"
      && state.battle.pendingTurnEffects.overloadPower !== null
    ) {
      addLog(state, "skill", "显现只能由影子在本回合出击时使用。");
      return state;
    }

    pushHistory(state);

    if (state.battle.stageId === TUTORIAL_STAGE_ID) {
      const step = currentGuideStep(state);
      if (step?.mode === "attack") {
        state.battle.guide.checkpoint = makeHistorySnapshot(state);
      }
    }

    state.pendingDefeat = null;
    state.battle.status = "RESOLVING";

    if (attacker.code !== "disguise-module") {
      state.battle.lastPlayerAttackerId = attacker.id;
    }

    const overloadPower = attacker.id === "p-robot"
      ? state.battle.pendingTurnEffects.overloadPower
      : null;

    if (overloadPower !== null) {
      state.campaign.overloadUsed = true;
      addLog(state, "skill", `影子显现，本次战斗 POWER 视为 ${overloadPower}。`, {
        unitId: attacker.id,
        power: overloadPower,
      });
    }

    settleCombatOutcome(state, {
      attacker,
      defender,
      overloadPower,
      source: "player-attack",
    });

    state.battle.pendingTurnEffects.overloadPower = null;

    const step = currentGuideStep(state);
    if (step?.mode === "attack") {
      advanceGuide(state);
    }

    if (evaluateBattleState(state, "player-attack")) {
      if (state.finalResults) {
        this.end(state.finalResults);
      }
      return state;
    }

    state.battle.turn += 1;
    state.battle.status = "ENEMY_OPENING";
    resolveEnemyOpeningStrike(state);

    if (evaluateBattleState(state, "enemy-open-strike")) {
      if (state.finalResults) {
        this.end(state.finalResults);
      }
      return state;
    }

    state.battle.status = "PLAYER_TURN";
    addLog(state, "system", `第 ${state.battle.turn} 回合开始。`);
    return state;
  }
};
