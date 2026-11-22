/* js/actions-level.js · 关卡与导航动作：ACTIONS 主表（关卡 / 急救 / 朗读 / 各题型）。
   由原 actions.js 拆分而来。经典脚本顺序加载，与 core.js 共享全局词法作用域；不要重复声明已有顶层名字。 */

const ACTIONS = {
  /* 首页主按钮不再先绕到地图：直接进入下一处已解锁、未走过的站。
     全部走完时才回地图，让用户自己挑一站重温。 */
  'start': () => {
    const i = nextStationIndex();
    session.navDir = 'forward';
    if (i < 0) { renderMap(); return; }
    session.levelIndex = i;
    play = {};
    closeModal();
    renderLevel();
  },
  'continue': () => {
    const i = nextStationIndex();
    session.navDir = 'forward';
    if (i < 0) { renderMap(); return; }
    session.levelIndex = i;
    play = {};
    closeModal();
    renderLevel();
  },
  'go-map': () => { stopSpeech(); closeModal(); session.navDir = 'back'; renderMap(); },
  'open-level': (el) => {
    if (session.view === 'map') session.mapScroll = window.scrollY || 0;
    session.levelIndex = Number(el.dataset.i);
    play = {};
    session.navDir = 'forward'; closeModal(); renderLevel();
  },
  'open-work-level': (el) => {
    const i = Number(el.dataset.i);
    if (!workReachable(i)) return;
    session.navDir = 'forward'; closeModal();
    renderLevel(null, WORK[i], i);
  },
  'go-work': () => {
    if (!isAdultTrack()) { session.tip = '工作间只在成年档开放，先回地图。'; renderMap(); return; }
    stopSpeech(); closeModal(); session.navDir = 'back'; renderWork();
  },
  'next-level': () => {
    if (play.side) {
      const i = play.sideIndex + 1;
      if (i < WORK.length && sideUnlocked(i)) {
        session.navDir = 'forward';
        renderLevel(null, WORK[i], i);
      }
      return;
    }
    session.levelIndex += 1; session.navDir = 'forward'; renderLevel();
  },
  'reroll': () => {
    session.navDir = 'forward';
    /* 支线重抽要带回来源幕次：否则新 play 会丢掉 side 标记，通关时写进主线进度。 */
    if (play.side) renderLevel(null, WORK[play.sideIndex], play.sideIndex);
    else renderLevel();
    showFeedback('gentle', '换了一道题，进度还留着。慢慢来。');
  },
  /* 6-12 岁档切换深度层：只改内存偏好并重抽同一站，不写存档、不计次数。
     拼装关与终章按钮不显示，这里也兜一层，避免误触后抽出空题。 */
  'set-depth': (el) => {
    if (!band().tiers || play.type === 'finale' || play.side) return;
    const d = el.dataset.d === '2' ? 2 : 1;
    session.depth = d;
    session.navDir = 'forward';
    renderLevel();
    showFeedback('gentle', d === 2 ? '换成长一点的题目了，随时可以切回来。' : '回到基础题，慢慢来。');
  },
  /* 把岛末站的动作收进「口袋」：只在本次打开的内存里，下一站显示一次就清掉。
     不写 localStorage、不记次数、不提示回来看，避免变成打卡。 */
  'pocket-add': (el) => {
    if (session.pocket) return;
    session.pocket = { text: el.dataset.t || '', from: session.lastCleared || '' };
    el.textContent = '已带上 · 下一站见';
    el.disabled = true;
    showFeedback('gentle', '这张卡只在本次打开里跟着你，不会留下记录。');
  },
  /* 两个人各挑一次再并排看：只用当前题的选项，不碰 play 的完成判定，也不写存档。 */
  'duo-open': () => {
    const opts = duoOptions(play.v);
    if (opts.length < 2 || play.done) return;
    session.duo = { step: 1, first: null, second: null, opts };
    /* 从「更多」里点开时，顺手把菜单收起，别让它压在双人面板上。 */
    document.querySelectorAll('#stage .tool-more[open]').forEach(d => { d.open = false; });
    paintDuo();
    showFeedback('gentle', '先请第一个人挑一个，选完换另一个人。');
  },
  'duo-pick': (el) => {
    const d = session.duo;
    if (!d || d.step === 3) return;
    const i = Number(el.dataset.i);
    if (!Number.isInteger(i) || i < 0 || i >= d.opts.length) return;
    if (d.step === 1) { d.first = i; d.step = 2; }
    else { d.second = i; d.step = 3; }
    paintDuo();
  },
  'duo-close': () => { session.duo = null; paintDuo(); },
  'goto-band': () => { stopSpeech(); session.navDir = ''; renderAgeGate(); },
  /* 急救入口：记下进入前那一屏，Esc 与「回到…」都回到那里。
     入口本身不改 session.view 之外的状态，也不写存档。 */
  'open-help': () => {
    if (session.view !== 'help') {
      /* 与 routeTo 的回落规则保持一致：已有年龄段时，选档页只是换档过渡屏。 */
      session.helpFrom = session.view === 'gate' && state.band ? 'home' : (session.view || 'home');
      helpResume = session.view === 'level' ? play : null;
      retreatResume = session.view === 'retreat'
        ? { play, kind: play && play.type, id: (play && play.data && play.data.id) || '', index: play && play.retreatIndex }
        : null;
    }
    renderHelp();
  },
  /* 弹窗里的安全出口：先收掉遮罩再进急救页，helpFrom 仍是弹窗背后那一屏。 */
  'modal-help': () => { closeModal(); ACTIONS['open-help'](); },
  'help-close': () => {
    stopSpeech(); closeModal(); session.navDir = 'back';
    const from = session.helpFrom;
    const resume = helpResume;
    const rr = retreatResume;
    helpResume = null;
    retreatResume = null;
    if (from === 'map') renderMap();
    else if (from === 'level') renderLevel(resume);
    else if (from === 'retreat') {
      /* 静修 2.0 的 sit 把 retreatStep 记成 -1，单靠这个标量会退回列表；
         按暂存的来源类型重建同一练习，沿用同一份 play 与步骤。 */
      if (rr && rr.play && rr.kind === 'sit' && rr.id) renderMeditatePractice(rr.id, rr.play);
      else if (rr && rr.play && Number.isInteger(rr.index)) renderRetreatPractice(rr.index, rr.play);
      else renderRetreatList();
    }
    else if (from === 'dict') renderDictionary();
    else if (from === 'selfhelp') renderSelfHelp();
    else if (from === 'slowvars') renderSlowVars();
    else if (from === 'work') renderWork();
    else if (from === 'gate' && !state.band) renderAgeGate();
    else renderHome();
  },
  'help-ground': () => {
    if (helpGroundDone) return;
    helpGroundDone = true;
    const done = document.getElementById('help-ground-done');
    if (done) done.hidden = false;
  },
  'help-word': (el) => {
    const w = el.dataset.w;
    const act = HELP_ACTIONS.find(a => a.id === 'name') || {};
    if (!w || !(act.words || []).includes(w)) return;
    helpWord = w;
    document.querySelectorAll('#stage .help-word').forEach(b => {
      const on = b.dataset.w === w;
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const out = document.getElementById('help-picked');
    if (out) {
      out.hidden = false;
      out.textContent = String(act.after || '').replace('{word}', w);
    }
  },
  'help-speak': (el) => {
    /* 「读给我听」是显式请求：即使设置里关了自动朗读，也读这一次 */
    const t = el.dataset.say || '';
    try {
      if (t && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(t);
        u.lang = 'zh-CN'; u.rate = 0.85; u.pitch = 1.05;
        window.speechSynthesis.speak(u);
      }
    } catch (err) { /* 不支持朗读时静默：文字仍然在页面上 */ }
  },
  'speak-question': () => speakTexts(questionTexts()),
  'speak-options': () => speakTexts(optionTexts()),
  /* 关卡页合并后的唯一朗读按钮：先读题目再读选项，一次点击、一次出声授权。 */
  'speak-all': () => speakTexts([...questionTexts(), ...optionTexts()]),
  /* 3-6 岁首页的朗读：只读一句引导和下一站站名，不读卖点与说明。 */
  'speak-home': () => {
    const i = nextStationIndex();
    speakTexts(['要开始上岛吗？点那个大按钮就好。', i >= 0 ? `下一站：${LEVELS[i].name}。` : '这一轨都走完了，可以回地图挑一站。']);
  },
  /* 选档页读介绍：此时还没选定档位，直接读档名 + 一句话说明。
     按钮本身是一次真实点击，iOS 的「先交互才能出声」限制在这里自然满足。 */
  'speak-band': (el) => {
    const b = AGE_BANDS.find(x => x.id === el.dataset.b);
    if (b) speakTexts([b.name + '。' + b.tag, b.desc]);
  },

  /* 1-1 天气：只存在内存，不落盘 */
  'weather-pick': (el) => {
    play.picked = Number(el.dataset.i);
    document.querySelectorAll('.weather-btn').forEach((b, i) => b.classList.toggle('selected', i === play.picked));
    /* 首站不再把主按钮锁住：没选也能一次点走，选了就把按钮改成带着它出发。 */
    const go = document.getElementById('weather-go');
    if (go) go.textContent = `带着「${play.v.items[play.picked] ? play.v.items[play.picked].n : ''}」上岛`;
    showFeedback('gentle', '选好了就出发。这个选择不会被保存，也不会被拿去分析。');
  },
  'weather-go': () => completeLevel('天气没有好坏，也不需要向谁解释。出发吧。'),

  /* 1-2 线索 */
  'clue-flip': (el) => {
    const i = Number(el.dataset.i);
    play.flipped.add(i);
    el.classList.add('flipped');
    el.querySelector('.clue-text').textContent = play.v.clues[i];
  },
  'clue-choose': (el) => {
    const i = Number(el.dataset.orig);
    if (i === play.v.answer) {
      document.querySelectorAll('#stage .opt').forEach(b => { b.disabled = true; });
      el.classList.add('selected');
      completeLevelHtml(`${esc(play.v.why)}<span class="tip">你翻开了 ${play.flipped.size} / ${play.v.clues.length} 张线索。</span>`);
    } else {
      nudge(`「${play.v.options[i]}」也是一种可能。再把几张线索合起来看看？`);
    }
  },

  /* 1-3 温度计：任何档位都完成 */
  'slider-submit': () => {
    const labels = sliderLabels(play.v);
    const msg = `你选了「${labels[play.value - 1]}」。${esc(play.v.replies[play.value - 1])}<span class="tip">同一件事，别人可能停在另一格，那也一样成立。</span>`;
    const input = document.getElementById('thermo'); if (input) input.disabled = true;
    document.querySelectorAll('[data-action="slider-submit"]').forEach(b => b.disabled = true);
    completeLevelHtml(msg);
  },

  /* 1-4 近义词配对 */
  'pair-left': (el) => {
    play.left = Number(el.dataset.i);
    document.querySelectorAll('[data-action="pair-left"]').forEach((b, i) => b.classList.toggle('active', i === play.left));
  },
  'pair-right': (el) => {
    if (play.left === null) { nudge('先点左边的一件事，再来选词。'); return; }
    const word = el.dataset.w;
    const target = play.v.pairs[play.left].word;
    if (word === target) {
      play.paired.set(play.left, word);
      el.classList.add('paired'); el.disabled = true;
      const leftBtn = document.querySelectorAll('[data-action="pair-left"]')[play.left];
      if (leftBtn) { leftBtn.classList.add('paired'); leftBtn.classList.remove('active'); leftBtn.disabled = true; }
      play.left = null;
      showFeedback('gentle', `配上了：「${esc(word)}」。<span class="tip">同一件事也可能同时有别的感觉，这里只取最贴近的那个词。</span>`);
      if (play.paired.size === play.v.pairs.length) completeLevel('几个词各归其位。能把感受分得这么细，本身就是一种照顾。');
    } else {
      nudge(`「${word}」也很像，但再看看左边那件事，重点落在哪里？`);
    }
  },

  /* 2-1 呼吸 */
  'breath-start': () => {
    if (play.running) return;
    /* 重新开始一轮呼吸，就说明上一轮的打断已经翻篇，别再在地图上报「被打断」。 */
    session.interrupted = false;
    const space = play.v.mode === 'space';
    const rounds = play.v.rounds || 2;
    const total = space ? 180 : rounds * 10;
    play.running = true; play.elapsed = 0;
    const ring = document.getElementById('breath-ring');
    const word = document.getElementById('breath-word');
    const round = document.getElementById('breath-round');
    if (ring && !space) ring.classList.add('running');
    const start = document.getElementById('breath-start');
    if (start) { start.disabled = true; start.textContent = '正在跟着做…'; }
    breathTimer = setInterval(() => {
      play.elapsed += 1;
      if (space) {
        /* 三段各 60 秒：觉察 → 聚集呼吸 → 扩到全身；不报吸呼节奏，不催呼气变长。 */
        const stage = Math.min(2, Math.floor(play.elapsed / 60));
        const words = ['先留意此刻的身体和念头', '把注意力收到呼吸上', '让觉察扩到全身'];
        const hints = ['不用改变呼吸', '走神了回来就好', '连身体一起留意'];
        if (word) word.textContent = words[stage];
        if (round) round.textContent = `第 ${stage + 1} / 3 段 · ${hints[stage]} · 随时可以停`;
        if (play.elapsed >= total) {
          clearInterval(breathTimer); breathTimer = null;
          if (word) word.textContent = '做完了';
          if (round) round.textContent = '三段走完了。不用评价做得怎么样，也不要求有什么感觉。';
        }
        return;
      }
      const t = play.elapsed % 10;
      const r = Math.min(rounds, Math.floor(play.elapsed / 10) + 1);
      if (word) word.textContent = t < 4 ? '慢慢吸气' : '慢慢呼气';
      if (round) round.textContent = `第 ${r} / ${rounds} 轮 · 呼气比吸气长一点 · 随时可以停`;
      if (play.elapsed >= total) {
        clearInterval(breathTimer); breathTimer = null;
        if (ring) ring.classList.remove('running');
        if (word) word.textContent = '做完了';
        if (round) round.textContent = `${rounds} 轮完成。感觉怎么样都可以，不用评价自己。`;
      }
    }, 1000);
  },
  'breath-done': () => completeLevel('谢谢你陪自己待了这一小会儿。'),

  /* 2-2 换镜头 */
  'reframe-choose': (el) => {
    const i = Number(el.dataset.orig);
    if (i === play.v.answer) {
      document.querySelectorAll('#stage .opt').forEach(b => { b.disabled = true; });
      el.classList.add('selected');
      completeLevel(play.v.why);
    } else {
      nudge(`「${play.v.options[i].d}」这个方向，可能会让那句话更紧一点。换个镜头试试？`);
    }
  },

  /* 2-3 要素连线 */
  'chain-pick': (el) => {
    const i = Number(el.dataset.i);
    const slot = play.placed.length;
    const expect = play.v.tags[slot];
    if (play.v.cards[i].tag === expect) {
      play.placed.push(i); paintChain();
      showFeedback('gentle', `放进「${esc(expect)}」了，继续。`);
      if (play.placed.length === play.v.cards.length) {
        completeLevel('几环连起来了：发生了一件事，脑子里冒出一句话，身体跟着有反应，于是做了某个动作。顺序不是唯一的，有时身体会先回答。');
      }
    } else {
      nudge(`这张更像在说「${play.v.cards[i].tag}」，而现在这一格是「${expect}」。`);
    }
  },
  'chain-undo': () => { if (play.placed.length) { play.placed.pop(); paintChain(); } },

  /* 2-4 需求分拣 */
  'sort-pick': (el) => { play.selected = Number(el.dataset.i); paintSort(); showFeedback('gentle', '选好了，再点一个筐。'); },
  'sort-put': (el) => {
    const bi = Number(el.dataset.i);
    if (play.selected === null) { nudge('先点一张卡，再点筐。'); return; }
    const card = play.v.cards[play.selected];
    if (card.to === bi) {
      play.placed.set(play.selected, bi); play.selected = null; paintSort();
      if (play.placed.size === play.v.cards.length) completeLevel('卡片都有了去处。有时候一张卡放进两个筐都说得通，按第一感觉来就好。');
      else showFeedback('gentle', '放好了，继续。');
    } else {
      nudge(`「${card.text}」更像是在说「${play.v.baskets[card.to]}」，要不要换个筐试试？`);
    }
  },

  /* 3-1 换位 */
  'persp-left': (el) => {
    play.role = Number(el.dataset.i);
    document.querySelectorAll('[data-action="persp-left"]').forEach((b, i) => b.classList.toggle('active', i === play.role));
  },
  'persp-right': (el) => {
    if (play.role === null) { nudge('先点一个人的名字。'); return; }
    const i = Number(el.dataset.i);
    if (i === play.role) {
      play.matched.set(play.role, i);
      el.classList.add('paired'); el.disabled = true;
      const left = document.querySelectorAll('[data-action="persp-left"]')[play.role];
      if (left) { left.classList.add('paired'); left.classList.remove('active'); left.disabled = true; }
      play.role = null;
      showFeedback('gentle', '两副眼镜对上了。两个人的重点不一样，但都可以成立。');
      if (play.matched.size === play.v.roles.length) completeLevel('先弄清楚对方看见了什么，比急着判断谁对谁错更省力。');
    } else {
      nudge('这句话放在另一个人身上，好像更说得通？再换一副眼镜看看。');
    }
  },

  /* 3-2 线索排序 */
  'order-pick': (el) => {
    const i = Number(el.dataset.i);
    const slot = play.placed.length;
    if (i === slot) {
      play.placed.push(i); paintOrder();
      if (play.placed.length === play.v.steps.length) completeLevel(play.v.why || '顺序排好了。回头看，中间少的往往不是善意，只是一条还没送到的信息。');
      else showFeedback('gentle', '这一步放好了，接着找下一步。');
    } else {
      nudge('这张卡发生得好像更早或更晚一点。试试先找时间上最靠前的那张。');
    }
  },
  'order-undo': () => { if (play.placed.length) { play.placed.pop(); paintOrder(); } },

  /* 3-3 回应拼贴：允许坚持自己的句子 */
  'compose-pick': (el) => {
    const r = Number(el.dataset.row), i = Number(el.dataset.i);
    play.picks[r] = i;
    document.querySelectorAll(`.compose-row[data-row="${r}"] .word-chip`).forEach(b => b.classList.toggle('selected', Number(b.dataset.i) === i));
    const submit = document.getElementById('compose-submit');
    if (submit) submit.disabled = play.picks.some(p => p === null);
    const preview = document.getElementById('compose-preview'); if (preview) preview.innerHTML = '';
    const fb = document.getElementById('feedback-slot'); if (fb) fb.innerHTML = '';
  },
  'compose-submit': () => {
    if (play.picks.some(p => p === null)) return;
    const sentence = play.v.rows.map((r, ri) => r.choices[play.picks[ri]].t).join('，');
    const sharp = play.v.rows.some((r, ri) => !r.choices[play.picks[ri]].gentle);
    document.getElementById('compose-preview').innerHTML =
      `<div class="compose-preview"><span class="muted">拼出来的一句话</span><br>${esc(sentence)}</div>`;
    if (sharp) {
      showFeedback('gentle', `这句话里有一块听起来像在给对方下结论，听的人可能先竖起防线。<span class="tip">可以换一块试试；当然，你想说的本来就有道理，也可以就用这句。</span>`);
      const actions = document.getElementById('level-actions');
      if (actions) actions.innerHTML = `<button class="btn btn-secondary" data-action="compose-keep">就用这句，继续</button><button class="btn btn-ghost" data-action="go-map">先回地图</button>`;
    } else {
      completeLevel('这句话既说出了自己的感受，也给对方留了余地。说出来会怎样，可以在生活里试一试。');
    }
  },
  'compose-keep': () => completeLevel('你保留了原本的说法。怎么说、什么时候说，本来就该由你决定。'),

  /* 3-4 记忆翻牌 */
  'memo-flip': (el) => {
    if (play.lock || play.done) return;
    const i = Number(el.dataset.i);
    if (play.matched.has(i) || play.open.has(i)) return;
    play.open.add(i); paintMemory();
    if (play.first === null) { play.first = i; return; }
    const a = play.first, b = i;
    play.first = null;
    if (play.deck[a].pair === play.deck[b].pair && play.deck[a].side !== play.deck[b].side) {
      play.matched.add(a); play.matched.add(b); play.found += 1; paintMemory();
      if (play.found === play.v.pairs.length) completeLevel('都找到了。翻错多少次这里不记，只看你找到了几对。');
      else showFeedback('gentle', `找到第 ${play.found} 对了，继续。`);
    } else {
      play.lock = true;
      memoTimer = setTimeout(() => {
        play.open.delete(a); play.open.delete(b); play.lock = false; paintMemory();
      }, 850);
    }
  },

  /* 4-2 / A4-2 火气分级：选哪一档都算完成 */
  'rung-pick': (el) => {
    const i = Number(el.dataset.i);
    const r = (play.v.rungs || [])[i];
    if (!r) return;
    document.querySelectorAll('.rung').forEach((b, bi) => {
      b.classList.toggle('selected', bi === i);
      b.disabled = true;
    });
    el.classList.remove('selected');
    el.classList.add('selected');
    const box = document.getElementById('rung-result');
    if (box) box.innerHTML = `<div class="feedback good">
      <p><b>${esc(r.label)}</b>这一档，通常可以先做一件事：</p>
      <p class="result-main" style="margin:8px 0 0">${esc(r.move)}</p>
      <p class="muted" style="margin-top:8px">哪一档都不丢人。认出来，就比被它推着走多了一点余地。</p></div>`;
    completeLevel(`火在这一档，出口还在：${r.move}`);
  },

  /* 终章 */
  'decor-toggle': (el) => {
    const i = Number(el.dataset.i);
    if (!Array.isArray(state.decor)) state.decor = [];
    if (state.decor.includes(i)) state.decor = state.decor.filter(x => x !== i);
    else if (state.decor.length >= 3) { showFeedback('gentle', '小岛上最多摆 3 样，先收起一样再换吧。'); return; }
    else state.decor.push(i);
    save();
    document.querySelectorAll('.decor-slot').forEach((slot, s) => {
      const d = state.decor[s] !== undefined ? DECOR[state.decor[s]] : null;
      slot.classList.toggle('on', !!d);
      slot.querySelector('.decor-glyph').textContent = d ? d.g : '＋';
      slot.querySelector('.decor-name').textContent = d ? d.n : '空地';
    });
    document.querySelectorAll('.decor-picker .chip').forEach((b, bi) => b.classList.toggle('active', state.decor.includes(bi)));
  },
  'quote-pick': (el) => {
    const i = Number(el.dataset.i);
    document.querySelectorAll('#quote-picks .opt').forEach((b, bi) => b.classList.toggle('selected', bi === i));
    document.getElementById('finale-quote').innerHTML = `<div class="finale-quote">「${esc(play.quotes[i])}」</div>`;
  },
  'quote-reroll': () => {
    play.quotes = shuffled(GLOSSARY_LINES).slice(0, 3);
    document.getElementById('quote-picks').innerHTML = play.quotes.map((q, i) =>
      `<button class="opt" data-action="quote-pick" data-i="${i}" aria-keyshortcuts="${i + 1}"><span class="opt-key" aria-hidden="true">${i + 1}</span><span>${esc(q)}</span></button>`).join('');
    document.getElementById('finale-quote').innerHTML = '';
  },
  'micro-reroll': () => {
    play.acts = shuffled(MICRO_ACTIONS).slice(0, 2);
    document.getElementById('micro-list').innerHTML = play.acts.map(a => `<div class="micro-card">${esc(a)}</div>`).join('');
  },
  'talk-reroll': () => {
    play.talk = rand(TALK_CARDS);
    document.getElementById('talk-text').textContent = play.talk;
  }
};
