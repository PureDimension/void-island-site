const {
  BUFF_CATALOG,
  VIRUS_BUFF,
  COGNITIVE_DISSONANCE_BUFF,
} = require("../data/buffs");
const { getUnitDefinition } = require("../data/units/catalog");

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function getAllUnits(battle) {
  return [...(battle?.playerUnits || []), ...(battle?.enemyUnits || [])];
}

function findUnit(battle, unitId) {
  if (!(battle && unitId)) {
    return null;
  }
  return getAllUnits(battle).find((unit) => unit.id === unitId) || null;
}

function getDefinitionForUnit(unit) {
  return getUnitDefinition(unit?.abilityCode || unit?.code);
}

function hasBuff(unit, buffKey) {
  return !!(unit?.buffs?.[buffKey] > 0);
}

function hasActiveVirus(unit) {
  return hasBuff(unit, VIRUS_BUFF) && !!unit?.runtimeState?.virusActivated;
}

function hasAnyBuff(unit) {
  return Object.values(unit?.buffs || {}).some((value) => value > 0);
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

function pickByPriority(units, reference = null) {
  return [...units].sort((a, b) => priorityCompare(a, b, reference))[0] || null;
}

function pickByPower(units, mode, reference = null) {
  if (!units.length) {
    return null;
  }
  const values = units.map((unit) => unit.power);
  const targetPower = mode === "highest" ? Math.max(...values) : Math.min(...values);
  return pickByPriority(units.filter((unit) => unit.power === targetPower), reference);
}

function getFriendlySupportUnits(battle, self, controllerSide = self.side) {
  return getAllUnits(battle)
    .filter((unit) => unit.alive)
    .filter((unit) => getControlSide(unit) === controllerSide);
}

function canUnitBeTargetedBy(attacker, target) {
  if (!(attacker && attacker.alive && target && target.alive) || attacker.id === target.id) {
    return false;
  }
  if (getDefinitionForUnit(target).display?.combatTargetable === false) {
    return false;
  }
  if (!hasActiveVirus(target)) {
    return true;
  }
  const originalEnemySide = target.side === "enemy" ? "player" : "enemy";
  return getControlSide(attacker) !== originalEnemySide;
}

const VIEW_RUNTIME_HELPERS = {
  findUnit,
};

const TARGET_RULE_RUNTIME = {
  getAllUnits,
  canUnitBeTargetedBy,
  pickByPower,
  pickByPriority,
  getFriendlySupportUnits: (state, self, controllerSide) => (
    getFriendlySupportUnits(state.battle, self, controllerSide)
  ),
  hasBuff,
  hasAnyBuff,
};

function getDerivedBuffKeys(unit) {
  const derived = [];
  if (unit?.runtimeState?.selfPowerFixed != null) {
    derived.push(COGNITIVE_DISSONANCE_BUFF);
  }
  return derived;
}

function getAllBuffKeys(unit) {
  const actual = Object.values(BUFF_CATALOG)
    .filter((buff) => !buff.derived)
    .filter((buff) => (unit?.buffs?.[buff.key] || 0) > 0)
    .map((buff) => buff.key);
  return [...new Set([...actual, ...getDerivedBuffKeys(unit)])];
}

function getBuffDescriptionsLegacy(unit) {
  if (!unit?.buffs) {
    return [];
  }

  return Object.values(BUFF_CATALOG)
    .filter((buff) => (unit.buffs[buff.key] || 0) > 0)
    .map((buff) => `【${buff.shortLabel}】${buff.description}`);
}

function getBuffShortLabelsLegacy(unit) {
  if (!unit?.buffs) {
    return [];
  }

  return Object.values(BUFF_CATALOG)
    .filter((buff) => (unit.buffs[buff.key] || 0) > 0)
    .map((buff) => `【${buff.shortLabel}】`);
}

function getPowerDisplay(unit, gameState) {
  if (!unit) {
    return { value: 0, suffix: "" };
  }

  const bonus = gameState?.battle?.combatPreview?.[unit.id]?.bonus || 0;
  return {
    value: unit.power,
    suffix: bonus > 0 ? `+${bonus}` : "",
  };
}

function summarizeEntry(entry) {
  if (entry.type === "combat") {
    return entry.text.replace(" 攻击 ", " → ");
  }
  if (entry.type === "enemy") {
    return entry.text.replace(" 锁定 ", " → ");
  }
  return entry.text;
}

function buildCenterFeed(logs) {
  const combatKeys = new Set(
    logs
      .filter((entry) => entry.type === "combat" && entry.source === "enemy-open-strike")
      .map((entry) => `${entry.turn}-${entry.attackerId}-${entry.defenderId}`)
  );

  return logs
    .filter((entry) => ["combat", "enemy", "hook", "skill"].includes(entry.type))
    .filter((entry) => {
      if (entry.type !== "enemy" || !entry.attackerId || !entry.targetUnitId) {
        return true;
      }
      return !combatKeys.has(`${entry.turn}-${entry.attackerId}-${entry.targetUnitId}`);
    })
    .slice(-3)
    .map((entry, index) => ({
      key: `${entry.turn}-${entry.type}-${index}-${entry.text}`,
      text: summarizeEntry(entry),
      type: entry.type,
    }));
}

function buildDisplayBattle(battle) {
  return battle ? cloneValue(battle) : null;
}

function getAbilityContextEntries(selectedUnit, battle) {
  if (!selectedUnit || !battle) {
    return [];
  }

  const hooks = getDefinitionForUnit(selectedUnit).viewHooks?.inspectorEntries || [];
  return hooks
    .map((hook) => hook(VIEW_RUNTIME_HELPERS, battle, selectedUnit))
    .filter((entry) => entry?.key && entry?.value);
}

function getUnitDisplayMode(unit) {
  return getDefinitionForUnit(unit).display?.mode || "standard";
}

function isManualTargetable(unit) {
  return getDefinitionForUnit(unit).display?.manualTargetable !== false;
}

function isPlayerVisibleEnemy(unit) {
  if (!unit?.alive) {
    return false;
  }
  const definition = getDefinitionForUnit(unit);
  return getControlSide(unit) === "enemy"
    || definition.display?.enemyLikeForPlayerTarget === true;
}

function isPlayerCommandable(unit) {
  if (!unit?.alive) {
    return false;
  }
  const definition = getDefinitionForUnit(unit);
  if (definition.display?.playerCommandable === false) {
    return false;
  }
  return getControlSide(unit) === "player";
}

function getForcedTargetId(battle, attacker) {
  if (!(battle && attacker && attacker.alive)) {
    return null;
  }

  const targetRule = getDefinitionForUnit(attacker).manualTargetRule;
  if (typeof targetRule !== "function") {
    return null;
  }

  const candidates = getAllUnits(battle)
    .filter((unit) => unit.id !== attacker.id)
    .filter((unit) => unit.alive)
    .filter((unit) => getDefinitionForUnit(unit).display?.manualTargetable !== false)
    .filter((unit) => targetRule(TARGET_RULE_RUNTIME, { battle }, {
      self: attacker,
      target: unit,
    }));

  return pickByPriority(candidates, attacker)?.id || null;
}

function canPlayerChooseTarget(battle, attacker, unit) {
  if (!(battle && attacker && attacker.alive && unit && unit.alive) || attacker.id === unit.id) {
    return false;
  }
  const definition = getDefinitionForUnit(unit);
  if (definition.display?.manualTargetable === false) {
    return false;
  }

  const targetRule = getDefinitionForUnit(attacker).manualTargetRule;
  const forcedTargetId = getForcedTargetId(battle, attacker);
  if (typeof targetRule === "function") {
    return !!forcedTargetId && forcedTargetId === unit.id;
  }
  if (forcedTargetId) {
    return forcedTargetId === unit.id;
  }

  if (getDefinitionForUnit(attacker).display?.canTargetFriendly === true) {
    return true;
  }

  return getControlSide(unit) !== getControlSide(attacker)
    || definition.display?.enemyLikeForPlayerTarget === true;
}

function getVirusState(unit) {
  if (!hasBuff(unit, VIRUS_BUFF)) {
    return null;
  }
  return hasActiveVirus(unit) ? "active" : "latent";
}

function hasLockedTarget(unit) {
  return typeof getDefinitionForUnit(unit).manualTargetRule === "function";
}

function getUnitActiveSkills(unit, battle) {
  if (!unit) {
    return [];
  }
  const activeSkills = getDefinitionForUnit(unit).activeSkills || [];
  return activeSkills.map((skill) => ({
    ...cloneValue(skill),
    used: !!battle?.activeSkillUsage?.[skill.key],
  }));
}

function getStage3Polarity(unit) {
  if (!(unit?.runtimeState?.stage3Seal || unit?.runtimeState?.stage3Book) || !unit.alive) {
    return null;
  }
  if (unit.power >= 0 && unit.power <= 4) {
    return "upright";
  }
  if (unit.power >= 5 && unit.power <= 9) {
    return "reversed";
  }
  return null;
}

function getBuffDescriptions(unit) {
  if (!unit) {
    return [];
  }

  return getAllBuffKeys(unit)
    .map((buffKey) => BUFF_CATALOG[buffKey])
    .filter(Boolean)
    .map((buff) => `【${buff.shortLabel}】：${buff.description}`);
}

function getBuffShortLabels(unit) {
  if (!unit) {
    return [];
  }

  return getAllBuffKeys(unit)
    .map((buffKey) => BUFF_CATALOG[buffKey])
    .filter(Boolean)
    .map((buff) => `【${buff.shortLabel}】`);
}

function buildBuffDescriptions(unit, battle = null) {
  if (!unit) {
    return [];
  }

  const descriptions = getAllBuffKeys(unit)
    .map((buffKey) => BUFF_CATALOG[buffKey])
    .filter(Boolean)
    .map((buff) => {
      if (buff.key === COGNITIVE_DISSONANCE_BUFF) {
        const value = unit.runtimeState?.selfPowerFixed;
        return `【认知失调：${value}】：当持有该状态的单位发生战斗时，本场战斗自身 POWER 视为 ${value}；不影响正逆位和时空闭环。`;
      }
      return `【${buff.shortLabel}】：${buff.description}`;
    });

  if (battle && unit.runtimeState?.stage3NoAttackTurn === battle.turn && unit.abilityCode !== "s3-alchemist-carter") {
    descriptions.push("复活回合无法攻击：该单位于本回合开始时被卡特复活，本回合无法攻击或协同攻击。");
  }

  return descriptions;
}

function buildBuffShortLabels(unit, battle = null) {
  if (!unit) {
    return [];
  }

  const labels = getAllBuffKeys(unit)
    .map((buffKey) => BUFF_CATALOG[buffKey])
    .filter(Boolean)
    .map((buff) => {
      if (buff.key === COGNITIVE_DISSONANCE_BUFF) {
        const value = unit.runtimeState?.selfPowerFixed;
        return `【认知失调：${value}】`;
      }
      return `【${buff.shortLabel}】`;
    });

  if (battle && unit.runtimeState?.stage3NoAttackTurn === battle.turn && unit.abilityCode !== "s3-alchemist-carter") {
    labels.push("复活回合无法攻击");
  }

  return labels;
}

function buildBuffDescriptionsUnified(unit, battle = null) {
  if (!unit) {
    return [];
  }

  const descriptions = getAllBuffKeys(unit)
    .map((buffKey) => BUFF_CATALOG[buffKey])
    .filter(Boolean)
    .map((buff) => {
      if (buff.key === COGNITIVE_DISSONANCE_BUFF) {
        const value = unit.runtimeState?.selfPowerFixed;
        return `【认知失调：${value}】：当持有该状态的单位发生战斗时，本场战斗自身 POWER 视为 ${value}；不影响正逆位和时空闭环。`;
      }
      return `【${buff.shortLabel}】：${buff.description}`;
    });

  if (battle && unit.runtimeState?.stage3NoAttackTurn === battle.turn && unit.abilityCode !== "s3-alchemist-carter") {
    descriptions.push("复活回合无法攻击：该单位于本回合开始时被卡特复活，本回合无法攻击或协同攻击。");
  }

  return descriptions;
}

function buildBuffShortLabelsUnified(unit, battle = null) {
  if (!unit) {
    return [];
  }

  const labels = getAllBuffKeys(unit)
    .map((buffKey) => BUFF_CATALOG[buffKey])
    .filter(Boolean)
    .map((buff) => {
      if (buff.key === COGNITIVE_DISSONANCE_BUFF) {
        const value = unit.runtimeState?.selfPowerFixed;
        return `【认知失调：${value}】`;
      }
      return `【${buff.shortLabel}】`;
    });

  if (battle && unit.runtimeState?.stage3NoAttackTurn === battle.turn && unit.abilityCode !== "s3-alchemist-carter") {
    labels.push("复活回合无法攻击");
  }

  return labels;
}

module.exports = {
  getBuffDescriptions: buildBuffDescriptionsUnified,
  getBuffShortLabels: buildBuffShortLabelsUnified,
  getPowerDisplay,
  buildCenterFeed,
  buildDisplayBattle,
  getAbilityContextEntries,
  getUnitDisplayMode,
  isManualTargetable,
  isPlayerVisibleEnemy,
  isPlayerCommandable,
  canPlayerChooseTarget,
  getForcedTargetId,
  getVirusState,
  hasLockedTarget,
  getUnitActiveSkills,
  getStage3Polarity,
};
