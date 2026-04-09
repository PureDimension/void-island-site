const {
  EMP_BUFF,
  ANTIBODY_BUFF,
  MARK_BUFF,
  VIRUS_BUFF,
  BUFF_CATALOG,
} = require("../buffs");

const EMPTY_HOOKS = {
  beforeCombat: [],
  modifyCombatPower: [],
  preventCombatDestruction: [],
  afterCombat: [],
  onDestroyed: [],
  onUnitDestroyed: [],
  previewCombatBonus: [],
};

const EMPTY_VIEW_HOOKS = {
  inspectorEntries: [],
};

const STANDARD_DISPLAY = {
  mode: "standard",
  manualTargetable: true,
  combatTargetable: true,
  playerCommandable: true,
  enemyAiCommandable: true,
  enemyLikeForPlayerTarget: false,
  enemyLikeForEnemyActor: false,
  excludedFromEnemyAutoTarget: false,
};

function buildStage2TargetPool(runtime, state, self) {
  return runtime.getAllUnits(state.battle)
    .filter((unit) => unit.id !== self.id)
    .filter((unit) => unit.alive)
    .filter((unit) => runtime.canUnitBeTargetedBy(self, unit));
}

function macrophageManualTargetRule(runtime, state, { self, target }) {
  const receiver = runtime.pickByPower(
    runtime.getFriendlySupportUnits(state, self).filter((unit) => !runtime.hasAnyBuff(unit)),
    "lowest",
    self
  );
  const expectedTarget = runtime.pickByPower(
    buildStage2TargetPool(runtime, state, self).filter(
      (unit) => unit.id !== receiver?.id
        && !runtime.hasBuff(unit, ANTIBODY_BUFF)
        && !runtime.hasBuff(unit, MARK_BUFF)
    ),
    "lowest",
    self
  );
  return expectedTarget?.id === target?.id;
}

function gatewayManualTargetRule(runtime, state, { self, target }) {
  const receiver = runtime.pickByPower(
    runtime.getFriendlySupportUnits(state, self).filter((unit) => !runtime.hasAnyBuff(unit)),
    "highest",
    self
  );
  const expectedTarget = runtime.pickByPower(
    buildStage2TargetPool(runtime, state, self).filter(
      (unit) => unit.id !== receiver?.id
        && !runtime.hasBuff(unit, ANTIBODY_BUFF)
        && !runtime.hasBuff(unit, MARK_BUFF)
    ),
    "highest",
    self
  );
  return expectedTarget?.id === target?.id;
}

function killerManualTargetRule(runtime, state, { self, target }) {
  const expectedTarget = runtime.pickByPriority(
    buildStage2TargetPool(runtime, state, self).filter((unit) => runtime.hasBuff(unit, MARK_BUFF)),
    self
  );
  return expectedTarget?.id === target?.id;
}

function mergeHooks(hooks = {}) {
  return {
    beforeCombat: hooks.beforeCombat || [],
    modifyCombatPower: hooks.modifyCombatPower || [],
    preventCombatDestruction: hooks.preventCombatDestruction || [],
    afterCombat: hooks.afterCombat || [],
    onDestroyed: hooks.onDestroyed || [],
    onUnitDestroyed: hooks.onUnitDestroyed || [],
    previewCombatBonus: hooks.previewCombatBonus || [],
  };
}

function defineUnit(config) {
  return {
    ...config,
    tags: config.tags || [],
    activeSkills: config.activeSkills || [],
    display: { ...STANDARD_DISPLAY, ...(config.display || {}) },
    hooks: mergeHooks(config.hooks),
    viewHooks: {
      ...EMPTY_VIEW_HOOKS,
      ...(config.viewHooks || {}),
      inspectorEntries: config.viewHooks?.inspectorEntries || [],
    },
    manualTargetRule: config.manualTargetRule || null,
    runtimeState: config.runtimeState || {},
  };
}

function isStage3CombatAttacker(self, attacker) {
  return self?.id && attacker?.id && self.id === attacker.id;
}

function isStage3CombatParticipant(self, attacker, defender) {
  return self?.id && (self.id === attacker?.id || self.id === defender?.id);
}

function getStage3Opponent(self, attacker, defender) {
  if (self?.id === attacker?.id) {
    return defender;
  }
  if (self?.id === defender?.id) {
    return attacker;
  }
  return null;
}

function countAllBuffStacks(state) {
  return runtimeGetAllUnits(state)
    .reduce((total, unit) => (
      total + Object.values(unit.buffs || {}).reduce((sum, value) => sum + (value || 0), 0)
    ), 0);
}

function runtimeGetAllUnits(state) {
  return [...(state?.battle?.playerUnits || []), ...(state?.battle?.enemyUnits || [])];
}

function stage3RunCooperation(runtime, state, self, target, context = {}) {
  const stageRuntime = state?.battle?.stageRuntime || {};
  if (!stageRuntime.stage3CooperationEnabled || !self?.alive || !target?.alive) {
    return;
  }

  const stance = runtime.getStage3Stance(self);
  if (stance === "balanced") {
    return;
  }

  const partnerId = self.runtimeState?.stage3CoopPartnerId;
  const partner = runtime.findUnit(state.battle, partnerId);
  if (!(partner && partner.alive && target.alive)) {
    return;
  }

  const coopVisited = new Set(context.coopVisited || []);
  if (coopVisited.has(partner.id)) {
    return;
  }

  let canTrigger = runtime.isStage3OppositeStance(self, partner);
  const forceCoopKey = `stage3ForceCoopTurn${state.battle.turn}`;
  if (!canTrigger && stageRuntime.stage3ForceFirstFailedCoop && !stageRuntime[forceCoopKey]) {
    canTrigger = true;
    stageRuntime[forceCoopKey] = true;
    runtime.addLog(state, "hook", `【TURN10】强制触发了 ${partner.name} 的首次失败协同攻击。`, {
      unitId: partner.id,
      sourceUnitId: self.id,
      targetUnitId: target.id,
    });
  }

  if (!canTrigger) {
    return;
  }

  coopVisited.add(self.id);
  coopVisited.add(partner.id);
  runtime.addLog(state, "hook", `${self.name} 触发协同攻击，${partner.name} 追击同一目标。`, {
    unitId: self.id,
    sourceUnitId: partner.id,
    targetUnitId: target.id,
  });
  runtime.settleCombatOutcome(state, {
    attacker: partner,
    defender: target,
    source: "stage3-coop",
    controllerSide: partner.side,
    coopVisited: [...coopVisited],
  });
}

function stage3BookHooks(effectHandlers = {}) {
  return {
    beforeCombat: [
      (runtime, state, { self, attacker, defender, combatControl }) => {
        if (!isStage3CombatAttacker(self, attacker) || !self.runtimeState?.stage3Seal) {
          return;
        }

        const target = defender;
        const stance = runtime.getStage3Stance(self);
        self.runtimeState.stage3LastStance = stance;

        if (stance === "balanced") {
          runtime.addLog(state, "hook", `${self.name} 处于【平衡】状态，攻击前自毁。`, {
            unitId: self.id,
            targetUnitId: target?.id || null,
          });
          combatControl.skipResolution = true;
          runtime.destroyUnit(state, self, "stage3-balance-self-destroy", {
            opponent: target,
            attacker: self,
            defender: target,
          });
          return;
        }

        if (stance === "upright") {
          combatControl.skipResolution = true;
          effectHandlers.onUpright?.(runtime, state, { self, target, attacker, defender, combatControl });
          if (self.alive) {
            runtime.stage3InvertUnit(state, self, self);
          }
          return;
        }

        effectHandlers.onReversedBefore?.(runtime, state, { self, target, attacker, defender, combatControl });
      },
    ],
    preventCombatDestruction: [
      (runtime, state, { self, threatenedUnit }) => {
        if (self.id !== threatenedUnit.id || !self.runtimeState?.stage3Seal) {
          return false;
        }
        return runtime.getStage3Stance(self) !== "balanced";
      },
    ],
    afterCombat: [
      (runtime, state, { self, attacker, defender, combatControl, ...rest }) => {
        if (!isStage3CombatAttacker(self, attacker) || !self.runtimeState?.stage3Seal) {
          return;
        }
        if (!self.alive) {
          return;
        }

        const target = defender;
        const stance = self.runtimeState?.stage3LastStance || runtime.getStage3Stance(self);
        if (stance === "reversed") {
          effectHandlers.onReversedAfter?.(runtime, state, {
            self,
            target,
            attacker,
            defender,
            combatControl,
            ...rest,
          });
          if (self.alive) {
            runtime.stage3InvertUnit(state, self, self);
          }
        }
      },
    ],
  };
}

const UNIT_CATALOG = {
  robot: defineUnit({
    name: "【影子】",
    power: 3,
    description: "若本单位被摧毁，则游戏失败。",
    tags: [],
  }),
  "robot-stage1-story": defineUnit({
    name: "【影子】",
    power: 3,
    description: "◆【空间重组】：每关限一次。选择一个己方单位和一个其他单位，将前者的部分 POWER 与其身上的 BUFF 一并转移给后者。若本单位被摧毁，则游戏失败。",
    tags: ["◆"],
    activeSkills: [
      {
        key: "space-reorg",
        label: "空间重组",
        style: "hive",
        oncePerStage: true,
      },
    ],
  }),
  "robot-stage2-story": defineUnit({
    name: "【影子】",
    power: 3,
    description: "◆【空间重组】：每关限一次。选择一个己方单位和一个其他单位，将前者的部分 POWER 与其身上的 BUFF 一并转移给后者。◆【时间流逝】：每关限一次。仅可在敌方行动前的 CONFIRM 阶段发动。取消敌方本轮行动及其全部后果，并直接进入下一个己方回合。若本单位被摧毁，则游戏失败。",
    tags: ["◆"],
    activeSkills: [
      {
        key: "space-reorg",
        label: "空间重组",
        style: "hive",
        oncePerStage: true,
      },
      {
        key: "time-elapse",
        label: "时间流逝",
        style: "clock",
        oncePerStage: true,
      },
    ],
  }),
  "robot-stage3-story": defineUnit({
    name: "【影子】",
    power: 3,
    description: "◆【空间重组】：每关限一次。选择一个己方单位和一个其他单位，将前者的部分 POWER 与其身上的 BUFF 一并转移给后者。◆【时间流逝】：每关限一次。仅可在敌方行动前的 CONFIRM 阶段发动。取消敌方本轮行动及其全部后果，并直接进入下一个己方回合。若本单位被摧毁，则游戏失败。",
    tags: ["◆", "●"],
    activeSkills: [
      {
        key: "space-reorg",
        label: "空间重组",
        style: "hive",
        oncePerStage: true,
      },
      {
        key: "time-elapse",
        label: "时间流逝",
        style: "clock",
        oncePerStage: true,
      },
    ],
    viewHooks: {
      inspectorEntries: [
        (runtime, battle, self) => {
          const loops = runtime.findUnit(battle, self.id)?.runtimeState?.stage3TimeLoops || [];
          return {
            key: "时空闭环",
            value: loops.length ? loops.map((value) => `POWER=${value}`).join(" / ") : "当前没有闭环",
          };
        },
      ],
    },
  }),
  waterbell: defineUnit({
    name: "【水铃儿】",
    power: 3,
    description: "无能力。",
  }),
  "signal-bee": defineUnit({
    name: "信号工蜂",
    power: 1,
    description: "▲：若上一个主动攻击者存活，则本次战斗 POWER + 该单位当前 POWER。",
    tags: ["▲"],
    hooks: {
      modifyCombatPower: [
        (runtime, state, { currentPower }) => {
          const previousAttacker = runtime.getPreviousCombatAttacker(state);
          return previousAttacker ? currentPower + previousAttacker.power : currentPower;
        },
      ],
      previewCombatBonus: [
        (runtime, state) => {
          const previousAttacker = runtime.getPreviousCombatAttacker(state);
          return previousAttacker ? previousAttacker.power : 0;
        },
      ],
    },
    viewHooks: {
      inspectorEntries: [
        (runtime, battle) => {
          const previousAttacker = runtime.findUnit(battle, battle.lastCombatAttackerId);
          return {
            key: "上一个主动攻击者",
            value: previousAttacker?.alive ? previousAttacker.name : "当前没有存活的对象",
          };
        },
      ],
    },
  }),
  "monitor-bee": defineUnit({
    name: "监视工蜂",
    power: 2,
    description: "▲：若上一个被攻击者存活，则本次战斗 POWER + 该单位当前 POWER。",
    tags: ["▲"],
    hooks: {
      modifyCombatPower: [
        (runtime, state, { currentPower }) => {
          const previousDefender = runtime.getPreviousCombatDefender(state);
          return previousDefender ? currentPower + previousDefender.power : currentPower;
        },
      ],
      previewCombatBonus: [
        (runtime, state) => {
          const previousDefender = runtime.getPreviousCombatDefender(state);
          return previousDefender ? previousDefender.power : 0;
        },
      ],
    },
    viewHooks: {
      inspectorEntries: [
        (runtime, battle) => {
          const previousDefender = runtime.findUnit(battle, battle.lastCombatDefenderId);
          return {
            key: "上一个被攻击者",
            value: previousDefender?.alive ? previousDefender.name : "当前没有存活的对象",
          };
        },
      ],
    },
  }),
  "battle-module": defineUnit({
    name: "战斗模块",
    power: 5,
    description: "●：不会因战斗失败被摧毁。每次参与战斗后，若仍存活，则 POWER 永久 -1。",
    tags: ["●"],
    hooks: {
      preventCombatDestruction: [
        (runtime, state, { self, threatenedUnit }) => {
          if (self.id !== threatenedUnit.id) {
            return false;
          }
          runtime.addLog(state, "hook", `${self.name} 免于因战斗被摧毁。`, {
            unitId: self.id,
          });
          return true;
        },
      ],
      afterCombat: [
        (runtime, state, { self, attacker, defender, combatControl }) => {
          if (self.id !== attacker.id && self.id !== defender.id) {
            return;
          }
          if (!self.alive) {
            return;
          }
          self.power -= 1;
          runtime.addLog(state, "hook", `${self.name} 战后 POWER -1。`, {
            unitId: self.id,
          });
          runtime.enforcePowerBounds(state, self, { cause: "battle-module-wear" });
        },
      ],
    },
  }),
  "emp-module": defineUnit({
    name: "电磁干扰模块",
    power: 1,
    description: `▼：若本单位因战斗被摧毁，则与之战斗的单位获得【${BUFF_CATALOG[EMP_BUFF].shortLabel}】。`
      + `【${BUFF_CATALOG[EMP_BUFF].shortLabel}】：${BUFF_CATALOG[EMP_BUFF].description}`,
    tags: ["▼"],
    hooks: {
      onDestroyed: [
        (runtime, state, { self, reason, opponent }) => {
          if (reason !== "combat" || !opponent || !opponent.alive) {
            return;
          }
          runtime.applyBuff(state, EMP_BUFF, opponent, self);
        },
      ],
    },
  }),
  "growth-module": defineUnit({
    name: "成长模块",
    power: 0,
    description: "▲：本次战斗 POWER +X。X = 本关内已被摧毁的单位数量。",
    tags: ["▲"],
    hooks: {
      modifyCombatPower: [
        (runtime, state, { currentPower }) => currentPower + runtime.destroyedCount(state),
      ],
      previewCombatBonus: [
        (runtime, state) => runtime.destroyedCount(state),
      ],
    },
  }),
  "disguise-module": defineUnit({
    name: "伪装模块",
    power: 3,
    description: "●：除己方回合中可主动攻击外，其余情况下，本单位被视为敌方单位。",
    tags: ["●"],
    display: {
      mode: "split",
      enemyLikeForPlayerTarget: true,
      enemyLikeForEnemyActor: true,
      excludedFromEnemyAutoTarget: true,
    },
  }),
  alpha: defineUnit({
    name: "安全护卫α",
    power: 5,
    description: "▲：本单位主动发起攻击时，则本次战斗 POWER +3。",
    tags: ["▲"],
    hooks: {
      modifyCombatPower: [
        (runtime, state, { self, attacker, currentPower }) => (
          self.id === attacker.id ? currentPower + 3 : currentPower
        ),
      ],
      previewCombatBonus: [() => 3],
    },
  }),
  beta: defineUnit({
    name: "安全护卫β",
    power: 3,
    description: "▲：若本单位作为被攻击者进入战斗，则本次战斗 POWER +3。",
    tags: ["▲"],
    hooks: {
      modifyCombatPower: [
        (runtime, state, { self, defender, currentPower }) => (
          self.id === defender.id ? currentPower + 3 : currentPower
        ),
      ],
      previewCombatBonus: [() => 3],
    },
  }),
  gamma: defineUnit({
    name: "【纸鸢】",
    power: 9,
    description: "●※：每当 α 或 β 发生战斗，本单位 POWER 永久 -1；若该次战斗中 α 或 β 被摧毁，则再额外 POWER 永久 -1。",
    tags: ["●", "※"],
    hooks: {
      afterCombat: [
        (runtime, state, { self, attacker, defender, combatControl }) => {
          if (!self.alive) {
            return;
          }

          const watchedCodes = new Set(["alpha", "beta"]);
          const watchedInBattle = watchedCodes.has(attacker.code) || watchedCodes.has(defender.code);
          if (!watchedInBattle) {
            return;
          }

          self.power -= 1;
          runtime.addLog(state, "hook", `${self.name} 因 α/β 参战而 POWER -1。`, {
            unitId: self.id,
          });
          runtime.enforcePowerBounds(state, self, { cause: "gamma-passive" });

          const watchedDestroyed =
            (!attacker.alive && watchedCodes.has(attacker.code))
            || (!defender.alive && watchedCodes.has(defender.code));

          if (!self.alive || !watchedDestroyed) {
            return;
          }

          self.power -= 1;
          runtime.addLog(state, "hook", `${self.name} 因 α/β 被摧毁而额外 POWER -1。`, {
            unitId: self.id,
          });
          runtime.enforcePowerBounds(state, self, { cause: "gamma-extra" });
        },
      ],
    },
  }),
  cipher: defineUnit({
    name: "密文",
    power: 1,
    description: "●：不会被选为攻击目标。",
    tags: ["●"],
    display: {
      manualTargetable: false,
      combatTargetable: false,
    },
  }),
  "macrophage-command": defineUnit({
    name: "巨噬细胞-指挥",
    power: 4,
    description: `▲：本单位主动攻击之前，令己方中 POWER 最低且没有任何 BUFF 的一个单位获得【${BUFF_CATALOG[ANTIBODY_BUFF].shortLabel}】。`
      + "攻击目标固定为没有【标记】且没有【抗体】、并且 POWER 最低的另一个单位。"
      + "战斗前：目标 POWER 永久 -2，本单位 POWER 永久 +2。",
    tags: ["▲"],
    manualTargetRule: macrophageManualTargetRule,
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, defender, controllerSide }) => {
          if (self.id !== attacker.id) {
            return;
          }

          const receiver = runtime.pickByPower(
            runtime.getFriendlySupportUnits(state, self, controllerSide).filter((unit) => !runtime.hasAnyBuff(unit)),
            "lowest"
          );

          if (receiver) {
            runtime.applyBuff(state, ANTIBODY_BUFF, receiver, self);
          }

          if (!defender?.alive) {
            return;
          }

          defender.power -= 2;
          self.power += 2;
          runtime.addLog(state, "hook", `${self.name} 吸取了 ${defender.name} 的 2 点 POWER。`, {
            unitId: self.id,
            targetUnitId: defender.id,
          });
          runtime.enforcePowerBounds(state, defender, { cause: "macrophage-drain", sourceUnitId: self.id });
          runtime.enforcePowerBounds(state, self, { cause: "macrophage-drain", sourceUnitId: defender.id });
        },
      ],
    },
  }),
  "gateway-b-cell": defineUnit({
    name: "调度B细胞-网关",
    power: 6,
    description: `▲：本单位主动攻击之前，令己方中 POWER 最高且没有任何 BUFF 的一个单位获得【${BUFF_CATALOG[ANTIBODY_BUFF].shortLabel}】。`
      + "攻击目标固定为没有【标记】且没有【抗体】、并且 POWER 最高的另一个单位。"
      + "本单位不直接战斗，而是令己方所有存活的“巡检单核体”“清理溶酶虫”依次攻击目标。"
      + "▼：行动结束后，复活己方所有已阵亡的“巡检单核体”“清理溶酶虫”“补体屏障”。",
    tags: ["▲", "▼"],
    manualTargetRule: gatewayManualTargetRule,
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, controllerSide }) => {
          if (self.id !== attacker.id) {
            return;
          }
          const receiver = runtime.pickByPower(
            runtime.getFriendlySupportUnits(state, self, controllerSide).filter((unit) => !runtime.hasAnyBuff(unit)),
            "highest"
          );
          if (receiver) {
            runtime.applyBuff(state, ANTIBODY_BUFF, receiver, self);
          }
        },
      ],
      afterCombat: [
        (runtime, state, { self, attacker, gatewayBurst, controllerSide }) => {
          if (self.id !== attacker?.id && !gatewayBurst) {
            return;
          }
          const reviveCodes = new Set(["patrol-monocyte", "cleaner-lysosome", "complement-barrier"]);
          const candidates = runtime.getAllUnits(state.battle)
            .filter((unit) => !unit.alive && reviveCodes.has(unit.code));

          for (const unit of candidates) {
            runtime.reviveUnit(state, unit, "gateway-b-cell", self, controllerSide);
          }
        },
      ],
    },
  }),
  "killer-t-protocol": defineUnit({
    name: "杀手T细胞-协议",
    power: 5,
    description: `▲：攻击目标固定为一个持有【${BUFF_CATALOG[MARK_BUFF].shortLabel}】的其他单位。若与持有【${BUFF_CATALOG[MARK_BUFF].shortLabel}】的单位发生战斗，则本次战斗必定胜利。`,
    tags: ["▲"],
    manualTargetRule: killerManualTargetRule,
    hooks: {
      modifyCombatPower: [
        (runtime, state, { self, attacker, defender, currentPower }) => {
          if (self.id !== attacker.id || !runtime.hasBuff(defender, MARK_BUFF)) {
            return currentPower;
          }
          return currentPower + 999;
        },
      ],
      previewCombatBonus: [
        (runtime, state, { self }) => (
          runtime.anyTargetHasBuff(state, self, MARK_BUFF) ? 999 : 0
        ),
      ],
    },
  }),
  "patrol-monocyte": defineUnit({
    name: "巡检单核体",
    power: 1,
    description: `▼：战斗结束后，使最后一次与本单位战斗且仍存活的单位获得【${BUFF_CATALOG[MARK_BUFF].shortLabel}】。`,
    tags: ["▼"],
    hooks: {
      afterCombat: [
        (runtime, state, { self }) => {
          if (!self.combat.lastBattleUnitId) {
            return;
          }
          const target = runtime.findUnit(state.battle, self.combat.lastBattleUnitId);
          if (!target || !target.alive) {
            return;
          }
          runtime.applyBuff(state, MARK_BUFF, target, self);
        },
      ],
    },
  }),
  "cleaner-lysosome": defineUnit({
    name: "清理溶酶虫",
    power: 2,
    description: "▲：本单位主动攻击时，若目标 POWER > 5，则目标 POWER -3；否则，直接摧毁目标。",
    tags: ["▲"],
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, defender, combatControl }) => {
          if (self.id !== attacker.id || !defender?.alive) {
            return;
          }

          if (defender.power > 5) {
            defender.power -= 3;
            combatControl.skipResolution = true;
            runtime.addLog(state, "hook", `${self.name} 使 ${defender.name} 的 POWER -3。`, {
              unitId: self.id,
              targetUnitId: defender.id,
            });
            runtime.enforcePowerBounds(state, defender, { cause: "cleaner-weakening", sourceUnitId: self.id });
            return;
          }

          runtime.addLog(state, "hook", `${self.name} 直接清除了 ${defender.name}。`, {
            unitId: self.id,
            targetUnitId: defender.id,
          });
          combatControl.skipResolution = true;
          runtime.destroyUnit(state, defender, "cleaner-execute", {
            sourceUnit: self,
            opponent: self,
          });
        },
      ],
    },
  }),
  "complement-barrier": defineUnit({
    name: "补体屏障",
    power: 3,
    description: "●※：本单位不可主动攻击。若一个己方单位将因战斗被摧毁，且该单位当前 POWER 大于本单位，则改为该单位免于被摧毁，本单位自毁。",
    tags: ["●", "※"],
    display: {
      playerCommandable: false,
      enemyAiCommandable: false,
    },
    hooks: {
      preventCombatDestruction: [
        (runtime, state, { self, threatenedUnit }) => {
          if (!self.alive || self.id === threatenedUnit.id) {
            return false;
          }
          if (!runtime.isSameSupportCamp(self, threatenedUnit)) {
            return false;
          }
          if (threatenedUnit.power <= self.power) {
            return false;
          }

          runtime.addLog(state, "hook", `${self.name} 保护了 ${threatenedUnit.name}，并替其自毁。`, {
            unitId: self.id,
            targetUnitId: threatenedUnit.id,
          });
          runtime.destroyUnit(state, self, "complement-barrier", {
            sourceUnit: threatenedUnit,
          });
          return true;
        },
      ],
    },
  }),
  lantern: defineUnit({
    name: "灯笼",
    power: 2,
    description: "●：本单位第一次攻击或被攻击进入战斗时，不会因本次战斗被摧毁。▼：该次战斗结束后，本单位永久获得对手当前能力并以新能力取代原能力；不会修改对手能力；该获得不改变目标原本的攻击目标索引逻辑。",
    tags: ["●", "▼"],
    hooks: {
      preventCombatDestruction: [
        (runtime, state, { self, threatenedUnit, attacker, defender }) => {
          if (self.id !== threatenedUnit.id) {
            return false;
          }
          if (self.id !== attacker?.id && self.id !== defender?.id) {
            return false;
          }
          runtime.addLog(state, "hook", `${self.name} 在首次参与战斗时免于被摧毁。`, {
            unitId: self.id,
          });
          return true;
        },
      ],
      afterCombat: [
        (runtime, state, { self, attacker, defender }) => {
          const participated = self.id === attacker?.id || self.id === defender?.id;
          if (!participated) {
            return;
          }
          const opponent = self.id === attacker?.id ? defender : attacker;
          if (!opponent) {
            return;
          }
          runtime.copyAbility(state, self, opponent);
        },
      ],
    },
  }),
  rattlesnake: defineUnit({
    name: "响尾蛇",
    power: 4,
    description: "●：每当本单位消灭一个敌对单位，自身 POWER 永久 +2。",
    tags: ["●"],
    hooks: {
      afterCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (!self.alive) {
            return;
          }
          const opponent = self.id === attacker.id ? defender : self.id === defender.id ? attacker : null;
          if (!opponent || opponent.alive) {
            return;
          }
          if (!runtime.areHostile(self, opponent)) {
            return;
          }

          self.power += 2;
          runtime.addLog(state, "hook", `${self.name} 因击毁 ${opponent.name} 而 POWER +2。`, {
            unitId: self.id,
            targetUnitId: opponent.id,
          });
          runtime.enforcePowerBounds(state, self, { cause: "rattlesnake-feed", sourceUnitId: opponent.id });
        },
      ],
    },
  }),
  phage: defineUnit({
    name: "噬菌体",
    power: 1,
    description: `▲：若本单位攻击或被攻击的对手没有【${BUFF_CATALOG[ANTIBODY_BUFF].shortLabel}】，则使其获得【${BUFF_CATALOG[VIRUS_BUFF].shortLabel}】。`
      + `【${BUFF_CATALOG[VIRUS_BUFF].shortLabel}】：${BUFF_CATALOG[VIRUS_BUFF].description}`,
    tags: ["▲"],
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, defender }) => {
          let target = null;
          if (self.id === attacker.id) {
            target = defender;
          } else if (self.id === defender?.id) {
            target = attacker;
          }
          if (!target?.alive) {
            return;
          }
          if (runtime.hasBuff(target, ANTIBODY_BUFF)) {
            return;
          }
          runtime.applyBuff(state, VIRUS_BUFF, target, self);
        },
      ],
    },
  }),
  "fever-module": defineUnit({
    name: "发热模块",
    power: 3,
    description: "▲：本单位主动攻击时，则除本单位与目标外的所有单位 POWER +1。●：本单位主动攻击时，则不会因本次战斗被摧毁。",
    tags: ["▲", "●"],
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (self.id !== attacker.id) {
            return;
          }
          for (const unit of runtime.getAllUnits(state.battle)) {
            if (!unit.alive || unit.id === self.id || unit.id === defender.id) {
              continue;
            }
            unit.power += 1;
            runtime.addLog(state, "hook", `${self.name} 使 ${unit.name} 的 POWER +1。`, {
              unitId: self.id,
              targetUnitId: unit.id,
            });
            runtime.enforcePowerBounds(state, unit, { cause: "fever-module", sourceUnitId: self.id });
          }
        },
      ],
      preventCombatDestruction: [
        (runtime, state, { self, threatenedUnit, attacker }) => {
          if (self.id !== threatenedUnit.id || self.id !== attacker.id) {
            return false;
          }
          runtime.addLog(state, "hook", `${self.name} 在主动攻击时免于被摧毁。`, {
            unitId: self.id,
          });
          return true;
        },
      ],
    },
  }),
  puzzle: defineUnit({
    name: "拼图",
    power: 6,
    description: "▼：若本单位以两块拼图状态完成战斗，则战斗结束后失去一块拼图，并使 POWER -3。若本单位当前只有一块拼图，且本次战斗胜利，则恢复拼图并使 POWER +3。",
    tags: ["▼"],
    runtimeState: {
      pieces: 2,
    },
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (self.id !== attacker.id && self.id !== defender.id) {
            return;
          }
          if ((self.runtimeState?.pieces ?? 2) !== 2) {
            return;
          }
          self.runtimeState.pendingBreak = true;
        },
      ],
      afterCombat: [
        (runtime, state, { self, attacker, defender }) => {
          const opponent = self.id === attacker.id ? defender : self.id === defender.id ? attacker : null;
          if (!opponent) {
            return;
          }
          if (self.alive && self.runtimeState?.pendingBreak) {
            self.runtimeState.pendingBreak = false;
            self.runtimeState.pieces = 1;
            self.power -= 3;
            runtime.addLog(state, "hook", `${self.name} 在战斗结束后损失了一块拼图，POWER -3。`, {
              unitId: self.id,
            });
            runtime.enforcePowerBounds(state, self, { cause: "puzzle-break" });
            return;
          }
          if (!self.alive) {
            return;
          }
          if ((self.runtimeState?.pieces ?? 2) !== 1) {
            return;
          }
          if (opponent.alive) {
            return;
          }
          self.runtimeState.pieces = 2;
          self.power += 3;
          runtime.addLog(state, "hook", `${self.name} 恢复了完整拼图，POWER +3。`, {
            unitId: self.id,
          });
          runtime.enforcePowerBounds(state, self, { cause: "puzzle-restore" });
        },
      ],
    },
    viewHooks: {
      inspectorEntries: [
        (runtime, battle, self) => ({
          key: "拼图块数",
          value: `${self.runtimeState?.pieces ?? 2}/2`,
        }),
      ],
    },
  }),
  "s3-alchemist-carter": defineUnit({
    name: "炼金术士卡特",
    power: 0,
    description: "●【永恒】：本单位 POWER 可为 10；每个己方回合开始时，若 POWER 不为 10，则以原始 POWER 复活所有已被摧毁的友方单位；免疫除【升华】外的一切直接改写 POWER 效果；免疫【真伪逆转】。●【升华】：死亡时生效。其他友方单位发动攻击时，本单位 POWER +1；每个己方回合开始时，保留 POWER 并复活本单位。●【警告】若本单位 POWER 大于 10，则立即摧毁场上全部单位。●【TURN5 / TURN10】将激活全员特殊强化效果。",
    tags: ["●"],
    runtimeState: {
      allowPower10: true,
      stage3InvertImmune: true,
      stage3Book: true,
      stage3DirectPowerImmune: true,
      stage3CarterOverflow: true,
    },
    hooks: {},
    viewHooks: {
      inspectorEntries: [
        (runtime, battle, self) => ({
          key: "时空闭环",
          value: (self.runtimeState?.stage3TimeLoops || []).length
            ? self.runtimeState.stage3TimeLoops.map((value) => `POWER=${value}`).join(" / ")
            : "当前没有闭环",
        }),
      ],
    },
  }),
  "s3-book-element": defineUnit({
    name: "元素之书",
    power: 9,
    description: "【正位】使对方 POWER -X，X 为自身 POWER；【逆位】攻击前使对方 POWER +X；攻击后【真伪逆转】。",
    runtimeState: {
      stage3Book: true,
      stage3Seal: true,
    },
    hooks: stage3BookHooks({
      onUpright: (runtime, state, { self, target }) => {
        if (!self.alive) {
          return;
        }
        runtime.addDirectPower(state, target, -self.power, {
          sourceUnit: self,
          sourceUnitId: self.id,
        });
        runtime.addLog(state, "hook", `${self.name} 以【正位】使 ${target.name} 的 POWER -${self.power}。`, {
          unitId: self.id,
          targetUnitId: target.id,
        });
        runtime.enforcePowerBounds(state, target, { cause: "stage3-element-upright", sourceUnitId: self.id });
      },
      onReversedBefore: (runtime, state, { self, target }) => {
        if (!(self.alive && target?.alive)) {
          return;
        }
        runtime.addDirectPower(state, target, self.power, {
          sourceUnit: self,
          sourceUnitId: self.id,
        });
        runtime.addLog(state, "hook", `${self.name} 以【逆位】使 ${target.name} 的 POWER +${self.power}。`, {
          unitId: self.id,
          targetUnitId: target.id,
        });
        runtime.enforcePowerBounds(state, target, { cause: "stage3-element-reversed", sourceUnitId: self.id });
      },
    }),
  }),
  "s3-book-strength": defineUnit({
    name: "力量之书",
    power: 8,
    description: "【正位】使自身 POWER +Y，Y 为对方 POWER；【逆位】攻击后使自身 POWER -Y；攻击后【真伪逆转】。",
    runtimeState: {
      stage3Book: true,
      stage3Seal: true,
    },
    hooks: stage3BookHooks({
      onUpright: (runtime, state, { self, target }) => {
        if (!(self.alive && target?.alive)) {
          return;
        }
        runtime.addDirectPower(state, self, target.power, {
          sourceUnit: target,
          sourceUnitId: target.id,
        });
        runtime.addLog(state, "hook", `${self.name} 以【正位】使自身 POWER +${target.power}。`, {
          unitId: self.id,
          targetUnitId: target.id,
        });
      },
      onReversedAfter: (runtime, state, { self, target }) => {
        if (!(self.alive && target)) {
          return;
        }
        runtime.addDirectPower(state, self, -target.power, {
          sourceUnit: target,
          sourceUnitId: target.id,
        });
        runtime.addLog(state, "hook", `${self.name} 以【逆位】使自身 POWER -${target.power}。`, {
          unitId: self.id,
          targetUnitId: target.id,
        });
        runtime.enforcePowerBounds(state, self, { cause: "stage3-strength-reversed", sourceUnitId: self.id });
      },
    }),
  }),
  "s3-book-soul": defineUnit({
    name: "灵魂之书",
    power: 7,
    description: "【正位】使对方获得【认知协调 X】；【逆位】攻击后使对方获得【认知失调 X】；X 为自身 POWER。【认知协调 X】：战斗时，自身 POWER 视为 X。【认知失调 X】：战斗时，对方 POWER 视为 X。攻击后【真伪逆转】。",
    runtimeState: {
      stage3Book: true,
      stage3Seal: true,
    },
    hooks: stage3BookHooks({
      onUpright: (runtime, state, { self, target }) => {
        if (!(self.alive && target?.alive)) {
          return;
        }
        if (runtime.isStage3BuffNullified(state, self)) {
          runtime.addLog(state, "hook", `${self.name} 对 ${target.name} 施加的【认知协调】被本回合无效化。`, {
            unitId: self.id,
            targetUnitId: target.id,
          });
          return;
        }
        target.runtimeState = target.runtimeState || {};
        target.runtimeState.combatPowerFixed = self.power;
        runtime.addLog(state, "hook", `${self.name} 以【正位】使 ${target.name} 获得【认知协调 ${self.power}】。`, {
          unitId: self.id,
          targetUnitId: target.id,
        });
      },
      onReversedAfter: (runtime, state, { self, target }) => {
        if (!(self.alive && target?.alive)) {
          return;
        }
        if (runtime.isStage3BuffNullified(state, self)) {
          runtime.addLog(state, "hook", `${self.name} 对 ${target.name} 施加的【认知失调】被本回合无效化。`, {
            unitId: self.id,
            targetUnitId: target.id,
          });
          return;
        }
        target.runtimeState = target.runtimeState || {};
        target.runtimeState.opponentPowerFixed = self.power;
        runtime.addLog(state, "hook", `${self.name} 以【逆位】使 ${target.name} 获得【认知失调 ${self.power}】。`, {
          unitId: self.id,
          targetUnitId: target.id,
        });
      },
    }),
  }),
  "s3-book-space": defineUnit({
    name: "时空之书",
    power: 6,
    description: "【正位】使炼金术士卡特失去所有已出现的时空闭环 POWER，并使影子获得这些 POWER 的【时空闭环】；【逆位】反过来使影子失去、卡特获得。已出现的 POWER 指本局至今所有攻击行为中，攻击者实际出手 POWER 为 0-9 的记录。攻击后【真伪逆转】。",
    runtimeState: {
      stage3Book: true,
      stage3Seal: true,
    },
    hooks: stage3BookHooks({
      onUpright: (runtime, state, { self }) => {
        const shadow = runtime.findUnit(state.battle, "p-robot");
        const carter = runtime.findUnit(state.battle, "s3-alchemist-carter");
        const candidatePowers = [...(state.battle.stageRuntime?.stage3TimeLoopCandidates?.player || [])];
        if (!(self.alive && shadow?.alive)) {
          return;
        }
        if (runtime.isStage3BuffNullified(state, self)) {
          runtime.addLog(state, "hook", `${self.name} 对 ${shadow.name} 施加的【时空闭环】被本回合无效化。`, {
            unitId: self.id,
            targetUnitId: shadow.id,
          });
          return;
        }
        shadow.runtimeState = shadow.runtimeState || {};
        if (carter) {
          carter.runtimeState = carter.runtimeState || {};
          carter.runtimeState.stage3TimeLoops = (carter.runtimeState.stage3TimeLoops || [])
            .filter((value) => !candidatePowers.includes(value));
        }
        shadow.runtimeState.stage3TimeLoops = [...new Set([...(shadow.runtimeState.stage3TimeLoops || []), ...candidatePowers])]
          .filter((value) => value >= 0 && value <= 9)
          .sort((a, b) => a - b);
        runtime.addLog(state, "hook", `${self.name} 以【正位】将已出现的时空闭环 POWER 转移给 ${shadow.name}。`, {
          unitId: self.id,
          targetUnitId: shadow.id,
        });
      },
      onReversedAfter: (runtime, state, { self }) => {
        const carter = runtime.findUnit(state.battle, "s3-alchemist-carter");
        const shadow = runtime.findUnit(state.battle, "p-robot");
        const candidatePowers = [...(state.battle.stageRuntime?.stage3TimeLoopCandidates?.enemy || [])];
        if (!(self.alive && carter?.alive)) {
          return;
        }
        if (runtime.isStage3BuffNullified(state, self)) {
          runtime.addLog(state, "hook", `${self.name} 对 ${carter.name} 施加的【时空闭环】被本回合无效化。`, {
            unitId: self.id,
            targetUnitId: carter.id,
          });
          return;
        }
        carter.runtimeState = carter.runtimeState || {};
        if (shadow) {
          shadow.runtimeState = shadow.runtimeState || {};
          shadow.runtimeState.stage3TimeLoops = (shadow.runtimeState.stage3TimeLoops || [])
            .filter((value) => !candidatePowers.includes(value));
        }
        carter.runtimeState.stage3TimeLoops = [...new Set([...(carter.runtimeState.stage3TimeLoops || []), ...candidatePowers])]
          .filter((value) => value >= 0 && value <= 9)
          .sort((a, b) => a - b);
        runtime.addLog(state, "hook", `${self.name} 以【逆位】将已出现的时空闭环 POWER 转移给 ${carter.name}。`, {
          unitId: self.id,
          targetUnitId: carter.id,
        });
      },
    }),
  }),
  "s3-memory-impurity": defineUnit({
    name: "记忆碎片·杂质",
    power: 0,
    description: "▲：攻击前使对方【真伪逆转】。",
    tags: ["▲"],
    runtimeState: {
      removeOnDestroyed: true,
    },
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (!(self.alive && isStage3CombatAttacker(self, attacker) && defender?.alive)) {
            return;
          }
          runtime.stage3InvertUnit(state, defender, self);
        },
      ],
    },
  }),
  "s3-memory-matrix": defineUnit({
    name: "记忆碎片·基质",
    power: 1,
    description: "▲：攻击前使影子 POWER +1，并使对方【真伪逆转】。",
    tags: ["▲"],
    runtimeState: {
      removeOnDestroyed: true,
    },
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (!(self.alive && isStage3CombatAttacker(self, attacker))) {
            return;
          }
          const shadow = runtime.findUnit(state.battle, "p-robot");
          if (shadow?.alive) {
            runtime.addDirectPower(state, shadow, 1, {
              sourceUnit: self,
              sourceUnitId: self.id,
            });
            runtime.addLog(state, "hook", `${self.name} 使 ${shadow.name} 的 POWER +1。`, {
              unitId: self.id,
              targetUnitId: shadow.id,
            });
          }
          if (defender?.alive) {
            runtime.stage3InvertUnit(state, defender, self);
          }
        },
      ],
    },
  }),
  "s3-memory-raw": defineUnit({
    name: "记忆碎片·未整理",
    power: 2,
    description: "▲：攻击前使影子 POWER +2，并召唤【记忆碎片·信号工蜂】【记忆碎片·纸鸢】【记忆碎片·水铃儿】【记忆碎片·调度B细胞-网关】【记忆碎片·使命】，并使对方【真伪逆转】。战斗结束后自毁。",
    tags: ["▲"],
    runtimeState: {
      removeOnDestroyed: true,
    },
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (!(self.alive && isStage3CombatAttacker(self, attacker))) {
            return;
          }
          const shadow = runtime.findUnit(state.battle, "p-robot");
          if (!shadow?.alive) {
            return;
          }
          runtime.addDirectPower(state, shadow, 2, {
            sourceUnit: self,
            sourceUnitId: self.id,
          });
          runtime.addLog(state, "hook", `${self.name} 使 ${shadow.name} 的 POWER +2。`, {
            unitId: self.id,
            targetUnitId: shadow.id,
          });
          if (!self.runtimeState?.stage3RawSummoned) {
            runtime.summonUnit(state, { template: "s3-memory-signal", id: "s3-memory-signal", slot: 4, side: "player" });
            const kite = runtime.summonUnit(state, { template: "s3-memory-kite", id: "s3-memory-kite", slot: 6, side: "player" });
            runtime.summonUnit(state, { template: "s3-memory-waterbell", id: "s3-memory-waterbell", slot: 8, side: "player" });
            runtime.summonUnit(state, { template: "s3-memory-gateway", id: "s3-memory-gateway", slot: 10, side: "player" });
            runtime.summonUnit(state, { template: "s3-memory-mission", id: "s3-memory-mission", slot: 12, side: "player" });
            if (kite) {
              kite.runtimeState = kite.runtimeState || {};
              kite.runtimeState.stage3IgnoreNextDestroyedBy = self.id;
            }
            self.runtimeState = self.runtimeState || {};
            self.runtimeState.stage3RawSummoned = true;
          }
          if (defender?.alive) {
            runtime.stage3InvertUnit(state, defender, self);
          }
        },
      ],
      afterCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (!isStage3CombatAttacker(self, attacker)) {
            return;
          }
          runtime.destroyUnit(state, self, "stage3-raw-self-destroy", { attacker, defender });
        },
      ],
    },
  }),
  "s3-memory-signal": defineUnit({
    name: "记忆碎片·信号工蜂",
    power: 3,
    description: "▲：攻击后使对方【真伪逆转】。本回合之后每个攻击的单位，在攻击时获得上一个攻击者的 POWER。",
    tags: ["▲"],
    hooks: {
      modifyCombatPower: [
        (runtime, state, { self, attacker, currentPower }) => {
          if (self.id !== attacker?.id || state.battle.stageRuntime.stage3SignalBoostTurn !== state.battle.turn) {
            return currentPower;
          }
          const previousAttacker = runtime.getPreviousCombatAttacker(state);
          return previousAttacker ? currentPower + previousAttacker.power : currentPower;
        },
      ],
      previewCombatBonus: [
        (runtime, state, { self }) => {
          if (state.battle.stageRuntime.stage3SignalBoostTurn !== state.battle.turn) {
            return 0;
          }
          const previousAttacker = runtime.getPreviousCombatAttacker(state);
          return previousAttacker && previousAttacker.id !== self.id ? previousAttacker.power : 0;
        },
      ],
      afterCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (!(self.alive && isStage3CombatAttacker(self, attacker))) {
            return;
          }
          state.battle.stageRuntime.stage3SignalBoostTurn = state.battle.turn;
          if (defender?.alive) {
            runtime.stage3InvertUnit(state, defender, self);
          }
        },
      ],
    },
  }),
  "s3-memory-kite": defineUnit({
    name: "记忆碎片·纸鸢",
    power: 9,
    description: "▲：攻击时，若自身 POWER 大于对方，则使对方【真伪逆转】。●：每有一个己方单位被摧毁，本单位 POWER -2。",
    tags: ["▲", "●"],
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (!(self.alive && isStage3CombatAttacker(self, attacker) && defender?.alive)) {
            return;
          }
          if (self.power > defender.power) {
            runtime.stage3InvertUnit(state, defender, self);
          }
        },
      ],
      onUnitDestroyed: [
        (runtime, state, { self, destroyedUnit }) => {
          if (!(self.alive && destroyedUnit && destroyedUnit.id !== self.id)) {
            return;
          }
          if (destroyedUnit.id === self.runtimeState?.stage3IgnoreNextDestroyedBy) {
            delete self.runtimeState.stage3IgnoreNextDestroyedBy;
            return;
          }
          if (runtime.getControlSide(destroyedUnit) !== runtime.getControlSide(self)) {
            return;
          }
          runtime.addDirectPower(state, self, -2, {
            sourceUnit: destroyedUnit,
            sourceUnitId: destroyedUnit.id,
          });
          runtime.addLog(state, "hook", `${self.name} 因己方单位被摧毁而 POWER -2。`, {
            unitId: self.id,
            sourceUnitId: destroyedUnit.id,
          });
          runtime.enforcePowerBounds(state, self, { cause: "stage3-kite-grief", sourceUnitId: destroyedUnit.id });
        },
      ],
    },
  }),
  "s3-memory-waterbell": defineUnit({
    name: "记忆碎片·水铃儿",
    power: 6,
    description: "▲：攻击后，强制将敌人所有单位本回合的攻击目标修改为自身，并在本回合免于被摧毁。之后每被攻击一次，POWER -1。",
    tags: ["▲"],
    hooks: {
      afterCombat: [
        (runtime, state, { self, attacker }) => {
          if (!(self.alive && isStage3CombatAttacker(self, attacker))) {
            return;
          }
          state.battle.stageRuntime.stage3ForcedEnemyTargetTurn = state.battle.turn + 1;
          state.battle.stageRuntime.stage3ForcedEnemyTargetId = self.id;
          self.runtimeState.stage3WaterbellGuardTurn = state.battle.turn + 1;
          self.runtimeState.stage3WaterbellAwakened = true;
          runtime.addLog(state, "hook", `${self.name} 吸引了本回合敌方全部攻击目标。`, {
            unitId: self.id,
          });
        },
      ],
      preventCombatDestruction: [
        (runtime, state, { self, threatenedUnit }) => (
          self.id === threatenedUnit.id
          && self.runtimeState?.stage3WaterbellGuardTurn === state.battle.turn
        ),
      ],
      beforeCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (!(self.alive && self.runtimeState?.stage3WaterbellAwakened && self.id === defender?.id)) {
            return;
          }
          runtime.addDirectPower(state, self, -1, {
            sourceUnit: attacker,
            sourceUnitId: attacker?.id || null,
          });
          runtime.addLog(state, "hook", `${self.name} 每被攻击一次，POWER -1。`, {
            unitId: self.id,
          });
          runtime.enforcePowerBounds(state, self, { cause: "stage3-waterbell-hit" });
        },
      ],
    },
  }),
  "s3-memory-mission": defineUnit({
    name: "记忆碎片·使命",
    power: 1,
    description: "◆：使场上任意单位 POWER 增加或减少【场上单位的 BUFF 总数】。▲：攻击时，使对方 POWER 变更为 5。",
    tags: ["◆", "▲"],
    viewHooks: {
      inspectorEntries: [
        (runtime, battle) => ({
          key: "当前修正值",
          value: `±${countAllBuffStacks({ battle })}`,
        }),
      ],
    },
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (!(self.alive && isStage3CombatAttacker(self, attacker) && defender?.alive)) {
            return;
          }
          runtime.applyDirectPowerChange(state, defender, 5, {
            sourceUnit: self,
            sourceUnitId: self.id,
          });
          runtime.addLog(state, "hook", `${self.name} 将 ${defender.name} 的 POWER 变更为 5。`, {
            unitId: self.id,
            targetUnitId: defender.id,
          });
        },
      ],
    },
  }),
  "s3-memory-gateway": defineUnit({
    name: "记忆碎片·调度B细胞-网关",
    power: 7,
    description: "▲：攻击时，使【记忆碎片·信号工蜂】【记忆碎片·纸鸢】【记忆碎片·水铃儿】依次对目标发起攻击；之后复活所有已被摧毁的【记忆碎片·信号工蜂】【记忆碎片·纸鸢】【记忆碎片·水铃儿】。",
    tags: ["▲"],
    hooks: {
      afterCombat: [
        (runtime, state, { self, attacker }) => {
          if (!(self.alive && isStage3CombatAttacker(self, attacker))) {
            return;
          }
          ["s3-memory-signal", "s3-memory-kite", "s3-memory-waterbell"].forEach((id) => {
            const unit = runtime.findUnit(state.battle, id);
            if (unit && !unit.alive) {
              runtime.reviveUnit(state, unit, "stage3-memory-gateway", self, "player");
            }
          });
        },
      ],
    },
  }),
};

UNIT_CATALOG["s3-memory-mission"].description = "◆：使场上任意单位 POWER 增加或减少【已生效的时空闭环 POWER 数量】。▼：攻击时，使对方 POWER 变更为 5。";
UNIT_CATALOG["s3-memory-mission"].viewHooks = {
  ...UNIT_CATALOG["s3-memory-mission"].viewHooks,
  inspectorEntries: [
    (runtime, battle) => {
      const units = [...(battle?.playerUnits || []), ...(battle?.enemyUnits || [])];
      const loopCount = units.reduce(
        (total, unit) => total + ((unit?.runtimeState?.stage3TimeLoops || []).length),
        0
      );
      return {
        key: "当前修正值",
        value: `±${loopCount}`,
      };
    },
  ],
};

UNIT_CATALOG["s3-book-soul"].description = "POWER7 【正位】使己方 POWER 最低的单位获得【认知失调 X】；【逆位】攻击之后使对方获得【认知失调 X】；X 为自身 POWER。【认知失调 X】：战斗时，对方 POWER 视为 X。攻击后【真伪逆转】。";
UNIT_CATALOG["s3-book-soul"].hooks = stage3BookHooks({
  onUpright: (runtime, state, { self, target }) => {
    if (!self.alive) {
      return;
    }
    if (runtime.isStage3BuffNullified(state, self)) {
      runtime.addLog(state, "hook", `${self.name} 对${target?.name || "目标"}施加的【认知失调】被本回合无效化。`, {
        unitId: self.id,
        targetUnitId: target?.id || null,
      });
      return;
    }
    const allies = runtime.getFriendlySupportUnits(state, self, runtime.getControlSide(self));
    const recipient = runtime.pickByPower(allies, "lowest", self);
    if (!recipient) {
      return;
    }
    recipient.runtimeState = recipient.runtimeState || {};
    recipient.runtimeState.opponentPowerFixed = self.power;
    runtime.addLog(state, "hook", `${self.name} 以【正位】使 ${recipient.name} 获得【认知失调 ${self.power}】。`, {
      unitId: self.id,
      targetUnitId: recipient.id,
    });
  },
  onReversedAfter: (runtime, state, { self, target }) => {
    if (!(self.alive && target?.alive)) {
      return;
    }
    if (runtime.isStage3BuffNullified(state, self)) {
      runtime.addLog(state, "hook", `${self.name} 对${target.name}施加的【认知失调】被本回合无效化。`, {
        unitId: self.id,
        targetUnitId: target.id,
      });
      return;
    }
    target.runtimeState = target.runtimeState || {};
    target.runtimeState.opponentPowerFixed = self.power;
    runtime.addLog(state, "hook", `${self.name} 以【逆位】使 ${target.name} 获得【认知失调 ${self.power}】。`, {
      unitId: self.id,
      targetUnitId: target.id,
    });
  },
});

UNIT_CATALOG["s3-book-space"].hooks = stage3BookHooks({
  onUpright: (runtime, state, { self }) => {
    const shadow = runtime.findUnit(state.battle, "p-robot");
    const carter = runtime.findUnit(state.battle, "s3-alchemist-carter");
    const candidatePowers = [...(state.battle.stageRuntime?.stage3TimeLoopCandidates?.player || [])];
    if (!(self.alive && shadow?.alive)) {
      return;
    }
    if (runtime.isStage3BuffNullified(state, self)) {
      runtime.addLog(state, "hook", `${self.name} 对${shadow.name}施加的【时空闭环】被本回合无效化。`, {
        unitId: self.id,
        targetUnitId: shadow.id,
      });
      return;
    }
    state.battle.stageRuntime.stage3TimeLoopCandidates = { player: [], enemy: [] };
    shadow.runtimeState = shadow.runtimeState || {};
    if (carter) {
      carter.runtimeState = carter.runtimeState || {};
      carter.runtimeState.stage3TimeLoops = (carter.runtimeState.stage3TimeLoops || [])
        .filter((value) => !candidatePowers.includes(value));
    }
    shadow.runtimeState.stage3TimeLoops = [...new Set([...(shadow.runtimeState.stage3TimeLoops || []), ...candidatePowers])]
      .filter((value) => value >= 0 && value <= 9)
      .sort((a, b) => a - b);
    runtime.addLog(state, "hook", `${self.name} 以【正位】将已出现的时空闭环 POWER 转移给${shadow.name}。`, {
      unitId: self.id,
      targetUnitId: shadow.id,
    });
  },
  onReversedAfter: (runtime, state, { self }) => {
    const carter = runtime.findUnit(state.battle, "s3-alchemist-carter");
    const shadow = runtime.findUnit(state.battle, "p-robot");
    const candidatePowers = [...(state.battle.stageRuntime?.stage3TimeLoopCandidates?.enemy || [])];
    if (!(self.alive && carter?.alive)) {
      return;
    }
    if (runtime.isStage3BuffNullified(state, self)) {
      runtime.addLog(state, "hook", `${self.name} 对${carter.name}施加的【时空闭环】被本回合无效化。`, {
        unitId: self.id,
        targetUnitId: carter.id,
      });
      return;
    }
    state.battle.stageRuntime.stage3TimeLoopCandidates = { player: [], enemy: [] };
    carter.runtimeState = carter.runtimeState || {};
    if (shadow) {
      shadow.runtimeState = shadow.runtimeState || {};
      shadow.runtimeState.stage3TimeLoops = (shadow.runtimeState.stage3TimeLoops || [])
        .filter((value) => !candidatePowers.includes(value));
    }
    carter.runtimeState.stage3TimeLoops = [...new Set([...(carter.runtimeState.stage3TimeLoops || []), ...candidatePowers])]
      .filter((value) => value >= 0 && value <= 9)
      .sort((a, b) => a - b);
    runtime.addLog(state, "hook", `${self.name} 以【逆位】将已出现的时空闭环 POWER 转移给${carter.name}。`, {
      unitId: self.id,
      targetUnitId: carter.id,
    });
  },
});

function getUnitDefinition(code) {
  return UNIT_CATALOG[code] || defineUnit({
    name: code,
    power: 0,
    description: "",
  });
}

module.exports = {
  EMPTY_HOOKS,
  EMPTY_VIEW_HOOKS,
  STANDARD_DISPLAY,
  UNIT_CATALOG,
  getUnitDefinition,
};
