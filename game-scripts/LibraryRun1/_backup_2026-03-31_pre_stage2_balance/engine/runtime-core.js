const BaseGame = require("../../BaseGame");
const {
  EMP_BUFF,
  VIRUS_BUFF,
  BUFF_CATALOG,
} = require("../data/buffs");
const { STORY_SCENES } = require("../data/stories");
const {
  FLOW,
  TUTORIAL_STAGE_ID,
  STAGE_1_ID,
  STAGE_2_ID,
  STAGE_3_ID,
  FLOW_JUMP_TARGETS,
} = require("../data/flow");
const { RULE_TEXT } = require("../data/rules");
const { GUIDE_SETS } = require("../data/guides");
const { getTipsForStage, canRevealTip } = require("../data/tips");
const { STAGE_DEFS } = require("../data/stages");
const { EMPTY_HOOKS, getUnitDefinition } = require("../data/units/catalog");
const { resolveEnemyAction } = require("./enemy-ai");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function uniquePush(list, item) {
  if (!list.includes(item)) {
    list.push(item);
  }
}

function createBuffState() {
  return Object.values(BUFF_CATALOG).reduce((result, buff) => {
    result[buff.key] = 0;
    return result;
  }, {});
}

function getUnitDefinitionForUnit(unit) {
  return getUnitDefinition(unit?.abilityCode || unit?.code);
}

function getDisplayConfig(unit) {
  return getUnitDefinitionForUnit(unit).display || {};
}

function refreshUnitPresentation(unit) {
  const definition = getUnitDefinitionForUnit(unit);
  unit.description = unit.descriptionOverride || definition.description;
  unit.tags = clone(unit.tagsOverride || definition.tags || []);
  unit.display = { ...definition.display };
  unit.combatTargetable = unit.display.combatTargetable !== false;
  return unit;
}

function createUnit({ id, slot, side, code, name, power, description, tags, buffs = null }) {
  const unit = {
    id,
    slot,
    side,
    baseSide: side,
    code,
    abilityCode: code,
    name,
    power,
    basePower: power,
    descriptionOverride: description || null,
    tagsOverride: tags || null,
    description: "",
    tags: [],
    display: {},
    combatTargetable: true,
    alive: true,
    destroyedAtTurn: null,
    buffs: {
      ...createBuffState(),
      ...(buffs || {}),
    },
    combat: {
      battlesFought: 0,
      kills: 0,
      lastBattleUnitId: null,
    },
    runtimeState: clone(getUnitDefinition(code).runtimeState || {}),
  };
  return refreshUnitPresentation(unit);
}

function instantiateLineup(state, stageId, lineup) {
  return lineup.map((entry) => {
    const template = entry.templateByMode?.[state?.campaign?.mode] || entry.template;
    const definition = getUnitDefinition(template);
    return createUnit({
      id: entry.id,
      slot: entry.slot,
      side: entry.side,
      code: template,
      name: entry.name || definition.name,
      power: entry.power ?? definition.power,
      description: entry.description,
      tags: entry.tags,
      buffs: entry.buffs,
    });
  });
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

function createBattleEventState() {
  return {
    triggeredKeys: [],
    queue: [],
    active: null,
  };
}

function currentGuideStep(state) {
  const guide = state?.battle?.guide;
  if (!guide || guide.hidden || guide.index < 0) {
    return null;
  }
  return guide.steps[guide.index] || null;
}

function currentBattleEventPage(state) {
  const activeEvent = state?.battle?.eventState?.active;
  if (!activeEvent) {
    return null;
  }
  return activeEvent.pages?.[activeEvent.index] || null;
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

function setEnemyLogicText(state, lines) {
  if (!state?.battle) {
    return;
  }
  state.battle.enemyLogicText = clone(lines || []);
}

function updateUnitPresentation(unit, options = {}) {
  if (!unit) {
    return unit;
  }
  if (Object.prototype.hasOwnProperty.call(options, "description")) {
    unit.descriptionOverride = options.description;
  }
  if (Object.prototype.hasOwnProperty.call(options, "tags")) {
    unit.tagsOverride = options.tags;
  }
  if (Object.prototype.hasOwnProperty.call(options, "name")) {
    unit.name = options.name;
  }
  return refreshUnitPresentation(unit);
}

function summonUnit(state, entry) {
  if (!(state?.battle && entry?.id && entry?.template && entry?.side)) {
    return null;
  }

  const existing = findUnit(state.battle, entry.id);
  if (existing) {
    if (!existing.alive) {
      reviveUnit(state, existing, "stage-event", null, entry.side);
    }
    return existing;
  }

  const [unit] = instantiateLineup(state, state.battle.stageId, [entry]);
  if (!unit) {
    return null;
  }

  if (entry.side === "player") {
    state.battle.playerUnits.push(unit);
    state.battle.playerUnits.sort((a, b) => a.slot - b.slot);
  } else {
    state.battle.enemyUnits.push(unit);
    state.battle.enemyUnits.sort((a, b) => a.slot - b.slot);
  }

  if (state.battle.stageRuntime?.stage3CooperationEnabled) {
    const enemyUnits = state.battle.enemyUnits
      .filter((current) => current.alive)
      .sort((a, b) => a.slot - b.slot);
    enemyUnits.forEach((current, index) => {
      const previous = enemyUnits[(index - 1 + enemyUnits.length) % enemyUnits.length];
      current.runtimeState = current.runtimeState || {};
      current.runtimeState.stage3CoopPartnerId = previous?.id || null;
    });
  }

  addLog(state, "hook", `${unit.name} 被召唤到战场。`, {
    unitId: unit.id,
    source: "stage-event",
  });
  return unit;
}

function buildBattle(stageId, state) {
  const stageDefinition = STAGE_DEFS[stageId];
  return {
    stageId: stageDefinition.stageId,
    title: stageDefinition.title,
    objective: stageDefinition.objective,
    enemyLogicText: clone(stageDefinition.enemyLogicText),
    enemyAi: stageDefinition.enemyAi,
    stageRuntime: clone(stageDefinition.runtimeState || {}),
    activeSkillUsage: {},
    status: "PLAYER_TURN",
    turn: 1,
    destroyedUnitIds: [],
    pendingTurnEffects: {
      overloadPower: null,
    },
    pendingEnemyAction: null,
    eventState: createBattleEventState(),
    lastEnemyAttackerId: null,
    lastPlayerAttackerId: null,
    lastCombatAttackerId: null,
    lastCombatDefenderId: null,
    playerUnits: instantiateLineup(state, stageId, stageDefinition.lineup.playerUnits),
    enemyUnits: instantiateLineup(state, stageId, stageDefinition.lineup.enemyUnits),
    actionLog: [
      {
        turn: 1,
        type: "system",
        text: stageDefinition.initialLogText,
      },
    ],
    guide: createGuideState(stageId),
  };
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

function resolvePriorityReferenceSide(reference) {
  if (!reference) {
    return null;
  }
  if (typeof reference === "string") {
    return reference;
  }
  return getControlSide(reference);
}

function priorityCompare(a, b, reference = null) {
  const referenceSide = resolvePriorityReferenceSide(reference);
  if (referenceSide) {
    const aIsEnemy = getControlSide(a) !== referenceSide;
    const bIsEnemy = getControlSide(b) !== referenceSide;
    if (aIsEnemy !== bIsEnemy) {
      return aIsEnemy ? -1 : 1;
    }
  }
  if (a.side !== b.side) {
    return a.side === "enemy" ? -1 : 1;
  }
  return a.slot - b.slot;
}

function sortBySlot(units) {
  return [...units].sort((a, b) => a.slot - b.slot);
}

function sortByPriority(units, reference = null) {
  return [...units].sort((a, b) => priorityCompare(a, b, reference));
}

function pickByPriority(units, reference = null) {
  return sortByPriority(units, reference)[0] || null;
}

function pickByPower(units, mode, reference = null) {
  if (!units.length) {
    return null;
  }
  const values = units.map((unit) => unit.power);
  const targetPower = mode === "highest" ? Math.max(...values) : Math.min(...values);
  return pickByPriority(units.filter((unit) => unit.power === targetPower), reference);
}

function alivePlayerUnits(state) {
  return getAllUnits(state.battle)
    .filter((unit) => unit.alive)
    .filter((unit) => getControlSide(unit) === "player");
}

function aliveEnemyUnits(state) {
  return getAllUnits(state.battle)
    .filter((unit) => unit.alive)
    .filter((unit) => getControlSide(unit) === "enemy");
}

function hasBuff(unit, buffKey) {
  return !!(unit?.buffs?.[buffKey] > 0);
}

function hasAnyBuff(unit) {
  return Object.values(unit?.buffs || {}).some((value) => value > 0);
}

function hasActiveVirus(unit) {
  return hasBuff(unit, VIRUS_BUFF) && !!unit?.runtimeState?.virusActivated;
}

function syncVirusActivationForUnit(state, unit) {
  if (!(state?.battle && unit && unit.alive && hasBuff(unit, VIRUS_BUFF))) {
    return false;
  }
  unit.runtimeState = unit.runtimeState || {};
  if (unit.runtimeState.virusActivated) {
    return true;
  }
  if (state.battle.turn >= unit.power) {
    unit.runtimeState.virusActivated = true;
    return true;
  }
  return false;
}

function syncVirusActivation(state) {
  if (!state?.battle) {
    return;
  }
  for (const unit of getAllUnits(state.battle)) {
    syncVirusActivationForUnit(state, unit);
  }
}

function getControlSide(unit) {
  if (!unit) {
    return null;
  }
  if (hasActiveVirus(unit)) {
    return unit.side === "enemy" ? "player" : "enemy";
  }
  return unit.side;
}

function isSameSupportCamp(unitA, unitB) {
  if (!(unitA && unitB)) {
    return false;
  }
  return getControlSide(unitA) === getControlSide(unitB);
}

function areHostile(unitA, unitB) {
  if (!(unitA && unitB) || unitA.id === unitB.id) {
    return false;
  }
  return getControlSide(unitA) !== getControlSide(unitB);
}

function getFriendlySupportUnits(state, self, controllerSide = self.side) {
  return getAllUnits(state.battle)
    .filter((unit) => unit.alive)
    .filter((unit) => getControlSide(unit) === controllerSide);
}

function getFriendlyUnitsByOriginalSide(state, self) {
  return getAllUnits(state.battle)
    .filter((unit) => (unit.baseSide ?? unit.side) === (self.baseSide ?? self.side));
}

function anyTargetHasBuff(state, self, buffKey) {
  return getAllUnits(state.battle)
    .some((unit) => unit.id !== self.id && unit.alive && hasBuff(unit, buffKey));
}

function canUnitBeTargetedBy(attacker, target) {
  if (!(attacker && attacker.alive && target && target.alive) || attacker.id === target.id) {
    return false;
  }
  if (getDisplayConfig(target).combatTargetable === false) {
    return false;
  }
  if (!hasActiveVirus(target)) {
    return true;
  }
  const originalEnemySide = target.side === "enemy" ? "player" : "enemy";
  return getControlSide(attacker) !== originalEnemySide;
}

function getStage3Stance(unit) {
  if (!unit) {
    return null;
  }
  if (unit.power >= 1 && unit.power <= 4) {
    return "upright";
  }
  if (unit.power >= 6 && unit.power <= 9) {
    return "reversed";
  }
  return "balanced";
}

function isStage3OppositeStance(unitA, unitB) {
  const stanceA = getStage3Stance(unitA);
  const stanceB = getStage3Stance(unitB);
  return (stanceA === "upright" && stanceB === "reversed")
    || (stanceA === "reversed" && stanceB === "upright");
}

function stage3InvertUnit(state, unit, sourceUnit = null) {
  if (!(unit && unit.alive)) {
    return false;
  }
  if (unit.runtimeState?.stage3InvertImmune) {
    addLog(state, "hook", `${unit.name} 免疫【真伪逆转】。`, {
      unitId: unit.id,
      sourceUnitId: sourceUnit?.id || null,
    });
    return false;
  }
  const originalPower = unit.power;
  unit.power = 10 - originalPower;
  addLog(state, "hook", `${unit.name} 触发【真伪逆转】，POWER 变为 ${unit.power}。`, {
    unitId: unit.id,
    sourceUnitId: sourceUnit?.id || null,
  });
  enforcePowerBounds(state, unit, {
    cause: "stage3-inversion",
    sourceUnitId: sourceUnit?.id || null,
  });
  return true;
}

function triggerStage3CarterOverflow(state, unit, sourceUnit = null) {
  if (!(unit?.runtimeState?.stage3CarterOverflow && unit.alive && unit.power > 10)) {
    return false;
  }
  addLog(state, "hook", `${unit.name} 的 POWER 超过 10，回廊失衡，所有单位被一并摧毁。`, {
    unitId: unit.id,
    sourceUnitId: sourceUnit?.id || null,
  });
  for (const current of getAllUnits(state.battle)) {
    if (current.alive) {
      destroyUnit(state, current, "stage3-carter-overflow", {
        sourceUnitId: unit.id,
      });
    }
  }
  return true;
}

function applyDirectPowerChange(state, unit, nextPower, options = {}) {
  if (!(unit && unit.alive) || !Number.isFinite(nextPower)) {
    return false;
  }
  if (unit.runtimeState?.stage3DirectPowerImmune && !options.ignoreDirectPowerImmunity) {
    addLog(state, "hook", `${unit.name} 免疫了这次直接改写 POWER 的效果。`, {
      unitId: unit.id,
      sourceUnitId: options.sourceUnitId || null,
    });
    return false;
  }
  unit.power = nextPower;
  triggerStage3CarterOverflow(state, unit, options.sourceUnit || null);
  return true;
}

function addDirectPower(state, unit, delta, options = {}) {
  return applyDirectPowerChange(state, unit, unit.power + delta, options);
}

function isStage3BuffNullified(state, sourceUnit) {
  if (!(state?.battle && sourceUnit)) {
    return false;
  }
  return (
    !!state.battle.stageRuntime?.stage3BuffNullifyActive
    && getControlSide(sourceUnit) === state.battle.stageRuntime?.stage3BuffNullifySide
  );
}

function clearStage3TurnScopedEffects(state) {
  if (!state?.battle?.stageRuntime) {
    return;
  }
  state.battle.stageRuntime.stage3BuffNullifyActive = false;
  state.battle.stageRuntime.stage3BuffNullifySide = null;
  state.battle.stageRuntime.stage3BuffNullifyTurn = null;
}

function recordStage3TimeLoopCandidate(state, unit) {
  if (!(state?.battle?.stageRuntime && unit?.alive)) {
    return;
  }
  const side = getControlSide(unit);
  const power = unit.power;
  if (!(side && Number.isFinite(power) && power >= 0 && power <= 9)) {
    return;
  }
  const stageRuntime = state.battle.stageRuntime;
  stageRuntime.stage3TimeLoopCandidates = stageRuntime.stage3TimeLoopCandidates || {
    player: [],
    enemy: [],
  };
  const bucket = stageRuntime.stage3TimeLoopCandidates[side];
  if (Array.isArray(bucket) && !bucket.includes(power)) {
    bucket.push(power);
    bucket.sort((a, b) => a - b);
  }
}

function resolveStage3CarterAscension(state, resultContext) {
  const battle = state?.battle;
  if (battle?.stageId !== "stage3-core") {
    return;
  }
  const attacker = resultContext?.attacker;
  const carter = findUnit(battle, "s3-alchemist-carter");
  if (!(attacker && carter && !carter.alive && attacker.id !== carter.id)) {
    return;
  }
  if (getControlSide(attacker) !== getControlSide(carter)) {
    return;
  }
  carter.basePower = (carter.basePower ?? carter.power ?? 0) + 1;
  carter.power = (carter.power ?? 0) + 1;
  triggerStage3CarterOverflow(state, carter, attacker);
  addLog(state, "hook", `${carter.name} 触发【升华】，POWER +1。`, {
    unitId: carter.id,
    sourceUnitId: attacker.id,
  });
}

function moveUnitToSide(state, unit, nextSide) {
  if (!unit || unit.side === nextSide) {
    return;
  }
  unit.side = nextSide;
}

function removeUnitFromBattle(state, unit) {
  if (!(state?.battle && unit?.id)) {
    return false;
  }
  const beforePlayer = state.battle.playerUnits.length;
  const beforeEnemy = state.battle.enemyUnits.length;
  state.battle.playerUnits = state.battle.playerUnits.filter((current) => current.id !== unit.id);
  state.battle.enemyUnits = state.battle.enemyUnits.filter((current) => current.id !== unit.id);
  return beforePlayer !== state.battle.playerUnits.length || beforeEnemy !== state.battle.enemyUnits.length;
}

function canPlayerCommand(unit) {
  if (!(unit && unit.alive)) {
    return false;
  }
  if (getControlSide(unit) !== "player") {
    return false;
  }
  return getDisplayConfig(unit).playerCommandable !== false;
}

function canEnemyCommand(unit) {
  if (!(unit && unit.alive)) {
    return false;
  }
  const display = getDisplayConfig(unit);
  if (display.enemyAiCommandable === false) {
    return false;
  }
  return getControlSide(unit) === "enemy" || display.enemyLikeForEnemyActor === true;
}

function canEnemyTreatAsPlayerTarget(unit) {
  if (!(unit && unit.alive)) {
    return false;
  }
  if (getControlSide(unit) !== "player") {
    return false;
  }
  return getDisplayConfig(unit).excludedFromEnemyAutoTarget !== true;
}

function canPlayerTargetEnemy(state, attacker, unit) {
  if (!(attacker && attacker.alive && unit && unit.alive) || attacker.id === unit.id) {
    return false;
  }
  const display = getDisplayConfig(unit);
  if (display.manualTargetable === false) {
    return false;
  }
  const targetRule = getUnitDefinitionForUnit(attacker).manualTargetRule;
  if (typeof targetRule === "function") {
    return !!targetRule(createRuntimeHelpers(), state, {
      self: attacker,
      target: unit,
    });
  }
  return areHostile(attacker, unit) || display.enemyLikeForPlayerTarget === true;
}

function getEnemyActorPool(state) {
  return getAllUnits(state.battle).filter((unit) => canEnemyCommand(unit));
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

function getHookBucket(unit) {
  return getUnitDefinitionForUnit(unit).hooks || EMPTY_HOOKS;
}

function applyBuff(state, buffKey, recipient, sourceUnit) {
  if (!recipient || !recipient.alive) {
    return false;
  }

  const buff = BUFF_CATALOG[buffKey];
  if (!buff) {
    return false;
  }

  const nullifyTurn = state?.battle?.stageRuntime?.stage3BuffNullifyTurn;
  const nullifySide = state?.battle?.stageRuntime?.stage3BuffNullifySide;
  if (
    nullifyTurn === state?.battle?.turn
    && sourceUnit
    && getControlSide(sourceUnit) === nullifySide
  ) {
    addLog(state, "hook", `${sourceUnit.name} 对 ${recipient.name} 施加的【${buff.shortLabel}】被本回合无效化。`, {
      unitId: sourceUnit.id,
      targetUnitId: recipient.id,
    });
    return false;
  }

  const currentValue = recipient.buffs[buffKey] || 0;
  if (!buff.stackable && currentValue > 0) {
    return false;
  }

  if (buffKey === "mark") {
    for (const unit of getAllUnits(state.battle)) {
      if (unit.id === recipient.id || !hasBuff(unit, buffKey)) {
        continue;
      }
      clearBuff(state, buffKey, unit, {
        text: `${unit.name} 身上的【${buff.shortLabel}】被新的【${buff.shortLabel}】替换。`,
      });
    }
  }

  recipient.buffs[buffKey] = buff.stackable ? currentValue + 1 : 1;

  if (buffKey === VIRUS_BUFF) {
    recipient.runtimeState = recipient.runtimeState || {};
    recipient.runtimeState.virusActivated = false;
    syncVirusActivationForUnit(state, recipient);
  }

  if (buffKey === EMP_BUFF) {
    recipient.power -= 3;
    addLog(state, "hook", `${recipient.name} 获得【${buff.shortLabel}】，POWER -3。`, {
      unitId: recipient.id,
      sourceUnitId: sourceUnit?.id || null,
    });
    enforcePowerBounds(state, recipient, { cause: buffKey, sourceUnitId: sourceUnit?.id || null });
    return true;
  }

  addLog(state, "hook", `${recipient.name} 获得【${buff.shortLabel}】。`, {
    unitId: recipient.id,
    sourceUnitId: sourceUnit?.id || null,
  });
  return true;
}

function clearBuff(state, buffKey, unit, options = {}) {
  if (!unit?.buffs || !unit.buffs[buffKey]) {
    return false;
  }
  unit.buffs[buffKey] = 0;
  if (buffKey === VIRUS_BUFF && unit.runtimeState) {
    delete unit.runtimeState.virusActivated;
  }
  if (!options.silent) {
    const buff = BUFF_CATALOG[buffKey];
    addLog(state, "hook", options.text || `${unit.name} 身上的【${buff.shortLabel}】消失。`, {
      unitId: unit.id,
    });
  }
  return true;
}

function transferUnitBuffs(state, source, target, caster = null) {
  if (!(source && target && source.alive && target.alive) || source.id === target.id) {
    return;
  }

  for (const buff of Object.values(BUFF_CATALOG)) {
    const count = source.buffs?.[buff.key] || 0;
    if (count <= 0) {
      continue;
    }

    if (buff.key === EMP_BUFF) {
      source.buffs[buff.key] = 0;
      source.power += 3 * count;
      addLog(state, "hook", `${source.name} 身上的【${buff.shortLabel}】被重组转移给 ${target.name}，POWER +${3 * count}。`, {
        unitId: source.id,
        targetUnitId: target.id,
        sourceUnitId: caster?.id || null,
      });
      for (let index = 0; index < count; index += 1) {
        applyBuff(state, EMP_BUFF, target, caster || source);
      }
      continue;
    }

    clearBuff(state, buff.key, source, { silent: true });

    if (!buff.stackable) {
      if (!hasBuff(target, buff.key)) {
        applyBuff(state, buff.key, target, caster || source);
      }
      continue;
    }

    for (let index = 0; index < count; index += 1) {
      applyBuff(state, buff.key, target, caster || source);
    }
  }
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
  runHooks("onUnitDestroyed", state, { ...payload, reason, destroyedUnit: unit });

  if (unit.buffs[EMP_BUFF] > 0 && unit.combat.lastBattleUnitId) {
    const lastBattleUnit = findUnit(state.battle, unit.combat.lastBattleUnitId);
    if (lastBattleUnit && lastBattleUnit.alive) {
      addLog(state, "hook", `${unit.name} 身上的【${BUFF_CATALOG[EMP_BUFF].shortLabel}】传递给 ${lastBattleUnit.name}。`, {
        unitId: unit.id,
        targetUnitId: lastBattleUnit.id,
      });
      applyBuff(state, EMP_BUFF, lastBattleUnit, unit);
    }
  }

  if (unit.runtimeState?.removeOnDestroyed) {
    removeUnitFromBattle(state, unit);
  }
}

function reviveUnit(state, unit, reason, sourceUnit = null, forcedSide = null) {
  if (!unit || unit.alive) {
    return false;
  }
  const wasVirusCarrier = hasActiveVirus(unit);
  const nextSide = forcedSide || (wasVirusCarrier ? (unit.side === "enemy" ? "player" : "enemy") : unit.side);
  unit.alive = true;
  unit.destroyedAtTurn = null;
  unit.power = unit.basePower;
  unit.buffs = createBuffState();
  unit.combat.lastBattleUnitId = null;
  unit.runtimeState = clone(getUnitDefinitionForUnit(unit).runtimeState || {});
  moveUnitToSide(state, unit, nextSide);
  refreshUnitPresentation(unit);

  addLog(state, "hook", `${unit.name} 被重新激活。`, {
    unitId: unit.id,
    reason,
    sourceUnitId: sourceUnit?.id || null,
  });
  return true;
}

function enforcePowerBounds(state, unit, detail = {}) {
  if (!unit || !unit.alive) {
    return;
  }

  syncVirusActivationForUnit(state, unit);

  const maxPower = unit.runtimeState?.allowPower10 ? 10 : 9;
  if (unit.power < 0 || unit.power > maxPower) {
    addLog(state, "rule", `${unit.name} 的 POWER 变为 ${unit.power}，越界摧毁。`, {
      unitId: unit.id,
      value: unit.power,
      ...detail,
    });
    destroyUnit(state, unit, detail.cause || "power-out-of-range", detail);
  }
}

function createRuntimeHelpers() {
  return {
    addLog,
    addDirectPower,
    anyTargetHasBuff,
    applyBuff,
    applyDirectPowerChange,
    areHostile,
    canUnitBeTargetedBy,
    clearBuff,
    destroyedCount,
    destroyUnit,
    enforcePowerBounds,
    findUnit,
    getAllUnits,
    getControlSide,
    getFriendlySupportUnits,
    getFriendlyUnitsByOriginalSide,
    getPreviousCombatAttacker,
    getPreviousCombatDefender,
    getStage3Stance,
    hasAnyBuff,
    hasBuff,
    isStage3BuffNullified,
    isSameSupportCamp,
    pickByPower,
    pickByPriority,
    copyAbility,
    reviveUnit,
    removeUnitFromBattle,
    settleCombatOutcome,
    stage3InvertUnit,
    isStage3OppositeStance,
    summonUnit,
    swapAbilities,
    updateUnitPresentation,
    setEnemyLogicText,
  };
}

function runHooks(hookName, state, payload, units = null) {
  const runtime = createRuntimeHelpers();
  let sourcePool = units || getAllUnits(state.battle);

  if (!units && hookName === "afterCombat") {
    const participantIds = new Set([
      payload?.attacker?.id,
      payload?.defender?.id,
    ].filter(Boolean));
    sourcePool = sourcePool.filter((unit) => unit.alive || participantIds.has(unit.id));
  } else if (!units && hookName === "beforeCombat") {
    const participantIds = new Set([
      payload?.attacker?.id,
      payload?.defender?.id,
    ].filter(Boolean));
    const participants = [payload?.attacker, payload?.defender]
      .filter((unit) => unit && unit.alive);
    const others = sourcePool
      .filter((unit) => unit.alive)
      .filter((unit) => !participantIds.has(unit.id));
    sourcePool = [...participants, ...sortByPriority(others)];
  } else if (!units) {
    sourcePool = sourcePool.filter((unit) => unit.alive);
  }

  const pool = sortByPriority(sourcePool);
  for (const unit of pool) {
    const hooks = getHookBucket(unit)[hookName] || [];
    for (const hook of hooks) {
      hook(runtime, state, { ...payload, self: unit });
    }
  }
}

function swapAbilities(state, unitA, unitB) {
  const abilityCodeA = unitA.abilityCode;
  const abilityCodeB = unitB.abilityCode;
  const stateA = clone(unitA.runtimeState || {});
  const stateB = clone(unitB.runtimeState || {});

  unitA.abilityCode = abilityCodeB;
  unitB.abilityCode = abilityCodeA;
  unitA.runtimeState = stateB;
  unitB.runtimeState = stateA;

  refreshUnitPresentation(unitA);
  refreshUnitPresentation(unitB);

  addLog(state, "hook", `${unitA.name} 与 ${unitB.name} 交换了能力。`, {
    unitId: unitA.id,
    targetUnitId: unitB.id,
  });
}

function copyAbility(state, recipient, sourceUnit) {
  if (!(recipient && sourceUnit)) {
    return;
  }

  recipient.abilityCode = sourceUnit.abilityCode;
  recipient.runtimeState = clone(
    sourceUnit.runtimeState || getUnitDefinitionForUnit(sourceUnit).runtimeState || {}
  );
  refreshUnitPresentation(recipient);

  addLog(state, "hook", `${recipient.name} 复制了 ${sourceUnit.name} 的能力。`, {
    unitId: recipient.id,
    targetUnitId: sourceUnit.id,
  });
}

function getCombatPower(unit, state, context) {
  let currentPower = unit.power;
  const runtime = createRuntimeHelpers();
  const hooks = getHookBucket(unit).modifyCombatPower || [];
  for (const hook of hooks) {
    currentPower = hook(runtime, state, { ...context, self: unit, currentPower });
  }
  const opponent = context?.attacker?.id === unit.id ? context?.defender : context?.attacker;
  const opponentFixedPower = opponent?.runtimeState?.opponentPowerFixed;
  if (Number.isFinite(opponentFixedPower)) {
    currentPower = opponentFixedPower;
  }
  return currentPower;
}

function preventCombatDestruction(state, threatenedUnit, context) {
  const runtime = createRuntimeHelpers();
  for (const unit of sortByPriority(getAllUnits(state.battle).filter((current) => current.alive))) {
    const hooks = getHookBucket(unit).preventCombatDestruction || [];
    for (const hook of hooks) {
      if (hook(runtime, state, { ...context, self: unit, threatenedUnit })) {
        return true;
      }
    }
  }
  return false;
}

function getCombatPreviewBonus(unit, state) {
  let bonus = 0;
  const runtime = createRuntimeHelpers();
  const hooks = getHookBucket(unit).previewCombatBonus || [];
  for (const hook of hooks) {
    bonus += hook(runtime, state, { self: unit }) || 0;
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

function maybeResolveStage3Cooperation(state, resultContext) {
  const battle = state?.battle;
  const stageRuntime = battle?.stageRuntime || {};
  if (!stageRuntime.stage3CooperationEnabled) {
    return;
  }

  const attacker = resultContext?.attacker;
  const defender = resultContext?.defender;
  if (!(attacker && defender && defender.alive)) {
    return;
  }

  const partnerId = attacker.runtimeState?.stage3CoopPartnerId;
  const partner = findUnit(battle, partnerId);
  if (!(partner && partner.alive)) {
    return;
  }

  const stance = resultContext?.attackerStage3Stance
    || attacker.runtimeState?.stage3LastStance
    || getStage3Stance(attacker);
  if (stance === "balanced") {
    return;
  }

  const visited = new Set(resultContext?.coopVisited || []);
  if (visited.has(partner.id)) {
    return;
  }

  const partnerStance = getStage3Stance(partner);
  let canTrigger = (stance === "upright" && partnerStance === "reversed")
    || (stance === "reversed" && partnerStance === "upright");
  const forceCoopKey = `stage3ForceCoopTurn${battle.turn}`;
  if (!canTrigger && stageRuntime.stage3ForceFirstFailedCoop && !stageRuntime[forceCoopKey]) {
    canTrigger = true;
    stageRuntime[forceCoopKey] = true;
    addLog(state, "hook", `【TURN10】强制触发了 ${partner.name} 的首次失败协同攻击。`, {
      unitId: partner.id,
      sourceUnitId: attacker.id,
      targetUnitId: defender.id,
    });
  }

  if (!canTrigger) {
    return;
  }

  visited.add(attacker.id);
  visited.add(partner.id);
  addLog(state, "hook", `${attacker.name} 触发协同攻击，${partner.name} 追击同一目标。`, {
    unitId: attacker.id,
    sourceUnitId: partner.id,
    targetUnitId: defender.id,
  });
  state.battle.pendingEnemyAction = createPendingAction(state, {
    kind: "stage3-coop",
    attackerId: partner.id,
    defenderId: defender.id,
    source: "stage3-coop",
    controllerSide: getControlSide(partner),
    coopVisited: [...visited],
  }, "enemy");
}

function applyStage3TimeLoops(state, fullContext) {
  const holders = getAllUnits(state.battle)
    .filter((unit) => unit.alive)
    .filter((unit) => Array.isArray(unit.runtimeState?.stage3TimeLoops) && unit.runtimeState.stage3TimeLoops.length > 0);

  if (!holders.length) {
    return;
  }

  const participants = [fullContext.attacker, fullContext.defender]
    .filter((unit) => unit && unit.alive && getControlSide(unit) === "player");

  for (const holder of holders) {
    const doomed = participants.find((unit) => holder.runtimeState.stage3TimeLoops.includes(unit.power));
    if (!doomed) {
      continue;
    }
    fullContext.combatControl.skipResolution = true;
    addLog(state, "hook", `${holder.name} 的【时空闭环 ${doomed.power}】使 ${doomed.name} 在本场战斗中直接失败。`, {
      unitId: holder.id,
      targetUnitId: doomed.id,
    });
    setPendingDefeat(state, {
      outcome: "defeat",
      stageId: state.battle.stageId,
      reason: `${holder.name} 的【时空闭环】已直接导致战斗失败。`,
      triggerSource: "stage3-time-loop",
    });
    return;
  }
}

function settleCombatOutcome(state, context) {
  const attacker = context.attacker;
  const defender = context.defender;
  if (!(attacker && defender && attacker.alive && defender.alive)) {
    return null;
  }

  const previousAttacker = getPreviousCombatAttacker(state);
  const previousDefender = getPreviousCombatDefender(state);

  attacker.combat.battlesFought += 1;
  defender.combat.battlesFought += 1;
  attacker.combat.lastBattleUnitId = defender.id;
  defender.combat.lastBattleUnitId = attacker.id;

  const fullContext = {
    ...context,
    attacker,
    defender,
    attackerStage3Stance: getStage3Stance(attacker),
    defenderStage3Stance: getStage3Stance(defender),
    previousAttacker,
    previousDefender,
    combatControl: {
      skipResolution: false,
    },
  };

  runHooks("beforeCombat", state, fullContext);
  applyStage3TimeLoops(state, fullContext);

  const attackerPower = attacker.alive ? getCombatPower(attacker, state, fullContext) : attacker.power;
  const defenderPower = defender.alive ? getCombatPower(defender, state, fullContext) : defender.power;
  recordStage3TimeLoopCandidate(state, attacker);

  addLog(state, "combat", `${attacker.name} 攻击 ${defender.name}。`, {
    attackerId: attacker.id,
    defenderId: defender.id,
    attackerPower,
    defenderPower,
    source: context.source || null,
  });

  let attackerDestroyed = !attacker.alive;
  let defenderDestroyed = !defender.alive;

  if (fullContext.combatControl.skipResolution) {
    attackerDestroyed = !attacker.alive;
    defenderDestroyed = !defender.alive;
  } else if (attacker.alive && defender.alive) {
    if (attackerPower === defenderPower) {
      attackerDestroyed = true;
      defenderDestroyed = true;
    } else if (attackerPower > defenderPower) {
      defenderDestroyed = true;
    } else {
      attackerDestroyed = true;
    }
  }

  if (attackerDestroyed && attacker.alive && preventCombatDestruction(state, attacker, fullContext)) {
    attackerDestroyed = false;
  }
  if (defenderDestroyed && defender.alive && preventCombatDestruction(state, defender, fullContext)) {
    defenderDestroyed = false;
  }

  if (attackerDestroyed && attacker.alive) {
    destroyUnit(state, attacker, "combat", { ...fullContext, opponent: defender });
  }
  if (defenderDestroyed && defender.alive) {
    destroyUnit(state, defender, "combat", { ...fullContext, opponent: attacker });
  }

  if (!attacker.alive && defender.alive) {
    defender.combat.kills += 1;
  }
  if (!defender.alive && attacker.alive) {
    attacker.combat.kills += 1;
  }

  const resultContext = {
    ...fullContext,
    attackerPower,
    defenderPower,
    attackerDestroyed,
    defenderDestroyed,
  };

  state.battle.lastCombatAttackerId = attacker.id;
  state.battle.lastCombatDefenderId = defender.id;
  runHooks("afterCombat", state, resultContext);
  resolveStage3CarterAscension(state, resultContext);
  maybeResolveStage3Cooperation(state, resultContext);

  for (const unit of getAllUnits(state.battle)) {
    if (unit.alive) {
      enforcePowerBounds(state, unit, { cause: "post-combat-check" });
    }
  }

  return resultContext;
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
    state.battle.pendingEnemyAction = null;
  }
  state.finalResults = results;
}

function setPendingDefeat(state, results) {
  state.phase = "DEFEAT";
  if (state.battle) {
    state.battle.status = "FAILED";
    state.battle.pendingTurnEffects.overloadPower = null;
    state.battle.pendingEnemyAction = null;
  }
  state.pendingDefeat = results;
}

function buildEnemyAiContext(state) {
  return {
    state,
    findUnit,
    getAllUnits,
    sortBySlot,
    sortByPriority,
    pickByPriority,
    pickByPower,
    hasBuff,
    hasAnyBuff,
    canEnemyCommand,
    canUnitBeTargetedBy,
    canEnemyTreatAsPlayerTarget,
    getEnemyActorPool: () => getEnemyActorPool(state),
    aliveEnemyUnits: () => aliveEnemyUnits(state),
    alivePlayerUnits: () => alivePlayerUnits(state),
    getFriendlySupportUnits,
  };
}

function resolveEnemyOpeningStrike(state) {
  if (!state.battle) {
    return;
  }

  state.battle.pendingEnemyAction = null;

  const result = resolveEnemyAction(state.battle.enemyAi, buildEnemyAiContext(state));

  if (!result.action) {
    addLog(state, "enemy", result.noActionText || "本回合没有敌方行动。", {
      attackerId: null,
      targetUnitId: state.battle.lastPlayerAttackerId || null,
    });
    return;
  }

  const attacker = findUnit(state.battle, result.action.attackerId);
  const defender = findUnit(state.battle, result.action.defenderId);

  state.battle.lastEnemyAttackerId = attacker?.id || null;
  addLog(state, "enemy", result.announceText || `${attacker?.name || "敌方单位"} 锁定 ${defender?.name || "目标"}。`, {
    attackerId: attacker?.id || null,
    targetUnitId: defender?.id || null,
  });

  state.battle.pendingEnemyAction = createPendingAction(state, result.action, "enemy");
}

function createPendingAction(state, action, sequenceOwner) {
  if (action.kind === "gateway-burst") {
    return {
      key: `${state.battle.turn}-${action.attackerId}-${action.defenderId}-gateway-announce`,
      kind: "gateway-sequence",
      phase: "announce",
      gatewayId: action.attackerId,
      attackerId: action.attackerId,
      defenderId: action.defenderId,
      supportIds: clone(action.supportIds || []),
      supportIndex: -1,
      controllerSide: action.controllerSide || "enemy",
      source: action.source || "enemy-open-strike",
      sequenceOwner,
      dashed: true,
    };
  }

  if (action.kind === "stage3-coop") {
    return {
      key: `${state.battle.turn}-${action.attackerId}-${action.defenderId}-stage3-coop`,
      sequenceOwner,
      dashed: false,
      ...clone(action),
    };
  }

  return {
    key: `${state.battle.turn}-${action.attackerId}-${action.defenderId}-${action.kind}`,
    sequenceOwner,
    dashed: false,
    ...clone(action),
  };
}

function findNextGatewaySupport(state, pendingAction, startIndex) {
  const supportIds = pendingAction.supportIds || [];
  for (let index = startIndex; index < supportIds.length; index += 1) {
    const support = findUnit(state.battle, supportIds[index]);
    if (support && support.alive) {
      return { support, index };
    }
  }
  return null;
}

function finishGatewaySequence(state, pendingAction, gateway, target) {
  if (gateway?.alive) {
    runHooks("afterCombat", state, {
      attacker: gateway,
      defender: target,
      source: pendingAction.source || "enemy-open-strike",
      gatewayBurst: true,
      controllerSide: pendingAction.controllerSide || gateway.side,
    }, [gateway]);
  }
  return { completed: true };
}

function advanceGatewaySequence(state, pendingAction) {
  const gateway = findUnit(state.battle, pendingAction.gatewayId || pendingAction.attackerId);
  const target = findUnit(state.battle, pendingAction.defenderId);

  if (!(gateway && gateway.alive)) {
    return { completed: true };
  }

  if (pendingAction.phase === "announce") {
    if (target?.alive) {
      runHooks("beforeCombat", state, {
        attacker: gateway,
        defender: target,
        source: pendingAction.source || "enemy-open-strike",
        controllerSide: pendingAction.controllerSide || gateway.side,
      }, [gateway]);
    }

    const nextSupport = target?.alive
      ? findNextGatewaySupport(state, pendingAction, 0)
      : null;

    if (!nextSupport || !target?.alive) {
      return finishGatewaySequence(state, pendingAction, gateway, target);
    }

    state.battle.pendingEnemyAction = {
      ...pendingAction,
      key: `${state.battle.turn}-${gateway.id}-${target.id}-gateway-${nextSupport.index}`,
      phase: "support",
      attackerId: nextSupport.support.id,
      supportIndex: nextSupport.index,
      dashed: false,
    };
    return { completed: false };
  }

  const currentSupport = findUnit(state.battle, pendingAction.attackerId);
  if (currentSupport?.alive && target?.alive) {
    settleCombatOutcome(state, {
      attacker: currentSupport,
      defender: target,
      source: pendingAction.sequenceOwner === "player" ? "player-gateway-chain" : "enemy-gateway-chain",
      controllerId: gateway.id,
      controllerSide: pendingAction.controllerSide || gateway.side,
    });
  }

  const nextSupport = target?.alive
    ? findNextGatewaySupport(state, pendingAction, (pendingAction.supportIndex || 0) + 1)
    : null;

  if (nextSupport && target?.alive) {
    state.battle.pendingEnemyAction = {
      ...pendingAction,
      key: `${state.battle.turn}-${gateway.id}-${target.id}-gateway-${nextSupport.index}`,
      phase: "support",
      attackerId: nextSupport.support.id,
      supportIndex: nextSupport.index,
      dashed: false,
    };
    return { completed: false };
  }

  return finishGatewaySequence(state, pendingAction, gateway, target);
}

function executePendingEnemyAction(state, pendingAction) {
  if (pendingAction.kind === "gateway-sequence") {
    return advanceGatewaySequence(state, pendingAction);
  }

  if (pendingAction.kind === "stage3-coop") {
    const attacker = findUnit(state.battle, pendingAction.attackerId);
    const defender = findUnit(state.battle, pendingAction.defenderId);
    if (!(attacker && attacker.alive && defender && defender.alive)) {
      return { completed: true };
    }

    settleCombatOutcome(state, {
      attacker,
      defender,
      overloadPower: null,
      source: pendingAction.source || "stage3-coop",
      controllerSide: pendingAction.controllerSide || attacker.side,
      coopVisited: clone(pendingAction.coopVisited || []),
    });
    return { completed: true };
  }

  const attacker = findUnit(state.battle, pendingAction.attackerId);
  const defender = findUnit(state.battle, pendingAction.defenderId);
  if (!(attacker && attacker.alive && defender && defender.alive)) {
    return { completed: true };
  }

  settleCombatOutcome(state, {
    attacker,
    defender,
    overloadPower: null,
    source: pendingAction.source || "enemy-open-strike",
    controllerSide: pendingAction.controllerSide || attacker.side,
  });
  return { completed: true };
}

function clearTurnEndBuffs(state) {
  if (!state.battle) {
    return;
  }

  for (const unit of getAllUnits(state.battle)) {
    if (!unit.alive) {
      continue;
    }
    for (const buff of Object.values(BUFF_CATALOG)) {
      if (buff.timing !== "turn-end" || !hasBuff(unit, buff.key)) {
        continue;
      }
      clearBuff(state, buff.key, unit);
    }
  }
}

function getStageBattleEvents(state) {
  const stageId = state?.battle?.stageId;
  return STAGE_DEFS[stageId]?.battleEvents || [];
}

function activateNextBattleEvent(state) {
  const eventState = state?.battle?.eventState;
  if (!eventState || eventState.active || !eventState.queue.length) {
    return;
  }
  eventState.active = eventState.queue.shift();
}

function queueBattleEvent(state, eventDefinition) {
  const eventState = state?.battle?.eventState;
  if (!eventState || !eventDefinition) {
    return;
  }
  const pages = clone(eventDefinition.pages || []);
  if (!pages.length) {
    return;
  }
  eventState.queue.push({
    key: eventDefinition.key,
    pages,
    index: 0,
  });
}

function matchBattleEvent(eventDefinition, trigger, turn) {
  if (!eventDefinition || eventDefinition.trigger !== trigger) {
    return false;
  }
  if (typeof eventDefinition.turn === "number") {
    return eventDefinition.turn === turn;
  }
  return true;
}

function runStageBattleEvents(state, trigger) {
  if (!state?.battle) {
    return;
  }

  const turn = state.battle.turn || 1;
  const eventState = state.battle.eventState || createBattleEventState();
  state.battle.eventState = eventState;
  const runtime = createRuntimeHelpers();

  for (const eventDefinition of getStageBattleEvents(state)) {
    if (eventState.triggeredKeys.includes(eventDefinition.key)) {
      continue;
    }
    if (!matchBattleEvent(eventDefinition, trigger, turn)) {
      continue;
    }
    eventState.triggeredKeys.push(eventDefinition.key);
    if (typeof eventDefinition.apply === "function") {
      eventDefinition.apply(runtime, state, eventDefinition);
    }
    queueBattleEvent(state, eventDefinition);
  }

  activateNextBattleEvent(state);
}

function runStageTurnStartHooks(state) {
  if (!state?.battle) {
    return;
  }
  const handler = STAGE_DEFS[state.battle.stageId]?.onTurnStart;
  if (typeof handler === "function") {
    handler(createRuntimeHelpers(), state);
  }
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

function getStoryPageBackground(page, fallback = "default") {
  return page?.background || fallback;
}

function getFlowEntry(state, flowIndex) {
  let nextIndex = flowIndex;
  while (FLOW[nextIndex] && FLOW[nextIndex].requiresMode && FLOW[nextIndex].requiresMode !== state.campaign.mode) {
    nextIndex += 1;
  }
  return {
    entry: FLOW[nextIndex] || null,
    flowIndex: nextIndex,
  };
}

function moveToFlow(state, flowIndex) {
  const resolved = getFlowEntry(state, flowIndex);
  const entry = resolved.entry;
  state.flowIndex = resolved.flowIndex;
  state.pendingDefeat = null;
  state.finalResults = null;

  if (!entry) {
    state.phase = "VICTORY";
    thisEnd(state, {
      outcome: "victory",
      stageId: STAGE_3_ID,
      survivors: [],
      triggerSource: "flow-end",
    });
    return;
  }

  if (entry.type === "story") {
    state.phase = "STORY";
    state.story = buildStoryState(entry.sceneId);
    state.storyBackground = getStoryPageBackground(state.story.pages[0], state.storyBackground || "default");
    state.battle = null;
    return;
  }

  state.phase = "BATTLE";
  state.story = null;
  state.battle = buildBattle(entry.stageId, state);
  syncCurrentGuideRules(state);
  runStageTurnStartHooks(state);
  runStageBattleEvents(state, "turn-start");
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

    if (state.battle.stageId === STAGE_1_ID) {
      uniquePush(state.campaign.clearedStages, STAGE_1_ID);
      state.campaign.ratings[STAGE_1_ID] = calculateStage1Rating(state);
      moveToFlow(state, state.flowIndex + 1);
      return true;
    }

    uniquePush(state.campaign.clearedStages, state.battle.stageId === STAGE_3_ID ? STAGE_3_ID : STAGE_2_ID);
    moveToFlow(state, state.flowIndex + 1);
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

  addLog(state, "guide", "水铃儿提醒：先让影子去攻击监视工蜂。");
  return false;
}

function getUnitActiveSkill(unit, skillKey) {
  return getUnitDefinitionForUnit(unit).activeSkills?.find((skill) => skill.key === skillKey) || null;
}

function hasUsedActiveSkill(state, skillKey) {
  return !!state?.battle?.activeSkillUsage?.[skillKey];
}

module.exports = class LibraryRun1Runtime extends BaseGame {
  setup() {
    const state = {
      phase: "STORY",
      flowIndex: 0,
      story: null,
      storyBackground: "default",
      modeSelectResume: null,
      campaign: {
        mode: null,
        overloadUsed: false,
        clearedStages: [],
        ratings: {},
        revealedTips: {},
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

    if (state.phase === "BATTLE") {
      syncVirusActivation(state);
    }

    if (state.finalResults) {
      return state;
    }

    if (action === "next-battle-event") {
      if (state.phase !== "BATTLE" || !state.battle?.eventState?.active) {
        return state;
      }
      const activeEvent = state.battle.eventState.active;
      if (activeEvent.index < activeEvent.pages.length - 1) {
        activeEvent.index += 1;
      } else {
        state.battle.eventState.active = null;
        activateNextBattleEvent(state);
        if (!state.battle.eventState.active) {
          evaluateBattleState(state, "battle-event");
        }
      }
      return state;
    }

    if (state.phase === "BATTLE" && state.battle?.eventState?.active) {
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
      previous.campaign.revealedTips = clone(state.campaign.revealedTips || {});
      return previous;
    }

    if (action === "reveal-tip") {
      if (state.phase !== "BATTLE" || !state.battle) {
        return state;
      }

      const stageId = state.battle.stageId;
      const tipId = data?.tipId;
      const tip = getTipsForStage(stageId).find((item) => item.id === tipId);
      if (!tip || !canRevealTip(state, stageId, tip)) {
        return state;
      }

      const revealedTips = state.campaign.revealedTips || {};
      const currentStageTips = new Set(revealedTips[stageId] || []);
      currentStageTips.add(tipId);
      revealedTips[stageId] = [...currentStageTips];
      state.campaign.revealedTips = revealedTips;
      return state;
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
      if (state.story.sceneId === "tutorial-pre" && state.story.index === 0 && !state.campaign.mode) {
        state.phase = "MODE_SELECT";
        state.modeSelectResume = {
          sceneId: "tutorial-pre",
          index: 1,
        };
        state.battle = null;
        return state;
      }
      if (state.story.index < state.story.pages.length - 1) {
        state.story.index += 1;
        state.storyBackground = getStoryPageBackground(
          state.story.pages[state.story.index],
          state.storyBackground || "default"
        );
      } else {
        moveToFlow(state, state.flowIndex + 1);
        if (state.phase === "BATTLE") {
          addLog(state, "system", "剧情结束，进入战斗。");
        }
      }
      return state;
    }

    if (action === "select-mode") {
      if (state.phase !== "MODE_SELECT") {
        return state;
      }
      if (!(data?.mode === "story" || data?.mode === "challenge")) {
        return state;
      }
      state.campaign.mode = data.mode;
      const jumpIndex = Object.prototype.hasOwnProperty.call(FLOW_JUMP_TARGETS, data?.jumpTarget)
        ? FLOW_JUMP_TARGETS[data.jumpTarget]
        : null;
      if (typeof jumpIndex === "number") {
        state.modeSelectResume = null;
        moveToFlow(state, jumpIndex);
      } else if (state.modeSelectResume) {
        state.phase = "STORY";
        state.story = buildStoryState(state.modeSelectResume.sceneId);
        state.story.index = state.modeSelectResume.index;
        state.storyBackground = getStoryPageBackground(
          state.story.pages[state.story.index],
          state.storyBackground || "default"
        );
        state.modeSelectResume = null;
      } else {
        moveToFlow(state, state.flowIndex + 1);
      }
      state.history = [];
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
      if (state.phase !== "BATTLE" || !state.battle || !state.battle.pendingEnemyAction) {
        return state;
      }

      pushHistory(state);

      const pendingAction = clone(state.battle.pendingEnemyAction);
      state.battle.pendingEnemyAction = null;

      executePendingEnemyAction(state, pendingAction);

      if (state.battle.pendingEnemyAction) {
        state.battle.status = "ENEMY_CONFIRM";
        return state;
      }

      const step = currentGuideStep(state);
      if (step?.mode === "confirm") {
        advanceGuide(state);
      }

      if (pendingAction.sequenceOwner === "player") {
        state.battle.pendingTurnEffects.overloadPower = null;

        if (evaluateBattleState(state, pendingAction.source || "player-attack")) {
          if (state.finalResults) {
            this.end(state.finalResults);
          }
          return state;
        }

        state.battle.turn += 1;
        syncVirusActivation(state);
        state.battle.status = "ENEMY_OPENING";
        resolveEnemyOpeningStrike(state);

        if (state.battle.pendingEnemyAction) {
          state.battle.status = "ENEMY_CONFIRM";
          return state;
        }

        if (evaluateBattleState(state, "enemy-open-strike")) {
          if (state.finalResults) {
            this.end(state.finalResults);
          }
          return state;
        }

        clearTurnEndBuffs(state);
        clearStage3TurnScopedEffects(state);
        state.battle.status = "PLAYER_TURN";
        addLog(state, "system", `第 ${state.battle.turn} 回合开始。`);
        runStageTurnStartHooks(state);
        runStageBattleEvents(state, "turn-start");
        return state;
      }

      if (evaluateBattleState(state, pendingAction.source || "enemy-open-strike")) {
        if (state.finalResults) {
          this.end(state.finalResults);
        }
        return state;
      }

      clearTurnEndBuffs(state);
      clearStage3TurnScopedEffects(state);
      state.battle.status = "PLAYER_TURN";
      addLog(state, "system", `第 ${state.battle.turn} 回合开始。`);
      runStageTurnStartHooks(state);
      runStageBattleEvents(state, "turn-start");
      return state;
    }

    if (action === "space-reorg") {
      if (state.phase !== "BATTLE" || state.battle.status !== "PLAYER_TURN" || state.battle.pendingEnemyAction) {
        return state;
      }

      const caster = findUnit(state.battle, data?.casterId);
      const source = findUnit(state.battle, data?.sourceId);
      const target = findUnit(state.battle, data?.targetId);
      const amount = Number(data?.amount);
      const skill = getUnitActiveSkill(caster, "space-reorg");

      if (!skill || hasUsedActiveSkill(state, skill.key)) {
        return state;
      }

      if (
        !canPlayerCommand(caster)
        || !source?.alive
        || !target?.alive
        || source.id === target.id
        || getControlSide(source) !== "player"
      ) {
        return state;
      }

      const maxTransfer = Math.max(0, source.power);
      if (!Number.isInteger(amount) || amount < 0 || amount > maxTransfer) {
        return state;
      }

      pushHistory(state);

      applyDirectPowerChange(state, source, source.power - amount, {
        sourceUnit: caster,
        sourceUnitId: caster.id,
      });
      applyDirectPowerChange(state, target, target.power + amount, {
        sourceUnit: caster,
        sourceUnitId: caster.id,
      });
      transferUnitBuffs(state, source, target, caster);
      state.battle.activeSkillUsage[skill.key] = true;

      addLog(state, "skill", `${caster.name} 发动【${skill.label}】。`, {
        unitId: caster.id,
        sourceUnitId: source.id,
        targetUnitId: target.id,
        amount,
      });
      addLog(state, "hook", `${source.name} 向 ${target.name} 转移了 ${amount} 点 POWER。`, {
        unitId: source.id,
        targetUnitId: target.id,
        amount,
      });

      enforcePowerBounds(state, source, { cause: "space-reorg", sourceUnitId: caster.id });
      enforcePowerBounds(state, target, { cause: "space-reorg", sourceUnitId: caster.id });
      evaluateBattleState(state, "space-reorg");
      return state;
    }

    if (action === "time-elapse") {
      const pendingAction = state?.battle?.pendingEnemyAction;
      const isSkippableEnemyConfirm = !!(
        state.phase === "BATTLE"
        && state.battle.status === "ENEMY_CONFIRM"
        && pendingAction
        && pendingAction.sequenceOwner !== "player"
        && !(pendingAction.kind === "gateway-sequence" && pendingAction.phase === "support")
      );

      if (!isSkippableEnemyConfirm) {
        return state;
      }

      const caster = findUnit(state.battle, data?.casterId);
      const skill = getUnitActiveSkill(caster, "time-elapse");

      if (!skill || !canPlayerCommand(caster) || !caster?.alive || hasUsedActiveSkill(state, skill.key)) {
        return state;
      }

      pushHistory(state);

      addLog(state, "skill", `${caster.name} 发动【${skill.label}】。`, {
        unitId: caster.id,
      });
      state.battle.activeSkillUsage[skill.key] = true;

      const skippedAttackerId = pendingAction.attackerId || pendingAction.gatewayId || null;
      state.battle.stageRuntime = state.battle.stageRuntime || {};
      state.battle.stageRuntime.timeElapseSkippedUnitId = skippedAttackerId;
      state.battle.pendingEnemyAction = null;

      if (skippedAttackerId) {
        const skippedUnit = findUnit(state.battle, skippedAttackerId);
        addLog(state, "hook", `时间流逝跳过了 ${skippedUnit?.name || "该单位"} 的本轮行动。`, {
          unitId: skippedAttackerId,
          sourceUnitId: caster.id,
        });
      }

      clearTurnEndBuffs(state);
      clearStage3TurnScopedEffects(state);
      state.battle.status = "PLAYER_TURN";

      if (evaluateBattleState(state, "time-elapse")) {
        if (state.finalResults) {
          this.end(state.finalResults);
        }
        return state;
      }

      addLog(state, "system", `第 ${state.battle.turn} 回合开始。`);
      runStageTurnStartHooks(state);
      runStageBattleEvents(state, "turn-start");
      return state;
    }

    if (action === "set-overload") {
      if (state.phase !== "BATTLE" || state.battle.status !== "PLAYER_TURN") {
        return state;
      }

      const power = Number(data?.power);
      if (state.campaign.overloadUsed) {
        return state;
      }

      if (data?.power === null) {
        if (state.battle.pendingTurnEffects.overloadPower === null) {
          return state;
        }
        pushHistory(state);
        state.battle.pendingTurnEffects.overloadPower = null;
        return state;
      }

      if (Number.isNaN(power) || power < 1 || power > 9) {
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

    if (!canPlayerCommand(attacker) || !canPlayerTargetEnemy(state, attacker, defender)) {
      return state;
    }

    if (!isTutorialAttackAllowed(state, attacker.id, defender.id)) {
      return state;
    }

    if (attacker.id !== "p-robot" && state.battle.pendingTurnEffects.overloadPower !== null) {
      addLog(state, "skill", "显现只能由影子在本回合作为攻击者时使用。");
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

    if (attacker.abilityCode === "gateway-b-cell" || attacker.abilityCode === "s3-memory-gateway") {
      const supportIds = attacker.abilityCode === "gateway-b-cell"
        ? sortByPriority(getFriendlySupportUnits(state, attacker, "player")
          .filter((unit) => unit.alive)
          .filter((unit) => unit.code === "patrol-monocyte" || unit.code === "cleaner-lysosome"))
            .map((unit) => unit.id)
        : sortByPriority(getFriendlySupportUnits(state, attacker, "player")
          .filter((unit) => unit.alive)
          .filter((unit) => unit.id !== attacker.id)
          .filter((unit) => (
            unit.abilityCode === "s3-memory-signal"
            || unit.abilityCode === "s3-memory-kite"
            || unit.abilityCode === "s3-memory-waterbell"
          )))
            .map((unit) => unit.id);

      state.battle.pendingEnemyAction = createPendingAction(state, {
        kind: "gateway-burst",
        attackerId: attacker.id,
        defenderId: defender.id,
        supportIds,
        source: "player-attack",
        controllerSide: "player",
      }, "player");
    } else {
      settleCombatOutcome(state, {
        attacker,
        defender,
        overloadPower,
        source: "player-attack",
        controllerSide: "player",
      });
    }

    state.battle.pendingTurnEffects.overloadPower = null;

    const step = currentGuideStep(state);
    if (step?.mode === "attack") {
      advanceGuide(state);
    }

    if (state.battle.pendingEnemyAction) {
      state.battle.status = "ENEMY_CONFIRM";
      return state;
    }

    if (evaluateBattleState(state, "player-attack")) {
      if (state.finalResults) {
        this.end(state.finalResults);
      }
      return state;
    }

    state.battle.turn += 1;
    syncVirusActivation(state);
    state.battle.status = "ENEMY_OPENING";
    resolveEnemyOpeningStrike(state);

    if (state.battle.pendingEnemyAction) {
      state.battle.status = "ENEMY_CONFIRM";
      return state;
    }

    if (evaluateBattleState(state, "enemy-open-strike")) {
      if (state.finalResults) {
        this.end(state.finalResults);
      }
      return state;
    }

    clearTurnEndBuffs(state);
    clearStage3TurnScopedEffects(state);
    state.battle.status = "PLAYER_TURN";
    addLog(state, "system", `第 ${state.battle.turn} 回合开始。`);
    runStageTurnStartHooks(state);
    runStageBattleEvents(state, "turn-start");
    return state;
  }
};
