/* 概念层 · 16 个概念，是「站点 / 工具 / 词典 / 慢变量」的共同锚点。
   纯数据，不含逻辑。kid / adult 是两轨各自可见的词卡名（与 CODEX 键一致）；
   line 是终章展示的一句话；mechanism 解释「这个动作为什么可能有用」，措辞保守；
   dose 是统一的动作规格：大约多久、几步、什么时候停；dict / tools / slowvars / stations 是反链。
   加载顺序见 index.html。 */
window.MI = window.MI || {};
/* 边界与安全：自助工具箱 / 慢变量 / 静修 / 词典共用这一份，避免四处措辞各写一遍后漂移。 */
MI.safety = {
  text: '这里是科普与一般性自助练习，不是诊断，也不是治疗，不能替代专业评估。如果身体或情绪持续不舒服，请找医生或专业支持；如果当下有伤害自己或他人的念头，先离开危险环境，联系当地急救或危机干预热线，或让可信任的人陪着你。'
};

MI.glossary = [
  {
    id: 'notice', kid: '觉察', adult: '觉察',
    line: '先注意到「我有感觉」，比马上处理它更要紧；情绪本身没有好坏。',
    mechanism: '把模糊的感觉说成一个词，可能让大脑从「被情绪推着走」切到「我正在感觉到什么」。这一步的效应通常很小，但它是后面所有动作的前提。',
    dose: { time: '约 30 秒', steps: 1, stop: '任何时候可以停' },
    dict: null, tools: [], slowvars: ['attention'],
    stations: ['1-1', 'A1-1']
  },
  {
    id: 'body', kid: '身体信号', adult: '身体信号',
    line: '身体常常比语言更早告诉我们一些事。',
    mechanism: '紧张常先出现在肩膀、呼吸、手心这些地方。先看可观察的信号，比先猜原因更容易上手；同一种感觉对不同人意味不同，所以它只当线索，不当结论。',
    dose: { time: '约 30 秒', steps: 1, stop: '任何时候可以停' },
    dict: '内感受', tools: ['5-4-3-2-1 锚定', '渐进肌肉放松', '睡眠节律', '日光与昼夜节律'], slowvars: ['health'],
    stations: ['1-2', 'A1-2', 'W-1']
  },
  {
    id: 'intensity', kid: '强度', adult: '强度',
    line: '把「很难受」放上刻度，才知道下一步该做什么。',
    mechanism: '把感受放到一个粗略的刻度上，可能让「很难受」变成「大概七分」。分量一旦分得开，动作就有得选：三分可以继续，八分需要先停。',
    dose: { time: '约 30 秒', steps: 1, stop: '不用纠结准确，给个大概就行' },
    dict: null, tools: ['微恢复'], slowvars: ['health'],
    stations: ['1-3', 'A1-3']
  },
  {
    id: 'granularity', kid: '情绪粒度', adult: '命名',
    line: '说得越准，越知道自己缺什么，脑子里的警报也会小一点。',
    mechanism: '用更具体的词区分感受，和更好的调节有关，但多数证据是相关而非因果。词更准，选错动作的概率会小一些；它也解释不了全部，别把命名当成终点。',
    dose: { time: '约 1 分钟', steps: 2, stop: '想不出更准的词就先停在这里' },
    dict: '情绪粒度', tools: ['自动思维'], slowvars: [],
    stations: ['1-4', 'A1-4']
  },
  {
    id: 'breath', kid: '慢呼吸', adult: '呼吸空间',
    line: '呼气长一点，或者只是看着呼吸来去，都可以。',
    mechanism: '把呼气放慢一点，可能让身体从警觉状态松一些；证据多见于短时放松，个体差异大，不舒服就恢复自然呼吸。只观察不调整，是另一种做法，不等于慢呼吸。',
    dose: { time: '约 1 分钟', steps: 3, stop: '头晕或憋气就恢复自然呼吸' },
    dict: null, tools: ['呼气长一点', '渐进肌肉放松'], slowvars: ['attention', 'health'],
    stations: ['2-1', 'A2-1']
  },
  {
    id: 'reframe', kid: '换个镜头', adult: '观察与推测',
    line: '换一个同样站得住的解释，不是把坏事说成好事。',
    mechanism: '同一件事换一种解释，可能改变随后的感受与动作。重评不是否认事实，也不是强迫自己往好处想；新解释必须同样站得住，否则只是换了个说法。',
    dose: { time: '约 1 分钟', steps: 2, stop: '新解释站不住就别硬换' },
    dict: '认知重评', tools: ['认知模型', '自动思维', '想法检验四问', '向下箭头'], slowvars: ['worldview'],
    stations: ['2-2', 'A2-2', 'W-2']
  },
  {
    id: 'chain', kid: '想法的力量', adult: '念头链',
    line: '把事件、念头、身体和动作分开看，链条就松了一格。',
    mechanism: '把事件、念头、身体反应、随后的动作分开写，可能让人看清哪一环最容易松动。它不证明念头是唯一原因，只是把原本糊在一起的东西摆出来。',
    dose: { time: '约 2 分钟', steps: 4, stop: '写到一半卡住就先停' },
    dict: '反刍', tools: ['反刍与担忧'], slowvars: ['craft'],
    stations: ['2-3', 'A2-3', 'W-4']
  },
  {
    id: 'need', kid: '我需要什么', adult: '需要',
    line: '缺的是休息、联结还是活动，认错了补多少都不解渴。不用马上变好，先知道自己需要什么就够了。',
    mechanism: '先认出缺的是休息、联结还是活动，可能让下一步更准。需要和想要不是一回事；认错需要时，补再多也不解渴。',
    dose: { time: '约 1 分钟', steps: 3, stop: '认不出就先选「先歇一下」' },
    dict: null, tools: ['任务拆解'], slowvars: ['purpose'],
    stations: ['2-4', 'A2-4']
  },
  {
    id: 'perspective', kid: '两副眼镜', adult: '视角',
    line: '对方看到的，可能不是同一件事。',
    mechanism: '设想对方掌握的信息和处境，可能让「他就是针对我」变成「我们看到的不是同一件事」。这不是替对方开脱，也不要求你放弃自己的版本。',
    dose: { time: '约 1 分钟', steps: 2, stop: '想不下去就先回到自己的版本' },
    dict: '观点采择', tools: ['社会连接与共同调节'], slowvars: ['relationships', 'worldview'],
    stations: ['3-1', 'A3-1']
  },
  {
    id: 'evidence', kid: '先找线索', adult: '缺失的信息',
    line: '把「看到的」和「补上去的」分开放。',
    mechanism: '把看到的事实和补上去的推测分开放，可能减少把推测当成事实。多数误会里缺的是一条没送到的信息，而不是恶意；但确实有恶意的时候也存在。',
    dose: { time: '约 1 分钟', steps: 2, stop: '线索不够就先别下结论' },
    dict: null, tools: ['行为实验'], slowvars: [],
    stations: ['3-2', 'A3-2']
  },
  {
    id: 'express', kid: '好好说话', adult: '表达',
    line: '说出自己的部分，也给对方留余地；表达和行动是可以选的。',
    mechanism: '用「我看见……我感到……我需要……」的句式，可能让话更容易被接住，也给自己留了余地。它不是话术，也不保证对方一定回应。',
    dose: { time: '约 2 分钟', steps: 3, stop: '情绪升到八分就先停，改天再说' },
    dict: null, tools: ['求助脚本'], slowvars: ['relationships'],
    stations: ['3-3', 'A3-3', 'W-3']
  },
  {
    id: 'review', kid: '记忆配对', adult: '状态与身体',
    line: '把词和身体信号连起来，是一次复习。',
    mechanism: '把情绪词和身体信号配对回忆，是一次检索练习。检索比重复读更容易留下痕迹，但这里只是常见对应，不代表每个人都一样。',
    dose: { time: '约 1 分钟', steps: 2, stop: '配对错了就再看一眼，不用计分' },
    dict: null, tools: [], slowvars: [],
    stations: ['3-4', 'A3-4']
  },
  {
    id: 'control', kid: '担心分筐', adult: '可控范围',
    line: '能做的、要等的、管不了的，分开放。',
    mechanism: '把担心拆成能做的、要等的、管不了的，可能减少反复想同一件事。可控与不可控之间常有灰色地带，拆完不代表问题消失，只是把力气放在能落地的部分。',
    dose: { time: '约 2 分钟', steps: 3, stop: '拆不动就先挑一件最小的' },
    dict: '担忧', tools: ['担忧时间', '问题解决五步'], slowvars: [],
    stations: ['4-1', 'A4-1']
  },
  {
    id: 'anger', kid: '火气分级', adult: '火气分级',
    line: '火气有档位，早一点发现就能早一点选。',
    mechanism: '给火气分档，可能让人更早发现自己在升档，从而在被推着走之前先做一个动作。分档是描述，不是给自己或别人贴标签。',
    dose: { time: '约 1 分钟', steps: 2, stop: '事后回看也算，不必当场做完' },
    dict: null, tools: ['微恢复'], slowvars: [],
    stations: ['4-2', 'A4-2']
  },
  {
    id: 'counter', kid: '接受与修复', adult: '反事实',
    line: '把「如果当时」说出来，遗憾才有形状。',
    mechanism: '把「如果当时」说出来，可能让遗憾从模糊的自责变成具体的一条。承认在意，不等于把责任全归给自己；能修的部分再单独拿出来。',
    dose: { time: '约 2 分钟', steps: 3, stop: '越想越沉就先停，改天再回看' },
    dict: null, tools: ['自我关怀'], slowvars: [],
    stations: ['4-3', 'A4-3']
  },
  {
    id: 'boundary', kid: '边界', adult: '边界',
    line: '说「不」不需要理由充分。',
    mechanism: '把时间和能力说清楚，可能让关系里的期待更可预测。说「不」不需要理由充分，也不等于拒绝对方这个人；边界是关系的一部分，不是关系的反面。',
    dose: { time: '约 1 分钟', steps: 2, stop: '说不出口就先写下来' },
    dict: '边界', tools: ['边界', '求助脚本'], slowvars: ['relationships'],
    stations: ['4-4', 'A4-4']
  }
];
