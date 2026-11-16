// ============================================================================
// 1인칭 학습지 [우리 사회] 탭 (4차 T4 — 목표 비교 · 조감 연결. T5 가 설계 요약·쟁점 메모·과제·탐험 지도를 더한다)
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
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
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
  function render() {
    if (!root) return;
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
    root.innerHTML = `<h3 class="sh-h">목표와 견주기 <span class="sub">기준 사회 · 우리 사회 · NDC · 1.5 °C — 같은 해의 엔진 값</span></h3>
      ${status}
      <div class="act-scales" role="group" aria-label="비교할 해">${yb}</div>
      <table class="field-table act-cmp soc-cmp"><thead><tr><th scope="col">${year}년</th>${head}</tr></thead><tbody>${body}</tbody></table>
      <p class="sh-note">NDC 비교 = 한국의 2035년 목표 비율(2018년 대비 53 %)을 전 세계 화석 CO₂에 적용하고 2050년에 0이 된다고 가정한 경로예요(가정 세 가지는 ⓘ).${srcButton('ndc_global_path')}
        이 표는 전 지구 평균(엔진 값)이에요. 미래로 가서 재는 값은 자리(도심·녹지·바다)에 따라 이 값과 조금씩 달라요 — 같은 자리에서 기준 사회와 우리 사회를 견줘 보세요.</p>
      <h3 class="sh-h">나와 사회 <span class="sub">2100년 기온 편차 — 기준 사회와의 차이</span></h3>
      ${scaleLine(L)}
      ${link}`;
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
    if (typeof FPActions !== 'undefined') FPActions.onChange(() => render());   // 행동이 바뀌면 '나와 사회' 줄
    render();
  }

  return { YEARS, PATHS, ROWS, ME_SCALE, table, societyDelta, mineDelta, aerialQuery, aerialHref, savedLevers, render, init };
})();
