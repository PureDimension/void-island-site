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
