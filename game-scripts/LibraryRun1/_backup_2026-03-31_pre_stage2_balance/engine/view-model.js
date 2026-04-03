const { BUFF_CATALOG, VIRUS_BUFF } = require("../data/buffs");
const { getUnitDefinition } = require("../data/units/catalog");

function cloneValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function findUnit(battle, unitId) {
  if (!(battle && unitId)) {
    return null;
  }
  return [...(battle.playerUnits || []), ...(battle.enemyUnits || [])]
    .find((unit) => unit.id === unitId) || null;
}

function getDefinitionForUnit(unit) {
  return getUnitDefinition(unit?.abilityCode || unit?.code);
}

const VIEW_RUNTIME_HELPERS = {
  findUnit,
};

function hasVirus(unit) {
  return !!(unit?.buffs?.[VIRUS_BUFF] || 0);
}

function getControlSide(unit) {
  if (!unit) {
    return null;
  }
  if (hasVirus(unit)) {
    return unit.side === "enemy" ? "player" : "enemy";
  }
  return unit.side;
}

function getBuffDescriptions(unit) {
  if (!unit?.buffs) {
    return [];
  }

  return Object.values(BUFF_CATALOG)
    .filter((buff) => (unit.buffs[buff.key] || 0) > 0)
    .map((buff) => `【${buff.shortLabel}】${buff.description}`);
}

function getBuffShortLabels(unit) {
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

function canPlayerChooseTarget(attacker, unit) {
  if (!(attacker && attacker.alive && unit && unit.alive) || attacker.id === unit.id) {
    return false;
  }
  const definition = getDefinitionForUnit(unit);
  if (definition.display?.manualTargetable === false) {
    return false;
  }
  return getControlSide(unit) !== getControlSide(attacker)
    || definition.display?.enemyLikeForPlayerTarget === true;
}

module.exports = {
  getBuffDescriptions,
  getBuffShortLabels,
  getPowerDisplay,
  buildCenterFeed,
  buildDisplayBattle,
  getAbilityContextEntries,
  getUnitDisplayMode,
  isManualTargetable,
  isPlayerVisibleEnemy,
  isPlayerCommandable,
  canPlayerChooseTarget,
};
