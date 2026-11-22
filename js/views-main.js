/* js/views-main.js · 主壳视图：选年龄段、首页、急救入口、地图、工作间、静修列表。
   经典脚本顺序加载，与 js/core.js 共享全局词法作用域；不要在此重复声明已有的顶层名字。 */

/* ---------------------------------------------------------------- 视图：选年龄段 */
/* 一次性提示：渲染当前页面时取走并清空，避免换档 / 重开的提示串到下一屏 */
function takeTip() {
  if (!session.tip) return '';
  const html = `<div class="notice">${esc(session.tip)}</div>`;
  session.tip = '';
  return html;
}
function renderAgeGate() {
  clearAsyncTimers();
  session.view = 'gate';
  session.tip = '';
  stage.innerHTML = `<div class="view">
    <span class="eyebrow">第一步 · 之后随时能改</span>
    <h2 style="margin:12px 0 10px">先选一下，谁来玩</h2>
    <p class="lead">不同年龄用的是不同题目：选项多少、线索长短、要不要读给你听，都会跟着变。6-12 岁这一档先玩基础题，走过一次后可以随时切到「多想一步」。孩子与亲子档共用一套站，成年档是单独的一套；两边进度各自保留，换档不会丢。</p>
    <div class="age-grid">${AGE_BANDS.map(b =>
      `<div class="age-pick">
        <button class="age-card ${b.id === 'adult' ? 'adult-card' : ''}" data-action="set-band" data-b="${b.id}" data-next="home">
          <span class="age-icon" aria-hidden="true">${esc(b.icon || '')}</span>
          <span class="age-name">${esc(b.name)}</span><span class="age-tag">${esc(b.tag)}</span>
          <span class="age-desc">${esc(b.desc)}</span><span class="age-len">${esc(b.len)}${b.mindful ? ' · 含静修间' : ''}</span>
          <span class="age-go">点这里进去 →</span>
        </button>
        <button class="age-read" data-action="speak-band" data-b="${b.id}" aria-label="读一读「${esc(b.name)}」这一档的介绍">🔊</button>
      </div>`).join('')}</div>
    <p class="home-note">前三档面向孩子与亲子共玩；最后一项是给自己的，另有一间不打卡的静修间。拿不准就选 6-12 岁那档，随时可以在「设置」里换。不会记录年龄，也不会上传任何信息。</p>
  </div>`;
  updateTopbar();
  resetViewScroll();
}

/* ---------------------------------------------------------------- 视图：首页 */
function renderHome() {
  clearAsyncTimers();
  session.view = 'home';
  const b = band();
  const cleared = clearedInTrack();
  const hasAnyProgress = cleared > 0;
  const nextIdx = nextStationIndex();
  const nextLv = nextIdx >= 0 ? LEVELS[nextIdx] : null;
  /* 首页按年龄档分层（docs/design-home-toolbar.html 方案 B）：
     - 孩子档（3-6 / 6-12）：只摆主路径与急救；换年龄段、词典、工具箱、慢变量收进页脚「给大人」。
       自助工具箱 31 张卡未按年龄筛选、场景多为成年情境，孩子的即时安抚由急救入口承担。
     - 3-6 岁：再去掉站数与卖点列表，下一站只报站名；主按钮旁给一个「读给我听」（不自动读，待定）。
     - 亲子：知识入口保留，标题改「一起看看」。成年：静修间升为第二按钮，工作间开放后在首页给入口。
     - 进度只说一遍：下一站卡里的「已走过 X / N 站」；「从头再来」挪进设置，先确认、可撤销。
     「给大人」只是折叠，不设门槛——加验证就得存东西，和「不采集」冲突。 */
  const kidHome = isKidTone();
  const tiny = b.id === 'a3';
  const nextMeta = nextLv
    ? `<span class="home-next-kicker">${hasAnyProgress ? '接着上次 · 下一站' : '从这里开始'}</span>
       <b>${tiny ? esc(nextLv.name) : `第 ${nextIdx + 1} 站 · ${esc(nextLv.name)}`}</b>
       ${tiny ? '' : `<span class="home-next-meta">${esc(nextLv.kind)} · 已走过 ${cleared} / ${TOTAL} 站</span>`}`
    : `<span class="home-next-kicker">这一轨已经走完</span>
       <b>${TOTAL} 站都走过了</b>
       <span class="home-next-meta">可以回地图重温任意一站，或换一个年龄段。</span>`;
  const ctaText = nextLv
    ? (tiny ? (hasAnyProgress ? '继续上岛' : '开始上岛') : `${hasAnyProgress ? '继续上岛' : '开始上岛'} · 第 ${nextIdx + 1} 站`)
    : '回地图挑一站';
  const speakHome = tiny && state.settings.speak
    ? '<button class="btn-read btn-speak" data-action="speak-home" aria-label="读一读首页">🔊 读给我听</button>' : '';
  const retreatBtn = isAdultTrack() ? '<button class="btn btn-secondary" data-action="open-retreat">只做 1 分钟练习</button>' : '';
  const workOpen = isAdultTrack() && WORK.length && (sideUnlocked(0) || WORK.some((w, i) => workReachable(i)));
  const workCard = workOpen ? `<button class="home-work" data-action="go-work">
          <span class="home-work-kicker">支线 · 已开放 · 不计进度</span>
          <b>工作间：一个工作日的 ${WORK.length} 个时刻</b>
          <span>会前、汇报被否、冲突、下班反刍。</span>
        </button>` : '';
  const knowledge = kidHome
    ? `<details class="home-adult"><summary>给大人 · 换年龄段、词典与工具</summary>
          <div class="home-adult-menu">
            <button class="btn-read" data-action="goto-band">换年龄段</button>
            <button class="btn-read" data-action="open-dictionary">心理学词典</button>
            <button class="btn-read" data-action="open-selfhelp">自助工具箱</button>
            <button class="btn-read" data-action="open-slowvars">慢变量</button>
          </div></details>`
    : `<div class="home-shortcuts">
          <span class="muted">${isAdultTrack() ? '工具：' : '一起看看：'}</span>
          <button class="btn-read" data-action="open-dictionary">心理学词典</button>
          <button class="btn-read" data-action="open-selfhelp">自助工具箱</button>
          <button class="btn-read" data-action="open-slowvars">慢变量</button>
        </div>`;
  stage.innerHTML = `<div class="view home-hero${tiny ? ' home-tiny' : ''}">
    <div class="toolbar">${bandChip()}${kidHome ? '' : '<button class="btn-read" data-action="goto-band">换年龄段</button>'}</div>
    <div class="home-grid">
      <div class="home-main">
        ${tiny ? '' : '<span class="eyebrow">随时可以离开</span>'}
        <h2>不赶走情绪，先认出它</h2>
        <p class="lead">这里不考你答得对不对，只帮你看清此刻的感觉，再带走一个用得上的小工具。</p>
        ${takeTip()}
        <div class="home-next">${nextMeta}</div>
        <div class="actions">
          <button class="btn btn-primary" data-action="start">${ctaText}</button>
          ${speakHome}${retreatBtn}
        </div>
        ${workCard}
        <div class="help-entry">
          <div class="help-entry-copy">
            <span class="help-entry-kicker">不用上岛 · 约 1 分钟</span>
            <b>${kidHome ? '现在有点难受？' : '现在很难受？'}</b>
            <span>先落地、给感受一个词、找一个人。不计进度，也不保存。</span>
          </div>
          <button class="btn help-entry-btn" data-action="open-help">先缓一缓</button>
        </div>
        <p class="home-note">全程不联网；天气选择只留在这一次，不会被保存，也没有每日签到。${isAdultTrack() ? '成年档与儿童档的进度分开记。' : ''}</p>
      </div>
      <aside class="home-side">
        <div class="home-horizon" aria-hidden="true">
          <span class="hh-sun"></span>
          <span class="hh-islet i1"></span><span class="hh-islet i2"></span><span class="hh-islet i3"></span>
          <span class="hh-route"></span>
          <span class="hh-land"></span>
          <span class="hh-wave"></span><span class="hh-wave w2"></span>
        </div>
        ${tiny ? '' : `<div class="home-points">
          <div class="home-point"><span class="dot"></span><span><b>没有标准答案。</b>不打分、不排名，也不比谁快。</span></div>
          <div class="home-point"><span class="dot"></span><span><b>一站一个玩法。</b>拼线索、调刻度、排顺序，动脑也动手。</span></div>
          <div class="home-point"><span class="dot"></span><span><b>按 ${esc(b.name)} 出题。</b>${esc(b.len)}。</span></div>
        </div>`}
        ${knowledge}
      </aside>
    </div>
  </div>`;
  updateTopbar();
  resetViewScroll();
}

/* ---------------------------------------------------------------- 视图：急救入口
   三个判断：
   1. 做成独立视图而不是弹窗——要放下三个动作和求助信息，弹窗在 390px 上会变成
      一个内部滚动的小盒子；急救时最不该出现的就是「内容藏在滚动条里」。
   2. 三步全部在本页内完成，不跳去静修间或关卡——否则「现在很难受」就变成
      「先去别处」，1 分钟也守不住。
   3. 完成状态与选中的词只存在内存里，不进 localStorage、不进存档。 */
function renderHelp() {
  clearAsyncTimers(); stopSpeech();
  session.view = 'help'; session.navDir = '';
  helpWord = null; helpGroundDone = false;
  const kid = isKidTone();
  const ground = HELP_ACTIONS.find(a => a.id === 'ground') || {};
  const nameAct = HELP_ACTIONS.find(a => a.id === 'name') || {};
  const reach = HELP_ACTIONS.find(a => a.id === 'reach') || {};
  const say = kid ? reach.sayKid : reach.say;
  const backLabels = {
    map: '回到地图', gate: '回到选年龄段', level: '回到刚才那一站',
    retreat: '回到静修间', dict: '回到词典', selfhelp: '回到工具箱', slowvars: '回到慢变量',
    work: '回到工作间'
  };
  const backLabel = backLabels[session.helpFrom] || '回到首页';
  stage.innerHTML = `<div class="view help-view">
    <div class="toolbar">${state.band ? bandChip() : ''}<button class="btn-read" data-action="help-close">${backLabel}</button></div>
    <span class="eyebrow">${esc(HELP.eyebrow)}</span>
    <h2 class="help-title">${esc(HELP.title)}</h2>
    <p class="lead">${esc(HELP.lead)}</p>
    <div class="help-crisis" role="note">
      <b>${kid ? '如果还是很难受' : '如果有伤害自己的念头'}</b>
      <p>${kid
        ? '先去找身边的大人——爸爸妈妈、老师或任何你信任的大人。不要一个人待着。'
        : '先联系一个你信任的人，或拨打 12356；如果有立即危险，请拨打 120 / 110，或去最近的急诊。'}</p>
    </div>
    <div class="help-actions">
      <section class="help-action" aria-labelledby="help-h-ground">
        <div class="help-head"><span class="help-num" aria-hidden="true">1</span><h3 id="help-h-ground">${esc(ground.name)}</h3><span class="help-len">${esc(ground.len)}${ground.tag ? ` · ${esc(ground.tag)}` : ''}</span></div>
        <p class="help-lead">${esc(ground.lead)}</p>
        <ol class="help-steps">${(ground.steps || []).map(s => `<li>${esc(s)}</li>`).join('')}</ol>
        <button class="btn btn-secondary help-do" data-action="help-ground">我跟着做完了</button>
        <p class="help-done" id="help-ground-done" role="status" hidden>${esc(ground.done)}</p>
      </section>
      <section class="help-action" aria-labelledby="help-h-name">
        <div class="help-head"><span class="help-num" aria-hidden="true">2</span><h3 id="help-h-name">${esc(nameAct.name)}</h3><span class="help-len">${esc(nameAct.len)}</span></div>
        <p class="help-lead">${esc(nameAct.lead)}</p>
        <div class="help-words" role="group" aria-label="挑一个最接近的词">
          ${(nameAct.words || []).map(w => `<button class="help-word" data-action="help-word" data-w="${esc(w)}">${esc(w)}</button>`).join('')}
        </div>
        <p class="help-picked" id="help-picked" role="status" hidden></p>
      </section>
      <section class="help-action" aria-labelledby="help-h-reach">
        <div class="help-head"><span class="help-num" aria-hidden="true">3</span><h3 id="help-h-reach">${esc(reach.name)}</h3><span class="help-len">${esc(reach.len)}</span></div>
        <p class="help-lead">${esc(kid ? reach.kidLead : reach.lead)}</p>
        <p class="help-say">「${esc(say)}」</p>
        <button class="btn btn-secondary help-do" data-action="help-speak" data-say="${esc(say)}">读给我听</button>
        <p class="help-hint">${esc(reach.hint)}</p>
      </section>
    </div>
    ${kid
      ? `<section class="help-lines help-kid">
          <h3>${esc(HELP_KID.title)}</h3>
          <p>${esc(HELP_KID.body)}</p>
          <p class="help-note">${esc(HELP_KID.note)}</p>
        </section>`
      : `<section class="help-lines">
          <h3>${esc(HELP_NUMBERS.title)}</h3>
          <ul>${(HELP_NUMBERS.items || []).map(it => `<li><b>${esc(it.k)}</b>${esc(it.t)}</li>`).join('')}</ul>
          <p class="help-note">${esc(HELP_NUMBERS.note)}</p>
        </section>`}
    <p class="home-note help-foot">不用做完，也不用变好。随时可以离开，什么都不用留下。</p>
  </div>`;
  updateTopbar();
  resetViewScroll();
}

/* ---------------------------------------------------------------- 视图：地图
   地图是一条「手绘航线」：四座岛画在同一张海图上，岛内站点用虚线航迹连起来。
   所有装饰层（海岸线、等高线、罗盘、水纹）都是 aria-hidden 的 SVG，信息仍然只在
   节点按钮上：站名、玩法、锁定原因、下一站，一个都不少。 */
/* 海岸线形状：viewBox 0 0 100 100，随岛块拉伸；只作为氛围，不参与交互 */
const ISLAND_TRACES = [
  'M5,46 C4,26 18,12 38,9 C60,5 82,14 91,32 C99,50 92,70 74,82 C54,95 24,90 10,72 C5,64 5,54 5,46 Z',
  'M7,50 C6,30 20,14 40,11 C62,7 84,18 92,36 C99,54 88,74 70,86 C50,98 22,92 11,74 C7,67 7,57 7,50 Z',
  'M6,42 C8,24 26,11 47,9 C70,7 88,19 93,38 C97,54 87,60 90,72 C84,86 66,92 48,88 C26,84 12,74 6,62 C4,54 5,48 6,42 Z',
  'M6,48 C7,28 22,13 43,10 C66,7 86,17 92,34 C98,51 91,69 78,82 C63,96 34,95 15,79 C8,71 5,58 6,48 Z'
];
/* 岛内的一道等高线，让「地图」不只是四个色块 */
const ISLAND_CONTOURS = [
  'M16,52 C22,32 44,20 64,28 C78,34 82,50 72,64 C58,78 30,76 20,62',
  'M18,50 C24,30 46,20 66,30 C80,40 80,58 66,70 C50,84 26,76 18,62',
  'M17,44 C24,26 48,18 68,26 C82,34 84,52 72,66 C58,80 30,80 18,66',
  'M18,52 C22,34 42,24 62,30 C78,36 80,54 68,66 C54,80 28,76 18,62'
];
/* 岛内的高地轮廓，补一点「地形图」的密度 */
const ISLAND_HIGHLANDS = [
  'M36,32 C48,28 62,32 64,42 C65,51 52,56 42,50 C34,45 32,37 36,32 Z',
  'M38,34 C50,30 64,34 65,44 C66,53 52,57 43,51 C36,46 34,38 38,34 Z',
  'M37,33 C49,29 63,33 65,43 C66,52 53,57 43,51 C35,46 33,38 37,33 Z',
  'M36,34 C48,30 62,34 64,44 C65,53 51,57 42,51 C34,46 32,38 36,34 Z'
];
const MAP_COMPASS = `<svg class="map-compass" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
  <circle cx="32" cy="32" r="21" fill="none" stroke="currentColor" stroke-width="1" opacity=".55"/>
  <path d="M32 8 L38 32 L32 40 L26 32 Z" fill="currentColor" opacity=".55"/>
  <path d="M32 40 L38 32 L32 56 L26 32 Z" fill="currentColor" opacity=".2"/>
  <text x="32" y="5" text-anchor="middle" font-size="7" fill="currentColor" opacity=".8">N</text>
</svg>`;
/* 「从头再来」后的撤销提示：只在同一条轨、且还有站可恢复时出现；进了新的一站即失效。 */
function undoNotice() {
  const u = session.undoRestart;
  if (!u || u.track !== bandTrack() || !u.ids.length) return '';
  return `<div class="notice undo-notice"><span>刚才重来了一轮。如果是点错了，可以恢复之前走过的 ${u.ids.length} 站。</span>
    <button class="btn-read" data-action="restart-undo">撤销重来</button></div>`;
}
function renderMap() {
  clearAsyncTimers();
  session.view = 'map';
  const list = islands();
  const trackCards = LEVELS.map(l => l.card).filter(Boolean);
  const trackSkills = LEVELS.map(l => l.skill).filter(Boolean);
  const gotCards = trackCards.filter(c => cardsInTrack().includes(c)).length;
  const gotSkills = trackSkills.filter(s => state.skills.includes(s)).length;
  /* 唯一一个「现在就能继续」的站：已解锁且没走过。终章也算，全部走完时它会被点亮。 */
  const nextIdx = LEVELS.findIndex((l, i) => isUnlocked(i) && !state.cleared.includes(l.id));
  const interrupted = session.interrupted;
  session.interrupted = false;
  let html = `<div class="${viewClass()}">
    ${interrupted ? '<div class="notice">刚才的呼吸练习被打断了，不用补上。想做的时候随时可以重新开始。</div>' : ''}
    ${takeTip()}
    ${undoNotice()}
    <div class="map-head"><div><span class="eyebrow">岛屿地图 · ${esc(band().name)}</span>
      <h2 style="margin-top:10px">想去哪站，就去哪站</h2>
      <p class="lead">${list.length} 座岛连成一条航线。同一座岛里的站可以随便进出；走过的还能再走，每次题目会换一批。</p></div></div>
    <div class="toolbar">${bandChip()}<span class="muted">${esc(band().len)}</span>
      <button class="btn-read" data-action="goto-band">换年龄段</button></div>
    ${nextIdx >= 0 ? `<div class="map-next">
      <div class="map-next-copy">
        <span class="map-next-kicker">下一站 · ${LEVELS[nextIdx].type === 'finale' ? '终章' : `岛 ${LEVELS[nextIdx].island}`}</span>
        <b>第 ${nextIdx + 1} / ${TOTAL} 站 · ${esc(LEVELS[nextIdx].name)}</b>
        <span class="map-next-meta">${esc(LEVELS[nextIdx].kind)} · 已走过 ${clearedInTrack()} / ${TOTAL} 站</span>
      </div>
      <button class="btn btn-primary" data-action="continue">从这里继续</button>
    </div>` : `<div class="map-next is-done">
      <div class="map-next-copy">
        <span class="map-next-kicker">这一轨已经走完</span>
        <b>${TOTAL} 站都走过了</b>
        <span class="map-next-meta">想重温哪一站，直接点下面的站点就好。</span>
      </div>
      <button class="btn btn-secondary" data-action="restart-ask">从头再来一轮</button>
    </div>`}
    <div class="map-legend-row" aria-hidden="true">
      <div class="map-legend">
        <span class="map-lg"><i class="lg-dot"></i>还没走</span>
        <span class="map-lg"><i class="lg-dot done"></i>走过</span>
        <span class="map-lg"><i class="lg-dot locked"></i>未解锁</span>
      </div>
      ${MAP_COMPASS}
    </div>
    <div class="map-board">`;
  list.forEach((isl, islIdx) => {
    const items = LEVELS.filter(l => l.island === isl.n && l.type !== 'finale');
    const doneCount = items.filter(l => state.cleared.includes(l.id)).length;
    const shape = ISLAND_TRACES[(isl.n - 1) % ISLAND_TRACES.length];
    const contour = ISLAND_CONTOURS[(isl.n - 1) % ISLAND_CONTOURS.length];
    const highland = ISLAND_HIGHLANDS[(isl.n - 1) % ISLAND_HIGHLANDS.length];
    html += `<section class="island" data-island="${isl.n}">
      <div class="island-art" aria-hidden="true"><svg viewBox="0 0 100 100" preserveAspectRatio="none" focusable="false">
        <path class="isle-water" d="${shape}"/>
        <path class="isle-land" d="${shape}"/>
        <path class="isle-edge" d="${shape}"/>
        <path class="isle-contour" d="${contour}"/>
        <path class="isle-contour alt" d="${highland}"/>
      </svg></div>
      <div class="island-head">
        <div class="island-label">
          <span class="island-kicker">岛 ${isl.n}</span>
          <span class="island-name">${esc(isl.name)}</span>
          <span class="island-theme">${esc(isl.theme)}</span>
        </div>
        <span class="island-count">${doneCount} / ${items.length} 站</span>
      </div>
      <div class="node-grid">`;
    const firstLocked = items.findIndex(l => !isUnlocked(LEVELS.indexOf(l)));
    items.forEach((l, itemIdx) => {
      const idx = LEVELS.indexOf(l);
      const done = state.cleared.includes(l.id);
      const unlocked = isUnlocked(idx);
      const isNext = idx === nextIdx;
      const extra = l.card ? `，会留下「${esc(l.card)}」词卡` : '';
      const lockedHint = itemIdx === firstLocked ? '未解锁 · 先走过上一岛最后一站' : '未解锁';
      html += `<button class="node ${done ? 'done' : ''} ${isNext ? 'next' : ''} ${session.lastCleared === l.id ? 'just-done' : ''} ${unlocked ? '' : 'locked'}" data-action="open-level" data-i="${idx}" ${unlocked ? '' : 'disabled'} aria-label="${esc(l.name)}${done ? '，已走过' : ''}${isNext ? '，可以从这里继续' : ''}${unlocked ? '，' + esc(l.kind) + extra : '，尚未解锁'}"${unlocked ? '' : ' title="先走过上一座岛的最后一站"'}>
        ${isNext ? '<span class="node-next">下一站</span>' : ''}
        <span class="node-pin" aria-hidden="true">${done ? '✓' : esc(String(l.num || '·'))}</span>
        <span class="node-name">${esc(l.name)}</span>
        <span class="node-type">${unlocked ? esc(l.kind) : lockedHint}</span>
      </button>`;
    });
    html += `</div></section>`;
    if (islIdx < list.length - 1) html += `<div class="route-gap" aria-hidden="true"></div>`;
  });
  const fin = LEVELS[TOTAL - 1] || {};
  const finaleOpen = isUnlocked(TOTAL - 1);
  const finDesc = finaleOpen
    ? (isAdultTrack() ? '挑一句带走，看看这一程练过的，也可以什么都不挑。' : '布置小岛、看看这一轮练过的本领，带走一句话和一张可以一起聊的卡片。')
    : `走完前 ${TOTAL - 1} 站后开放。不用着急，一站一站来。`;
  html += `<div class="route-gap finale-gap" aria-hidden="true"></div>
    <div class="finale-entry ${finaleOpen ? 'open' : 'locked'}">
      <span class="finale-flag" aria-hidden="true"><svg viewBox="0 0 32 44" focusable="false">
        <path d="M12 41 V5" stroke="currentColor" stroke-width="1.6" fill="none"/>
        <path d="M13 7 L27 13 L13 19 Z" fill="currentColor" opacity=".85"/>
        <path d="M6 41 H20" stroke="currentColor" stroke-width="1.6" fill="none" opacity=".5"/>
      </svg></span>
      <div class="finale-body"><h3>终章 · ${esc(fin.name || '小结')}</h3>
        <p>${finDesc}</p></div>
      <button class="btn ${finaleOpen ? 'btn-primary' : 'btn-secondary'}" data-action="open-level" data-i="${TOTAL - 1}" ${finaleOpen ? '' : 'disabled'}>${finaleOpen ? '去终章' : '还没开放'}</button>
    </div>
    <p class="map-caption" aria-hidden="true">手绘航线 · 不按比例</p>
    <svg class="map-wave" viewBox="0 0 240 40" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d="M0,20 C20,10 40,30 60,20 S100,10 120,20 S160,30 180,20 S220,10 240,20"/>
    </svg>
  </div>`;
  const mindful = !!band().mindful;
  /* 入口按「什么时候会用到」分组：先随身工具，再知识，最后收集。
     原来的 7 个按钮平铺，主次全靠阅读顺序；分组后主线和支线的权重一眼能分开。 */
  html += `<div class="map-hub">
    <section class="hub-block">
      <div class="hub-head"><h3>随时可用</h3><span class="muted">不计进度 · 随时可停</span></div>
      <div class="hub-grid">
        <button class="hub-card hub-help" data-action="open-help">
          <span class="hub-name">${isKidTone() ? '现在有点难受' : '现在很难受'}</span>
          <span class="hub-desc">三个 1 分钟动作：先落地、给感受一个词、找一个人。</span>
          <span class="hub-meta">不计进度 · 不保存 · 随时可停</span>
        </button>
        <button class="hub-card" data-action="open-bottle">
          <span class="hub-name">今日漂流瓶</span>
          <span class="hub-desc">从 ${BOTTLES.length} 个问题里抽一个，和自己聊一句；答案不保存。</span>
          <span class="hub-meta">一题就够 · 不记录</span>
        </button>
        <button class="hub-card" data-action="${mindful ? 'open-retreat' : 'goto-band'}">
          <span class="hub-name">静修间</span>
          <span class="hub-desc">${MD_FAMILIES.length} 个练习族 × 2 档，或按此刻的场景挑一个。</span>
          <span class="hub-meta">${mindful ? `${MD_PRACTICES.length + RETREAT.length} 个练习 · 不记录` : '成年档开放 · 现在可切换'}</span>
        </button>
      </div>
    </section>
    ${isAdultTrack() && WORK.length ? `<section class="hub-block">
      <div class="hub-head"><h3>专题 · 工作间</h3><span class="muted">支线 · 不计入 ${TOTAL} 站</span></div>
      <div class="hub-grid">
        <button class="hub-card hub-work" data-action="go-work">
          <span class="hub-name">工作间</span>
          <span class="hub-desc">会前、汇报被否、冲突、下班反刍：四个工作日的时刻。</span>
          <span class="hub-meta">${sideUnlocked(0) || WORK.some((w, i) => workReachable(i)) ? `${WORK.length} 个时刻 · 不加奖励` : `走完 ${WORK_GATE} 后开放`}</span>
        </button>
      </div>
    </section>` : ''}
    <section class="hub-block">
      <div class="hub-head"><h3>知识与工具</h3><span class="muted">想查就查，不占进度</span></div>
      <div class="hub-grid">
        <button class="hub-card" data-action="open-dictionary">
          <span class="hub-name">心理学词典</span>
          <span class="hub-desc">${DICTIONARY.length} 条概念，按主题找、按类型挑，或直接搜。</span>
          <span class="hub-meta">${DICT_GROUPS.length} 组 · ${DICT_CATS.length} 个主题 · 本地搜索</span>
        </button>
        <button class="hub-card" data-action="open-selfhelp">
          <span class="hub-name">自助工具箱</span>
          <span class="hub-desc">按此刻的状态，挑一张能马上用的小工具卡。</span>
          <span class="hub-meta">${SH_TOOLS.length} 张卡 · ${SH_STATES.length} 种状态</span>
        </button>
        <button class="hub-card" data-action="open-slowvars">
          <span class="hub-name">慢变量</span>
          <span class="hub-desc">健康、关系、三观这些长期底盘，慢一点看。</span>
          <span class="hub-meta">${SV_VARS.length} 个变量 · ${SV_PRACTICES.length} 张练习</span>
        </button>
      </div>
    </section>
    <section class="hub-block">
      <div class="hub-head"><h3>这一趟的收集</h3><span class="muted">走过才会留下</span></div>
      <div class="hub-grid two">
        <button class="hub-card" data-action="open-codex">
          <span class="hub-name">词卡图鉴</span>
          <span class="hub-desc">每走过一站，会留下一张可以回看的词卡。</span>
          <span class="hub-meta">${gotCards} / ${trackCards.length} 张</span>
        </button>
        <button class="hub-card" data-action="open-skills">
          <span class="hub-name">本领清单</span>
          <span class="hub-desc">这一程练过的小本领，都收在这里。</span>
          <span class="hub-meta">${gotSkills} / ${trackSkills.length} 个</span>
        </button>
      </div>
    </section>
  </div>
  <div class="map-foot"><button class="btn btn-ghost" data-action="open-settings">显示、朗读与数据</button></div>
    <p class="home-note">没有每日签到，也没有连续登录奖励。想来就来，进度不会掉。${band().adult ? '每一站底下都留了一句给大人的话。' : ''}${mindful ? '呼吸与正念练习可以随时停止，不算中断。' : ''}${isAdultTrack() ? '成年档与儿童档的进度分开记，互不影响。' : ''}</p>
  </div>`;
  stage.innerHTML = html;
  updateTopbar();
  resetViewScroll();   /* 之后若 session.mapScroll 有值，rAF 会再恢复到那一站 */
  const justDone = session.lastCleared;
  session.lastCleared = '';
  if (session.mapScroll) {
    const y = session.mapScroll;
    session.mapScroll = 0;
    requestAnimationFrame(() => { try { window.scrollTo(0, y); } catch (e) { /* noop */ } });
  }
  if (justDone) setTimeout(() => {
    const n = document.querySelector('.node.just-done');
    if (n) n.classList.remove('just-done');
  }, 1800);
}

/* ---------------------------------------------------------------- 工作间（成年档支线）
   时间线不是一个平铺题库：四幕按一个工作日的时间往下排，每幕只说一个时刻。
   完成只写 state.sideCleared；这里不显示「已完成几幕」，避免变成打卡。 */
function renderWork() {
  clearAsyncTimers(); stopSpeech();
  session.view = 'work'; session.navDir = '';
  const done = new Set(state.sideCleared);
  const open0 = workReachable(0);
  const stops = WORK.map((l, i) => {
    const unlocked = workReachable(i);
    const finished = done.has(l.id);
    const stateText = finished ? '✓ 走过' : unlocked ? '去这一幕' : (i === 0 ? `走完 ${WORK_GATE} 开放` : '先走上一幕');
    return `<button class="work-stop ${finished ? 'done' : ''} ${unlocked ? '' : 'locked'}" data-action="open-work-level" data-i="${i}" ${unlocked ? '' : 'disabled'}>
      <span class="work-time">${esc(l.time)}</span>
      <span class="work-body">
        <span class="work-name">${esc(l.name)}</span>
        <span class="work-kind">${esc(l.kind)}</span>
        <span class="work-goal">${esc(l.goal)}</span>
      </span>
      <span class="work-state">${esc(stateText)}</span>
    </button>`;
  }).join('');
  stage.innerHTML = `<div class="${viewClass()} work-view">
    <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
    ${takeTip()}
    <span class="eyebrow">成年档 · 专题支线</span>
    <h2 style="margin-top:10px">工作间</h2>
    <p class="lead">四个时刻，沿着一个工作日往下走。它是支线：不计入 ${TOTAL} 站，也不加贝壳、词卡或本领；主线停在哪一站，出来还是那一站。</p>
    ${!open0 ? `<div class="notice">走完地图上的 ${WORK_GATE} 后开放第一幕。</div>` : ''}
    <div class="work-line">${stops}</div>
    <p class="home-note">不用按顺序打卡，也不记录时长。想停就停，进度只留在本机。</p>
  </div>`;
  updateTopbar();
  resetViewScroll();
}

/* ---------------------------------------------------------------- 静修间（成年档支线） */
function retreatSafety() { return `<div class="retreat-safety">${esc(RETREAT_SAFETY)}</div>`; }

/* 按「此刻的状态」分组展示：只是排列顺序，不是筛选器，也不要求用户先描述感受 */
const RETREAT_GROUPS = ['现在很烦', '现在很累', '睡不着', '心里空'];
function retreatCard(r, i) {
  return `<button class="retreat-card" data-action="retreat-start" data-i="${i}">
    <span class="retreat-name">${esc(r.name)}</span>
    <span class="retreat-sub">${esc(r.when || r.sub)}</span>
    <span class="retreat-len">${esc(r.minutes)} · 随时可停</span>
  </button>`;
}
function mdCard(p) {
  return `<button class="retreat-card md-card" data-action="md-start" data-id="${esc(p.id)}">
    <span class="retreat-name">${esc(p.name)}</span>
    <span class="retreat-sub">${esc(p.sub)}</span>
    <span class="retreat-len">${esc(p.minutes)} · 随时可停</span>
  </button>`;
}
function renderRetreatList() {
  clearAsyncTimers(); stopSpeech();
  session.view = 'retreat'; session.navDir = ''; session.retreatStep = -1;
  const indexed = RETREAT.map((r, i) => ({ r, i }));
  const groups = RETREAT_GROUPS.map(m => ({ m, list: indexed.filter(x => x.r.mood === m) }))
    .filter(g => g.list.length);
  const other = indexed.filter(x => !RETREAT_GROUPS.includes(x.r.mood));
  if (other.length) groups.push({ m: '别的时刻', list: other });
  const curScene = mdScene === 'all' || MD_SCENES.some(s => s.id === mdScene) ? mdScene : 'all';
  mdScene = curScene;
  const shorts = MD_PRACTICES.filter(p => p.dose === 1);
  const nowList = (curScene === 'all' ? shorts : shorts.filter(p => (p.scenes || []).includes(curScene))).slice(0, 3);
  const sceneBtns = [`<button class="md-scene ${curScene === 'all' ? 'on' : ''}" data-action="md-scene" data-s="all" aria-pressed="${curScene === 'all'}">都可以</button>`]
    .concat(MD_SCENES.map(s => `<button class="md-scene ${curScene === s.id ? 'on' : ''}" data-action="md-scene" data-s="${esc(s.id)}" aria-pressed="${curScene === s.id}">${esc(s.name)}</button>`)).join('');
  const familyCards = MD_FAMILIES.map(f => {
    const one = MD_PRACTICES.find(p => p.family === f.id && p.dose === 1);
    const three = MD_PRACTICES.find(p => p.family === f.id && p.dose === 3);
    if (!one || !three) return '';
    return `<div class="md-family">
      <div class="md-family-head"><b>${esc(f.name)}</b><span>${esc(f.sub)}</span></div>
      <div class="md-doses">
        <button class="btn-read" data-action="md-start" data-id="${esc(one.id)}">短版 · ${esc(one.minutes)}</button>
        <button class="btn-read" data-action="md-start" data-id="${esc(three.id)}">长版 · ${esc(three.minutes)}</button>
      </div>
    </div>`;
  }).join('');
  stage.innerHTML = `<div class="view">
    <div class="toolbar">${bandChip()}<button class="btn-read" data-action="go-map">回到地图</button></div>
    <span class="eyebrow">静修间 · 不计进度</span>
    <h2 style="margin:12px 0 10px">不用完成什么，坐一会儿就好</h2>
    <p class="lead">${MD_FAMILIES.length} 个练习族、${MD_PRACTICES.length} 条引导，加上 ${RETREAT.length} 个情境练习。按此刻的场景挑一个，或者从最短的开始。没有连续天数、没有提醒、不记录你做过几次。</p>
    ${MD_PRACTICES.length ? `<section class="md-now" aria-labelledby="md-now-title">
      <h3 class="retreat-group-title" id="md-now-title">此刻</h3>
      <div class="md-scenes" role="group" aria-label="按此刻的场景挑一个">${sceneBtns}</div>
      <div class="md-now-grid">${nowList.map(mdCard).join('')}</div>
    </section>` : ''}
    ${retreatSafety()}
    ${MD_PRACTICES.length ? `<section class="md-families" aria-labelledby="md-fam-title">
      <h3 class="retreat-group-title" id="md-fam-title">练习族 · 每个只教一个动作</h3>
      <div class="md-family-grid">${familyCards}</div>
    </section>` : ''}
    <details class="md-more">
      <summary>更多情境练习 · ${RETREAT.length} 个</summary>
      ${groups.map(g => `<section class="retreat-group">
        <h3 class="retreat-group-title">${esc(g.m)}</h3>
        <div class="retreat-grid">${g.list.map(x => retreatCard(x.r, x.i)).join('')}</div></section>`).join('')}
    </details>
    <p class="home-note">这些练习参考了正念与认知取向里常见的通用思路，经过简化，只是一般性的放松方式，不是治疗，也不能代替专业帮助。可以睁眼，也可以随时停。</p>
  </div>`;
  updateTopbar();
  resetViewScroll();
}
