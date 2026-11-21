// ============================================================================
// 1인칭 학습지 [우리 사회] 탭 (4차 T4 목표 비교 · 조감 연결 + T5 설계 요약 · 쟁점 메모) · [과제] 탭의 과제 ⑫~⑮ · 탐험 지도 (T5)
// ----------------------------------------------------------------------------
// 무엇을 맡나(TASK_4차_T §5)
//   ① 목표 비교 표: 2050·2100년 × CO₂·기온 편차·해수온·pH — 기준 사회(현재 정책) · 우리 사회(회의실에서 확정한 설계) ·
//      NDC 비교 경로(전 세계가 한국 2035 NDC 53 %) · 1.5 °C 경로. 값은 모두 FPModel.pathRun(엔진 궤적은 fp-model.js 에서만)의 전 지구 값 —
//      조감 미래 예측과 같은 해 같은 값이다. 1인칭 측정값은 자리마다 지점 차이(도시 CO₂·육지/바다 증폭)가 얹혀 이 표와 똑같지는 않다.
//   ② 나 vs 우리 사회: "우리 사회의 선택은 2100년 기온 편차를 O °C 바꿔요. 나의 행동(대한민국 전체가 함께 하는 경우)은 O °C."
//      둘 다 같은 기준 — 기준 사회(현재 정책, ssp245)와의 차이다. 나의 행동은 참여 규모를 '대한민국'으로 고정해 F4 와 같은
//      함수(FPModel.mineRun = ActionsCore.emissionsFn)로 계산한다. 지금 고른 참여 규모와 상관없이 같은 문장이 되게.
//      F4 미래 비교 카드(fp-actions.js compareHtml)에도 '우리 사회 차이' 열을 같은 함수(societyDelta)로 나란히 붙인다.
//   ③ [조감에서 그래프로 보기]: 조감 미래 예측을 /dashboard?tab=future&preset=custom&levers=… 로 연다(마스터 §4 예외 —
//      조감 tab-future.js 는 주소의 levers 를 읽는 것만 더했다). 단일 HTML 에서는 껍데기가 data-aerial-go 를 받아 같은 값으로 연다.
// 숫자를 만들지 않는다 — 표와 문장은 엔진 결과를 그대로 옮긴다. 설계가 없으면(fp.society.levers 없음) '우리 사회' 칸은 비우고 회의실로 안내한다.
// 로드 순서: … fp-actions → fp-society → fp-tools … (firstperson/index.html 과 빌더 FP_JS 를 같이 맞춘다).
//   읽는 순간에는 DOM 을 건드리지 않는다(함정 10). init() 은 fp-main 이 FPActions.init 뒤에 부른다.
// ============================================================================
const FPSociety = (() => {
  const YEARS = [2050, 2100];
  const BASE = 'ssp245';
  // 열(경로). 'custom' = 회의실에서 확정한 설계(fp.society.levers)
  const PATHS = Object.freeze([
    { id: 'ssp245', label: '기준 사회', sub: '현재 정책', src: 'scen_ssp245' },
    { id: 'custom', label: '우리 사회', sub: '회의실 설계', src: 'society_card_levels' },
    { id: 'ndc', label: 'NDC 비교', sub: '전 세계가 53 %', src: 'ndc_global_path' },
    { id: 'ssp119', label: '1.5 °C 경로', sub: '탄소중립', src: 'scen_ssp119' },
  ]);
  // 행(그래프 순서 CO₂ → 기온 → 해수온 → pH — 마스터 결정 11)
  const ROWS = Object.freeze([
    { key: 'ppm', label: 'CO₂', unit: 'ppm', dec: 0 },
    { key: 'T', label: '기온 편차', unit: '°C', dec: 2 },
    { key: 'sst', label: '해수온', unit: '°C', dec: 2 },
    { key: 'pH', label: 'pH', unit: '', dec: 3 },
  ]);
  const ME_SCALE = 'korea';

  // ── 순수 계산(node 검사: tools/test_society.js) ────────────────────────────
  const runOf = (id, levers) => (id === 'custom' ? (levers ? FPModel.pathRun('custom', levers) : null) : FPModel.pathRun(id));
  // 표: rows[i].vals[pathId] = 그해 값(설계가 없으면 custom = null)
  function table(year, levers) {
    const samples = Object.fromEntries(PATHS.map(p => { const r = runOf(p.id, levers); return [p.id, r ? FPModel.sample(year, r) : null]; }));
    return ROWS.map(r => ({ ...r, vals: Object.fromEntries(PATHS.map(p => [p.id, samples[p.id] ? samples[p.id][r.key] : null])) }));
  }
  // 우리 사회 − 기준 사회 (그해 key 값). 설계가 없으면 null
  function societyDelta(year, levers, key = 'T') {
    if (!levers) return null;
    return FPModel.sample(year, FPModel.pathRun('custom', levers))[key] - FPModel.sample(year, FPModel.pathRun(BASE))[key];
  }
  // 나의 행동(대한민국 전체) − 기준 사회. 행동이 없으면 null
  function mineDelta(year, chosen, key = 'T') {
    if (!chosen || !chosen.ids || !chosen.ids.length) return null;
    return FPModel.sample(year, FPModel.mineRun(BASE, null, chosen, ME_SCALE))[key] - FPModel.sample(year, FPModel.pathRun(BASE))[key];
  }
  // 조감 미래 예측 주소(서버) · 단일 HTML 껍데기에 넘길 값. 레버 일곱 칸을 그대로(엔진 범위 확인은 조감 쪽이 한다)
  const aerialQuery = levers => `tab=future&preset=custom&levers=${encodeURIComponent(JSON.stringify(levers))}`;
  const aerialHref = levers => `/dashboard?${aerialQuery(levers)}`;

  // ── 화면 ──────────────────────────────────────────────────────────────
  let root = null, year = 2100;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function saved() {
    try { const so = WorksheetStore.readFp().society; return so && so.levers && typeof so.levers === 'object' ? so : null; } catch (e) { return null; }
  }
  const savedLevers = () => { const s = saved(); return s ? { ...EarthSystem.LEVER_NOW, ...s.levers } : null; };
  const signed = (v, dec) => { const r = Number(v.toFixed(dec)); return r === 0 ? '0' : (r > 0 ? '+' : '−') + Math.abs(r).toFixed(dec); };
  const moveWord = v => (v < 0 ? `${Math.abs(v).toFixed(v > -0.01 ? 3 : 2)} °C 낮춰요` : v > 0 ? `${v.toFixed(v < 0.01 ? 3 : 2)} °C 높여요` : '바꾸지 않아요');
  function scaleLine(levers) {
    const c = typeof FPActions !== 'undefined' ? FPActions.chosen() : null;
    const soc = societyDelta(2100, levers), me = mineDelta(2100, c);
    const a = soc == null ? '아직 회의실에서 설계를 확정하지 않았어요.' : `우리 사회의 선택은 2100년 기온 편차를 기준 사회보다 <b>${moveWord(soc)}</b>.`;
    const b = me == null ? '나의 행동은 아직 고르지 않았어요 — [나의 행동] 탭에서 고르면 여기 나란히 보여요.'
      : `나의 행동(대한민국 전체가 함께 하는 경우)은 <b>${moveWord(me)}</b>.`;
    const ratio = soc != null && me != null && me < 0 && soc < 0 ? soc / me : null;
    const r = ratio && ratio >= 2 ? ` 사회의 선택이 약 <b>${Number(ratio.toPrecision(2)).toLocaleString('ko-KR')}배</b> 커요 — 개인 행동은 많은 사람이 함께 하고 사회의 선택이 받쳐 줄 때 커집니다.` : '';
    return `<p class="act-line soc-scale">${a} ${b}${r}${srcButton('model_temp')}${srcButton('action_scale')}</p>`;
  }
  // ── T5 설계 요약 · 쟁점 메모 ────────────────────────────────────────────
  const SC = () => SocietyCore;
  const fmtLever = (k, v) => (/Share$|^ev$|^otherCut$/.test(k) ? `${Math.round(v * 100)} %` : `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(2)} GtC/년`);
  const LEVER_KO = { fossilShare: '화석 발전', nuclearShare: '원자력 발전', renewShare: '재생 발전', ev: '전기차 비율', ccs: '탄소 포집', otherCut: '나머지 배출 감축', forest: '토지이용 배출' };
  // 회의실 초안(cards)이 확정한 레버와 다른가 — 회의실은 카드를 바꿀 때마다 초안을 저장하고, 레버는 [보기]로 확정할 때만 저장한다(T2)
  function draftChanged(so) {
    if (!so || !so.levers || !so.cards) return false;
    const a = SC().leversFrom(so.cards), b = { ...EarthSystem.LEVER_NOW, ...so.levers };
    return Object.keys(a).some(k => Math.abs(a[k] - b[k]) > 1e-4);   // 저장·주소를 거친 반올림은 같은 설계로 본다
  }
  function designHtml(so, L) {
    if (!L) return '';
    const cards = so.cards || {}, d = SC().design(cards, 'value');
    const C = typeof FPStageCouncil !== 'undefined' ? FPStageCouncil : null;
    const tech = SC().TECH_CARDS.filter(t => typeof cards[t.id] === 'number').map(t => {
      const v = d.values[t.id];
      return `<li><b>${esc(t.label)}</b> ${C ? `${C.levelOf(t, v)}단계 · ${esc(C.fmtValue(t, v))}` : ''}</li>`;
    }).join('');
    const pol = SC().POLICY_CARDS.filter(p => cards[p.id] === true).map(p => `<li><b>${esc(p.label)}</b></li>`).join('');
    const lev = Object.keys(LEVER_KO).map(k => `<tr><th scope="row">${LEVER_KO[k]}</th><td class="num">${fmtLever(k, EarthSystem.LEVER_NOW[k])}</td><td class="num is-ours">${fmtLever(k, L[k])}</td></tr>`).join('');
    return `<h3 class="sh-h">우리 사회 설계 <span class="sub">회의실에서 확정한 카드 · 단계 · 2050년 레버</span></h3>
      ${draftChanged(so) ? '<p class="ac-wait">회의실에서 카드를 바꾼 뒤 아직 확정하지 않았어요 — 아래 표는 마지막으로 확정한 설계예요.</p>' : ''}
      <div class="soc-design"><div><h4>기술 카드</h4><ul>${tech || '<li>없음 — 지금 구조 그대로</li>'}</ul><h4>정책 카드</h4><ul>${pol || '<li>없음</li>'}</ul></div>
      <table class="field-table soc-levers"><thead><tr><th scope="col">레버(2050년 목표)</th><th scope="col">지금</th><th scope="col">우리 사회</th></tr></thead><tbody>${lev}</tbody></table></div>
      <p class="sh-note">카드 단계 값은 이 프로그램이 정한 연출값이에요(레버 식은 엔진 그대로).${srcButton('society_card_levels')}</p>`;
  }
  function issuesHtml(so) {
    const ids = so && Array.isArray(so.issuesOpened) ? so.issuesOpened.filter(id => SC().issues[id]) : [];
    if (!ids.length) return `<h3 class="sh-h">쟁점 메모</h3><p class="sh-note">회의실에서 원자력·포집·태양광과 풍력·탄소 가격제 카드를 놓으면 그 쟁점 카드가 여기 열려요.</p>`;
    const notes = so.issueNotes && typeof so.issueNotes === 'object' ? so.issueNotes : {};
    return `<h3 class="sh-h">쟁점 메모 <span class="sub">찬성·우려 근거를 같은 분량으로 — 정답은 정해져 있지 않아요</span></h3>` + ids.map(id => {
      const is = SC().issues[id], li = a => a.map(t => `<li>${esc(t)}</li>`).join('');
      return `<details class="soc-issue"${notes[id] ? '' : ' open'}><summary>${esc(is.title)}${srcButton(is.src)}</summary>
        <div class="soc-issue-cols"><div><h4>찬성 근거</h4><ul>${li(is.pro)}</ul></div><div><h4>우려 근거</h4><ul>${li(is.con)}</ul></div></div>
        <label class="soc-note"><span>나는 이 카드를 왜 골랐나 (쓰지 않아도 돼요)</span><textarea rows="2" data-issue-note="${id}" placeholder="고른 까닭, 걱정되는 점">${esc(notes[id] || '')}</textarea></label></details>`;
    }).join('');
  }
  function render() {
    if (!root || (root.contains(document.activeElement) && document.activeElement.tagName === 'TEXTAREA')) return;   // 쓰는 중에는 다시 그리지 않는다(커서가 튄다)
    const so = saved(), L = savedLevers();
    const ae = document.activeElement, keepYear = ae && root.contains(ae) ? ae.getAttribute('data-soc-year') : null;
    const rows = table(year, L);
    const head = PATHS.map(p => `<th scope="col">${esc(p.label)}<span class="ac-sub">${esc(p.sub)}</span>${srcButton(p.src)}</th>`).join('');
    const body = rows.map(r => `<tr><th scope="row">${r.label}${r.unit ? ` <span class="ac-sub">${r.unit}</span>` : ''}</th>`
      + PATHS.map(p => `<td class="num${p.id === 'custom' ? ' is-ours' : ''}">${r.vals[p.id] == null ? '—' : r.vals[p.id].toFixed(r.dec)}</td>`).join('') + '</tr>').join('');
    const yb = YEARS.map(v => `<button class="btn btn--time btn--sm${v === year ? ' is-on' : ''}" type="button" data-soc-year="${v}" aria-pressed="${v === year}">${v}년</button>`).join('');
    const when = so && so.savedAt ? new Date(so.savedAt) : null;
    const status = L
      ? `<p class="act-line">우리 사회 = 기후 정책 회의실에서 ${when ? `${when.getMonth() + 1}월 ${when.getDate()}일 ` : ''}확정한 설계입니다. 바꾸려면 회의실에서 다시 확정하세요.
          <button class="btn btn--nav btn--sm" type="button" data-soc-council>회의실로 가기</button></p>`
      : `<p class="ac-wait">'우리 사회'는 시청 '기후 정책 회의실'에서 카드로 설계하고 확정하면 채워져요.
          <button class="btn btn--nav btn--sm" type="button" data-soc-council>회의실로 가기</button></p>`;
    const link = L ? `<p class="sh-links"><a class="btn btn--nav btn--sm" href="${esc(aerialHref(L))}" data-aerial-go="${esc('future?' + aerialQuery(L).replace(/^tab=future&/, ''))}">
        <span data-icon="globe"></span>조감에서 그래프로 보기</a></p>
        <p class="sh-note">조감 미래 예측이 '직접 설계'로 이 사회의 레버를 받아 엽니다. 같은 엔진이라 같은 해의 값이 이 표와 같아요.</p>` : '';
    root.innerHTML = `${designHtml(so, L)}<h3 class="sh-h">목표와 견주기 <span class="sub">기준 사회 · 우리 사회 · NDC · 1.5 °C — 같은 해의 엔진 값</span></h3>
      ${status}
      <div class="act-scales" role="group" aria-label="비교할 해">${yb}</div>
      <table class="field-table act-cmp soc-cmp"><thead><tr><th scope="col">${year}년</th>${head}</tr></thead><tbody>${body}</tbody></table>
      <p class="sh-note">NDC 비교 = 한국의 2035년 목표 비율(2018년 대비 53 %)을 전 세계 화석 CO₂에 적용하고 2050년에 0이 된다고 가정한 경로예요(가정 세 가지는 ⓘ).${srcButton('ndc_global_path')}
        이 표는 전 지구 평균(엔진 값)이에요. 미래로 가서 재는 값은 자리(도심·녹지·바다)에 따라 이 값과 조금씩 달라요 — 같은 자리에서 기준 사회와 우리 사회를 견줘 보세요.</p>
      <h3 class="sh-h">나와 사회 <span class="sub">2100년 기온 편차 — 기준 사회와의 차이</span></h3>
      ${scaleLine(L)}
      ${link}
      ${issuesHtml(so)}`;
    if (typeof Icons !== 'undefined' && Icons.fill) Icons.fill(root);
    if (keepYear) { const b = root.querySelector(`[data-soc-year="${keepYear}"]`); if (b) b.focus(); }
  }
  function init() {
    const panel = document.getElementById('shPanelSociety');
    if (!panel) return;
    root = document.getElementById('socRoot');
    if (!root) { root = document.createElement('div'); root.id = 'socRoot'; panel.appendChild(root); }
    root.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.socYear) { year = Number(b.dataset.socYear); render(); return; }
      if (b.hasAttribute('data-soc-council') && typeof FPActions !== 'undefined' && typeof FPActions.councilHook === 'function') FPActions.councilHook();
    });
    root.addEventListener('input', e => {
      const id = e.target.dataset.issueNote;
      if (!id) return;
      try { WorksheetStore.updateFp(fp => { const so = fp.society; const n = so.issueNotes && typeof so.issueNotes === 'object' ? so.issueNotes : (so.issueNotes = {}); n[id] = e.target.value; }); } catch (err) { /* 메모리 */ }
    });
    root.addEventListener('focusout', () => setTimeout(() => { if (!root.contains(document.activeElement)) render(); }, 0));
    if (typeof FPActions !== 'undefined') FPActions.onChange(() => { render(); renderTasks(); });   // 행동이 바뀌면 '나와 사회' 줄 · 탐험 지도 2장
    render();
    initTasks();
  }

  // ============================================================================
  // T5 과제 ⑫~⑮ · 탐험 지도(네 장) — 학습지 [과제] 탭
  // ----------------------------------------------------------------------------
  // 번호: D3 에서 측정 ①② · 현장 ③④⑤ 로 다시 매겼다. 빈 번호 없이 이어서 2장(F5 행동 과제 여섯 개) = ⑥~⑪,
  //   3장 = ⑫ 설계 · ⑬ 재 보기 · ⑭ 쟁점, 4장 = ⑮ 나와 사회. 지시서의 ⑭~⑰(F5 ⑧~⑬)은 D3 이전 번호라 그대로 두면 ⑥⑦이 빈다.
  //   번호는 이 표(CHAPTERS.nos) 한 곳에서만 정한다 — F5 가 ⑥~⑪을 쓰고, 이 표의 2장 줄과 맞춘다.
  // 판정은 기록 수·글 유무로만(2차 이후 원칙). ⑭는 어느 쪽 판단이든 똑같이 완료.
  // 저장: fp.tasks[id] = { id, title, link, obs: {칸 이름: 글}, diff, scenario, time } — 현장 과제와 같은 모양이라
  //   조감 [기록] 탭(js/worksheet.js renderFp)이 그대로 보여 준다(마스터 §6-4). link = '우리 사회'(조감 탐구 단계가 없어 장 이름).
  const SOC_TASKS = Object.freeze([
    { id: 'soc_design', no: '⑫', title: '⑫ 2050년 사회 설계', chapter: 3,
      goal: '기후 정책 회의실에서 2100년 기온 편차가 2 °C 아래가 되는 설계를 하나 만들고, 고른 카드와 까닭을 쓴다.',
      how: '시청 회의실에서 카드를 놓고 [이 사회로 2050년 보기]로 확정하세요. 확정하면 아래 칸이 채워져요.',
      fields: [{ key: '고른 카드와 까닭', ph: '어떤 카드를 몇 단계로 왜 골랐나요?' }] },
    { id: 'soc_measure', no: '⑬', title: '⑬ 설계한 미래를 재 보기', chapter: 3,
      goal: '우리 사회 2050년의 도심 CO₂·해수 pH를 기준 사회(현재 정책)와 같은 자리에서 각각 5번 이상 재고 견준다.',
      how: '사회의 선택을 \'우리가 설계한 사회\'로 두고 2050년으로 가서 도심 대기(CO₂센서)·바다(pH미터)를 재세요. 그다음 현재(2026)에서 사회의 선택을 \'현재 정책\'으로 바꾸고 2050년 같은 자리에서 다시 재세요.',
      fields: [{ key: '두 사회의 차이와 까닭', ph: '[기록] 탭의 평균을 견주어 쓰세요', diff: true }] },
    { id: 'soc_issue', no: '⑭', title: '⑭ 쟁점 카드 토론', chapter: 3,
      goal: '원자력 또는 포집 쟁점 카드의 찬성 근거와 우려 근거를 하나씩 옮겨 적고, 내 판단을 쓴다.',
      how: '쟁점 카드 본문은 회의실 이젤과 학습지 [우리 사회] \'쟁점 메모\'에 있어요. 어느 쪽 판단이든 완료예요.',
      fields: [{ key: '찬성 근거', ph: '찬성 근거 하나' }, { key: '우려 근거', ph: '우려 근거 하나' }, { key: '내 판단', ph: '나는 어떻게 생각하나요? 까닭은?', diff: true }] },
    { id: 'soc_scale', no: '⑮', title: '⑮ 나와 사회', chapter: 4,
      goal: '나의 미래(나의 행동)와 우리 사회의 2100년 차이를 견주고, 개인 행동과 사회의 선택이 각각 왜 필요한지 쓴다.',
      how: '학습지 [우리 사회]의 \'나와 사회\' 줄과 [나의 행동]의 미래 비교 표를 보세요.',
      fields: [{ key: '견준 결과', ph: '두 차이는 각각 몇 °C였나요?' }, { key: '둘 다 필요한 까닭', ph: '개인 행동과 사회의 선택이 왜 각각 필요할까요?', diff: true }] },
  ]);
  const TASK_LINK = '우리 사회';
  const text = v => String(v == null ? '' : v).trim();
  // ⑬ 기록 조건: 2050년 · 기준 미래 갈래 · 경로(우리 사회 = custom, 기준 사회 = ssp245) · 도심 대기 CO₂ / 해수 pH
  const M_SUBS = Object.freeze([
    { label: '우리 사회 도심 CO₂', path: 'custom', test: r => r.kind === 'co2' && r.spot === 'airCity' },
    { label: '기준 사회 도심 CO₂', path: 'ssp245', test: r => r.kind === 'co2' && r.spot === 'airCity' },
    { label: '우리 사회 해수 pH', path: 'custom', test: r => r.kind === 'ph' },
    { label: '기준 사회 해수 pH', path: 'ssp245', test: r => r.kind === 'ph' },
  ]);
  const M_GOAL = 5;
  const pathIs = (r, id) => String(r.path || '').split(':')[0] === id;
  // 순수: 저장값(fp) + 측정 기록(rows) → 과제마다 { task, a, subs[{label, ok, n?, goal?}], frac, done }
  function taskProgress(fp, rows) {
    const tasks = (fp && fp.tasks) || {}, so = (fp && fp.society) || {};
    return SOC_TASKS.map(t => {
      const a = tasks[t.id] || { obs: {} }, obs = a.obs || {};
      const val = f => (f.diff ? a.diff : obs[f.key]);
      let subs = [];
      if (t.id === 'soc_design') subs.push({ label: '설계 확정', ok: !!(so.levers && typeof so.levers === 'object') });
      if (t.id === 'soc_measure') subs = M_SUBS.map(m => {
        const n = (rows || []).filter(r => r.year === 2050 && r.branch === 'base' && pathIs(r, m.path) && m.test(r)).length;
        return { label: m.label, n, goal: M_GOAL, ok: n >= M_GOAL };
      });
      subs.push(...t.fields.map(f => ({ label: f.key, ok: !!text(val(f)) })));
      const frac = subs.reduce((x, s) => x + (s.goal ? Math.min(s.n, s.goal) / s.goal : s.ok ? 1 : 0), 0) / subs.length;
      return { task: t, a, subs, frac, done: subs.every(s => s.ok) };
    });
  }
  function setTask(id, patch) {
    const t = SOC_TASKS.find(x => x.id === id);
    try {
      WorksheetStore.updateFp(fp => {
        const cur = fp.tasks[id] || { id, title: t.title, link: TASK_LINK, obs: {} };
        Object.assign(cur, patch, { title: t.title, link: TASK_LINK, time: new Date().toISOString(),
          scenario: typeof FPScenario !== 'undefined' ? (/^ssp/.test(FPScenario.choice) ? FPScenario.choice : FPScenario.shortName()) : '' });
        fp.tasks[id] = cur;
      });
    } catch (e) { /* 저장이 막히면 이번 화면 동안만 */ }
  }

  // 탐험 지도(T §6-3) — 장마다 역할·시간·하는 일·과제 번호. 순서는 권장이고 막지 않는다
  const CHAPTERS = Object.freeze([
    { n: 1, role: '관측자', time: '과거 → 현재', what: '같은 자리를 여러 해에서 재며 변화와 원인 찾기', nos: '①~⑤' },
    { n: 2, role: '시민', time: '현재', what: '카페·분리배출장·멀티탭·정류장·여행사 → 나의 미래', nos: '⑥~⑪' },
    { n: 3, role: '결정자', time: '현재 → 미래', what: '기후 정책 회의실 → 우리 사회의 미래', nos: '⑫~⑭' },
    { n: 4, role: '성찰', time: '—', what: '나 · 우리 사회 · 목표를 한 표에, 학습지 내보내기', nos: '⑮' },
  ]);
  // 장마다 과제 목록 [{ title, done, frac }]. 1장 = 측정 ①② + 현장 ③④⑤(fp-field), 3·4장 = 위 SOC_TASKS.
  //   2장은 F5 의 행동 과제 ⑥~⑪(FPField.actionProgress). 그 함수가 없을 때(예전 파일 조합)만 체험 여부 셋(행동 고르기·카페·분리배출)으로 대신한다.
  function chapterItems(n, fp, rows) {
    if (n === 1 && typeof FPField !== 'undefined' && FPField.taskProgress) {
      return [...FPField.taskProgress(), ...FPField.fieldProgress()].map(p => ({ title: p.task.title, done: p.done, frac: p.frac }));
    }
    if (n === 2) {
      if (typeof FPField !== 'undefined' && typeof FPField.actionProgress === 'function') return FPField.actionProgress().map(p => ({ title: p.task.title, done: p.done, frac: p.frac }));
      const act = (fp && fp.actions) || {}, log = act.minigameLog || {};
      const chosen = typeof FPActions !== 'undefined' ? FPActions.chosen().ids.length : (Array.isArray(act.chosen) ? act.chosen.length : 0);
      return [{ title: '행동 하나 이상 고르기', done: chosen > 0 }, { title: '카페 체험', done: Array.isArray(log.cafe) && log.cafe.length > 0 },
        { title: '분리배출장 체험', done: Array.isArray(log.recycle) && log.recycle.length > 0 }].map(x => ({ ...x, frac: x.done ? 1 : 0 }));
    }
    return taskProgress(fp, rows).filter(p => p.task.chapter === n).map(p => ({ title: p.task.title, done: p.done, frac: p.frac }));
  }
  const chapterFrac = items => (items.length ? items.reduce((a, x) => a + x.frac, 0) / items.length : 0);

  let mapBox = null, taskBox = null, openChapter = 1;
  function readFp() { try { return WorksheetStore.readFp(); } catch (e) { return { tasks: {}, society: {}, actions: {}, ui: {} }; } }
  const rowsNow = () => (typeof FPField !== 'undefined' ? FPField.rows : []);
  function renderMap() {
    if (!mapBox) return;
    const fp = readFp(), rows = rowsNow();
    mapBox.innerHTML = `<h3 class="sh-h">탐험 지도 <span class="sub">1인칭의 네 장 — 순서는 권장이에요, 어디서 시작해도 돼요</span></h3>` + CHAPTERS.map(c => {
      const items = chapterItems(c.n, fp, rows), f = chapterFrac(items);
      return `<details class="soc-ch" data-ch="${c.n}"${c.n === openChapter ? ' open' : ''}><summary>
          <span class="soc-ch-n">${c.n}장</span><span class="soc-ch-role">${c.role}</span><span class="soc-ch-time">${c.time}</span>
          <span class="soc-ch-bar" role="img" aria-label="${c.n}장 진행 ${Math.round(f * 100)} %"><i style="width:${(f * 100).toFixed(0)}%"></i></span><span class="soc-ch-pct">${Math.round(f * 100)} %</span></summary>
        <p class="soc-ch-what">${esc(c.what)} · 과제 ${c.nos}</p>
        <ul class="soc-ch-items">${items.map(x => `<li class="${x.done ? 'ok' : ''}">${x.done ? '✓ ' : ''}${esc(x.title)}</li>`).join('')}</ul></details>`;
    }).join('');
    // 4차 F5: 구석 배지·[과제] 탭 숫자도 같은 목록으로 센다(③ 과제 글을 쓰고 나온 뒤에도 맞게)
    if (typeof FPField !== 'undefined' && FPField.updateBadge) FPField.updateBadge();
  }
  function renderTasks() {
    renderMap();
    if (!taskBox || taskBox.contains(document.activeElement)) return;   // 글을 쓰는 중에는 다시 그리지 않는다
    const fp = readFp();
    taskBox.innerHTML = `<h4 class="t-section">사회의 선택 과제 — 3장 결정자 · 4장 성찰</h4>` + taskProgress(fp, rowsNow()).map(p => {
      const t = p.task, obs = p.a.obs || {};
      const extra = t.id === 'soc_design' ? (() => {
        const r = fp.society && fp.society.result;
        return r && fp.society.levers ? `<p class="t-line">확정한 설계: 2100년 기온 편차 <b>${Number(r.T2100).toFixed(2)} °C</b> — ${r.T2100 < 2 ? '2 °C 아래예요.' : '아직 2 °C 위예요. 카드를 함께 더 써 보세요.'}</p>` : '';
      })() : t.id === 'soc_scale' ? scaleLine(savedLevers()) : '';
      const btn = t.id === 'soc_design' ? '<button class="btn btn--nav btn--sm" type="button" data-soc-council>회의실로 가기</button>'
        : t.id === 'soc_measure' ? '<button class="btn btn--time btn--sm" type="button" data-soc-go="2050">2050년으로 가기</button>' : '';
      return `<div class="task-card field-task soc-task${p.done ? ' done' : ''}" data-st="${t.id}">
        <div class="t-head"><span class="t-title">${esc(t.title)}</span><span class="t-badge">${p.done ? '✓ 완료' : Math.round(p.frac * 100) + '%'}</span></div>
        <div class="t-concept">${t.chapter}장 · ${CHAPTERS[t.chapter - 1].role}</div>
        <p class="t-line"><b>목표</b> ${esc(t.goal)}</p><p class="t-line"><b>방법</b> ${esc(t.how)} ${btn}</p>${extra}
        ${t.fields.map(f => `<label class="ft-diff"><span>${esc(f.key)}</span><textarea rows="2" data-key="${esc(f.key)}"${f.diff ? ' data-diff' : ''} placeholder="${esc(f.ph)}">${esc(f.diff ? p.a.diff : obs[f.key])}</textarea></label>`).join('')}
        <div class="t-subs">${p.subs.map(s => `<span class="t-sub${s.ok ? ' ok' : ''}">${esc(s.label)}${s.goal ? ` ${Math.min(s.n, s.goal)}/${s.goal}` : ''}</span>`).join('')}</div></div>`;
    }).join('');
    if (typeof Icons !== 'undefined' && Icons.fill) Icons.fill(taskBox);
  }
  function setChapter(n, scroll) {
    openChapter = n;
    try { WorksheetStore.updateFp(fp => { fp.ui.chapter = n; }); } catch (e) { /* 메모리 */ }
    renderMap();
    if (scroll && mapBox) { const d = mapBox.querySelector(`[data-ch="${n}"]`); if (d) d.scrollIntoView({ block: 'start' }); }
  }
  function initTasks() {
    mapBox = document.getElementById('socMap');
    taskBox = document.getElementById('socTasks');
    if (!mapBox || !taskBox) return;
    try { const c = Number(WorksheetStore.readFp().ui.chapter); if (c >= 1 && c <= 4) openChapter = c; } catch (e) { /* 1장 */ }
    mapBox.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('[data-ch]'); if (d && d.open && Number(d.dataset.ch) !== openChapter) setChapter(Number(d.dataset.ch)); }, true);
    taskBox.addEventListener('input', e => {
      const card = e.target.closest('[data-st]');
      if (!card || !e.target.dataset.key) return;
      const id = card.dataset.st, a = (readFp().tasks || {})[id] || { obs: {} };
      if (e.target.hasAttribute('data-diff')) setTask(id, { diff: e.target.value });
      else setTask(id, { obs: { ...(a.obs || {}), [e.target.dataset.key]: e.target.value } });
    });
    taskBox.addEventListener('focusout', () => setTimeout(() => { if (!taskBox.contains(document.activeElement)) renderTasks(); }, 0));
    taskBox.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.hasAttribute('data-soc-council') && typeof FPActions !== 'undefined' && typeof FPActions.councilHook === 'function') FPActions.councilHook();
      if (b.dataset.socGo && typeof FPScenario !== 'undefined') FPScenario.goTo(Number(b.dataset.socGo), 'base');
    });
    renderTasks();
    // 교사용 ?chapter=3 — 학습지가 그 장을 펼친 채 시작(수업 시간 배분용). 첫 안내가 떠 있으면 안내가 먼저
    const q = new URLSearchParams(window.__FP_QUERY__ || location.search), ch = Number(q.get('chapter'));
    if (ch >= 1 && ch <= 4) {
      setChapter(ch);
      if (typeof FPSheet !== 'undefined' && !(typeof FPOnboard !== 'undefined' && FPOnboard.isOpen)) { FPSheet.open('tasks'); setChapter(ch, true); }
    }
  }

  return { YEARS, PATHS, ROWS, ME_SCALE, SOC_TASKS, CHAPTERS, M_SUBS, M_GOAL, table, societyDelta, mineDelta, aerialQuery, aerialHref, savedLevers,
    taskProgress, chapterItems, draftChanged, render, renderTasks, init };
})();
