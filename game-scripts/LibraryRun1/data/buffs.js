const BUFF_CATALOG = {
  "electromagnetic-interference": {
    key: "electromagnetic-interference",
    label: "电磁干扰",
    shortLabel: "电磁干扰",
    description: "POWER -3；若本单位被摧毁，则最后一次与之战斗的单位获得【电磁干扰】。",
    stackable: true,
    timing: "persistent",
  },
  antibody: {
    key: "antibody",
    label: "抗体",
    shortLabel: "抗体",
    description: "本身没有额外效果，但会影响部分单位的目标判定。",
    stackable: false,
    timing: "persistent",
  },
  mark: {
    key: "mark",
    label: "标记",
    shortLabel: "标记",
    description: "本身没有额外效果，但会影响部分单位的目标判定。",
    stackable: false,
    timing: "persistent",
  },
  virus: {
    key: "virus",
    label: "病毒",
    shortLabel: "病毒",
    description: "获得后不会立刻生效。当当前回合数大于本单位的 POWER 时，【病毒】开始生效且之后不再失效。生效后，本单位会被视为改变阵营，并以新阵营的身份处理“己方”与“敌方”描述。",
    stackable: false,
    timing: "persistent",
  },
};

BUFF_CATALOG.virus.description = "获得后不会立刻生效。当当前回合数大于等于本单位的 POWER 时，【病毒】开始生效且之后不再失效。生效后，本单位会永久改变阵营，并以新阵营的身份处理“己方”与“敌方”描述。";

module.exports = {
  BUFF_CATALOG,
  EMP_BUFF: BUFF_CATALOG["electromagnetic-interference"].key,
  ANTIBODY_BUFF: BUFF_CATALOG.antibody.key,
  MARK_BUFF: BUFF_CATALOG.mark.key,
  VIRUS_BUFF: BUFF_CATALOG.virus.key,
};

BUFF_CATALOG["electromagnetic-interference"].label = "电磁干扰";
BUFF_CATALOG["electromagnetic-interference"].shortLabel = "电磁干扰";
BUFF_CATALOG["electromagnetic-interference"].description = "POWER -3；若本单位被摧毁，则最后一次与之战斗的单位获得【电磁干扰】。";

BUFF_CATALOG.antibody.label = "抗体";
BUFF_CATALOG.antibody.shortLabel = "抗体";
BUFF_CATALOG.antibody.description = "本身没有额外效果，但会影响部分单位的目标判定。";

BUFF_CATALOG.mark.label = "标记";
BUFF_CATALOG.mark.shortLabel = "标记";
BUFF_CATALOG.mark.description = "本身没有额外效果，但会影响部分单位的目标判定。";

BUFF_CATALOG.virus.label = "病毒";
BUFF_CATALOG.virus.shortLabel = "病毒";
BUFF_CATALOG.virus.description = "获得后不会立刻生效。当当前回合数大于等于本单位的 POWER 时，【病毒】开始生效且之后不再失效。生效后，本单位会永久改变阵营，并以新阵营的身份处理“己方”与“敌方”描述。";

BUFF_CATALOG["cognitive-consonance"] = {
  key: "cognitive-consonance",
  label: "认知协调",
  shortLabel: "认知协调",
  description: "战斗时，自身 POWER 视为指定值。新的【认知协调】会覆盖旧的【认知协调】。",
  stackable: false,
  timing: "persistent",
  derived: true,
};

BUFF_CATALOG["cognitive-dissonance"] = {
  key: "cognitive-dissonance",
  label: "认知失调",
  shortLabel: "认知失调",
  description: "战斗时，对方 POWER 视为指定值。新的【认知失调】会覆盖旧的【认知失调】。",
  stackable: false,
  timing: "persistent",
  derived: true,
};

BUFF_CATALOG["time-loop"] = {
  key: "time-loop",
  label: "时空闭环",
  shortLabel: "时空闭环",
  description: "广域能力。任意单位发生战斗时，如己方参与战斗的单位 POWER 命中任一记录值，则本场战斗玩家失败。新的【时空闭环】会继续追加记录值。",
  stackable: true,
  timing: "persistent",
  derived: true,
};

module.exports.COGNITIVE_CONSONANCE_BUFF = BUFF_CATALOG["cognitive-consonance"].key;
module.exports.COGNITIVE_DISSONANCE_BUFF = BUFF_CATALOG["cognitive-dissonance"].key;
module.exports.TIME_LOOP_BUFF = BUFF_CATALOG["time-loop"].key;

BUFF_CATALOG["cognitive-dissonance"].label = "认知失调";
BUFF_CATALOG["cognitive-dissonance"].shortLabel = "认知失调";
BUFF_CATALOG["cognitive-dissonance"].description = "战斗时，对方 POWER 视为指定值（本场战斗不触发）。新的【认知失调】会覆盖旧的同类状态。";
BUFF_CATALOG["time-loop"].label = "时空闭环";
BUFF_CATALOG["time-loop"].shortLabel = "时空闭环";
BUFF_CATALOG["time-loop"].description = "广域能力。任意单位发生战斗时，若玩家方参战单位的 POWER 命中任一已生效值，则该战斗直接失败。新的【时空闭环】会继续追加记录值。";
