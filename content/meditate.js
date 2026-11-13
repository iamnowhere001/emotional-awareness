/* 静修间 2.0 · 练习族与引导练习（纯数据）
   5 个族 × 2 档剂量：breath / body / notice / chain / fist。
   每个族只教一个动作；机制与「什么时候不做」写在族上，练习只带步骤。
   全部不记录：没有次数、连续天数、完成度；场景与剂量只在内存里。 */
window.MI = window.MI || {};
MI.meditate = {
  families: [
    {
      id: 'breath', name: '呼吸锚定', sub: '不调整，只跟着', concept: 'breath',
      mechanism: '把注意力放回呼吸，可能让身体从警觉里松一点；呼气稍长对一些人有用，但个体差异大。',
      notFor: '头晕、憋气或不舒服时，恢复自然呼吸，不用硬撑。'
    },
    {
      id: 'body', name: '身体扫描', sub: '从手和脚开始', concept: 'body',
      mechanism: '把注意力放到身体的感觉上，可能更早发现紧张在哪里；感觉不到也算做了，它不是放松任务。',
      notFor: '有创伤史或解离体验时，只做手和脚，或改做声音；任何时候可以睁眼。'
    },
    {
      id: 'notice', name: '声音与空间', sub: '把注意范围放宽', concept: 'notice',
      mechanism: '听声音而不追故事，可能让注意力从反刍里退出来一点；它不是要让脑子安静。',
      notFor: '不追求「没有声音」；环境吵时，听声音本身也可以。'
    },
    {
      id: 'chain', name: '念头路过', sub: '看见它，不跟着走', concept: 'chain',
      mechanism: '给念头贴一个标签，可能让你和念头之间多出一点距离；不是要消除它，也不要求你相信它。',
      notFor: '越贴越紧、越想越沉时，改做呼吸或身体，不用硬做完。'
    },
    {
      id: 'fist', name: '松开拳头', sub: '用对比找到松', concept: 'body',
      mechanism: '握紧再松开，可能让手和前臂的紧张对比更明显；这是渐进肌肉放松的最小版本。',
      notFor: '不用力到疼；手腕、手臂有伤时跳过，或只做一只手的轻握。'
    }
  ],
  scenes: [
    { id: 'meeting', name: '会议前' },
    { id: 'elevator', name: '等电梯' },
    { id: 'sleep', name: '睡前' },
    { id: 'commute', name: '通勤' },
    { id: 'lunch', name: '午休' },
    { id: 'argument', name: '刚吵完架' }
  ],
  practices: [
    {
      id: 'breath-1', family: 'breath', dose: 1, name: '跟着呼吸', sub: '不调整，只跟着',
      minutes: '约 1 分钟',
      intro: '不用改变呼吸，也不用闭眼。只要知道自己在吸气、在呼气。',
      scenes: ['meeting', 'elevator', 'commute', 'sleep'],
      steps: [
        { label: '坐稳', text: '坐稳，脚踩地。手放在哪里都可以。' },
        { label: '一次吸气', text: '注意一次吸气，不用吸满，也不用数。' },
        { label: '一次呼气', text: '再注意一次呼气。呼气可以稍长，不舒服就恢复自然。' },
        { label: '回来', text: '走神了？发现走神，就是回来了。再跟三次呼吸。' }
      ],
      close: '不用做得标准。注意到呼吸来过，就可以停了。'
    },
    {
      id: 'breath-3', family: 'breath', dose: 3, name: '跟着呼吸 · 长版', sub: '给注意力一个落脚点',
      minutes: '约 3 分钟',
      intro: '不控制呼吸。走神就回来，回来这一步就是练习。',
      scenes: ['meeting', 'elevator', 'commute', 'sleep'],
      steps: [
        { label: '坐稳', text: '坐稳，肩膀松一点。眼睛可以睁着。' },
        { label: '找到呼吸', text: '找到呼吸最明显的地方：鼻子、胸口或肚子。' },
        { label: '跟着一进一出', text: '跟着一次吸气、一次呼气。不用数，也不用改。' },
        { label: '走神', text: '发现自己在想别的，就在心里说一句「走神了」。' },
        { label: '回来', text: '把注意力带回呼吸。回来多少次都可以。' }
      ],
      close: '不用清空脑子。能回来一次，就已经在练了。'
    },
    {
      id: 'body-1', family: 'body', dose: 1, name: '手和脚', sub: '先只做两个地方',
      minutes: '约 1 分钟',
      intro: '只做手和脚，不扫全身。睁眼也可以，感觉不到也算做了。',
      scenes: ['sleep', 'lunch'],
      steps: [
        { label: '手', text: '把注意力放到右手：指尖、掌心、手背。' },
        { label: '换一只手', text: '再放到左手。有感觉就停一下，没有也可以。' },
        { label: '脚', text: '注意两只脚：脚底、脚趾、脚跟。' },
        { label: '整个', text: '把手的温度和脚踩地的感觉放在一起，停一会儿。' }
      ],
      close: '不用放松什么。注意到「这里有感觉」，就可以停了。'
    },
    {
      id: 'body-3', family: 'body', dose: 3, name: '身体扫描 · 长版', sub: '从头到脚，粗粗一遍',
      minutes: '约 3 分钟',
      intro: '不追求放松。每个地方停一两秒，不舒服就跳过去。',
      scenes: ['sleep', 'lunch'],
      steps: [
        { label: '坐稳', text: '坐稳或躺下，眼睛可以睁着。先感觉椅背或床面。' },
        { label: '肩和手臂', text: '注意肩膀、手臂、手。紧就紧，不用刻意松。' },
        { label: '胸口和肚子', text: '注意胸口和肚子的起伏。不用改变呼吸。' },
        { label: '腿和脚', text: '注意大腿、小腿、脚底。麻、热、冷都算感觉。' },
        { label: '整个身体', text: '把身体当成一个整体，停三次呼吸。' }
      ],
      close: '哪里不舒服就跳过，不用做完每一个地方。'
    },
    {
      id: 'notice-1', family: 'notice', dose: 1, name: '听三种声音', sub: '不追声音的故事',
      minutes: '约 1 分钟',
      intro: '不用找安静的地方。只挑三种此刻能听到的声音。',
      scenes: ['elevator', 'commute', 'lunch'],
      steps: [
        { label: '最近的声音', text: '先听最近的一种声音，可能是空调或自己的呼吸。' },
        { label: '远一点的声音', text: '再听远一点的声音，可能是走廊或外面的车。' },
        { label: '声音之间的空隙', text: '注意声音之间的安静，哪怕只有一下。' }
      ],
      close: '不用让声音消失。听到什么，就算什么。'
    },
    {
      id: 'notice-3', family: 'notice', dose: 3, name: '声音与空间', sub: '把注意范围放宽',
      minutes: '约 3 分钟',
      intro: '从声音开始，慢慢把注意力放到整个周围。',
      scenes: ['elevator', 'commute', 'lunch'],
      steps: [
        { label: '坐稳', text: '坐稳，眼睛可以睁着。先听最近的声音。' },
        { label: '一层一层', text: '再听远一层、更远一层。不用去找，等它来。' },
        { label: '声音之间', text: '注意声音之间的空隙。空隙长短都没关系。' },
        { label: '整个空间', text: '把注意力放到整个房间，连同自己的身体。' }
      ],
      close: '不用追求「没有声音」。环境吵，也可以这样听。'
    },
    {
      id: 'chain-1', family: 'chain', dose: 1, name: '给念头贴标签', sub: '看见它，不跟着走',
      minutes: '约 1 分钟',
      intro: '不用赶走念头。只给它一个很粗的名字。',
      scenes: ['commute', 'sleep', 'argument'],
      steps: [
        { label: '停一下', text: '停一下，注意脑子里正在转的那句话。' },
        { label: '贴标签', text: '它是「计划」「担心」，还是「回忆」？选一个就好。' },
        { label: '再等一个', text: '等下一个念头出现，再贴一次标签。' },
        { label: '三个就够', text: '贴到三个，就可以停下。' }
      ],
      close: '不是要不想。能看见「这是一个念头」，就已经拉开一点。'
    },
    {
      id: 'chain-3', family: 'chain', dose: 3, name: '看念头来去', sub: '不追，也不赶',
      minutes: '约 3 分钟',
      intro: '把念头当成路过的东西。来就来，走就走。',
      scenes: ['commute', 'sleep', 'argument'],
      steps: [
        { label: '坐稳', text: '坐稳，注意呼吸三次，让注意力落地。' },
        { label: '等一个念头', text: '不用找念头，等它自己出现。' },
        { label: '命名', text: '给它一个名字：计划、担心、评价、回忆。' },
        { label: '不跟', text: '不往下想，也不赶它走。看它自己散掉。' },
        { label: '回来', text: '回到呼吸。下一个念头来了，再这样做。' }
      ],
      close: '越想越紧时，就改做呼吸或身体，不用硬做完。'
    },
    {
      id: 'fist-1', family: 'fist', dose: 1, name: '握拳再松开', sub: '用对比找到松',
      minutes: '约 1 分钟',
      intro: '只做手。不用力到疼，手腕有伤就轻轻来。',
      scenes: ['meeting', 'argument'],
      steps: [
        { label: '握紧', text: '慢慢握拳，用上五成力，握紧约 5 秒。' },
        { label: '注意', text: '注意手心、手指和前臂的紧。' },
        { label: '松开', text: '再慢慢松开约 10 秒，让手摊在腿上。' },
        { label: '对比', text: '停三次呼吸，感受紧和松的差别。' }
      ],
      close: '松不下来也没关系。知道「刚才更紧」就够了。'
    },
    {
      id: 'fist-3', family: 'fist', dose: 3, name: '松开拳头 · 长版', sub: '手、肩、腹、腿',
      minutes: '约 3 分钟',
      intro: '四组，一组一组来。每组只用到五成力。',
      scenes: ['meeting', 'argument'],
      steps: [
        { label: '手', text: '握紧约 5 秒，再松开约 10 秒。注意前臂的变化。' },
        { label: '肩', text: '耸肩上提约 5 秒，再放下。不用耸肩到疼。' },
        { label: '肚子', text: '轻轻收腹约 5 秒，再松开。呼吸照常。' },
        { label: '腿', text: '脚尖抬起约 5 秒，再放下。' },
        { label: '全身', text: '停三次呼吸，感受四肢的重量。' }
      ],
      close: '有伤的地方跳过。做完一组，也可以直接停。'
    }
  ],
  intents: [
    { t: '如果明天坐下打开电脑，就先做三次呼吸。', family: 'breath', scene: 'meeting' },
    { t: '如果等电梯超过十秒，就听三种声音。', family: 'notice', scene: 'elevator' },
    { t: '如果躺下还在想白天的事，就给三个念头贴标签。', family: 'chain', scene: 'sleep' },
    { t: '如果会议开始前还有一分钟，就握拳再松开。', family: 'fist', scene: 'meeting' },
    { t: '如果午休坐下，就先注意手和脚。', family: 'body', scene: 'lunch' },
    { t: '如果通勤路上没事做，就听近处和远处的声音。', family: 'notice', scene: 'commute' },
    { t: '如果刚吵完架，就先注意脚踩地，再说话。', family: 'body', scene: 'argument' },
    { t: '如果今天只做一次，就做最短的那一次。', family: 'all', scene: 'all' }
  ]
};
