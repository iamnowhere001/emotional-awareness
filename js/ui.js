/* js/ui.js · 对话框与数据：弹窗、导出 / 导入、设置、词卡图鉴、本领、漂流瓶。
   经典脚本顺序加载，与 js/core.js 共享全局词法作用域；不要在此重复声明已有的顶层名字。 */

/* ---------------------------------------------------------------- 弹窗 */
function openModal(html) {
  lastFocus = document.activeElement;
  overlay.innerHTML = `<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true">${html}<button class="modal-help" data-action="modal-help" aria-label="打开 1 分钟安抚与求助">现在很难受？先缓一缓 · 约 1 分钟</button><button class="modal-close" data-action="close-modal" aria-label="关闭弹窗">×</button></div></div>`;
  /* 弹窗打开时锁住背后的页面滚动：小屏上滑到弹窗底部不会把地图也带着滚。 */
  document.body.classList.add('modal-open');
  /* 用 DOM 取标题，避免正则漏掉带属性的标题；有标题就走 aria-labelledby，
     没有才退回通用 aria-label。overlay 不再挂 aria-live，避免整个弹窗被重复播报。 */
  const modal = overlay.querySelector('.modal');
  const titleEl = modal && modal.querySelector('.modal-title');
  if (titleEl) {
    if (!titleEl.id) titleEl.id = 'modal-title';
    modal.setAttribute('aria-labelledby', titleEl.id);
  } else if (modal) {
    modal.setAttribute('aria-label', '对话框');
  }
  overlay.classList.add('open');
  const first = overlay.querySelector('button, [tabindex]');
  if (first) { try { first.focus(); } catch (e) { /* noop */ } }
}
/* 弹窗内的 Tab 循环，避免焦点跑到背后页面 */
function trapTab(e) {
  const focusables = Array.from(overlay.querySelectorAll('button:not(:disabled), [tabindex]:not([tabindex="-1"])'))
    .filter(el2 => el2.offsetParent !== null || el2 === document.activeElement);
  if (!focusables.length) return;
  const first = focusables[0], last = focusables[focusables.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  else if (!overlay.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
}
function closeModal() {
  overlay.classList.remove('open'); overlay.innerHTML = '';
  document.body.classList.remove('modal-open');
  if (lastFocus && document.contains(lastFocus)) { try { lastFocus.focus(); } catch (e) { /* noop */ } }
  lastFocus = null;
}

function openRest() {
  openModal(`<div class="modal-title">歇一下，看看远处</div>
    <div class="modal-body"><p>已经走了 ${session.clearedThisRun} 站。眼睛和肩膀大概也想动一动了：抬头看看 6 米外的地方，约 20 秒；或者站起来伸个懒腰、喝口水。</p>
    <p>${esc(band().len)}，走到这里正好可以停。这是一般性的休息提醒，不是医疗建议；想继续玩也完全可以，进度不会丢。</p></div>
    <div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">好，继续</button>
    <button class="btn btn-ghost" data-action="go-map">先到这里，回地图</button></div>`);
}

/* ---------------------------------------------------------------- 底栏的两个抽屉
   1.2.0 把地图上原先那 9 张入口卡收进「工具」「我的」：底栏常驻，任何一屏一次点到，
   不用先回地图、再往下滚三千像素。抽屉只是一份入口清单——
   不新增任何状态、不写存档、不记录看过什么；点一行等于点原来那张卡
   （sheet-go 先收抽屉再执行原动作，避免遮罩盖住新页面）。 */
function sheetRow(to, name, desc, meta) {
  return `<button class="sheet-row" data-action="sheet-go" data-to="${to}">
    <span class="sheet-name">${esc(name)}</span>
    <span class="sheet-desc">${esc(desc)}</span>
    ${meta ? `<span class="sheet-meta">${esc(meta)}</span>` : ''}
  </button>`;
}
function openToolsSheet() {
  const rows = [
    sheetRow('open-dictionary', '心理学词典', '按主题、词条类型或直接搜。', `${DICTIONARY.length} 条 · 本地搜索`),
    sheetRow('open-selfhelp', '自助工具箱', '按此刻的状态，挑一张能马上用的卡。', `${SH_TOOLS.length} 张卡`),
    sheetRow('open-slowvars', '慢变量', '健康、关系、三观这些长期底盘，慢一点看。', `${SV_VARS.length} 个变量`),
    sheetRow('open-bottle', '漂流瓶', '抽一个问题，和自己聊一句；答案不保存。', `${BOTTLES.length} 个问题`)
  ];
  if (band().mindful) rows.push(sheetRow('open-retreat', '静修间', '按此刻的场景挑一个练习，不算时间，也不打卡。', `${MD_PRACTICES.length + RETREAT.length} 个练习`));
  if (isAdultTrack() && WORK.length) rows.push(sheetRow('go-work', '工作间', `一个工作日的 ${WORK.length} 个时刻，支线不计进度。`,
    (sideUnlocked(0) || WORK.some((w, i) => workReachable(i))) ? `${WORK.length} 个时刻 · 不加奖励` : `走完 ${WORK_GATE} 后开放`));
  openModal(`<div class="modal-title">工具</div>
    <div class="modal-body"><p class="muted">想查就查，不占进度，也不记录你看了什么。</p>
      <div class="sheet-grid">${rows.join('')}</div></div>
    <div class="modal-actions"><button class="btn btn-secondary" data-action="close-modal">收起</button></div>`);
}
function openMineSheet() {
  const cards = LEVELS.map(l => l.card).filter(Boolean);
  const skills = LEVELS.map(l => l.skill).filter(Boolean);
  const gotCards = cards.filter(c => cardsInTrack().includes(c)).length;
  const gotSkills = skills.filter(s => state.skills.includes(s)).length;
  openModal(`<div class="modal-title">我的</div>
    <div class="modal-body">
      <p class="muted">${esc(band().name)} · 已走过 ${clearedInTrack()} / ${TOTAL} 站${hasShells() ? ` · 贝壳 ${state.shells}` : ''}</p>
      <div class="sheet-grid">
        ${sheetRow('open-codex', '词卡图鉴', '走过一站，留下一张可以回看的词卡。', `${gotCards} / ${cards.length} 张`)}
        ${sheetRow('open-skills', '本领清单', '这一程练过的小本领，都收在这里。', `${gotSkills} / ${skills.length} 个`)}
        ${sheetRow('goto-band', '换年龄段', '四档的题目、进度与词卡各自独立，换了不会丢。', '')}
        ${sheetRow('open-settings', '显示、朗读与数据', '字号、动效、朗读，以及导出与清空。', '')}
      </div></div>
    <div class="modal-actions"><button class="btn btn-secondary" data-action="close-modal">收起</button></div>`);
}
/* ---------------------------------------------------------------- 导出 / 导入
   导出把 README §5 的存档字段原样装进 JSON，带独立的 exportVersion。
   导入的文件属于外部输入：先校验来源与结构，再让用户确认覆盖；
   确认之前不改动当前档，确认后仍可用内存里的快照撤销一次。 */
let pendingImport = null;   /* 校验通过、等待确认的导入 */
let importUndo = null;      /* 上一次导入前的快照，只存在内存里 */

function exportFilename(d = new Date()) {
  const pad = n => String(n).padStart(2, '0');
  return `mood-island-progress-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}

function exportPayload() {
  return {
    app: EXPORT_APP,
    exportVersion: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    state: clone(state)
  };
}

function setDataStatus(msg) {
  const el = document.getElementById('data-status');
  if (el) el.textContent = msg;
}

function exportProgress() {
  const name = exportFilename();
  const text = JSON.stringify(exportPayload(), null, 2);
  try {
    const blob = new Blob([text], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    /* 立刻 revoke 会让个别浏览器把下载取消掉，挪到下一轮事件循环 */
    setTimeout(() => { try { URL.revokeObjectURL(url); } catch (e) { /* noop */ } }, 0);
    setDataStatus(`已导出 ${name}。文件在浏览器的下载目录里，只含本机的进度与设置。`);
  } catch (e) {
    setDataStatus('这台浏览器不允许导出文件。可以换用 Chrome / Safari 再试。');
  }
}

function hasProgress(s) {
  return !!s.band || s.cleared.length > 0 || s.awarded.length > 0
    || s.cards.kid.length > 0 || s.cards.adult.length > 0
    || s.skills.length > 0 || s.shells > 0 || s.decor.length > 0;
}

/* 只做校验，不碰当前 state。返回 code 供测试断言，message 直接给用户看。 */
function validateImport(text) {
  let data;
  try { data = JSON.parse(text); }
  catch (e) { return { ok: false, code: 'json', message: '这个文件不是有效的 JSON，可能不是本游戏导出的文件，或者传输时被改坏了。' }; }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { ok: false, code: 'shape', message: '文件内容不是一份进度存档。' };
  }
  if (data.app !== EXPORT_APP) {
    return { ok: false, code: 'app', message: '这不是《心情闯关岛》导出的进度文件：缺少应用标识。请选设置里「导出进度」得到的 JSON。' };
  }
  const ev = data.exportVersion;
  if (!Number.isInteger(ev) || ev < 1) {
    return { ok: false, code: 'export-version-missing', message: '文件里的导出格式版本缺失或无法识别。' };
  }
  if (ev > EXPORT_VERSION) {
    return { ok: false, code: 'export-version-newer', message: `这个文件来自更新的导出格式（v${ev}），当前版本只认得 v${EXPORT_VERSION}。请先更新游戏再导入。` };
  }
  const raw = data.state;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, code: 'state-missing', message: '文件里缺少存档内容（state），无法导入。当前进度没有被改动。' };
  }
  const sv = Number(raw.version);
  if (Number.isFinite(sv) && sv > SCHEMA_VERSION) {
    return { ok: false, code: 'schema-newer', message: `这份存档的结构版本（v${sv}）比当前游戏（v${SCHEMA_VERSION}）新，导进来可能会丢字段。请先更新游戏。` };
  }
  /* 不论导出时是哪个结构版本，都走同一条 migrate()：白名单过滤 + 旧档补齐 */
  const next = migrate(raw);
  if (!hasProgress(next)) {
    return { ok: false, code: 'empty', message: '这份文件里没有可以导入的进度（没有年龄段、站点、词卡、本领或贝壳）。当前进度没有被改动。' };
  }
  return { ok: true, state: next, exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt : '', exportVersion: ev };
}

function summarizeState(s) {
  const b = AGE_BANDS.find(x => x.id === s.band);
  return {
    band: b ? `${b.name} · ${b.tag}` : '还没选年龄段',
    kid: s.cleared.filter(id => KID.levels.some(l => l.id === id)).length,
    adult: s.cleared.filter(id => ADULT.levels.some(l => l.id === id)).length,
    cards: s.cards.kid.length + s.cards.adult.length,
    skills: s.skills.length,
    shells: s.shells
  };
}

function formatExportTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try { return d.toLocaleString('zh-CN', { hour12: false }); }
  catch (e) { return iso; }
}

function importSummaryHtml(s) {
  return `<p>${esc(s.band)}</p>
    <p>儿童 / 亲子轨 ${s.kid} 站 · 成年轨 ${s.adult} 站</p>
    <p>词卡 ${s.cards} 张 · 本领 ${s.skills} 个 · 贝壳 ${s.shells}</p>`;
}

function showImportError(message, fileName) {
  openModal(`<div class="modal-title">导入失败</div>
    <div class="modal-body">
      ${fileName ? `<p>文件：<b>${esc(fileName)}</b></p>` : ''}
      <p>${esc(message)}</p>
      <p class="muted">当前设备上的进度没有被改动。</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-action="close-modal">知道了</button>
      <button class="btn btn-primary" data-action="import-progress">换个文件</button>
    </div>`);
}

function previewImport(text, fileName) {
  const res = validateImport(text);
  if (!res.ok) { showImportError(res.message, fileName); return; }
  pendingImport = { ...res, fileName };
  const now = summarizeState(state);
  const next = summarizeState(res.state);
  const when = formatExportTime(res.exportedAt);
  openModal(`<div class="modal-title">导入前先看一眼</div>
    <div class="modal-body">
      <p>文件：<b>${esc(fileName || '未命名')}</b>${when ? ` · 导出于 ${esc(when)}` : ''}</p>
      <div class="import-compare">
        <div><b>文件里的进度</b>${importSummaryHtml(next)}</div>
        <div><b>当前设备</b>${importSummaryHtml(now)}</div>
      </div>
      <p class="muted">导入会<b>覆盖</b>当前设备的进度与显示设置，不做合并。确认后，本次打开期间还可以撤销一次。</p>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" data-action="cancel-import">先不导入</button>
      <button class="btn btn-primary" data-action="import-confirm">覆盖并导入</button>
    </div>`);
}

function readImportFile(file) {
  if (!file) return;
  /* 进度 JSON 只有几十 KB；过大的文件多半不是本游戏的导出，先挡在门外 */
  if (file.size > 5 * 1024 * 1024) {
    showImportError('这个文件太大了（超过 5 MB），不像是一份进度备份。当前进度没有被改动。', file.name);
    return;
  }
  const reader = new FileReader();
  reader.onload = () => previewImport(String(reader.result || ''), file.name);
  reader.onerror = () => showImportError('读不出这个文件，可能是权限或编码问题。当前进度没有被改动。', file.name);
  reader.readAsText(file);
}

/* 文件选择框按需创建、用完移除：设置页 DOM 里不留常驻的 input，
   既符合「页面上没有自由文本输入框」的约束，也不让选择器打断设置页的焦点顺序。 */
function pickImportFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.style.display = 'none';
  input.addEventListener('change', () => {
    const file = input.files && input.files[0];
    input.remove();
    if (file) readImportFile(file);
  });
  /* 用户取消选择：清掉临时 input（cancel 事件较新，旧浏览器靠 change 分支） */
  input.addEventListener('cancel', () => input.remove());
  document.body.appendChild(input);
  input.click();
}

function openSettings() {
  const s = state.settings;
  /* 切换开关会整块重建弹窗；先记下滚动位置与当前控件，重建后放回去，
     避免每次点开关都把视线和焦点甩回顶部。 */
  const oldModal = overlay.querySelector('.modal');
  const keepScroll = oldModal ? oldModal.scrollTop : 0;
  const active = document.activeElement;
  const keepKey = (active && overlay.contains(active) && active.dataset && active.dataset.action)
    ? { action: active.dataset.action, k: active.dataset.k || '', b: active.dataset.b || '', v: active.dataset.v || '' }
    : null;
  openModal(`<div class="modal-title">显示、朗读与数据</div>
    <div class="modal-body">
      <div class="setting-row"><strong>年龄段</strong><div class="seg">
        ${AGE_BANDS.map(b => `<button class="${state.band === b.id ? 'on' : ''}" data-action="set-band" data-b="${b.id}" data-next="map">${esc(b.name)}</button>`).join('')}
      </div><p class="muted" style="margin-top:8px">${esc(band().desc)}　${esc(band().len)}。前三档共用一套儿童 / 亲子的站，成年档是独立的一套，两边进度分开记、都保留。</p></div>
      <div class="setting-row"><strong>字号</strong><div class="seg">
        ${[[1, '标准'], [1.15, '大'], [1.3, '特大']].map(([v, n]) => `<button class="${s.scale === v ? 'on' : ''}" data-action="set-scale" data-v="${v}">${n}</button>`).join('')}
      </div></div>
      <div class="setting-row"><strong>朗读（用这台设备自带的语音，不联网）</strong><div class="seg">
        <button class="${s.speak ? 'on' : ''}" data-action="toggle-flag" data-k="speak" data-v="1">开启朗读</button>
        <button class="${!s.speak ? 'on' : ''}" data-action="toggle-flag" data-k="speak" data-v="0">关闭</button>
        <button class="${s.autoSpeak ? 'on' : ''}" data-action="toggle-flag" data-k="autoSpeak" data-v="${s.autoSpeak ? 0 : 1}">进站自动读题目</button>
      </div><p class="muted" style="margin-top:8px">朗读用的是设备自带语音，不需要联网。iPhone / iPad 等浏览器要求先点一下页面才允许自动朗读；这时在题目页点「读给我听」仍然有效。</p></div>
      <div class="setting-row"><strong>动效与对比</strong><div class="seg">
        <button class="${!s.motion ? 'on' : ''}" data-action="toggle-flag" data-k="motion" data-v="0">保留轻微动效</button>
        <button class="${s.motion ? 'on' : ''}" data-action="toggle-flag" data-k="motion" data-v="1">尽量减少动画</button>
        <button class="${s.contrast ? 'on' : ''}" data-action="toggle-flag" data-k="contrast" data-v="${s.contrast ? 0 : 1}">高对比</button>
      </div><p class="muted" style="margin-top:8px">系统设置了「减少动态效果」时，本游戏会自动遵守。</p></div>
      <div class="setting-row"><strong>这里存了什么</strong>
        <p>只存「年龄段、走到哪一站、词卡、本领、贝壳、小岛摆设、显示设置」，全部留在这台设备的浏览器里，不上传、不联网。</p>
        <p><b>不会保存</b>：开场选的天气、任何输入的心情文字（本游戏也不提供文字输入框）。</p>
        ${storageWritable ? '' : '<p class="muted"><b>当前浏览器无法保存数据</b>：这一趟仍能继续玩，但关掉页面后进度不会留下来。换普通窗口打开即可正常保存。</p>'}</div>
      <div class="setting-row"><strong>备份与迁移</strong>
        <p>导出会生成一个 JSON 文件，只含上面这些字段；换设备或清浏览器数据前留一份，之后可以再导入。</p>
        <p class="muted">导入会先让你核对年龄段与站数，确认后才覆盖；覆盖前的那一份在本次打开期间还能撤销一次。</p>
        <div class="seg">
          <button data-action="export-progress">导出进度</button>
          <button data-action="import-progress">导入进度</button>
        </div>
        <p class="muted" id="data-status" role="status"></p></div>
      ${state.band && clearedInTrack() > 0 ? `<div class="setting-row"><strong>重新走一轮</strong>
        <p>把这一轨走过的 ${clearedInTrack()} 站重新标成「还没走」，题目换一批；词卡、本领、贝壳和工作间都保留。</p>
        <p class="muted">会先让你确认；重来之后、开始下一站之前还能撤销一次。</p>
        <div class="seg"><button data-action="restart-ask">从头再来一轮</button></div></div>` : ''}
      <div class="setting-row"><strong>装到主屏</strong>
        ${(typeof deferredInstallPrompt !== 'undefined' && deferredInstallPrompt)
          ? '<p>装到主屏后可以像普通 App 一样打开，断网也能玩。</p><div class="seg"><button data-action="install-app">安装到主屏</button></div>'
          : '<p class="muted">用 iPhone / iPad 的 Safari 打开时，点底部「分享」→「添加到主屏」即可；其他浏览器若暂不显示安装按钮，用浏览器菜单里的「添加到主屏 / 安装应用」也可以。</p>'}
      </div>
    </div>
    <div class="modal-actions">
      ${importUndo ? '<button class="btn btn-secondary" data-action="import-undo">撤销上次导入</button>' : ''}
      <button class="btn btn-primary" data-action="close-modal">完成</button>
      <button class="btn btn-ghost" data-action="clear-progress">清空本机进度</button></div>`);
  /* 重建后按 data-action / data-k / data-b 找同一个控件；
     值会翻转的开关（自动朗读、高对比）先找同值，找不到再退回同组第一个。 */
  const modal = overlay.querySelector('.modal');
  if (modal) modal.scrollTop = keepScroll;
  if (keepKey) {
    const sameGroup = [...overlay.querySelectorAll('[data-action]')].filter(b =>
      b.dataset.action === keepKey.action && (b.dataset.k || '') === keepKey.k && (b.dataset.b || '') === keepKey.b);
    const btn = sameGroup.find(b => (b.dataset.v || '') === keepKey.v) || sameGroup[0];
    if (btn) { try { btn.focus(); } catch (e) { /* noop */ } }
  }
}
function openCodex() {
  /* 图鉴在渲染层按「概念」分组：同一件事在两套站里可能叫不同的名字（如 情绪粒度 / 命名），
     这里合并成 20 组并同时标出另一种叫法；state.cards 的键仍是原来的显示名，存档与 schema 不动。 */
  const bag = cardsInTrack();
  const adult = isAdultTrack();
  const groups = GLOSSARY.map(g => {
    const mine = adult ? g.adult : g.kid;
    const other = adult ? g.kid : g.adult;
    return { mine, other: other === mine ? '' : other, has: bag.includes(mine), def: CODEX[mine] || { t: '', e: '' } };
  });
  const got = groups.filter(x => x.has).length;
  openModal(`<div class="modal-title">词卡图鉴 · ${got} / ${groups.length}</div>
    <div class="modal-body">每张卡都是从一站里带回来的小工具。同一件事在两套站里可能有不同叫法，这里并成一组看。没有集齐压力，也没有隐藏奖励。</div>
    <div class="codex-grid">${groups.map(({ mine, other, has, def }, i) => {
      const g = GLOSSARY[i];
      return `<div class="codex-card ${has ? '' : 'locked'}"><b>${has ? esc(mine) : '???'}</b>
      ${has && other ? `<span class="codex-alias">也叫「${esc(other)}」</span>` : ''}
      <span>${has ? esc(def.t) : '走到那一站就能遇见'}</span>
      ${has ? `<span class="codex-eg">${esc(def.e)}</span>` : ''}
      ${has ? `<span class="codex-refs">${conceptRefLinks(g)}</span>` : ''}</div>`;
    }).join('')}</div>
    <div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">合上图鉴</button></div>`);
}
function openSkills() {
  const list = LEVELS.filter(l => l.skill);
  const got = list.filter(l => state.skills.includes(l.skill)).length;
  openModal(`<div class="modal-title">本领清单 · ${got} / ${list.length}</div>
    <div class="modal-body">只是这一趟遇到过的事，不评级、不比较。同一条轨上再走一遍，本领会接着留着。</div>
    <div class="skill-list" style="margin-top:16px">${list.map(l => {
      const has = state.skills.includes(l.skill);
      return `<span class="skill-chip ${has ? '' : 'locked'}">${has ? esc(l.skill) : '· · ·'}</span>`;
    }).join('')}</div>
    <div class="modal-actions"><button class="btn btn-primary" data-action="close-modal">合上</button></div>`);
}
let lastBottle = -1;
function openBottle() {
  /* 换一题时避开上一题，题池够大就不会连着抽到同一道 */
  let i = Math.floor(Math.random() * BOTTLES.length);
  if (BOTTLES.length > 1 && i === lastBottle) i = (i + 1) % BOTTLES.length;
  lastBottle = i;
  const b = BOTTLES[i];
  openModal(`<div class="modal-title">漂流瓶 · 一题就好</div>
    <div class="modal-body"><p>${esc(b.q)}</p><p class="muted">不记进度、不打卡，选哪一个都会给一句回应。</p></div>
    <div class="opt-grid" style="margin-top:16px" id="bottle-opts">${b.opts.map((o, i) => optBtn(i, o, '', 'bottle-choose')).join('')}</div>
    <div id="bottle-feedback"></div>
    <div class="modal-actions"><button class="btn btn-ghost" data-action="open-bottle">换一题</button>
      <button class="btn btn-secondary" data-action="close-modal">收起</button></div>`);
  overlay.dataset.why = b.why;
}
