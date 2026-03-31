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

function mergeHooks(hooks = {}) {
  return {
    beforeCombat: hooks.beforeCombat || [],
    modifyCombatPower: hooks.modifyCombatPower || [],
    preventCombatDestruction: hooks.preventCombatDestruction || [],
    afterCombat: hooks.afterCombat || [],
    onDestroyed: hooks.onDestroyed || [],
    previewCombatBonus: hooks.previewCombatBonus || [],
  };
}

function defineUnit(config) {
  return {
    ...config,
    tags: config.tags || [],
    display: { ...STANDARD_DISPLAY, ...(config.display || {}) },
    hooks: mergeHooks(config.hooks),
    viewHooks: {
      ...EMPTY_VIEW_HOOKS,
      ...(config.viewHooks || {}),
      inspectorEntries: config.viewHooks?.inspectorEntries || [],
    },
    runtimeState: config.runtimeState || {},
  };
}

const UNIT_CATALOG = {
  robot: defineUnit({
    name: "【影子】",
    power: 3,
    description: "◆【显现】：整场游戏所有关卡仅一次。仅当本单位主动攻击时，可将本次战斗中的 POWER 视为 1-9 的指定值。若本单位被摧毁，则游戏失败。",
    tags: ["◆"],
    hooks: {
      modifyCombatPower: [
        (runtime, state, { self, attacker, currentPower, overloadPower }) => {
          if (self.id === attacker.id && overloadPower !== null) {
            return overloadPower;
          }
          return currentPower;
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
      + "电脑攻击目标为没有【标记】且没有【抗体】、并且 POWER 最低的另一个单位。"
      + "战斗前：目标 POWER 永久 -2，本单位 POWER 永久 +2。",
    tags: ["▲"],
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
      + "电脑攻击目标为没有【标记】且没有【抗体】、并且 POWER 最高的另一个单位。"
      + "本单位不直接战斗，而是令己方所有存活的“巡检单核体”“清理溶酶虫”依次攻击目标。"
      + "▼：行动结束后，复活己方所有已阵亡的“巡检单核体”“清理溶酶虫”“补体屏障”。",
    tags: ["▲", "▼"],
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
          const candidates = runtime.getFriendlyUnitsByOriginalSide(state, self)
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
    description: `▲：电脑攻击目标为一个持有【${BUFF_CATALOG[MARK_BUFF].shortLabel}】的其他单位。若与持有【${BUFF_CATALOG[MARK_BUFF].shortLabel}】的单位发生战斗，则本次战斗必定胜利。`,
    tags: ["▲"],
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
    description: "●：若本单位作为被攻击者进入战斗，则不会因本次战斗被摧毁。▼：若本单位本次战斗中作为被攻击者，则战斗结束后与主动攻击者永久交换能力；该交换不改变目标原本的攻击目标索引逻辑。",
    tags: ["●", "▼"],
    hooks: {
      preventCombatDestruction: [
        (runtime, state, { self, threatenedUnit, defender }) => {
          if (self.id !== threatenedUnit.id || self.id !== defender.id) {
            return false;
          }
          runtime.addLog(state, "hook", `${self.name} 在被攻击时免于被摧毁。`, {
            unitId: self.id,
          });
          return true;
        },
      ],
      afterCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (self.id !== defender.id || !attacker) {
            return;
          }
          runtime.swapAbilities(state, self, attacker);
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
    description: `▲：若本单位攻击的目标没有【${BUFF_CATALOG[ANTIBODY_BUFF].shortLabel}】，则使其获得【${BUFF_CATALOG[VIRUS_BUFF].shortLabel}】。`
      + `【${BUFF_CATALOG[VIRUS_BUFF].shortLabel}】：${BUFF_CATALOG[VIRUS_BUFF].description}`,
    tags: ["▲"],
    hooks: {
      beforeCombat: [
        (runtime, state, { self, attacker, defender }) => {
          if (self.id !== attacker.id || !defender?.alive) {
            return;
          }
          if (runtime.hasBuff(defender, ANTIBODY_BUFF)) {
            return;
          }
          runtime.applyBuff(state, VIRUS_BUFF, defender, self);
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
};

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
