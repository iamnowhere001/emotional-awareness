function renderRetreatPractice(i, resumePlay) {
  clearAsyncTimers(); stopSpeech();
  session.view = 'retreat'; session.retreatStep = i;
  const r = RETREAT[i];
  if (!r) { renderRetreatList(); return; }
  /* 从急救页返回时沿用同一份进行态：不重新抽 defuse 变体、不重置 ground / space 的进度。 */
  play = resumePlay || { type: r.type, data: r, tries: 0, done: false, retreatIndex: i };
  let body = '';
  if (r.type === 'ground') {
    if (!resumePlay) play.picks = r.rows.map(() => null);
    body = `<div class="ground-rows">${r.rows.map((row, ri) =>
      `<div class="ground-row" data-row="${ri}"><div class="compose-label">${esc(row.label)}</div>
        <div class="compose-choices">${row.choices.map((c, ci) =>
          `<button class="word-chip" data-action="ground-pick" data-row="${ri}" data-i="${ci}" aria-pressed="false">${esc(c)}</button>`).join('')}</div></div>`).join('')}</div>
      <div id="retreat-result"></div>`;
  } else if (r.type === 'defuse') {
    if (!resumePlay) {
      play.v = rand(r.variants);
      play.opts = shuffled(withIndex(play.v.options));
    }
    body = `${scenarioBox('脑子里冒出来的那句话', play.v.thought)}
      <div class="opt-grid">${play.opts.map(({ v: o, i }, k) => optBtn(k, o.t, o.d, 'defuse-pick', i)).join('')}</div>
      <div id="retreat-result"></div>
      <div class="actions"><button class="btn btn-secondary" data-action="defuse-reroll">换一句</button></div>`;
  } else {
    if (!resumePlay) play.step = 0;
    body = `<div id="space-body"></div><div id="retreat-result"></div>`;
  }
  /* 静修练习复用概念层的机制与规格：三种题型各对到一个概念，不新增解释文本。 */
  const rc = conceptOfRetreat(r);
  const conceptBlock = rc ? `<div class="retreat-concept">
    <b>对应概念 · ${esc(conceptName(rc))}</b>
    <p>${esc(rc.mechanism)}</p>
    <p class="muted">动作规格 · ${esc(conceptSpec(rc))}</p>
    <p class="sh-refs">${conceptRefLinks(rc)}</p>
  </div>` : '';
  stage.innerHTML = `<div class="view">
    <div class="toolbar"><span class="muted">静修间</span>
      <button class="btn-read" data-action="md-list">换一个练习</button>
      <button class="btn-read" data-action="go-map">结束，回地图</button></div>
    <h2>${esc(r.name)}</h2>
    <p class="level-goal">${esc(r.sub)}　·　${esc(r.intro)}</p>
    ${retreatSafety()}
    ${conceptBlock}
    <div class="play-area" style="margin-top:20px">${body}</div>
    <div id="feedback-slot" aria-live="polite"></div>
  </div>`;
  if (r.type === 'space') paintSpace();
  updateTopbar();
  stage.focus({ preventScroll: true });
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* noop */ }
}

function paintSpace() {
  const r = play.data, s = play.step;
  const box = document.getElementById('space-body');
  if (!box) return;
  if (s >= r.steps.length) {
    box.innerHTML = `<div class="space-card"><span class="space-label">结束</span><p>${esc(r.close)}</p></div>`;
    document.getElementById('retreat-result').innerHTML =
      `<div class="actions"><button class="btn btn-primary" data-action="go-map">回到刚才的事</button>
       <button class="btn btn-secondary" data-action="retreat-start" data-i="${play.retreatIndex}">再做一次</button></div>`;
    return;
  }
  const st = r.steps[s];
  box.innerHTML = `<div class="space-card"><span class="space-label">${esc(st.label)}</span><p>${esc(st.text)}</p></div>
    <div class="space-dots">${r.steps.map((x, i) => `<span class="space-dot ${i < s ? 'done' : i === s ? 'current' : ''}"></span>`).join('')}</div>
    <div class="actions"><button class="btn btn-primary" data-action="space-next">${s === r.steps.length - 1 ? '做完这一段' : '继续'}</button>
      <button class="btn btn-ghost" data-action="go-map">随时结束</button></div>`;
}

/* ---------------------------------------------------------------- 静修间 2.0 · sit 引导
   逐步文字，不计时、不显示剩余秒数；每一步都能「先停在这儿」。
   结束页只做机制归因与一句 if-then，不显示次数 / 天数 / 时长。 */
function renderMeditatePractice(id, resumePlay) {
  clearAsyncTimers(); stopSpeech();
  const p = MD_PRACTICE_BY_ID[id];
  if (!p) { renderRetreatList(); return; }
  const f = MD_FAMILY_BY_ID[p.family] || {};
  session.view = 'retreat'; session.retreatStep = -1;
  /* 从急救页返回时沿用同一份进行态：paintSit() 按 play.step 重画，
     不重新抽题、不退回第一步；只在内存，不写存档。 */
  play = resumePlay || { type: 'sit', data: p, family: f, step: 0, done: false, stopped: false, intent: 0 };
  const rc = conceptOfMeditate(p);
  const conceptBlock = `<div class="retreat-concept">
    <b>${esc(f.name || '这一步在做什么')}</b>
    <p class="muted">什么时候不做 · ${esc(f.notFor || '不舒服就停')}</p>
    <p class="muted">${esc(p.minutes)} · 不用计时，随时可以停</p>
    ${rc ? `<p class="sh-refs">${conceptRefLinks(rc)}</p>` : ''}
  </div>`;
  stage.innerHTML = `<div class="view">
    <div class="toolbar"><span class="muted">静修间</span>
      <button class="btn-read" data-action="md-list">换一个练习</button>
      <button class="btn-read" data-action="go-map">结束，回地图</button></div>
    <h2>${esc(p.name)}</h2>
    <p class="level-goal">${esc(p.sub)}　·　${esc(p.intro)}</p>
    ${conceptBlock}
    <div class="play-area" style="margin-top:20px"><div id="sit-body"></div><div id="retreat-result"></div></div>
    ${retreatSafety()}
    <div id="feedback-slot" aria-live="polite"></div>
  </div>`;
  paintSit();
  updateTopbar();
  stage.focus({ preventScroll: true });
  try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { /* noop */ }
}

function paintSit() {
  const p = play.data, s = play.step;
  const box = document.getElementById('sit-body');
  if (!box) return;
  if (s >= p.steps.length) { finishSit(false); return; }
  const st = p.steps[s];
  const pacer = (play.family && play.family.id === 'breath')
    ? `<div class="md-pacer" aria-hidden="true"><div class="breath-ring running"></div><p>圆变大时吸气，变小时呼气；不跟也可以。</p></div>`
    : '';
  box.innerHTML = `<div class="space-card md-step">
      <span class="space-label">${esc(st.label)}</span>
      <p>${esc(st.text)}</p>
    </div>
    ${pacer}
    <div class="space-dots">${p.steps.map((x, i) => `<span class="space-dot ${i < s ? 'done' : i === s ? 'current' : ''}"></span>`).join('')}</div>
    <div class="actions">
      <button class="btn btn-primary" data-action="md-next">${s === p.steps.length - 1 ? '做完这一步' : '继续'}</button>
      <button class="btn btn-ghost" data-action="md-stop">先停在这儿</button>
    </div>`;
  const res = document.getElementById('retreat-result');
  if (res) res.innerHTML = '';
}

function finishSit(stopped) {
  const p = play.data, f = play.family || {};
  play.done = true; play.stopped = !!stopped;
  const box = document.getElementById('sit-body');
  const res = document.getElementById('retreat-result');
  if (box) box.innerHTML = `<div class="space-card"><span class="space-label">${stopped ? '停在这里' : '做完了'}</span><p>${esc(p.close)}</p></div>`;
  if (!res) return;
  if (stopped) {
    res.innerHTML = `<div class="feedback good"><p>停在这里也可以，不用补上。</p>
      <div class="actions" style="margin-top:12px">
        <button class="btn btn-secondary" data-action="md-start" data-id="${esc(p.id)}">再做一次</button>
        <button class="btn btn-ghost" data-action="md-list">换一个练习</button>
        <button class="btn btn-ghost" data-action="go-map">回地图</button>
      </div></div>`;
    return;
  }
  const byFamily = MD_INTENTS.findIndex(x => x.family === p.family);
  const byScene = MD_INTENTS.findIndex(x => x.scene === 'all' || (p.scenes || []).includes(x.scene));
  play.intent = byFamily >= 0 ? byFamily : (byScene >= 0 ? byScene : 0);
  const intent = (MD_INTENTS[play.intent] || {}).t || '';
  res.innerHTML = `<div class="feedback good">
    <p><b>你刚刚做的是</b>：${esc(f.mechanism || '')}</p>
    <p class="muted" style="margin-top:8px">不用评价做得好不好，也不用延长。</p>
    <div class="md-intent"><span class="md-intent-kicker">带回一句</span><p id="md-intent-text">${esc(intent)}</p>
      <button class="btn-read" data-action="md-intent">换一句</button></div>
    <div class="actions" style="margin-top:12px">
      <button class="btn btn-secondary" data-action="md-start" data-id="${esc(p.id)}">再做一次</button>
      <button class="btn btn-ghost" data-action="md-list">换一个练习</button>
      <button class="btn btn-ghost" data-action="go-map">回地图</button>
    </div></div>`;
}
