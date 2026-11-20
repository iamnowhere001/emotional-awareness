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
    line: '把注意力放回呼吸，看着它来去就好；想调整节奏时再慢慢呼气。',
    mechanism: '把呼气放慢一点，可能让身体从警觉状态松一些；证据多见于短时放松，个体差异大，不舒服就恢复自然呼吸。只观察不调整，是另一种做法，不等于慢呼吸。',
    dose: { time: '约 1～3 分钟（按站里的引导走）', steps: 3, stop: '头晕或憋气就恢复自然呼吸' },
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
    line: '能做的、要等的，先分开放；分得细时还能再分一堆「管不了的」。',
    mechanism: '把担心先分进能做的、要等的两堆，可能减少反复想同一件事；分得细时还能再分一堆「管不了的」。可控与不可控之间常有灰色地带，拆完不代表问题消失，只是把力气放在能落地的部分。',
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
  },
  {
    id: 'shame', kid: '把事和自己分开', adult: '羞耻与内疚',
    line: '做错一件事，不等于变成不好的人；把事和人分开，才有得补。',
    mechanism: '内疚指向具体的行为，通常还留有修补的余地；羞耻指向整个人，容易让人想躲起来。把「我做了什么」和「我是谁」分开说，可能把躲开换成补一句、改一步。',
    dose: { time: '约 1 分钟', steps: 2, stop: '说不出就先在心里过一遍' },
    dict: '自我关怀', tools: ['自我关怀'], slowvars: [],
    stations: ['5-1', 'A5-1']
  },
  {
    id: 'envy', kid: '看见比较', adult: '比较与嫉妒',
    line: '嫉妒不必羞耻，它常常在指出你也很想要的东西。',
    mechanism: '向上的社会比较会让人看到差距，也可能带来嫉妒。把「我不如人」改写成「我也想要那个」，可能把自我否定转成一个方向；感受本身不需要被判对错。',
    dose: { time: '约 1 分钟', steps: 2, stop: '说不出想要什么就先承认「我有点羡慕」' },
    dict: '社会比较', tools: ['比较与社交媒体'], slowvars: [],
    stations: ['5-2', 'A5-2']
  },
  {
    id: 'lonely', kid: '孤单分级', adult: '孤独与归属',
    line: '孤单是「连接不够」的信号，不是「不值得被连接」的证据。',
    mechanism: '孤独感说的是想要的连接和实际的连接之间有落差。给它一个刻度，再找这一档能做的事，可能比笼统地难受好下手；被懂需要时间，不必一次到位。',
    dose: { time: '约 1 分钟', steps: 2, stop: '不想联系就先停，不必勉强' },
    dict: '孤独感', tools: ['社会连接与共同调节'], slowvars: ['relationships'],
    stations: ['5-3', 'A5-3']
  },
  {
    id: 'care', kid: '照顾与开口', adult: '身体照料与求助',
    line: '照顾身体是第一步，开口求助是本事，不是麻烦别人。',
    mechanism: '从可观察的身体信号出发，认出需要，再走到一个具体动作和可以找的人，可能让「硬撑」变成「先照顾、再求助」。持续的不舒服需要认真对待，不是靠忍。',
    dose: { time: '约 2 分钟', steps: 4, stop: '有危险信号立即就医，不必等这一趟做完' },
    dict: '社会支持', tools: ['求助脚本'], slowvars: ['health'],
    stations: ['5-4', 'A5-4']
  }
];

/* 概念关系层：每个概念依赖哪些更早的概念、在哪一站被教、在词典里能接着读哪几条。
   bridge 是「上一站带走什么 → 这一站用它」的一句承接，practice 是与本站概念绑定的
   一个可带走的动作（替代原来随机发的微行动），两轨共用同一份，不写存档、不计数。
   这些字段不写进上面每一条，是为了让「内容」与「关系」分开看；
   运行时由 js/core.js 建反向索引，scripts/lint-content.mjs 会校验：
   - requires 必须是真实概念，且不能成环；
   - teach 必须正好覆盖两轨各一站，并落在该概念的 stations 里；
   - 依赖概念的教学点必须早于本概念的教学点（先教后用）；
   - dicts 里每一条都必须是词典里已有的词条（不新增词条）。
   工作间解锁点由 levels-adult-work.js 的 MI.workGate 给出，lint 会校验四幕用到的概念
   都在解锁点之前教过，避免再次出现「用到但没教」。 */
(() => {
  const links = {
    notice: {
      teach: ['1-1', 'A1-1'], requires: [], dicts: ['注意'],
      bridge: '这是第一站，不用先学会什么。只要留意一下「我现在有感觉」。',
      practice: '今天随便挑一个时刻，在心里说一句「我现在有点……」，说不出词也没关系。'
    },
    body: {
      teach: ['1-2', 'A1-2'], requires: ['notice'], dicts: ['内感受', '具身认知'],
      bridge: '上一站认出「我有感觉」，这一站去找它是从哪儿看出来的：肩膀、呼吸、手心。',
      practice: '停十秒，看看肩膀是松的还是紧的、手心是干还是潮，不用改变它。'
    },
    intensity: {
      teach: ['1-3', 'A1-3'], requires: ['notice', 'body'], dicts: ['情绪', '情绪调节'],
      bridge: '上一站找到了身体线索，这一站给这些线索一个大概的分量。',
      practice: '把此刻最明显的一种感觉，放进「一点点 / 中等 / 很满」里的一格。'
    },
    granularity: {
      teach: ['1-4', 'A1-4'], requires: ['notice', 'intensity'], dicts: ['情绪粒度', '情绪'],
      bridge: '上一站把感受放上了刻度，这一站再给它一个更准的名字。',
      practice: '把「我不太舒服」换成一个更具体的词，比如「有点闷」或「有点委屈」。'
    },
    breath: {
      teach: ['2-1', 'A2-1'], requires: ['body', 'intensity'], dicts: ['正念', '情绪调节'],
      bridge: '上一站把感觉说得更准了，这一站先不处理它，只陪着呼吸待一会儿。',
      practice: '找一个不赶时间的空隙，留意一次吸气、一次呼气，不用改变它；走神就回来。'
    },
    reframe: {
      teach: ['2-2', 'A2-2'], requires: ['notice', 'granularity'], dicts: ['认知重评', '情绪调节'],
      bridge: '上一站让身体慢下来一点，这一站看看同一件事有没有另一种站得住的说法。',
      practice: '挑一件今天有点在意的事，写出另一个同样站得住的解释，不用往好处说。'
    },
    chain: {
      teach: ['2-3', 'A2-3'], requires: ['reframe', 'body'], dicts: ['反刍', '认知解离', '情绪ABC理论'],
      bridge: '上一站换过一次镜头，这一站把感受、想法、动作和需要连成一条线。',
      practice: '把刚才那件事拆成四行：我感觉到什么、我想到什么、我做了什么、我其实需要什么。'
    },
    need: {
      teach: ['2-4', 'A2-4'], requires: ['granularity', 'body'], dicts: ['马斯洛需求层次', '自我决定理论'],
      bridge: '上一站拆开了那条链，这一站看链条尽头：我其实在盼着什么。',
      practice: '在「我有点烦」后面补半句：「大概是因为我盼着……」。'
    },
    perspective: {
      teach: ['3-1', 'A3-1'], requires: ['notice', 'granularity'], dicts: ['观点采择', '心理理论'],
      bridge: '上一站看清自己的需要，这一站试试同一件事在别人眼里是什么样。',
      practice: '同一件事，替当时不在场的另一个人写一句话，猜错也没关系。'
    },
    evidence: {
      teach: ['3-2', 'A3-2'], requires: ['perspective', 'notice'], dicts: ['确认偏差', '认知偏差'],
      bridge: '上一站站到了别人的位置，这一站回来问一句：我看到的和我知道的，差在哪儿。',
      practice: '把「他肯定是……」改成「我看到的是……」，只改这一句。'
    },
    express: {
      teach: ['3-3', 'A3-3'], requires: ['need', 'perspective', 'evidence'], dicts: ['非暴力沟通', '我信息', '主动倾听'],
      bridge: '上一站分清了观察与推测，这一站把「我」说出口，又不把对方推远。',
      practice: '用「我看到…我觉得…我希望…」说一句，先不要求对方回应。'
    },
    review: {
      teach: ['3-4', 'A3-4'], requires: ['notice', 'body', 'granularity'], dicts: ['提取练习', '间隔效应'], review: true,
      bridge: '这一站不教新东西：把岛 1 认过的词凭记忆再取一次，看看留下了哪些。',
      practice: '不看提示，凭记忆说出三个描写感受的词，想不起来就翻图鉴。'
    },
    control: {
      teach: ['4-1', 'A4-1'], requires: ['reframe', 'need'], dicts: ['担忧', '焦虑'],
      bridge: '上一站回看了学过的词，这一站把它们用在一件还没结果的事上。',
      practice: '把现在惦记的事分两堆：今天能动的、只能等的；各写一件就够。'
    },
    anger: {
      teach: ['4-2', 'A4-2'], requires: ['intensity', 'body'], dicts: ['情绪调节', '压力'],
      bridge: '上一站分出了能做的和只能等的，这一站给火气也留一个刻度。',
      practice: '给此刻的火气找一档，再挑那一档对应的一个小动作，做完就算结束。'
    },
    counter: {
      teach: ['4-3', 'A4-3'], requires: ['reframe', 'perspective'], dicts: ['自我关怀', '接纳'],
      bridge: '上一站学会了不急着给火气定性，这一站对「如果当时」也松一点。',
      practice: '把「要是当时我……」改写成「当时我做了…，现在我在意的是…」。'
    },
    boundary: {
      teach: ['4-4', 'A4-4'], requires: ['express', 'need'], dicts: ['边界', '非暴力沟通'],
      bridge: '上一站把「如果当时」说完整了，这一站把话说向别人：我需要什么，到哪里为止。',
      practice: '找一件不太想答应的小事，说一句「这个我先不接」，不需要补理由。'
    },
    shame: {
      teach: ['5-1', 'A5-1'], requires: ['granularity', 'boundary'], dicts: ['自我关怀', '反刍'],
      bridge: '上一站学会了把话说向别人，这一站把话转回自己：做错的事，和「我是谁」分开。',
      practice: '想给自己下判决时，先改成一句「这件事我处理得不好」，停在这里。'
    },
    envy: {
      teach: ['5-2', 'A5-2'], requires: ['reframe', 'granularity'], dicts: ['社会比较', '自尊'],
      bridge: '上一站把自己从事里分了出来，这一站看比较：把「我不如人」换成「我也想要」。',
      practice: '冒出「别人都比我好」时，补一句「我羡慕的到底是哪一个」，只认出它。'
    },
    lonely: {
      teach: ['5-3', 'A5-3'], requires: ['need', 'perspective'], dicts: ['孤独感', '归属不确定性'],
      bridge: '上一站从比较里认出了想要的东西，这一站认出另一种想要：和别人连上。',
      practice: '觉得孤单时，给一个还联系着的人发一句很短的真实话，不用寒暄。'
    },
    care: {
      teach: ['5-4', 'A5-4'], requires: ['body', 'boundary'], dicts: ['社会支持', '情绪调节'],
      bridge: '上一站往别人那里迈了一步，这一站先回到身体：认出信号，也知道什么时候开口找人。',
      practice: '身体不舒服时，先把哪儿、什么时候、多难受说清楚，再决定找谁。'
    }
  };
  MI.glossary.forEach(g => Object.assign(g, links[g.id] || {}));
})();
