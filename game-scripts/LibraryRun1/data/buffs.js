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
    description: "本单位会持续到下一个回合结束前临时改变阵营，并以新阵营的身份处理“己方”与“敌方”描述。下一个回合结束时移除。",
    stackable: false,
    timing: "turn-end",
  },
};

module.exports = {
  BUFF_CATALOG,
  EMP_BUFF: BUFF_CATALOG["electromagnetic-interference"].key,
  ANTIBODY_BUFF: BUFF_CATALOG.antibody.key,
  MARK_BUFF: BUFF_CATALOG.mark.key,
  VIRUS_BUFF: BUFF_CATALOG.virus.key,
};
