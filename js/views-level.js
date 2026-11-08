/* js/views-level.js · 关卡视图：RENDERERS、makePlay、renderLevel、子渲染与通关结果卡。
   经典脚本顺序加载，与 js/core.js 共享全局词法作用域；不要在此重复声明已有的顶层名字。 */

/* ---------------------------------------------------------------- 各关渲染器（规模全部由数据驱动） */
const RENDERERS = {
  weather(v) {
    return `<p class="lead">${esc(v.note)}</p>
      <div class="weather-grid" style="margin-top:18px">${v.items.map((it, i) =>
        `<button class="weather-btn" data-action="weather-pick" data-i="${i}">
          <span class="weather-glyph" aria-hidden="true">${it.g}</span>
          <span class="weather-name">${esc(it.n)}</span>
          <span class="weather-sub">${esc(it.s)}</span></button>`).join('')}</div>
      <div class="actions"><button class="btn btn-primary" data-action="weather-go" id="weather-go" disabled>带着它上岛</button>
      <button class="btn btn-ghost" data-action="weather-go">直接出发</button></div>`;
  },
  clue(v) {
    const opts = shuffled(withIndex(v.options));
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">先翻开线索卡，再想想这些线索合起来像哪种感觉。</p>
      <div class="clue-grid">${v.clues.map((c, i) =>
        `<button class="clue-card" data-action="clue-flip" data-i="${i}"><span class="clue-num">线索 ${i + 1}</span><span class="clue-text">点一下翻开</span></button>`).join('')}</div>
      <div class="opt-grid ${v.options.length > 2 ? 'cols-2' : ''}">${opts.map(({ v: o, i }, k) => optBtn(k, o, '', 'clue-choose', i)).join('')}</div>`;
  },
  slider(v) {
    const n = v.replies.length, mid = Math.ceil(n / 2), labels = sliderLabels(v);
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">${esc(v.question)}</p>
      <div class="thermo">
        <div class="thermo-value" id="thermo-value">${mid} · ${labels[mid - 1]}</div>
        <input type="range" id="thermo" min="1" max="${n}" step="1" value="${mid}" aria-label="感受强度，1 到 ${n}">
        <div class="thermo-labels"><span>1 · ${labels[0]}</span><span>${mid} · ${labels[mid - 1]}</span><span>${n} · ${labels[n - 1]}</span></div>
      </div>
      <p class="muted" style="margin-top:12px">这一关没有正确档位。选完会告诉你，这个刻度下的感受通常长什么样。</p>
      <div class="actions"><button class="btn btn-primary" data-action="slider-submit">就用这一格</button></div>`;
  },
  match(v) {
    return `<p class="prompt">先点左边的一件事，再点右边那个最贴近的词。</p>
      <div class="pair-cols">
        <div class="pair-col"><div class="section-label">发生了什么</div>${v.pairs.map((p, i) =>
          `<button class="pair-item" data-action="pair-left" data-i="${i}">${esc(p.scene)}</button>`).join('')}</div>
        <div class="pair-col"><div class="section-label">心里那个词</div>${shuffled(v.words).map(w =>
          `<button class="pair-item" data-action="pair-right" data-w="${esc(w)}">${esc(w)}</button>`).join('')}</div>
      </div>`;
  },
  breath(v) {
    /* 两种模式：默认 paced（呼气比吸气长一点的慢呼吸）；
       space 是「三分钟呼吸空间」——只留意呼吸与身体，不引导改变节奏，也不播放吸呼动画。 */
    const space = v.mode === 'space';
    return `<div class="breath-box">
      <p class="lead">${esc(v.note)}</p>
      <div class="breath-ring ${space ? 'space' : ''}" id="breath-ring"><span class="breath-word" id="breath-word">准备好了再开始</span></div>
      <div class="breath-round" id="breath-round">${space ? '三段各一分钟，不用调整呼吸，走神就回来。' : '做几轮都算数，随时可以停。'}</div>
      <div class="breath-actions">
        <button class="btn btn-secondary" data-action="breath-start" id="breath-start">${space ? '开始 · 约 3 分钟' : `跟着做 ${v.rounds} 轮`}</button>
        <button class="btn btn-primary" data-action="breath-done">我做完了 / 直接继续</button>
      </div>
      <p class="muted" style="margin-top:14px">头晕、憋气或不想做，就恢复平时呼吸，点右边继续。这里不计分、不计时。</p>
    </div>`;
  },
  reframe(v) {
    /* 拼装题的选项顺序已由组合键确定，不能再随机打乱，否则同一历史会看到不同顺序；
       手写变体仍按原来的随机打乱，行为不变。 */
    const opts = v.compose ? withIndex(v.options) : shuffled(withIndex(v.options));
    const prompt = esc(v.question || '下面几个镜头里，哪一个更贴近事实、也更留得住原本的感受？');
    return `${scenarioBox('脑子里自动冒出来的那句话', v.thought)}
      <p class="prompt">${prompt}</p>
      <div class="opt-grid">${opts.map(({ v: o, i }, k) => optBtn(k, o.t, o.d, 'reframe-choose', i)).join('')}</div>`;
  },
  chain(v) {
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">按「${esc(v.tags.join(' → '))}」的顺序，把卡片依次放进格子。</p>
      <div class="slots" id="chain-slots"></div>
      <div class="section-label">待放的卡片</div><div class="tray" id="chain-tray"></div>
      <div class="actions"><button class="btn btn-secondary" data-action="chain-undo">撤回一步</button></div>`;
  },
  sort(v) {
    return `<p class="prompt">先点一张卡，再点它更像属于的那个筐。</p>
      <div class="baskets" id="sort-baskets"></div>
      <div class="section-label">待分拣的卡片</div><div class="tray" id="sort-tray"></div>`;
  },
  perspective(v) {
    return `${scenarioBox('同一件事', v.scenario)}
      <p class="prompt">先点一个人的名字，再点他更可能冒出的那句话。</p>
      <div class="pair-cols">
        <div class="pair-col"><div class="section-label">谁在看</div>${v.roles.map((r, i) =>
          `<button class="pair-item" data-action="persp-left" data-i="${i}">${esc(r.name)}</button>`).join('')}</div>
        <div class="pair-col"><div class="section-label">他可能怎么想</div>${shuffled(v.roles.map((r, i) => ({ t: r.thought, i }))).map(o =>
          `<button class="pair-item" data-action="persp-right" data-i="${o.i}">${esc(o.t)}</button>`).join('')}</div>
      </div>`;
  },
  order(v) {
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">把 ${v.steps.length} 张线索按发生的先后排好，看看误会是从哪一环开始的。</p>
      <div class="slots" id="order-slots"></div>
      <div class="section-label">线索卡（顺序已打乱）</div><div class="tray" id="order-tray"></div>
      <div class="actions"><button class="btn btn-secondary" data-action="order-undo">撤回一步</button></div>`;
  },
  compose(v) {
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">每一行挑一块，拼成一句既说出自己、又不指责对方的话。</p>
      <div class="compose-rows">${v.rows.map((r, ri) =>
        `<div class="compose-row" data-row="${ri}"><div class="compose-label">${esc(r.label)}</div>
          <div class="compose-choices">${shuffled(withIndex(r.choices)).map(({ v: c, i: ci }) =>
            `<button class="word-chip" data-action="compose-pick" data-row="${ri}" data-i="${ci}">${esc(c.t)}</button>`).join('')}</div></div>`).join('')}</div>
      <div id="compose-preview"></div>
      <div class="actions"><button class="btn btn-primary" data-action="compose-submit" id="compose-submit" disabled>拼好了，看看这句话</button></div>`;
  },
  memory(v) {
    return `<p class="prompt">翻开两张牌，把「情绪词」和它常见的「身体信号」配成对。</p>
      <div class="memo-progress" id="memo-progress" aria-live="polite">已找到 0 / ${v.pairs.length} 对</div>
      <div class="memory-grid" id="memo-grid"></div>
      <p class="muted" style="margin-top:14px">翻错了就盖回去，不记次数。每个人的身体反应不一样，这里只是常见的一种。</p>`;
  },
  ladder(v) {
    return `${scenarioBox('场景', v.scenario)}
      <p class="prompt">${esc(v.question)}</p>
      <div class="ladder">${v.rungs.map((r, i) =>
        `<button class="rung" data-action="rung-pick" data-i="${i}">
          <span class="rung-lv" aria-hidden="true">${i + 1}</span>
          <span class="rung-main"><span class="rung-label">${esc(r.label)}</span><span class="rung-body">${esc(r.body)}</span></span>
        </button>`).join('')}</div>
      <p class="muted" style="margin-top:12px">没有对错。选完之后，会看到这一档通常可以先做什么。</p>
      <div id="rung-result"></div>`;
  },
  finale(v) {
    const skills = LEVELS.filter(l => l.skill && state.skills.includes(l.skill));
    const adult = isAdultTrack();
    const skillBlock = `<h3${adult ? '' : ' style="margin-top:22px"'}>${adult ? '1' : '2'} · 这一程练过的</h3>
      <p class="muted" style="margin:6px 0 10px">不是分数，只是你遇到过的事。</p>
      <div class="skill-list">${skills.length ? skills.map(l => `<span class="skill-chip">${esc(l.skill)}</span>`).join('') : '<span class="muted">还没走过前面的站，随时可以回去。</span>'}</div>`;
    const quoteBlock = `<h3 style="margin-top:22px">${adult ? '2' : '3'} · 带走一句话</h3>
      <p class="muted" style="margin:6px 0 10px">挑一句今天最用得上的，截图留住就好，不用上传。</p>
      <div id="quote-picks" class="quote-picks">${play.quotes.map((q, i) =>
        `<button class="opt" data-action="quote-pick" data-i="${i}" aria-keyshortcuts="${i + 1}"><span class="opt-key" aria-hidden="true">${i + 1}</span><span>${esc(q)}</span></button>`).join('')}</div>
      <button class="btn-read" data-action="quote-reroll">换一组句子</button>
      <div id="finale-quote"></div>`;
    const microBlock = `<h3 style="margin-top:22px">${adult ? '3' : '4'} · 生活里可以试试</h3>
      <div id="micro-list" class="micro-list">${play.acts.map(a => `<div class="micro-card">${esc(a)}</div>`).join('')}</div>
      <button class="btn-read" data-action="micro-reroll">换两件小事</button>`;

    if (adult) {
      return `<p class="lead">走到这里。不用总结这一程，也不用给自己打分。剩下几件小事，挑着做就行。</p>
        ${skillBlock}
        ${quoteBlock}
        ${microBlock}
        <div class="talk-card" style="margin-top:22px"><h3>4 · 给三个月后的自己留一句</h3>
          <p>不用写下来，在心里说一句就够了。可以从这三个开头里挑一个：</p>
          <div class="micro-list" style="margin-top:12px">
            <div class="micro-card">「如果三个月后我还是会这样，我希望那时候的我知道……」</div>
            <div class="micro-card">「这阵子最难的是……，我做对的一点是……」</div>
            <div class="micro-card">「下次再遇到，我想先对自己说一句话：……」</div>
          </div>
          <p class="muted">这里没有输入框，也不会保存任何文字。说出来、或者只在心里过一遍，都可以。</p></div>
        <div class="actions"><button class="btn btn-primary" data-action="go-map">回到地图</button>
          <button class="btn btn-secondary" data-action="restart-all">再走一轮（换一批题）</button></div>`;
    }

    const picks = state.decor || [];
    return `<p class="lead">这一趟走到了岛的尽头。这里没有考试，只有几件小事：布置一下、看看练过的本领、带走一句话，或者和旁边的人聊两句。</p>
      <h3 style="margin-top:22px">1 · 用贝壳布置小岛（最多选 3 样）</h3>
      <div class="island-canvas"><div class="island-ground"></div>
        ${[0, 1, 2].map(s => {
          const d = picks[s] !== undefined ? DECOR[picks[s]] : null;
          return `<div class="decor-slot ${d ? 'on' : ''}" style="left:${[18, 42, 68][s]}%"><span class="decor-glyph">${d ? d.g : '＋'}</span><span class="decor-name">${d ? esc(d.n) : '空地'}</span></div>`;
        }).join('')}
      </div>
      <div class="decor-picker">${DECOR.map((d, i) =>
        `<button class="chip ${picks.includes(i) ? 'active' : ''}" data-action="decor-toggle" data-i="${i}">${d.g} ${esc(d.n)}</button>`).join('')}</div>
      ${skillBlock}
      ${quoteBlock}
      ${microBlock}
      <div class="talk-card" style="margin-top:22px"><h3>5 · 可以一起聊的卡片</h3>
        <p id="talk-text">${esc(play.talk)}</p>
        <button class="btn-read" data-action="talk-reroll">换一张</button>
        <p class="muted">不用回答，也不用聊出结论。聊聊就行，或者跳过。</p></div>
      <div class="actions"><button class="btn btn-primary" data-action="go-map">回到地图</button>
        <button class="btn btn-secondary" data-action="restart-all">再走一轮（换一批题）</button></div>`;
  }
};

/* ---------------------------------------------------------------- 关卡初始化 */
function makePlay(lv, v) {
  const base = { id: lv.id, type: lv.type, v, tries: 0, done: false };
  switch (lv.type) {
    case 'weather': return { ...base, picked: null };
    case 'clue': return { ...base, flipped: new Set() };
    case 'slider': return { ...base, value: Math.ceil(v.replies.length / 2) };
    case 'match': return { ...base, left: null, paired: new Map() };
    case 'breath': return { ...base, elapsed: 0, running: false };
    case 'chain': return { ...base, order: shuffled(v.cards.map((c, i) => i)), placed: [] };
    case 'sort': return { ...base, selected: null, placed: new Map(), trayOrder: shuffled(v.cards.map((c, i) => i)) };
    case 'perspective': return { ...base, role: null, matched: new Map() };
    case 'order': return { ...base, order: shuffled(v.steps.map((s, i) => i)), placed: [] };
    case 'compose': return { ...base, picks: v.rows.map(() => null) };
    case 'ladder': return { ...base, picked: null };
    case 'memory': {
      const deck = [];
      v.pairs.forEach((p, pi) => deck.push({ text: p[0], pair: pi, side: 0 }, { text: p[1], pair: pi, side: 1 }));
      return { ...base, deck: shuffled(deck), open: new Set(), matched: new Set(), first: null, lock: false, found: 0 };
    }
    /* 终章的三句话来自概念层的一句话（原来单独的 QUOTES 已并入 glossary）；随机取 3 条。 */
    case 'finale': return { ...base, quotes: shuffled(GLOSSARY_LINES).slice(0, 3), talk: rand(TALK_CARDS), acts: shuffled(MICRO_ACTIONS).slice(0, 2) };
    default: return base;
  }
}

function renderLevel(resumePlay, lvOverride, sideIndex) {
  clearAsyncTimers(); stopSpeech();
  session.view = 'level';
  const lv = lvOverride || currentLevel();
  /* 从急救页返回时沿用同一份进行态：不重新抽题、不清已选；
     呼吸计时器已被 clearAsyncTimers 停掉，把 running 归位即可。 */
  play = resumePlay || makePlay(lv, lv.type === 'finale' ? {} : pickVariant(lv.id));
  if (sideIndex !== undefined) {
    play.side = true;
    play.sideIndex = sideIndex;
  }
  const v = play.v;
  if (play.type === 'breath') play.running = false;
  const b = band();
  const side = !!play.side;
  const speakBtns = (state.settings.speak && lv.type !== 'finale')
    ? `<button class="btn-read" data-action="speak-question" aria-label="朗读题目">🔊 读题目</button><button class="btn-read" data-action="speak-options" aria-label="朗读选项">🔊 读选项</button>` : '';
  stage.innerHTML = `<div class="${viewClass()}" data-variant="${v && v.key ? esc(v.key) : ''}">
    <div class="toolbar">${bandChip(`<span class="muted">${lv.type === 'finale' ? '终章' : side ? `工作间 · ${esc(lv.time || '')} · 支线` : `岛 ${lv.island} · 第 ${lv.num} 站`}</span>`)}
      <button class="btn-read" data-action="${side ? 'go-work' : 'go-map'}">← ${side ? '工作间' : '地图'}</button>
      ${lv.type !== 'finale' ? '<button class="btn-read" data-action="reroll">换一道题</button>' : ''}
      ${speakBtns}
    </div>
    <div class="level-head">
      <div class="level-kicker"><span class="eyebrow">${esc(lv.kind)}</span></div>
      <h2>${esc(lv.name)}</h2><p class="level-goal">${esc(lv.goal)}</p>
    </div>
    <div class="play-area">${RENDERERS[lv.type](v)}</div>
    <div id="feedback-slot" aria-live="polite"></div>
    <div class="actions" id="level-actions"></div>
    ${b.adult && lv.adult ? `<div class="adult-tip"><b>给大人：</b>${esc(lv.adult)}</div>` : ''}
  </div>`;
  afterRender(lv);
  updateTopbar();
  stage.focus({ preventScroll: true });
  try { window.scrollTo({ top: 0, behavior: state.settings.motion ? 'auto' : 'smooth' }); } catch (e) { /* noop */ }
  if (state.settings.autoSpeak && state.settings.speak && lv.type !== 'finale') {
    setTimeout(() => speakTexts(questionTexts()), 350);
  }
}

function afterRender(lv) {
  if (lv.type === 'chain') paintChain();
  if (lv.type === 'sort') paintSort();
  if (lv.type === 'order') paintOrder();
  if (lv.type === 'memory') paintMemory();
  if (lv.type === 'slider') {
    const input = document.getElementById('thermo');
    if (input) input.addEventListener('input', () => {
      play.value = Number(input.value);
      const labels = sliderLabels(play.v);
      document.getElementById('thermo-value').textContent = `${play.value} · ${labels[play.value - 1]}`;
    });
  }
}

/* ---------------------------------------------------------------- 子渲染 */
function paintChain() {
  const v = play.v;
  document.getElementById('chain-slots').innerHTML = v.tags.map((t, s) => {
    const cardIdx = play.placed[s];
    return `<div class="slot ${cardIdx !== undefined ? 'filled' : ''}"><span class="slot-tag">${esc(t)}</span><span>${cardIdx !== undefined ? esc(v.cards[cardIdx].text) : '等待放入…'}</span></div>`;
  }).join('');
  document.getElementById('chain-tray').innerHTML = play.order.map(i =>
    `<button class="chip ${play.placed.includes(i) ? 'used' : ''}" data-action="chain-pick" data-i="${i}" ${play.placed.includes(i) ? 'disabled' : ''}>${esc(v.cards[i].text)}</button>`).join('');
}
function paintSort() {
  const v = play.v;
  document.getElementById('sort-baskets').innerHTML = v.baskets.map((b, bi) => {
    const items = [...play.placed.entries()].filter(([, to]) => to === bi);
    return `<button class="basket ${play.selected !== null ? 'active' : ''}" data-action="sort-put" data-i="${bi}">
      <span class="basket-title">${esc(b)}（${items.length}）</span>
      <span class="basket-items">${items.length ? items.map(([ci]) => `<span class="basket-item">${esc(v.cards[ci].text)}</span>`).join('') : '<span class="muted">还没放卡片</span>'}</span></button>`;
  }).join('');
  document.getElementById('sort-tray').innerHTML = play.trayOrder.map(i =>
    `<button class="chip ${play.selected === i ? 'active' : ''} ${play.placed.has(i) ? 'used' : ''}" data-action="sort-pick" data-i="${i}" ${play.placed.has(i) ? 'disabled' : ''}>${esc(v.cards[i].text)}</button>`).join('');
}
function paintOrder() {
  const v = play.v;
  document.getElementById('order-slots').innerHTML = v.steps.map((s, i) => {
    const cardIdx = play.placed[i];
    return `<div class="slot ${cardIdx !== undefined ? 'filled' : ''}"><span class="slot-tag">第 ${i + 1} 步</span><span>${cardIdx !== undefined ? esc(v.steps[cardIdx]) : '等待放入…'}</span></div>`;
  }).join('');
  document.getElementById('order-tray').innerHTML = play.order.map(i =>
    `<button class="chip ${play.placed.includes(i) ? 'used' : ''}" data-action="order-pick" data-i="${i}" ${play.placed.includes(i) ? 'disabled' : ''}>${esc(v.steps[i])}</button>`).join('');
}
function paintMemory() {
  document.getElementById('memo-progress').textContent = `已找到 ${play.found} / ${play.v.pairs.length} 对`;
  document.getElementById('memo-grid').innerHTML = play.deck.map((c, i) => {
    const matched = play.matched.has(i);
    const open = play.open.has(i) || matched;
    const label = matched ? `已配对：${c.text}` : open ? `已翻开：${c.text}` : '未翻开的记忆牌';
    return `<button class="memo-card ${matched ? 'matched' : open ? 'open' : ''}" data-action="memo-flip" data-i="${i}" ${matched ? 'disabled' : ''} aria-label="${esc(label)}">${open ? esc(c.text) : '背面'}</button>`;
  }).join('');
}

/* ---------------------------------------------------------------- 通关 */
/* 每站对应的概念（glossary）里有一句「为什么可能有用」和一份动作规格；
   结果卡把它们带出来，避免同一套机制在 34 个变体里各写一遍。 */
function conceptRows(lv) {
  const c = conceptOfLevel(lv.id);
  if (!c) return '';
  const d = c.dose || {};
  const spec = [d.time, d.steps ? `${d.steps} 步` : '', d.stop].filter(Boolean).join(' · ');
  return `<div class="result-row"><b>为什么可能有用</b><span>${esc(c.mechanism)}</span></div>
    ${spec ? `<div class="result-row"><b>动作规格</b><span>${esc(spec)}</span></div>` : ''}`;
}
/* 通关结果默认按纯文本转义；只有确实要拼标签的调用方走 completeLevelHtml。
   这样以后新增题型时，即使直接把内容变量传进来，也不会执行成 HTML。 */
function completeLevel(text) { completeLevelHtml(esc(text)); }
/* 主线与支线共用的结果卡外壳：只负责渲染反馈槽、滚动到可见、清空底部动作。
   奖励 / 存档 / 文案的差异仍留在两个完成分支里，不在这里合流。 */
function paintResultCard({ kicker, html, rows, extra, buttons }) {
  const slot = document.getElementById('feedback-slot');
  if (slot) {
    slot.innerHTML = `<div class="feedback good result-card">
      <div class="result-kicker"><span class="result-check" aria-hidden="true">✓</span>${kicker}</div>
      <p class="result-main">${html}</p>
      <div class="result-rows">${rows}</div>
      ${extra || ''}
      <div class="result-actions">${buttons}</div>
    </div>`;
    try { slot.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) { /* noop */ }
  }
  const actions = document.getElementById('level-actions');
  if (actions) actions.innerHTML = '';
}
function completeLevelHtml(html) {
  if (play.done) return;
  play.done = true;
  stopSpeech();
  /* 呼吸练习中途点「我做完了」时，计时器要立刻收掉；
     这里手动清而不是走 clearAsyncTimers，免得被标成「被打断」。 */
  if (breathTimer) { clearInterval(breathTimer); breathTimer = null; }
  if (play.running) {
    play.running = false;
    const ring = document.getElementById('breath-ring');
    if (ring) ring.classList.remove('running');
    const word = document.getElementById('breath-word');
    if (word) word.textContent = '做完了';
  }
  const lv = currentLevel();
  /* 支线完成：只写 sideCleared，不碰 cleared / awarded / cards / skills / shells，
     也不触发「一轮歇一下」的计数。主线进度与支线进度在这里彻底分开。 */
  if (play.side) {
    if (!state.sideCleared.includes(lv.id)) state.sideCleared.push(lv.id);
    save();
    updateTopbar();
    const nextI = play.sideIndex + 1;
    const canNext = nextI < WORK.length && sideUnlocked(nextI);
    const buttons = `${canNext ? `<button class="btn btn-primary" data-action="next-level">去下一幕 · ${esc(WORK[nextI].name)}</button>` : ''}
      <button class="btn btn-secondary" data-action="go-work">回到工作间</button>
      <button class="btn btn-ghost" data-action="reroll">这一幕再玩一次</button>`;
    const rows = `<div class="result-row"><b>小贴士</b><span>${esc(lv.tip)}</span></div>
          ${lv.tryIt ? `<div class="result-row"><b>生活里试试</b><span>${esc(lv.tryIt)}</span></div>` : ''}
          ${conceptRows(lv)}
          <div class="result-row"><b>说明</b><span>工作间是支线：不计入 ${TOTAL} 站，也不加贝壳、词卡或本领。</span></div>`;
    paintResultCard({ kicker: '这一幕走过了 · 支线', html, rows, buttons });
    return;
  }
  if (!state.cleared.includes(lv.id)) state.cleared.push(lv.id);
  if (!state.awarded.includes(lv.id)) {
    state.awarded.push(lv.id);
    if (hasShells()) state.shells += 2;   /* 贝壳是否发放由 bands.shells 决定 */
  }
  if (lv.card) {
    const bag = state.cards[bandTrack()];
    if (bag && !bag.includes(lv.card)) bag.push(lv.card);
  }
  if (lv.skill && !state.skills.includes(lv.skill)) state.skills.push(lv.skill);
  save();
  updateTopbar();
  const micro = lv.type !== 'finale' && lv.num === 4
    ? `<div class="micro-card" style="margin-top:12px">今日微行动：${esc(rand(MICRO_ACTIONS))}</div>` : '';
  const next = state.levelIndex + 1;
  const canNext = next < TOTAL && isUnlocked(next);
  const buttons = `${canNext ? `<button class="btn btn-primary" data-action="next-level">去下一站 · ${esc(LEVELS[next].name)}</button>` : ''}
      <button class="btn btn-secondary" data-action="go-map">回到地图</button>
      <button class="btn btn-ghost" data-action="reroll">这站再玩一次</button>`;
  const rows = `<div class="result-row"><b>小贴士</b><span>${esc(lv.tip)}</span></div>
        ${lv.tryIt ? `<div class="result-row"><b>生活里试试</b><span>${esc(lv.tryIt)}</span></div>` : ''}
        ${conceptRows(lv)}
        <div class="result-row"><b>收进图鉴</b><span>${esc(lv.card || '这一站')}　·　本领：${esc(lv.skill || '这一站')}</span></div>`;
  paintResultCard({ kicker: '这一站完成了 · 带走了什么', html, rows, extra: micro, buttons });
  session.lastCleared = lv.id;
  session.clearedThisRun += 1;
  if (session.clearedThisRun % band().rest === 0) setTimeout(openRest, 900);
}
