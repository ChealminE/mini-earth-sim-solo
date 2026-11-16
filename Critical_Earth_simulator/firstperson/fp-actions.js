// ============================================================================
// 1인칭 행동 카드 + 세계 속 행동 지점 (4차 F2)
// ----------------------------------------------------------------------------
// 두 가지를 맡는다.
//   ① 학습지 [나의 행동] 탭(#actRoot): 행동 6개 카드(크기 막대 · 숫자 · ⓘ) · 비교 줄 · 참여 규모 · [미래 보러 가기]
//   ② 도시 구역의 가벼운 행동 지점 4개: 집 앞 멀티탭 · 자전거 거치대 · 버스 정류장 · 여행사 창문
//      (카페·분리배출장은 미니게임 M 이 건물·외관째 만든다 — 여기서는 카드 자리만 비워 둔다)
//
// 정직한 규모(TASK_4차_F §0): 숫자는 모두 ActionsCore(js/actions-core.js)에서만 낸다 — 지점은 '찾아가는 맥락'일 뿐이고
//   카드와 같은 함수(personalKg·cutGtC)를 쓴다. 효과를 부풀리는 배율도, 행동만으로 세계 모습을 바꾸는 연출도 없다.
//   '나의 미래' 갈래(엔진 실행)는 FPScenario.mineRun(fp-main.js, F3)이 맡는다 — 이 파일은 고른 행동을 저장하고 onChange 로 알릴 뿐이다.
//   ③ 사회의 선택(F3, 마스터 D18)도 이 탭 위쪽에 그리지만 고른 값·경로는 FPScenario.setChoice 가 갖는다(fp.actions.society).
//
// 규칙
//   - 현재(NOW_YEAR = 2026)에서만 고를 수 있다. 다른 해에는 카드가 잠기고 [현재로 가기], 지점 표지판은 흐려진다.
//   - 텀블러·분리배출은 미니게임 결과로만 켜진다(마스터 D13). 그 전에는 "아직 해 보지 않았어요 [카페에서 해 보기]".
//     교사용 주소 ?free=1 이면 카드에서 바로 켤 수 있다. M4 가 setMinigameResult(id, 결과) 로 채운다.
//   - 저장: 학습지 공용 저장소 fp.actions = { chosen: [...], scale, minigames: { tumbler, recycle } } (js/worksheet-store.js).
//     fp.actions.society 는 F3 몫이라 건드리지 않는다(updateFp 가 다른 키를 그대로 둔다).
//
// 세계 속 지점 (축척: 1유닛 = 50 m, 함정 13 — 주석의 크기는 실척 m)
//   - 지점마다 Mesh 하나(받침·기둥·표지판을 한 지오메트리로 굽고, 표지판 그림 + 단색 견본을 캔버스 한 장에 그린다)
//     → 드로우콜 +4. 그림자는 드리우지 않는다(그림자 패스도 드로우콜이라 '+4 이하'를 넘는다). 투명 재질 없음(함정 15).
//   - 가까이(약 5.5 m) 가서 표지판을 겨누면 십자선 아래 "E 플러그 뽑기" 안내. E(e.code — 한글 자판 ㄷ 이어도 같다, fp-player.js)
//     → 멀티탭은 그 자리에서 스위치를 끄고(표시등 꺼짐), 나머지는 고르기 카드와 함께 학습지 [나의 행동]이 그 카드에 초점을 두고 열린다.
//
// 로드 순서: … fp-timeline → fp-actions → fp-tools → fp-player → fp-main (firstperson/index.html 과 빌더 FP_JS 를 같이 맞춘다).
//   이 파일을 읽는 순간에는 DOM·three.js 를 건드리지 않는다(함정 10 TDZ). build()(세계, fp-main 이 세계를 만든 뒤) ·
//   init()(학습지, FPSheet.init 뒤)에서만 만든다. 아래 '순수 계산' 부분은 node(tools/test_actions.js)로 검사한다.
// ============================================================================
const FPActions = (() => {
  const AC = ActionsCore;
  const NOW = AC.START;
  const byId = Object.fromEntries(AC.ACTIONS.map(a => [a.id, a]));
  const MAX_KG = Math.max(...AC.ACTIONS.map(a => a.kgPerYear));   // 크기 막대 공통 눈금(선형) — 가장 큰 행동

  // 미니게임이 맡는 행동(D13): 체험해야 켜진다
  const MINIGAME = Object.freeze({
    tumbler: { place: '카페', tryLabel: '카페에서 해 보기' },
    recycle: { place: '분리배출장', tryLabel: '분리배출장에서 해 보기' },
  });
  // 카드의 '찾아가기' 꼬리표 — 세계 어디서 이 행동을 만나는가
  const WHERE = Object.freeze({
    tumbler: '도시의 카페', standby: '집 앞 멀티탭', recycle: '도시의 분리배출장',
    bike: '자전거 거치대', transit: '버스 정류장', flight: '여행사 창문',
  });

  // 세계 속 행동 지점 4개. local = 도시 구역(cityGroup) 안 좌표 [x, z] — 큰길(z ≈ −0.01, 폭 6 m)·교차로(x ≈ 0.09)·건물·
  //   T3 충전소(z 0.085)·굴뚝·SMR 자리와 겹치지 않는 보도. face = 표지판이 보는 쪽(+1 = +z, 큰길 쪽)
  const POINTS = Object.freeze([
    { id: 'plug',   action: 'standby', label: '집 앞 멀티탭',  local: [-0.52, 0.105], face: -1 },
    { id: 'bike',   action: 'bike',    label: '자전거 거치대', local: [-0.80, -0.115], face: 1 },
    { id: 'bus',    action: 'transit', label: '버스 정류장',   local: [-0.32, -0.112], face: 1 },
    { id: 'travel', action: 'flight',  label: '여행사 창문',   local: [0.30, -0.125], face: 1 },
  ]);
  // 지점 고르기 카드(정류장·거치대 = 타고 갈 수단, 여행사 = 올해 여행 계획 2장). on = 그 행동을 켜는 쪽인가
  const CHOICES = Object.freeze({
    bike: { title: '자전거 거치대 — 가까운 거리는 무엇으로 갈까요?', opts: [
      { key: 'on', label: '걷거나 자전거 타기', on: true },
      { key: 'off', label: '가까워도 자가용 타기', on: false }] },
    bus: { title: '버스 정류장 — 앞으로 무엇을 타고 다닐까요?', opts: [
      { key: 'on', label: '버스·지하철 타기', on: true },
      { key: 'off', label: '지금처럼 자가용 타기', on: false }] },
    travel: { title: '여행사 창문 — 올해 여행 계획', opts: [
      { key: 'off', label: '장거리 왕복 비행 (해외여행)', on: false },
      { key: 'on', label: '가까운 기차 여행', on: true }],
      note: '이 카드는 줄인 장거리 비행 1번의 크기만 셉니다 — 대신 가는 기차 여행에도 배출이 조금 있어요.' },
  });

  // ③ 사회의 선택 설명(4차 F3). SSP 세 줄은 조감 미래 예측 PRESET_DESC(js/tab-future.js)와 같은 글 — test_actions 가 같은지 본다
  const SOCIETY_DESC = Object.freeze({
    ssp245: '현재 정책이 유지될 때의 경로에 가장 가까운 SSP. 배출이 2050년 무렵까지 지금 수준에 머물다 천천히 줄어듭니다.',
    ssp126: '기온 상승을 2 °C 아래로 억제하는 경로. 화석 배출이 빠르게 줄고 2070년대부터 순배출이 음수가 됩니다.',
    ssp119: '1.5 °C 억제, 세기 중반 탄소중립 경로. 2050년 무렵 순배출 0, 그 뒤로는 대기에서 탄소를 거둬들입니다.',
    ndc: '전 세계가 한국의 2035년 목표와 같은 비율(2018년 대비 53 %, 목표 범위의 낮은 끝)로 화석 CO₂를 줄이고 2050년에 0이 된다고 가정한 비교 경로입니다.',
    custom: '시청 \'기후 정책 회의실\'에서 정책·기후테크 카드로 설계한 2050년의 사회를 따릅니다.',
    aerial: '조감 모드 미래 예측에서 레버로 설계한 2050년의 사회를 따릅니다(이번 화면에서만).',
  });

  // ── 순수 계산 (DOM 없음 — node 검사) ────────────────────────────────────
  const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0));
  const mg = (st, id) => (st && st.minigames && st.minigames[id]) || null;
  const isDone = (st, id) => !!(mg(st, id) && mg(st, id).done);
  // 분리배출 정확도: 해 본 결과가 있으면 그 값, 없으면 0(아직 안 해 봄 — ActionsCore 규칙).
  //   교사용 ?free=1 로 체험 없이 켰을 때만 1(안내서 값 88 kg 그대로)로 본다 — 0 이면 켜도 0 kg 이라 켜는 뜻이 없다
  function recycleAccuracy(st, free) {
    const r = mg(st, 'recycle');
    if (r && Number.isFinite(Number(r.accuracy)) && r.accuracy !== null) return clamp01(r.accuracy);
    return free ? 1 : 0;
  }
  // ActionsCore 에 넘기는 chosen 묶음 { ids, recycleAccuracy }
  function chosenOf(st, free) {
    const ids = ((st && st.chosen) || []).filter(id => byId[id]);
    return { ids: [...new Set(ids)], recycleAccuracy: recycleAccuracy(st, free) };
  }
  // 카드에서 켜고 끌 수 있는가 — 미니게임 행동은 체험했거나 교사용일 때만(D13)
  const canToggle = (id, st, free) => !!byId[id] && (!MINIGAME[id] || free || isDone(st, id));
  // 그 행동 1인 [kg/년] — 크기 막대·숫자. 분리배출은 정확도를 곱하되, 아직 해 보지 않았으면 안내서 값(88)을 보인다
  function cardKg(id, st, free) {
    const a = byId[id];
    if (a.scaleBy !== 'recycleAccuracy') return a.kgPerYear;
    return isDone(st, 'recycle') || free ? a.kgPerYear * recycleAccuracy(st, free) : a.kgPerYear;
  }
  // 비교 줄 ①: 텀블러를 몇 년 써야 장거리 왕복 비행 1번만큼인가(계산값 — 문헌값 1-5 아래 '286년'과 같은 식)
  const tumblerYearsPerFlight = () => byId.flight.kgPerYear / byId.tumbler.kgPerYear;
  // 비교 줄 ②: 내 행동 합계가 한국인 1인 생활 배출(9.46 t, footprint_kr)의 몇 %인가
  const footprintPct = chosen => AC.personalKg(chosen) / AC.FOOTPRINT_KR_KG * 100;
  // 참여 규모로 함께 했을 때 1년에 줄이는 CO₂ [t/년, 다 퍼진 뒤] — 엔진에 넣는 양과 같은 식(cutGtC)
  const scaleTonnes = (chosen, scaleId) => AC.cutGtC(chosen, scaleId) * AC.C_TO_CO2 * 1e9;

  // 숫자 글: 한국어 자릿수(만·억). 반올림 자리는 크기에 맞춰 — 작은 값이 0 으로 사라지지 않게
  const nf = (v, d = 0) => Number(v).toLocaleString('ko-KR', { maximumFractionDigits: d, minimumFractionDigits: 0 });
  const fmtKg = v => nf(v, v < 1000 ? 1 : 0);   // 285.4 · 61.6 처럼 안내서 자리 그대로(정수면 소수점 없이)
  function fmtPeople(n) {
    if (n >= 1e8) return `${nf(n / 1e8, 1)}억 명`;
    if (n >= 1e4) return `${nf(n / 1e4, 0)}만 명`;
    return `${nf(n)}명`;
  }
  function fmtTonnes(t) {
    if (!(t > 0)) return '0 kg';
    if (t < 1) return `${fmtKg(t * 1000)} kg`;
    if (t < 1e4) return `${nf(t, t < 10 ? 1 : 0)} t`;
    if (t < 1e8) return `${nf(t / 1e4, t < 1e5 ? 1 : 0)}만 t`;
    return `${nf(t / 1e8, 2)}억 t`;
  }

  // ── 상태 ────────────────────────────────────────────────────────────────
  let free = false;
  try { free = new URLSearchParams(window.__FP_QUERY__ || location.search).get('free') === '1'; } catch (e) { free = false; }
  const st = { chosen: [], scale: 'me', minigames: {} };
  let year = NOW;            // 지금 보고 있는 해 — fp-main applyScenarioYear 가 onYear 로 알린다
  let context = null;        // 학습지를 지점에서 열었을 때의 고르기 카드(지점 id)
  const listeners = [];
  const isNow = () => year === NOW;

  function load() {
    try {
      const a = WorksheetStore.readFp().actions || {};
      st.chosen = Array.isArray(a.chosen) ? a.chosen.filter(id => byId[id]) : [];
      st.scale = AC.SCALES.some(s => s.id === a.scale) ? a.scale : 'me';
      st.minigames = a.minigames && typeof a.minigames === 'object' ? a.minigames : {};
    } catch (e) { /* 저장소가 막히면 빈 상태로 */ }
    // 체험 전 미니게임 행동이 (예전 저장분 등으로) 켜져 있으면 끈다 — D13
    st.chosen = st.chosen.filter(id => canToggle(id, st, free));
  }
  function save() {
    try {
      WorksheetStore.updateFp(fp => {
        fp.actions = fp.actions && typeof fp.actions === 'object' && !Array.isArray(fp.actions) ? fp.actions : {};
        fp.actions.chosen = st.chosen.slice();
        fp.actions.scale = st.scale;
        fp.actions.minigames = st.minigames;
      });
    } catch (e) { /* 메모리에만 */ }
  }
  function changed() {
    save();
    render();
    applyPointState();
    const c = chosen();
    for (const fn of listeners) { try { fn(c, st.scale); } catch (e) { console.error(e); } }
  }
  const chosen = () => chosenOf(st, free);
  const has = id => st.chosen.includes(id);

  // 행동 켜기/끄기 — 현재에서만, 미니게임 행동은 D13 규칙대로. 바뀌었으면 true
  function setAction(id, on) {
    if (!isNow() || !canToggle(id, st, free)) return false;
    if (on === has(id)) return false;
    st.chosen = on ? [...st.chosen, id] : st.chosen.filter(x => x !== id);
    changed();
    return true;
  }
  const toggle = id => setAction(id, !has(id));
  function setScale(id) {
    if (!isNow() || !AC.SCALES.some(s => s.id === id) || id === st.scale) return false;
    st.scale = id;
    changed();
    return true;
  }
  // 미니게임(M4)이 결과를 넣는다: tumbler { done: true, … } · recycle { done: true, accuracy: 0~1, … }.
  //   체험을 마치면 그 행동이 켜진다(D13 '체험해야 켜짐'). 현재가 아니어도 결과는 저장한다(카페는 현재에만 열 테지만 안전하게)
  function setMinigameResult(id, result = {}) {
    if (!MINIGAME[id]) return false;
    st.minigames = { ...st.minigames, [id]: { ...result, done: true } };
    if (isNow() && !has(id)) st.chosen = [...st.chosen, id];
    changed();
    return true;
  }

  // ── 학습지 [나의 행동] 탭 ─────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  let root = null;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  // ⓘ 는 srcButton('키')(js/source-tip.js)를 그대로 부른다 — check_sources.js 가 이 글꼴의 키를 훑어 등록부 누락을 막는다

  function cardHtml(a) {
    const on = has(a.id), wait = MINIGAME[a.id] && !isDone(st, a.id) && !free;
    const kg = cardKg(a.id, st, free), pct = kg / MAX_KG * 100;
    let num = `<b>${fmtKg(kg)}</b> kg/년`;
    if (a.id === 'recycle') {
      if (isDone(st, 'recycle')) num = `88 kg × 정확도 ${nf(recycleAccuracy(st, free) * 100)} % = <b>${fmtKg(kg)}</b> kg/년`;
      else if (free) num = `<b>${fmtKg(kg)}</b> kg/년 <span class="ac-sub">(정확도 100 %로 가정 — 교사용)</span>`;
      else num = `<b>${fmtKg(kg)}</b> kg/년 <span class="ac-sub">(분리배출을 해 보면 정확도만큼으로 정해져요)</span>`;
    }
    const toggleBtn = wait ? '' : `<button class="btn btn--scen btn--sm ac-toggle${on ? ' is-on' : ''}" type="button" data-toggle="${a.id}"`
      + ` aria-pressed="${on}"${isNow() ? '' : ' disabled'}>${on ? '하기로 했어요' : '할래요'}</button>`;
    const waitLine = wait ? `<p class="ac-wait">아직 해 보지 않았어요 <button class="btn btn--nav btn--sm" type="button" data-try="${a.id}">${MINIGAME[a.id].tryLabel}</button></p>` : '';
    return `<article class="act-card${on ? ' is-on' : ''}${wait ? ' is-wait' : ''}" id="actCard-${a.id}" data-act="${a.id}" tabindex="-1" aria-label="${esc(a.label)}">
      <div class="ac-head"><span class="ac-name">${esc(a.label)}</span>${srcButton(a.src)}${toggleBtn}</div>
      <div class="ac-bar" role="img" aria-label="1년에 ${fmtKg(kg)} kg — 가장 큰 행동(${nf(MAX_KG)} kg)의 ${nf(pct, 1)} %"><i style="width:${pct.toFixed(2)}%"></i></div>
      <p class="ac-num">${num}<span class="ac-where">찾아가기: ${WHERE[a.id]}</span></p>${waitLine}
    </article>`;
  }

  function contextHtml() {
    const c = context && CHOICES[context];
    if (!c) return '';
    const p = POINTS.find(q => q.id === context), on = has(p.action);
    const btns = c.opts.map(o => `<button class="btn btn--scen ac-choice${o.on === on ? ' is-on' : ''}" type="button" data-choice="${o.key}"`
      + ` aria-pressed="${o.on === on}"${isNow() ? '' : ' disabled'}>${esc(o.label)}</button>`).join('');
    return `<div class="act-context" role="group" aria-labelledby="actCtxTitle">
      <p class="ac-ctx-title" id="actCtxTitle">${esc(c.title)}</p>
      <div class="ac-choices">${btns}</div>
      ${c.note ? `<p class="ac-sub">${esc(c.note)}</p>` : ''}
    </div>`;
  }

  // ③ 사회의 선택(4차 F3) — 고르기만. 설계는 T2 회의실, 경로·갈래 계산은 FPScenario(fp-main.js)
  function societyHtml() {
    if (typeof FPScenario === 'undefined' || !FPScenario.choices) return '';
    const list = FPScenario.choices(), cur = FPScenario.choice;
    const btns = list.map(c => `<button class="btn btn--scen btn--sm act-soc${c.id === cur ? ' is-on' : ''}" type="button" data-society="${c.id}"`
      + ` aria-pressed="${c.id === cur}"${isNow() && c.available ? '' : ' disabled'}><span data-icon="${c.icon}"></span>${esc(c.label)}</button>`).join('');
    const c = list.find(x => x.id === cur) || list[0];
    const noDesign = !list.find(x => x.id === 'custom').available;
    return `<h3 class="sh-h">③ 사회의 선택 <span class="sub">배출 경로 — 미래를 가장 크게 바꾸는 층</span></h3>
      <div class="act-society" role="group" aria-label="사회의 선택">${btns}</div>
      <p class="act-line">${esc(SOCIETY_DESC[c.id] || '')}${srcButton(c.src)}</p>
      ${noDesign ? `<p class="ac-wait">'우리가 설계한 사회'는 시청 '기후 정책 회의실'에서 만들어요 <button class="btn btn--nav btn--sm" type="button" id="actGoCouncil">회의실로 가기</button></p>` : ''}
      <p class="sh-note"><b>기준 미래</b> = 이 경로 그대로, <b>나의 미래</b> = 같은 경로 − 아래 나의 행동 × 참여 규모. 2026년까지는 하나의 역사이고 2027년부터 갈라집니다.${srcButton('fp_now_join')}</p>`;
  }

  function render() {
    if (!root) return;
    // 다시 그리면 초점이 사라진다 — 누르던 버튼을 기억했다가 같은 버튼에 되돌린다(키보드로 이어서 조작할 수 있게)
    const ae = document.activeElement, keep = ae && root.contains(ae)
      ? ['data-toggle', 'data-scale', 'data-choice', 'data-try', 'data-society', 'id'].map(k => [k, ae.getAttribute(k)]).find(([, v]) => v) : null;

    const c = chosen(), sum = AC.personalKg(c), sc = AC.SCALES.find(s => s.id === st.scale);
    const tonnes = scaleTonnes(c, st.scale);
    const years = Math.round(tumblerYearsPerFlight());
    const lock = isNow() ? '' : `<div class="act-lock" role="status"><span>현재(${NOW})로 가야 행동을 바꿀 수 있어요 — 지금은 ${year}년입니다.</span>
      <button class="btn btn--time btn--sm" type="button" id="actGoNow">현재로 가기</button></div>`;
    const scaleBtns = AC.SCALES.map(s => `<button class="btn btn--nav btn--sm${s.id === st.scale ? ' is-on' : ''}" type="button" data-scale="${s.id}"`
      + ` aria-pressed="${s.id === st.scale}"${isNow() ? '' : ' disabled'}>${esc(s.id === 'world' ? '세계' : s.label)}</button>`).join('');
    const who = st.scale === 'me' ? '나 혼자 할 때입니다.'
      : `만약 <b>${esc(sc.label)}</b> ${fmtPeople(sc.people)}이 함께 한다면 — 가정입니다.`;
    const flightCap = st.scale === 'world' && has('flight')
      ? ` 비행은 국제선을 타는 사람 수(약 3.3억 명)까지만 셉니다.${srcButton('act_flight')}` : '';

    root.innerHTML = `${lock}${contextHtml()}${societyHtml()}
      <h3 class="sh-h">① 나의 탄소 <span class="sub">1년에 줄이는 CO₂ — 여섯 막대가 같은 눈금입니다</span></h3>
      <p class="sh-note">도시의 멀티탭·자전거 거치대·버스 정류장·여행사 창문에 가서 <span class="key">E</span> 를 누르면 그 카드로 옵니다 — 숫자는 카드와 같은 계산입니다.${srcButton('fp_action_points')}</p>
      <div class="act-cards">${AC.ACTIONS.map(cardHtml).join('')}</div>
      <p class="act-line">카페에서 텀블러를 <b>약 ${nf(years)}년</b> 써야 장거리 왕복 비행 1번(${nf(byId.flight.kgPerYear)} kg)만큼 줄어요.${srcButton('act_tumbler')}
        학교와 정부가 주로 권하는 행동은 작은 쪽이라는 연구도 있습니다.${srcButton('wynes2017')}</p>
      <p class="act-line">${c.ids.length ? `내가 고른 행동 ${c.ids.length}개 합계 <b>${fmtKg(sum)} kg/년</b> = 한국인 1명 생활 배출(9.46 t)의 <b>${footprintPct(c).toFixed(1)} %</b>`
        : '아직 고른 행동이 없어요 — 고르면 한국인 1명 생활 배출(9.46 t)과 견줘 보여 줍니다.'}${srcButton('footprint_kr')}</p>
      ${free ? '<p class="ac-sub">교사용 주소(?free=1): 텀블러·분리배출을 체험 없이 카드에서 바로 고를 수 있습니다.</p>' : ''}

      <h3 class="sh-h">② 모두의 선택 <span class="sub">참여 규모 — 같은 행동을 몇 명이 함께 하나</span></h3>
      <div class="act-scales" role="group" aria-label="참여 규모">${scaleBtns}</div>
      <p class="act-line">${who}${srcButton('action_scale')}
        ${c.ids.length ? ` 모두 합치면 1년에 <b>${fmtTonnes(tonnes)}</b> CO₂를 줄입니다(2030년에 다 퍼진 뒤).${srcButton('action_ramp')}${flightCap}` : ''}</p>
      <p class="act-line">이만큼 줄이면 미래의 CO₂·기온이 얼마나 달라지는지는 미래로 가서 계측기로 직접 재 보세요.</p>
      <p class="sh-links"><button class="btn btn--time" type="button" id="actGoFuture"><span data-icon="play"></span>미래 보러 가기 (2100년 · 나의 미래)</button></p>
      <p class="sh-note">IPCC는 인프라와 정책이 받쳐 줄 때 생활 속 수요 측 조치로 건물·육상 수송·식품 부문 배출을 2050년까지 40~70 % 줄일 수 있다고 봅니다.${srcButton('ipcc_ar6_demand')}
        개인 행동은 많은 사람이 함께 하고 사회의 선택이 받쳐 줄 때 미래를 크게 바꿉니다.</p>`;
    if (typeof Icons !== 'undefined' && Icons.fill) Icons.fill(root);
    if (keep) {
      const el = keep[0] === 'id' ? $(keep[1]) : root.querySelector(`[${keep[0]}="${keep[1]}"]`);
      if (el && !el.disabled) el.focus();
    }
  }

  function onClick(e) {
    const b = e.target.closest('button');
    if (!b || !root.contains(b) || b.disabled) return;
    if (b.dataset.toggle) { toggle(b.dataset.toggle); return; }
    if (b.dataset.scale) { setScale(b.dataset.scale); return; }
    if (b.dataset.choice && context) {
      const p = POINTS.find(q => q.id === context), o = CHOICES[context].opts.find(x => x.key === b.dataset.choice);
      if (p && o) { setAction(p.action, o.on); flashCard(p.action, false); }
      return;
    }
    if (b.dataset.try) { tryMinigame(b.dataset.try); return; }
    if (b.dataset.society && typeof FPScenario !== 'undefined') { FPScenario.setChoice(b.dataset.society); return; }
    if (b.id === 'actGoCouncil') {
      // T2 회의실이 FPActions.councilHook = () => … 를 채운다. 그 전에는 안내만
      if (typeof api.councilHook === 'function') api.councilHook();
      else toast('시청 \'기후 정책 회의실\'은 아직 준비 중이에요', 2800);
      return;
    }
    if (b.id === 'actGoNow' && typeof FPScenario !== 'undefined') { FPScenario.goTo(NOW, FPScenario.branch); return; }
    if (b.id === 'actGoFuture' && typeof FPScenario !== 'undefined') {
      // '나의 미래' 갈래는 행동이 하나라도 있을 때 열린다(fp-main syncMine → FPTimeline.setMineEnabled). 닫혀 있으면 goTo 가 기준 미래로 간다 — 그 사실을 알린다
      if (typeof FPTimeline !== 'undefined' && !FPTimeline.mineEnabled) toast('행동을 하나 이상 고르면 \'나의 미래\'가 열려요 — 지금은 2100년 기준 미래로 갑니다', 3200);
      FPScenario.goTo(2100, 'mine');
    }
  }

  // 미니게임 열기 — M 이 FPActions.minigameHook = id => … 를 채운다. 그 전에는 안내만
  function tryMinigame(id) {
    if (typeof api.minigameHook === 'function') { api.minigameHook(id); return; }
    toast(`${MINIGAME[id].place}은(는) 아직 문을 열지 않았어요 (준비 중)`, 2800);
  }
  const toast = (m, ms) => { if (typeof FPField !== 'undefined') FPField.toast(m, ms); };

  // 그 카드로 초점·스크롤 + 잠깐 테두리. focus = 카드 자체에 초점을 줄지(지점에서 열 때)
  function flashCard(id, focus = true) {
    const el = root && $(`actCard-${id}`);
    if (!el) return;
    if (focus) el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
    el.classList.add('is-focus');
    clearTimeout(flashCard._t);
    flashCard._t = setTimeout(() => el.classList.remove('is-focus'), 2500);
  }

  // 학습지 [나의 행동]을 그 지점·카드에 맞춰 연다
  function openFor(pointId) {
    const p = POINTS.find(q => q.id === pointId);
    context = p && CHOICES[pointId] && isNow() ? pointId : null;
    render();
    if (typeof FPSheet !== 'undefined') FPSheet.open('actions');
    if (!p) return;
    if (context) {
      const first = root.querySelector('.ac-choice');
      root.scrollTop = 0;
      const panel = $('shPanelActions');
      if (panel) panel.scrollTop = 0;
      if (first) first.focus();
      flashCard(p.action, false);
    } else flashCard(p.action, true);
  }

  function init() {
    root = $('actRoot');
    load();
    if (!root) return;
    root.addEventListener('click', onClick);
    // 학습지를 닫으면 지점 고르기 카드는 접는다(다음에 탭으로 열면 카드 목록부터)
    const sheet = $('sheet');
    if (sheet && typeof MutationObserver !== 'undefined') {
      new MutationObserver(() => { if (sheet.hidden && context) { context = null; render(); } })
        .observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
    }
    render();
    applyPointState();
  }

  // fp-main applyScenarioYear 가 연도가 바뀔 때마다 부른다 — 카드 잠금·표지판 흐림
  function onYear(y) {
    const was = isNow();
    year = Math.round(Number(y));
    if (!isNow()) context = null;
    if (was !== isNow()) { render(); applyPointState(); }
    else if (root && root.querySelector('.act-lock')) render();   // 다른 해끼리 옮겨도 '지금은 O년' 글을 맞춘다
  }

  // ── 세계 속 지점 ─────────────────────────────────────────────────────────
  const U = 0.02;   // 1 m = 0.02 유닛 (1유닛 = 50 m)
  const CW = 512, SIGN_H = 384;               // 캔버스: 위 512×384 = 표지판 그림, 아래 128 px = 단색 견본 4칸
  const SW = { body: 0, accent: 1, dark: 2, led: 3 };
  let pts = [], camRef = null, hintEl = null, focusPt = null, tick = 0;

  const FONT = '"Pretendard", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", sans-serif';
  // 표지판 그림(3D 세계 안 소품 — UI 토큰이 아니라 세계 색). 아이콘은 캔버스 선으로 그린다(외부 그림 파일 0)
  const rrect = (g, x, y, w, h, r) => { if (g.roundRect) g.roundRect(x, y, w, h, r); else g.rect(x, y, w, h); };   // 예전 브라우저 대비
  function drawIcon(g, id, cx, cy, s, col) {
    g.save(); g.translate(cx, cy); g.strokeStyle = col; g.fillStyle = col; g.lineWidth = s * 0.08; g.lineJoin = g.lineCap = 'round';
    if (id === 'plug') {               // 멀티탭: 긴 몸통 + 구멍 3개 + 선
      g.strokeRect(-s * 0.55, -s * 0.18, s * 1.1, s * 0.36);
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.arc(i * s * 0.3, 0, s * 0.07, 0, Math.PI * 2); g.fill(); }
      g.beginPath(); g.moveTo(-s * 0.55, 0); g.quadraticCurveTo(-s * 0.8, s * 0.1, -s * 0.75, s * 0.4); g.stroke();
    } else if (id === 'bike') {        // 자전거: 바퀴 둘 + 뼈대
      for (const x of [-0.42, 0.42]) { g.beginPath(); g.arc(x * s, s * 0.15, s * 0.28, 0, Math.PI * 2); g.stroke(); }
      g.beginPath(); g.moveTo(-0.42 * s, 0.15 * s); g.lineTo(-0.1 * s, -0.25 * s); g.lineTo(0.25 * s, -0.25 * s); g.lineTo(0.42 * s, 0.15 * s);
      g.moveTo(-0.1 * s, -0.25 * s); g.lineTo(0.05 * s, 0.15 * s); g.lineTo(0.25 * s, -0.25 * s); g.moveTo(0.2 * s, -0.38 * s); g.lineTo(0.32 * s, -0.38 * s); g.stroke();
    } else if (id === 'bus') {         // 버스: 둥근 상자 + 창 + 바퀴
      g.beginPath(); rrect(g, -s * 0.5, -s * 0.42, s, s * 0.72, s * 0.1); g.stroke();
      g.fillRect(-s * 0.38, -s * 0.3, s * 0.76, s * 0.24);
      for (const x of [-0.27, 0.27]) { g.beginPath(); g.arc(x * s, s * 0.34, s * 0.1, 0, Math.PI * 2); g.fill(); }
    } else {                           // 여행: 비행기(왼쪽) ↔ 기차(오른쪽)
      g.beginPath(); g.moveTo(-s * 0.95, 0); g.lineTo(-s * 0.15, 0);
      g.moveTo(-s * 0.55, -s * 0.3); g.lineTo(-s * 0.45, 0); g.lineTo(-s * 0.55, s * 0.3);
      g.moveTo(-s * 0.9, -s * 0.12); g.lineTo(-s * 0.85, 0); g.lineTo(-s * 0.9, s * 0.12); g.stroke();
      g.beginPath(); rrect(g, s * 0.15, -s * 0.32, s * 0.8, s * 0.56, s * 0.12); g.stroke();
      g.fillRect(s * 0.27, -s * 0.2, s * 0.56, s * 0.16);
      g.beginPath(); g.moveTo(s * 0.1, s * 0.42); g.lineTo(s * 1.0, s * 0.42); g.stroke();
    }
    g.restore();
  }
  const SIGN = {
    plug:   { title: '멀티탭', sub: on => (on ? '전원 꺼짐 · 플러그 뽑음' : '전원 켜짐 · 대기전력'), bg: '#f4f1ea', ink: '#1d2025', accent: '#a65200' },
    bike:   { title: '자전거 거치대', sub: () => '가까운 거리는 걷기·자전거', bg: '#e6f0e7', ink: '#17331f', accent: '#175e31' },
    bus:    { title: '버스 정류장', sub: () => '버스·지하철 타는 곳', bg: '#e4ebfa', ink: '#14274f', accent: '#1c4fbf' },
    travel: { title: '여행사', sub: () => '올해 여행 계획', bg: '#fbefe0', ink: '#3a1f08', accent: '#963805' },
  };
  // 단색 견본: 받침(body) · 강조(accent) · 기둥(dark) · 표시등(led)
  const SWATCH = {
    plug:   { body: '#d9d6cf', accent: '#f1f2ef', dark: '#4b5258' },
    bike:   { body: '#8b9196', accent: '#2f8f7a', dark: '#4b5258' },
    bus:    { body: '#c8ced6', accent: '#1c4fbf', dark: '#4b5258' },
    travel: { body: '#e8e2d6', accent: '#963805', dark: '#4b5258' },
  };
  function paint(p) {
    const g = p.ctx, S = SIGN[p.id], on = has(p.action);
    g.fillStyle = S.bg; g.fillRect(0, 0, CW, SIGN_H);
    g.fillStyle = S.accent; g.fillRect(0, 0, CW, 18); g.fillRect(0, SIGN_H - 10, CW, 10);
    drawIcon(g, p.id, CW / 2, 140, 120, S.accent);
    g.fillStyle = S.ink; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `700 64px ${FONT}`; g.fillText(S.title, CW / 2, 268);
    g.font = `500 34px ${FONT}`; g.fillText(S.sub(on), CW / 2, 330);
    const sw = SWATCH[p.id];
    // 표시등: 멀티탭 스위치는 켜져 있으면 붉게 빛나고, 플러그를 뽑으면(standby 고름) 꺼진다. 다른 지점은 강조색
    const led = p.id === 'plug' ? (on ? '#3a2a28' : '#ff4a3a') : sw.accent;
    [['body', sw.body], ['accent', sw.accent], ['dark', sw.dark], ['led', led]].forEach(([k, c]) => {
      g.fillStyle = c; g.fillRect(SW[k] * 128, SIGN_H, 128, CW - SIGN_H);
    });
    p.tex.needsUpdate = true;
  }

  // 조각들을 한 지오메트리로 굽는다. parts: [geo, 'sign' | 견본 이름, [x, y, z], ry?]
  //   'sign' 조각은 평면의 UV 를 표지판 칸(v 0.25~1)으로 옮기고, 나머지는 UV 를 견본 칸 한가운데 한 점으로 모은다(단색)
  function bakeUV(parts) {
    const m = new THREE.Matrix4(), list = [];
    for (const [geo, kind, p, ry] of parts) {
      const g = geo.index ? geo.toNonIndexed() : geo;
      m.makeRotationY(ry || 0).setPosition(p[0], p[1], p[2]);
      g.applyMatrix4(m);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) {
        if (kind === 'sign') uv.setY(i, SIGN_H / CW * uv.getY(i) + (1 - SIGN_H / CW));
        else uv.setXY(i, (SW[kind] * 128 + 64) / CW, 64 / CW);
      }
      list.push(g);
      if (g !== geo) geo.dispose();
    }
    const n = list.reduce((s, g) => s + g.attributes.position.count, 0);
    const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uvs = new Float32Array(n * 2);
    let o = 0;
    for (const g of list) {
      const c = g.attributes.position.count;
      pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); uvs.set(g.attributes.uv.array, o * 2);
      o += c; g.dispose();
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    out.computeBoundingSphere();
    return out;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w * U, h * U, d * U);
  const plane = (w, h) => new THREE.PlaneGeometry(w * U, h * U);
  const at = (x, y, z) => [x * U, y * U, z * U];
  // 기둥 위 양면 표지판(평면 두 장을 등지게 — 뒤에서 봐도 글자가 뒤집히지 않는다) + 얇은 뒤판.
  //   기둥은 표지판 아래 끝까지만 올리고(5 cm 겹침) 뒤판(4 cm)보다 가늘지 않게 5 cm — 표지판 면(±3 cm)을 뚫고 나오면 글자 위에 기둥이 비친다
  const signParts = (w, h, x, y, z) => {
    const top = y - h / 2 + 0.05;
    return [
      [box(0.05, top, 0.05), 'dark', at(x, top / 2, z)],
      [plane(w, h), 'sign', at(x, y, z + 0.03)],
      [plane(w, h), 'sign', at(x, y, z - 0.03), Math.PI],
      [box(w + 0.08, h + 0.08, 0.04), 'dark', at(x, y, z)],
    ];
  };
  // 모양: 실척(m) — 받침이 지면(y = 0)에 닿게(Q3 접지). sign = 겨누는 점(표지판 가운데), col = 충돌 상자(로컬, m)
  function shapeOf(id) {
    if (id === 'plug') return {      // 집 앞 실외 콘센트 받침(0.6 × 1.0 × 0.4) 위 멀티탭 + 불 들어오는 스위치, 뒤에 기둥 표지판(1.2 × 0.9)
      parts: [
        [box(0.6, 1.0, 0.4), 'body', at(0, 0.5, 0)],
        [box(0.5, 0.06, 0.16), 'accent', at(0, 1.03, 0.02)],
        [box(0.08, 0.05, 0.08), 'led', at(0.2, 1.08, 0.04)],
        ...signParts(1.2, 0.9, 0, 2.15, -0.24),
      ], sign: [0, 2.15, -0.2], col: [0.34, 0.26, 1.05] };
    if (id === 'bike') {             // 거치대 고리 3개(높이 0.8 m, 간격 0.8 m) + 바닥 레일, 왼쪽 끝 기둥 표지판
      const parts = [[box(2.4, 0.05, 0.2), 'dark', at(0, 0.025, 0)]];
      for (const x of [-0.8, 0, 0.8]) {
        parts.push([box(0.06, 0.8, 0.06), 'accent', at(x, 0.4, -0.35)], [box(0.06, 0.8, 0.06), 'accent', at(x, 0.4, 0.35)],
          [box(0.06, 0.06, 0.76), 'accent', at(x, 0.8, 0)]);
      }
      parts.push(...signParts(1.2, 0.9, -1.5, 2.15, 0));
      return { parts, sign: [-1.5, 2.15, 0], col: [1.25, 0.4, 0.9] };   // 높이 0.9 m — 걸어 넘는 턱(STEP_H ≈ 0.65 m)보다 높게
    }
    if (id === 'bus') return {       // 정류장 쉼터(4 × 2.5 × 1.4): 지붕 · 뒷벽 · 기둥 2 · 의자, 오른쪽 끝 정류장 표지 기둥
      parts: [
        [box(4.0, 0.1, 1.5), 'accent', at(0, 2.5, -0.1)],
        [box(4.0, 2.0, 0.06), 'body', at(0, 1.3, -0.75)],
        [box(0.08, 2.5, 0.08), 'dark', at(-1.9, 1.25, -0.7)], [box(0.08, 2.5, 0.08), 'dark', at(1.9, 1.25, -0.7)],
        [box(2.6, 0.06, 0.4), 'body', at(0, 0.45, -0.5)], [box(0.06, 0.45, 0.3), 'dark', at(-1.1, 0.22, -0.5)], [box(0.06, 0.45, 0.3), 'dark', at(1.1, 0.22, -0.5)],
        ...signParts(0.8, 0.6, 2.4, 2.75, 0),
      ], sign: [2.4, 2.75, 0], col: [2.0, 0.8, 2.6], colZ: -0.72, colD: 0.1 };
    return {                         // 여행사 가게(3 × 2.6 × 1.5) — 큰길 쪽 창에 여행 포스터(2.4 × 1.8), 차양
      parts: [
        [box(3.0, 2.6, 1.5), 'body', at(0, 1.3, 0)],
        [box(3.2, 0.15, 1.7), 'accent', at(0, 2.67, 0)],
        [box(3.0, 0.08, 0.5), 'accent', at(0, 2.35, 1.0)],
        [plane(2.4, 1.8), 'sign', at(0, 1.35, 0.76)],
      ], sign: [0, 1.35, 0.8], col: [1.5, 0.75, 2.7] };
  }

  // fp-main 이 세계(buildFirstPersonWorld) 뒤에 부른다
  function build(camera) {
    camRef = camera;
    _f = new THREE.Vector3(); _d = new THREE.Vector3();
    const W = FPWorld, GB = W.GROUND_BASE, Z = W.ZONE_W;
    pts = POINTS.map(P => {
      const cv = document.createElement('canvas');
      cv.width = CW; cv.height = CW;
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const sh = shapeOf(P.id);
      // 표지판 글자가 그늘에서도 읽히게 같은 그림을 약하게 스스로 빛나게(emissiveMap). 흐림(다른 해)은 색·발광을 낮춘다
      const mat = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.28, roughness: 0.7, metalness: 0.05 });
      const mesh = new THREE.Mesh(bakeUV(sh.parts), mat);
      const yaw = P.face > 0 ? 0 : Math.PI;
      const x = P.local[0] + Z, z = P.local[1];
      mesh.position.set(x, GB, z);
      mesh.rotation.y = yaw;
      mesh.castShadow = false;   // 그림자 패스 드로우콜을 늘리지 않는다(머리말)
      mesh.receiveShadow = true;
      W.scene.add(mesh);
      // 겨누는 점(월드) = 표지판 가운데. yaw π 면 로컬 x·z 가 뒤집힌다
      const sgn = P.face > 0 ? 1 : -1;
      const aim = new THREE.Vector3(x + sgn * sh.sign[0] * U, GB + sh.sign[1] * U, z + sgn * sh.sign[2] * U);
      // 충돌 상자(대충의 바깥 상자 — 걸어 들어가 표지판을 뚫지 않게). col = [반폭 x, 반폭 z, 높이] m
      const cz = z + sgn * (sh.colZ || 0) * U, hz = (sh.colD != null ? sh.colD : sh.col[1]) * U;
      const bx = { minX: x - sh.col[0] * U, maxX: x + sh.col[0] * U, minZ: cz - hz, maxZ: cz + hz, top: GB + sh.col[2] * U };
      W.boxes.push(bx);
      const p = { ...P, mesh, mat, tex, ctx: cv.getContext('2d'), aim };
      paint(p);
      return p;
    });
    hintEl = document.getElementById('actHint');
    applyPointState();
    return pts;
  }

  // 표지판 그림(멀티탭 표시등)·흐림을 지금 상태에 맞춘다
  function applyPointState() {
    for (const p of pts) {
      paint(p);
      const on = isNow();
      p.mat.color.setHex(on ? 0xffffff : 0x8a8a8a);
      p.mat.emissiveIntensity = on ? 0.28 : 0.04;
    }
  }

  const NEAR = 0.11;        // 약 5.5 m 안에서
  const AIM_COS = 0.92;     // 시선과 23° 안 (작은 표지판도 겨누기 쉽게 원뿔로 본다)
  let _f = null, _d = null;   // three.js 벡터는 build() 에서 만든다(이 파일을 읽는 순간에는 THREE 를 건드리지 않는다)
  let lastHint = '';
  function hintText(p) {
    if (!isNow()) return { html: `현재(${NOW})로 가야 해요`, locked: true };
    const verb = p.id === 'plug' ? (has('standby') ? '플러그 다시 꽂기' : '플러그 뽑기')
      : p.id === 'travel' ? '올해 여행 계획 고르기' : '타고 갈 수단 고르기';
    return { html: `<span class="key">E</span>${verb} <span class="ah-sub">${esc(p.label)}</span>`, locked: false };
  }
  // 프레임 루프에서 — 초당 10번만 본다
  function update(dt) {
    if (!camRef || !pts.length) return;
    tick += dt;
    if (tick < 0.1) return;
    tick = 0;
    let best = null, bestD = Infinity;
    const blocked = (typeof FPPlayer !== 'undefined' && (FPPlayer.uiOpen || FPPlayer.underwater)) || !document.pointerLockElement;
    if (!blocked) {
      camRef.getWorldDirection(_f);
      const px = FPPlayer.pos.x, pz = FPPlayer.pos.z;
      for (const p of pts) {
        const hd = Math.hypot(p.aim.x - px, p.aim.z - pz);
        if (hd > NEAR) continue;
        _d.subVectors(p.aim, camRef.position).normalize();
        if (_d.dot(_f) < AIM_COS) continue;
        if (hd < bestD) { best = p; bestD = hd; }
      }
    }
    focusPt = best;
    if (!hintEl) return;
    if (!best) { if (!hintEl.hidden) hintEl.hidden = true; lastHint = ''; return; }
    const h = hintText(best);
    if (h.html !== lastHint) {   // 글이 바뀔 때만 DOM 을 건드린다(멀티탭은 뽑으면 '다시 꽂기'로 바뀐다)
      hintEl.innerHTML = h.html;
      hintEl.classList.toggle('is-locked', h.locked);
      lastHint = h.html;
    }
    if (hintEl.hidden) hintEl.hidden = false;
  }

  // E 키(fp-player.js). 겨눈 지점이 없으면 false
  function interact() {
    const p = focusPt;
    if (!p) return false;
    if (!isNow()) {
      toast(`현재(${NOW})로 가야 행동을 바꿀 수 있어요 — 학습지의 [현재로 가기]나 타임라인 [현재 ${NOW}]`, 3200);
      openFor(null);
      flashCard(p.action, true);
      return true;
    }
    if (p.id === 'plug') {
      // 스위치 끄기 한 번 — 표시등이 꺼진다(효과음은 없다, 마스터 D12). 다시 누르면 다시 꽂는다
      const on = !has('standby');
      setAction('standby', on);
      toast(on ? `딸깍 — 안 쓰는 플러그를 뽑았어요 (1년에 약 ${fmtKg(byId.standby.kgPerYear)} kg)` : '플러그를 다시 꽂았어요 — 대기전력이 다시 새요', 2600);
    }
    if (hintEl) hintEl.hidden = true;
    focusPt = null; lastHint = '';
    openFor(p.id);
    return true;
  }

  const api = {
    POINTS, CHOICES, MINIGAME, NOW,
    // 순수 계산(node 검사용)
    chosenOf, canToggle, cardKg, recycleAccuracy, tumblerYearsPerFlight, footprintPct, scaleTonnes, fmtTonnes, fmtPeople, fmtKg,
    // 상태
    chosen, get scale() { return st.scale; }, get free() { return free; }, has,
    setAction, toggle, setScale, setMinigameResult, onChange: fn => { listeners.push(fn); },
    minigameHook: null, councilHook: null, SOCIETY_DESC,
    // 화면
    init, build, update, interact, onYear, openFor, render,
    get focusPoint() { return focusPt ? focusPt.id : null; },
    get points() { return pts; },
  };
  return api;
})();
