const { ANTIBODY_BUFF, MARK_BUFF } = require("../data/buffs");

function tutorialMaxSlot(context) {
  const attacker = context.sortBySlot(context.aliveEnemyUnits()).slice(-1)[0] || null;
  const target = context.sortBySlot(context.alivePlayerUnits()).slice(-1)[0] || null;

  return {
    action: attacker && target ? {
      kind: "combat",
      attackerId: attacker.id,
      defenderId: target.id,
      source: "enemy-open-strike",
      controllerSide: "enemy",
    } : null,
    noActionText: "本回合没有敌方回击。",
    announceText: attacker && target ? `${attacker.name} 锁定 ${target.name}。` : null,
  };
}

function stage1PassiveDefense(context) {
  const target = context.findUnit(context.state.battle, context.state.battle.lastPlayerAttackerId);
  if (!target || !target.alive || !context.canEnemyTreatAsPlayerTarget(target)) {
    return {
      action: null,
      noActionText: "本回合没有敌方回击。",
    };
  }

  const candidates = context.getEnemyActorPool()
    .filter((unit) => unit.power > target.power);
  const attacker = context.pickByPower(candidates, "lowest");

  if (!attacker) {
    return {
      action: null,
      noActionText: "敌方未找到合法攻击者。",
    };
  }

  return {
    action: {
      kind: "combat",
      attackerId: attacker.id,
      defenderId: target.id,
      source: "enemy-open-strike",
      controllerSide: "enemy",
    },
    announceText: `${attacker.name} 锁定 ${target.name}。`,
    noActionText: "敌方未找到合法攻击者。",
  };
}

function canStage2Target(unit) {
  return unit && unit.alive && unit.combatTargetable !== false;
}

function getStage2RotationOrder(context) {
  return [
    "s2-macrophage",
    "s2-gateway",
    "s2-killer",
  ].map((id) => context.findUnit(context.state.battle, id)).filter(Boolean);
}

function stage2TargetPool(context, attacker) {
  return context.getAllUnits(context.state.battle)
    .filter((unit) => unit.id !== attacker.id)
    .filter(canStage2Target)
    .filter((unit) => context.canUnitBeTargetedBy(attacker, unit));
}

function stage2MacrophageAction(context, attacker) {
  const receiver = context.pickByPower(
    context.getFriendlySupportUnits(context.state, attacker).filter((unit) => !context.hasAnyBuff(unit)),
    "lowest"
  );
  const target = context.pickByPower(
    stage2TargetPool(context, attacker).filter(
      (unit) => unit.id !== receiver?.id
        && !context.hasBuff(unit, MARK_BUFF)
        && !context.hasBuff(unit, ANTIBODY_BUFF)
    ),
    "lowest"
  );

  return target ? {
    kind: "combat",
    attackerId: attacker.id,
    defenderId: target.id,
    source: "enemy-open-strike",
    controllerSide: "enemy",
  } : null;
}

function stage2GatewayAction(context, attacker) {
  const receiver = context.pickByPower(
    context.getFriendlySupportUnits(context.state, attacker).filter((unit) => !context.hasAnyBuff(unit)),
    "highest"
  );
  const target = context.pickByPower(
    stage2TargetPool(context, attacker).filter(
      (unit) => unit.id !== receiver?.id
        && !context.hasBuff(unit, MARK_BUFF)
        && !context.hasBuff(unit, ANTIBODY_BUFF)
    ),
    "highest"
  );

  if (!target) {
    return null;
  }

  const supportIds = context.sortByPriority(
    context.getFriendlySupportUnits(context.state, attacker)
      .filter((unit) => unit.alive)
      .filter((unit) => unit.code === "patrol-monocyte" || unit.code === "cleaner-lysosome")
  ).map((unit) => unit.id);

  return {
    kind: "gateway-burst",
    attackerId: attacker.id,
    defenderId: target.id,
    supportIds,
    source: "enemy-open-strike",
    controllerSide: "enemy",
  };
}

function stage2KillerAction(context, attacker) {
  const target = context.pickByPriority(
    stage2TargetPool(context, attacker).filter((unit) => context.hasBuff(unit, MARK_BUFF))
  );

  return target ? {
    kind: "combat",
    attackerId: attacker.id,
    defenderId: target.id,
    source: "enemy-open-strike",
    controllerSide: "enemy",
  } : null;
}

function stage2ActionForUnit(context, unit) {
  if (!unit || !context.canEnemyCommand(unit)) {
    return null;
  }

  if (unit.id === "s2-macrophage") {
    return stage2MacrophageAction(context, unit);
  }
  if (unit.id === "s2-gateway") {
    return stage2GatewayAction(context, unit);
  }
  if (unit.id === "s2-killer") {
    return stage2KillerAction(context, unit);
  }
  return null;
}

function stage2RotationDefense(context) {
  const order = getStage2RotationOrder(context);
  const battle = context.state.battle;
  const start = battle.stageRuntime?.rotationIndex || 0;

  for (let offset = 0; offset < order.length; offset += 1) {
    const index = (start + offset) % order.length;
    const attacker = order[index];
    const action = stage2ActionForUnit(context, attacker);

    if (!action) {
      continue;
    }

    battle.stageRuntime.rotationIndex = (index + 1) % order.length;
    return {
      action,
      announceText: `${attacker.name} 锁定 ${context.findUnit(battle, action.defenderId)?.name || "目标"}。`,
      noActionText: "本回合没有敌方行动。",
    };
  }

  battle.stageRuntime.rotationIndex = (start + 1) % order.length;
  return {
    action: null,
    noActionText: "本回合没有敌方行动。",
  };
}

const ENEMY_AI_REGISTRY = {
  "tutorial-max-slot": tutorialMaxSlot,
  "stage1-passive-defense": stage1PassiveDefense,
  "stage2-rotation-defense": stage2RotationDefense,
};

function resolveEnemyAction(aiId, context) {
  const resolver = ENEMY_AI_REGISTRY[aiId];
  if (!resolver) {
    return {
      action: null,
      noActionText: "本回合没有敌方行动。",
    };
  }
  return resolver(context);
}

module.exports = {
  ENEMY_AI_REGISTRY,
  resolveEnemyAction,
};
