// ============================================================================
// 1인칭 모드 - 부트스트랩 & 프레임 루프
// ============================================================================
const glCanvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas: glCanvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
// 노출은 1.15 고정(4차 B2에서 밝기 슬라이더를 뺐다). 조감은 1.1(2차 F2)인데 1인칭은 하늘이 화면 대부분이라
// 같은 값이면 화면 전체가 어둡게 느껴져서 조금 밝게 둔다.
renderer.toneMappingExposure = 1.15;

const camera = new THREE.PerspectiveCamera(75, 1, 0.002, 60);

buildFirstPersonWorld(renderer);
FPTechWorld.build();   // 4차 T3: 세계 속 기후테크 소품(처음엔 숨김 — applyWorldState 가 그해 사회 모습대로 켠다)
FPActions.build(camera);   // 4차 F2: 도시의 행동 지점 4개(멀티탭·거치대·정류장·여행사) — 지점마다 Mesh 하나(드로우콜 +4)

// ── 배출 경로 + 연도 → 전 지구 CO₂ (3차 E4) ─────────────────────────────────
// 예전에는 CO₂ 슬라이더로 농도를 직접 넣었다. 조감 모드에서는 CO₂가 배출을 쌓은 '결과'라(3차 마스터 결정 9)
// 두 화면이 같은 값을 쓰도록 조감 미래 예측과 같은 엔진(js/earth-system.js)으로 그 해의 전 지구 CO₂를 계산해 applyWorldCO2 에 넣는다.
// 시작 값은 주소에서: /firstperson/?scenario=ssp245&year=2100 (단일 HTML 파일에서는 껍데기가 window.__FP_QUERY__ 로 넘긴다).
// 도시 열섬·나무 밑 CO₂ 같은 공간 차이 계산은 그대로 — HUD에 '전 지구'와 '이 지점'을 나눠 적는다.
const FPScenario = (() => {
  const q = new URLSearchParams(window.__FP_QUERY__ || location.search);
  // 4차 F3: 경로(path) 이름 — 이름·아이콘은 조감 미래 예측 시나리오 버튼과 같다. 'ndc'·'custom' 은 사회의 선택(D18)에서 왔다.
  //   PRESETS 는 FPModel.pathRun 에 넘기는 경로 키별 짧은 이름(타임라인·HUD 배지가 좁아서 짧게).
  const PRESETS = { ssp245: '현재 정책', ssp126: '파리협약 2 °C', ssp119: '1.5 °C 탄소중립', ndc: '국가 목표(NDC)', custom: '직접 설계' };
  let urlLevers = null;
  try { urlLevers = q.get('levers') ? JSON.parse(q.get('levers')) : null; } catch (e) { urlLevers = null; }
  if (!urlLevers || typeof urlLevers !== 'object') urlLevers = null;
  // 레버 묶음은 빠진 칸을 지금 값(LEVER_NOW)으로 채운다 — 저장값·주소가 낡아 칸이 빠져도 엔진이 멈추지 않게
  const fullLevers = l => (l && typeof l === 'object' ? { ...EarthSystem.LEVER_NOW, ...l } : null);
  // T2 회의실이 저장한 '우리가 설계한 사회' 레버(fp.society.levers). 없으면 null → 그 선택지는 잠긴다
  function designedLevers() {
    try { return fullLevers(WorksheetStore.readFp().society.levers); } catch (e) { return null; }
  }
  // 4차 T2: 포집 합(ccs)을 CCUS·DAC 로 나누는 비율 — 회의실 카드 값(2050 목표). 세계 속 CCUS 설비는 이것이 있어야 보인다(FPModel.society 4번째 인자)
  function designedCapture() {
    try { const c = WorksheetStore.readFp().society.capture; return c && typeof c === 'object' ? c : null; } catch (e) { return null; }
  }

  // ── 사회의 선택 (4차 F3, 마스터 D18) ─────────────────────────────────────
  // 선택지 = SocietyCore.CHOICES(현재 정책 · 파리협약 2 °C · 1.5 °C 탄소중립 · 국가 목표(NDC)를 전 세계가 따른다면 · 우리가 설계한 사회)
  //   + 조감 [1인칭으로] 링크가 레버(직접 설계)를 넘겨 왔으면 '직접 설계(조감에서 가져옴)'(F §3 끝, 'aerial').
  // 고른 것은 학습지 공용 저장소 fp.actions.society 에 둔다. 주소의 ?scenario= 가 있으면 그 링크의 뜻이 먼저다(저장값보다).
  const CHOICE_ICON = { ssp245: 'globe', ssp126: 'accord', ssp119: 'target', ndc: 'list', custom: 'blocks', aerial: 'blocks' };
  function choiceList() {
    const list = SocietyCore.CHOICES.map(c => ({ id: c.id, label: c.label, src: c.src, icon: CHOICE_ICON[c.id],
      available: c.id !== 'custom' || !!designedLevers() }));
    if (urlLevers) list.push({ id: 'aerial', label: '직접 설계(조감에서 가져옴)', src: 'lever_fossil', icon: 'blocks', available: true });
    return list;
  }
  const pathOf = id => (id === 'custom' || id === 'aerial' ? 'custom' : id);
  const leversOf = id => (id === 'aerial' ? fullLevers(urlLevers) : id === 'custom' ? designedLevers() : null);
  const valid = id => choiceList().some(c => c.id === id && c.available);
  let choice = 'ssp245';
  {
    const qs = q.get('scenario');
    let stored = null;
    try { stored = WorksheetStore.readFp().actions.society; } catch (e) { stored = null; }
    if (qs === 'custom' && urlLevers) choice = 'aerial';
    else if (qs && qs !== 'custom' && valid(qs)) choice = qs;
    else if (stored && stored !== 'aerial' && valid(stored)) choice = stored;
  }
  let levers = leversOf(choice);

  const S = {
    get choice() { return choice; },
    get preset() { return pathOf(choice); },          // FPModel.pathRun 에 넘기는 경로 키
    get levers() { return levers; },
    // 4차 E1: 기본 연도 = '현재'(FPModel.NOW_YEAR, 마스터 D6). 예전 기본 2023(LAST_HIST_YEAR)은 '마지막 실제 배출 해'라 현재와 다르다
    year: Math.max(FPModel.YEAR_MIN, Math.min(FPModel.YEAR_MAX, Math.round(Number(q.get('year')) || FPModel.NOW_YEAR))),
    // 갈래: 'base' = 기준 미래(사회의 선택 경로), 'mine' = 나의 미래(같은 경로 − 나의 행동 × 참여 규모). 행동이 하나라도 있어야 열린다
    branch: 'base',
    PRESETS,
    choices: choiceList,
  };
  // 짧은 이름(타임라인·HUD·기록 표). 'custom' 경로는 누가 설계했는지로 이름이 다르다
  S.shortName = () => (choice === 'custom' ? '우리가 설계한 사회' : choice === 'aerial' ? '직접 설계(조감)' : PRESETS[choice]);
  // 4차 C1: 엔진 궤적·그해 표본은 FPModel(fp-model.js)에서만 낸다 — 조감과 같은 해 같은 값을 node(test_fp_model)로 검사하려고.
  // 4차 F3: 갈래 → 경로 실행. 기준 미래 = 사회의 선택 경로(FPModel.pathRun — 경로별 캐시는 FPModel).
  //   나의 미래 = 같은 경로 − 나의 행동 × 참여 규모(FPModel.mineRun → ActionsCore.emissionsFn). 실행 캐시는 여기 한 칸:
  //   행동·참여 규모·사회의 선택이 바뀔 때만 버린다(mineKey 가 달라지면 다시 굴린다, 약 10 ms).
  let mineCache = null, mineKeyCached = '';
  const mineKey = () => {
    const c = FPActions.chosen();
    return [FPModel.pathKey(S.preset, levers), FPActions.scale, c.ids.slice().sort().join('+'), c.recycleAccuracy].join('|');
  };
  S.mineRun = () => {
    const k = mineKey();
    if (!mineCache || k !== mineKeyCached) {
      mineCache = FPModel.mineRun(S.preset, levers, FPActions.chosen(), FPActions.scale);
      mineKeyCached = k;
    }
    return mineCache;
  };
  S.dropMine = () => { mineCache = null; mineKeyCached = ''; };
  S.runOf = (branch, year) => FPModel.shownRun(year,
    branch === 'mine' && typeof S.mineRun === 'function' ? S.mineRun() : FPModel.pathRun(S.preset, levers));
  // '현재까지는 하나의 역사'(마스터 D6): year ≤ NOW_YEAR 면 어느 갈래·경로든 기준 경로 실행(FPModel.shownRun)
  S.sample = () => FPModel.sample(S.year, S.runOf(S.branch, S.year));
  S.ppm = () => S.sample().ppm;
  // 그해 사회 모습(전기차 비율 등) — 조감과 같은 규칙(FPModel.society). 직접 설계면 레버 값. 현재까지는 기준 경로의 사회(D6)
  S.society = s => FPModel.shownSociety(s, S.preset, levers, choice === 'custom' ? designedCapture() : null);
  // 4차 E2: 해를 인자로 받는다 — 전환 덮개(0.4초) 동안 S.year 는 아직 떠나는 해라서. 현재까지는 하나의 역사(D6)
  S.label = (y = S.year) => (y <= EarthSystem.LAST_HIST_YEAR ? `${y}년 (실제 배출)`
    : y <= FPModel.NOW_YEAR ? `${y}년 (하나의 역사)` : `${S.shortName()} ${y}년`);
  // 사회의 선택 바꾸기 — 현재에서만(행동과 같은 '지금의 선택' 규칙, 학습지 [나의 행동] 잠금). 바뀌었으면 true.
  //   현재까지는 하나의 역사라 세계 모습은 그대로지만, 미래로 가면 이 경로가 보인다
  S.setChoice = id => {
    if (S.year !== FPModel.NOW_YEAR || id === choice || !valid(id)) return false;
    choice = id;
    levers = leversOf(id);
    S.dropMine();
    if (id !== 'aerial') WorksheetStore.updateFp(fp => { fp.actions.society = id; });
    if (typeof S.onChoice === 'function') S.onChoice(id);
    return true;
  };
  // 4차 T2: 회의실에서 설계를 확정하면 — 이미 '우리가 설계한 사회'를 골라 둔 상태면 setChoice 가 같은 id 라 아무것도 안 하므로
  //   저장된 새 레버를 다시 읽어 경로·나의 미래를 버린다. 아직 다른 선택이면 setChoice('custom')(현재에서만 — 회의실은 현재에서만 열린다)
  S.useDesign = () => {
    if (choice !== 'custom') return S.setChoice('custom');
    levers = leversOf('custom');
    S.dropMine();
    if (typeof S.onChoice === 'function') S.onChoice(choice);
    return true;
  };
  return S;
})();
// 4차 C5: 세계 상태는 applyWorldState(그해 엔진 표본, 그해 사회 모습) 하나로 바꾼다(첫 반영은 아래 applyScenarioYear).
// 도구·미니맵을 만들기 전에 한 번 넣어 둔다 — 그 전에 fpSample()을 읽는 곳이 2023년 대체값으로 떨어지지 않게.
FPWorld.sample = FPScenario.sample();
FPPlayer.init(camera, glCanvas);
FPTools.init(camera);   // 단축바 + 손에 든 도구 (camera를 씬에 넣는 것도 여기서 처리)
FPMinimap.init();
// 4차 C4: 바다(해수 pCO₂·산호·유빙)는 그해 엔진 표층 상태라 연도·경로가 바뀔 때만 갱신한다(applyScenarioYear).
// 예전 0.2초 틱(FPAir)·해수 평형 적분(stepSeaCO2)은 지웠다.

// 4차 D3: 학습지를 열면 3D 캔버스가 왼쪽 60 %로 줄어든다(CSS body.sheet-open). 그래서 창 크기가 아니라 캔버스 칸 크기를 따른다.
// setSize(…, false): 렌더러가 캔버스 style 폭·높이를 px 로 덮어쓰지 않게 — 덮어쓰면 CSS 의 60 %/100 % 가 듣지 않는다.
function fit() {
  const w = glCanvas.clientWidth || window.innerWidth, h = glCanvas.clientHeight || window.innerHeight;
  // 4차 M1: 무대 안에서는 무대 품질 단계의 픽셀 비(high ≤ 2 · mid 1.5 · low 1, fp-stage.js), 세계에서는 늘 ≤ 2
  renderer.setPixelRatio(typeof FPStage !== 'undefined' && FPStage.active() ? FPStage.pixelRatio() : Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  FPTools.resize(w / h);
  if (typeof FPStage !== 'undefined') FPStage.resize(w / h);   // 학습지를 열면 3D 칸이 60 % — 무대 카메라 화면비도 같이
}
// 칸 크기가 바뀌는 길이 둘(창 크기 변경 · 학습지 열고 닫기)이라 캔버스 자체를 지켜본다
if (typeof ResizeObserver !== 'undefined') new ResizeObserver(fit).observe(glCanvas);
else window.addEventListener('resize', fit);
fit();

// ── 연도·갈래 바꾸기 (4차 E1) ──
// 4차 B4(마스터 D5): 교사용 CO₂ 직접 입력(#co2Slider)을 뺐다. CO₂는 늘 배출 경로·연도의 결과다.
// 4차 D2: HUD 의 자동차·바다·산호 줄(hudCars·hudSea·hudCoral)을 뺐다 — HUD 는 아래 'HUD' 절.
// 4차 E1: 학습지 [과제]의 배출 경로 목록·연도 슬라이더·전 지구 CO₂ 글(#fpScenario·#fpYear·#fpGlobalCo2)을 지우고
// 화면 위 타임라인(firstperson/fp-timeline.js)으로 옮겼다. 경로 선택은 F3 '사회의 선택'으로 간다 — E 에서는 주소의
// ?scenario= 가 없으면 현재 정책 고정. 전 지구 CO₂ 숫자는 화면에 띄우지 않는다(HUD 와 같은 까닭 — 재야 할 값을 늘 보여 주면 잴 이유가 없다).
// 연도 배지 글(HUD·타임라인이 같이 쓴다 — 첫 반영 applyScenarioYear 가 읽으므로 그보다 앞에 둔다). 기본은 과거 / 현재 / 기준 미래(고른 경로) — '현재' = FPModel.NOW_YEAR(마스터 D6).
// E(타임라인)·F(나의 미래)·T(우리 사회의 미래)가 이 함수를 바꿔 끼워 '나의 미래' 같은 이름을 채운다.
FPScenario.badge = () => {
  const y = FPScenario.year, now = FPModel.NOW_YEAR;
  if (y < now) return { text: `${y}년 · 과거`, era: 'past' };
  if (y === now) return { text: `${y}년 · 현재`, era: 'now' };
  if (FPScenario.branch === 'mine') return { text: `${y}년 · 나의 미래 (${FPScenario.shortName()})`, era: 'future' };
  return { text: `${y}년 · 기준 미래 (${FPScenario.shortName()})`, era: 'future' };
};
// 타임라인 오른쪽 글: 시대(과거·현재·미래)와 갈래 이름. 과거 = 2023년까지 실제 배출, 2024~현재 = 기준 경로 하나의 역사(D6),
// 그 뒤 = 고른 경로(조감과 같은 약속). 4차 E2: 전환 중에는 '가는 해'를 먼저 보여 주므로 연도·갈래를 인자로 받는다
const ERA_TEXT = { past: '과거', now: '현재', future: '미래' };
const eraOf = y => (y < FPModel.NOW_YEAR ? 'past' : y === FPModel.NOW_YEAR ? 'now' : 'future');
FPScenario.timelineInfo = (y = FPScenario.year, br = FPScenario.branch) => {
  const era = eraOf(y);
  const branchName = y <= EarthSystem.LAST_HIST_YEAR ? '실제 배출'
    : y <= FPModel.NOW_YEAR ? '하나의 역사 (현재 정책)'
    : (br === 'mine' ? `나의 미래 · ${FPScenario.shortName()} − 나의 행동` : `기준 미래 · ${FPScenario.shortName()}`);
  return { era, eraText: ERA_TEXT[era], branchName };
};
// 4차 E3: 측정 기록 한 줄에 붙이는 연도·갈래·경로 (fp-field.js record). 갈래는 학생 말로 넷 — 과거 / 현재 / 기준 미래 / 나의 미래.
// path = 그 값이 나온 경로 실행의 키: 현재까지는 하나의 역사라 늘 기준 경로(FPModel.BASE_PRESET, D6), 그 뒤는 고른 경로(나의 미래면 'mine').
// F3 의 '사회의 선택'이 경로를 바꾸면 같은 해·같은 갈래라도 path 가 달라 평균이 섞이지 않는다(fp-field summary 묶음 키).
// 4차 F3: path = 사회의 선택 id(ssp245 · ssp126 · ssp119 · ndc · custom · aerial). 나의 미래는 'mine:선택:규모:행동' —
//   행동·참여 규모를 바꾼 뒤 잰 값이 앞의 평균과 섞이지 않게(과제 ⑨ '기준 vs 나의 미래 평균 비교')
const BRANCH_KO = { past: '과거', now: '현재', base: '기준 미래', mine: '나의 미래' };
FPScenario.recordTag = () => {
  const y = FPScenario.year, era = eraOf(y);
  const branch = era === 'future' ? FPScenario.branch : era;
  const c = branch === 'mine' ? FPActions.chosen() : null;
  // 4차 F4: '우리 도시'가 도심 공기를 바꾸는 동안(현재·나의 미래)의 기록은 ':city42'(감소 %)를 붙여 참여 전 기록과 따로 센다(과제 ⑩ 전·후 비교)
  const lc = FPActions.localCutFor(y, branch), city = lc > 0 ? `:city${Math.round(lc * 100)}` : '';
  const path = (era !== 'future' ? FPModel.BASE_PRESET
    : (branch === 'mine' ? `mine:${FPScenario.choice}:${FPActions.scale}:${c.ids.slice().sort().join('+')}` : FPScenario.choice)) + city;
  return { year: y, branch, branchKo: BRANCH_KO[branch], path };
};
// 전환 덮개 가운데 글: '2100년 · 기준 미래'
const branchLabel = (y, br) => (y > FPModel.NOW_YEAR ? (br === 'mine' ? '나의 미래' : '기준 미래') : ERA_TEXT[eraOf(y)]);
function applyScenarioYear() {
  const s = FPScenario.sample();
  applyWorldState(s, FPScenario.society(s));   // 도시·차·굴뚝·산호·유빙 (C5) — 하늘·파도는 연도와 무관
  FPTimeline.show(FPScenario.year, FPScenario.branch, FPScenario.timelineInfo());
  FPActions.onYear(FPScenario.year);   // 4차 F2: 현재가 아니면 행동 카드 잠금·지점 표지판 흐림
  FPStage.onYear(FPScenario.year, FPWorld.city);   // 4차 M2: 카페 정면은 2000년 도시 규모부터, 들어가기는 현재만
}

// ── 연도 → 세계 상태 한 통로 (4차 E2) ───────────────────────────────────────
// 연도·갈래가 바뀌는 길은 goTo 하나다(타임라인 정거장·슬라이더·[ · ] 키·갈래 버튼·현장 과제 [O년으로 가기]).
//   ① 측정 중이던 계측기는 취소(다른 해의 값이 섞이지 않게 — FPTools.cancelReadings)
//   ② 0.4초 덮개(가운데 '2100년 · 기준 미래'): 덮개가 다 덮인 0.2초 시점에 세계를 바꾸고 걷어 낸다 — 건물·차가 튀어나오는 모습을 가린다.
//      덮개가 떠 있는 동안 측정 클릭은 무시(FPScenario.inTransition, fp-tools.js use).
//      움직임 줄이기(prefers-reduced-motion)면 덮개 없이 바로.
//   ③ 슬라이더를 끄는 동안(opt.instant)은 덮개 없이 바로 — 한 해마다 화면이 깜빡이면 끌 수가 없다.
//   전환 중에 다시 부르면 목표만 바꾼다(타임라인은 곧바로 가는 해를 보여 주므로 [ · ] 를 연달아 눌러도 한 칸씩 간다).
const timeFade = document.getElementById('timeFade');
const timeFadeText = document.getElementById('timeFadeText');
const FADE_HALF_MS = 200;
const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
FPScenario.inTransition = false;
// phase: null(덮개 없음) · 'in'(덮는 중 — 끝에서 fadeTarget 으로 바꾼다) · 'out'(걷는 중 — 이미 바꿨다)
let fadeTarget = null, fadeTimer = 0, phase = null;
function commitYear(y, br) {
  FPScenario.year = y;
  FPScenario.branch = br;
  applyScenarioYear();
}
function goTo(year, branch, opt = {}) {
  const y = Math.max(FPModel.YEAR_MIN, Math.min(FPModel.YEAR_MAX, Math.round(Number(year))));
  if (!Number.isFinite(y)) return;
  const br = branch === 'mine' && FPTimeline.mineEnabled ? 'mine' : 'base';
  const cur = fadeTarget || { y: FPScenario.year, br: FPScenario.branch };
  if (y === cur.y && br === cur.br) return;   // 같은 해·같은 갈래면 세계를 다시 만들지 않는다
  if (FPTools.cancelReadings()) FPField.toast('연도가 바뀌어 측정을 취소했습니다 — 이 해에서 다시 재세요', 2200);
  if (opt.instant || reducedMotion() || !timeFade) {
    if (fadeTarget) fadeTarget = { y, br };   // 덮개가 떠 있으면 그 덮개가 이 해로 바꾸고 걷는다
    else commitYear(y, br);
    return;
  }
  fadeTarget = { y, br };
  FPTimeline.show(y, br, FPScenario.timelineInfo(y, br));
  timeFadeText.textContent = `${y}년 · ${branchLabel(y, br)}`;
  if (phase === 'in') return;                 // 이미 덮는 중 — 아래 타이머가 마지막 목표로 바꾼다
  // 덮개 없음 또는 걷는 중이면 새로 덮는다(걷는 중이던 타이머는 버린다)
  phase = 'in';
  FPScenario.inTransition = true;
  timeFade.classList.add('on');
  clearTimeout(fadeTimer);
  fadeTimer = setTimeout(() => {
    const t = fadeTarget;
    fadeTarget = null;
    commitYear(t.y, t.br);
    phase = 'out';
    timeFade.classList.remove('on');
    fadeTimer = setTimeout(() => { phase = null; FPScenario.inTransition = false; }, FADE_HALF_MS);
  }, FADE_HALF_MS);
}
FPScenario.goTo = goTo;
// 야장 현장 과제(fp-field.js)가 '이 연도로 가기'로 부른다
FPScenario.goYear = y => goTo(y, FPScenario.branch);
FPTimeline.init({ onGo: goTo });   // 첫 반영(applyScenarioYear) 앞 — show() 가 막대 요소를 찾아 둔 뒤라야 그린다
applyScenarioYear();

// ── 야장 ────────────────────────────────────────────────────────────────────
FPField.init();
FPSheet.init();   // 4차 D3: 오른쪽 학습지 패널(열고 닫기·탭). 내용은 위 FPField 가 이미 그려 두었다
FPActions.init(); // 4차 F2: 학습지 [나의 행동] 카드(저장값 읽기 → 그리기). Icons.fill 앞이라 카드 속 아이콘도 채워진다
// 4차 F3: 행동·참여 규모가 바뀌면 '나의 미래' 실행을 버리고, 행동이 하나라도 있을 때만 갈래 [나의 미래]를 연다.
//   행동은 현재에서만 바뀌므로(잠금) 미래에서 갈래가 갑자기 바뀌는 일은 없다 — 그래도 나의 미래에 있으면 세계를 다시 맞춘다
function syncMine() {
  FPScenario.dropMine();
  FPTimeline.setMineEnabled(FPActions.chosen().ids.length > 0);
  if (FPScenario.branch === 'mine') applyScenarioYear();
}
FPActions.onChange(syncMine);
FPScenario.onChoice = () => { FPActions.render(); applyScenarioYear(); };   // 사회의 선택 → 카드 다시 그리기·타임라인 글
syncMine();
// 4차 M1: 무대(미니게임) 관리자 — 렌더러는 하나라 세계의 renderer·장면을 넘긴다(들어갈 때 값 저장 → 나올 때 복원, 마스터 §6-14)
FPStage.init({ renderer, camera, scene: FPWorld.scene, canvas: glCanvas, fit });
// 4차 M4: 학습지 [나의 행동]의 [카페에서 해 보기]·[분리배출장에서 해 보기] → 미니맵에 그 장소 + 내 위치에서 화살표(순간이동 없음)
FPActions.minigameHook = id => {
  const stage = { tumbler: 'cafe', recycle: 'recycle' }[id];
  if (!stage) return;
  FPMinimap.setTarget(stage);
  const q = FPStage.places().find(p => p.stage === stage), name = q ? q.title : stage;
  const now = FPScenario.year === FPModel.NOW_YEAR;
  FPField.toast(now ? `미니맵에 ${name} 위치를 표시했어요 — 화살표를 따라가 보세요 (F 로 학습지 닫기)`
    : `미니맵에 ${name} 위치를 표시했어요 — 들어가려면 현재(${FPModel.NOW_YEAR})로 가야 해요`, 3600);
};
// 4차 T2: 학습지 [나의 행동]의 [회의실로 가기] → 미니맵에 시청 표시 + 화살표(순간이동 없음, 미니게임과 같은 규칙)
FPActions.councilHook = () => {
  FPMinimap.setTarget('council');
  const now = FPScenario.year === FPModel.NOW_YEAR;
  FPField.toast(now ? '미니맵에 시청(기후 정책 회의실) 위치를 표시했어요 — 화살표를 따라가 보세요 (F 로 학습지 닫기)'
    : `미니맵에 시청 위치를 표시했어요 — 들어가려면 현재(${FPModel.NOW_YEAR})로 가야 해요`, 3600);
};
FPOnboard.init(); // 4차 D4: 첫 진입 안내 3장(본 적 없으면 바로 띄운다). Icons.fill 앞이라 안내 속 아이콘도 채워진다
// 4차 D1: 정적 마크업의 <span data-icon=…> 을 조감과 같은 SVG 아이콘으로 채운다(이모지는 기기마다 모양이 달라서 안 씀)
Icons.fill();
// 계측기가 값을 '확정'했을 때만 기록한다 (수렴 중인 값은 아직 못 믿는 값이라서)
FPTools.onMeasured = (tool, value, reading) => FPField.record(tool, value, reading);

// ── HUD (4차 D2) ────────────────────────────────────────────────────────────
// 왼쪽 위 한 덩어리: 지금 구역 · 연도 배지 · 든 도구. 측정값(CO₂·바다 6값·산호)과 좌표·자동차 수는 뺐다 —
// HUD 가 재야 할 값을 늘 보여 주면 측정할 이유가 사라진다(D §2). 측정값은 도구 표시창과 기록 알림에만.
const hudZone = document.getElementById('hudZone');
const hudZoneSub = document.getElementById('hudZoneSub');
const hudYear = document.getElementById('hudYear');
const hudTool = document.getElementById('hudTool');
const waterOverlay = document.getElementById('waterOverlay');
// 서 있는 구역 (fp-player.js currentZone 과 같은 경계). 학생 말로는 바다·녹지·도시 세 구역이다
const zoneKeyAt = () => (FPPlayer.underwater || FPPlayer.pos.x < -FPWorld.ZONE_W / 2 ? 'ocean' : FPPlayer.pos.x > FPWorld.ZONE_W / 2 ? 'city' : 'green');
const ZONE_NAME = { ocean: '바다', green: '녹지', city: '도시' };
// 글이 바뀔 때만 DOM 을 건드린다 (초당 8번 같은 글을 다시 쓰면 레이아웃만 다시 계산된다)
const setText = (el, v) => { if (el.textContent !== v) el.textContent = v; };
let hudTimer = 0;

// ── 프레임 루프 ─────────────────────────────────────────────────────────────
let t = 0, last = performance.now();
const _wn = [0, 0, 0];   // 파도 법선 임시 버퍼 (프레임마다 새로 할당하지 않으려고 밖에 둠)
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 0.1);
  last = now;
  t += dt;
  // 4차 M1: 무대에 들어가 있으면 세계 갱신·렌더를 멈추고 무대만 그린다(M §1-1 — 세계 쪽 성능 예산을 무대가 통째로 쓴다)
  if (FPStage.active()) { FPStage.frame(dt); return; }

  FPPlayer.update(dt, t);
  FPTools.update(dt);          // 측정 중인 계측기의 값이 안정되어 가는 과정
  FPActions.update(dt);        // 4차 F2: 행동 지점을 겨눴는지(초당 10번) → 'E 플러그 뽑기' 안내
  FPStage.updateDoors(dt, camera);   // 4차 M2: 무대 입구(카페 문)를 겨눴는지 → 'E 카페에 들어가기'
  FPMinimap.update(dt);        // 초당 10회만 다시 그린다
  updateSunShadow(FPPlayer.pos.x, FPPlayer.pos.z);

  // 수면 파도: 잔물결까지 형상으로 만들고 매 프레임 법선을 다시 계산해야
  // 환경맵 반사가 물결 기울기를 따라 잘게 반짝인다 (반사가 보이는 핵심)
  // 4차 C5: 파도 세기는 CO₂와 무관(예전 co2k 항 삭제)
  const pa = FPWorld.wavePosAttr, base = FPWorld.waveBase;
  const na = FPWorld.waveGeo.attributes.normal;
  // setZ()/setXYZ()는 정점 7천 개 × 매 프레임이면 호출 오버헤드만으로도 무시 못 할 비용이라
  // 타입드 배열에 직접 쓴다 (needsUpdate만 세워주면 결과는 동일)
  const parr = pa.array, narr = na.array;
  for (let i = 0, p = 0; i < pa.count; i++, p += 3) {
    const lx = base[p], ly = base[p + 1];
    parr[p + 2] = FPWorld.waveHeightAt(lx, ly, t);
    FPWorld.waveNormalAt(lx, ly, t, _wn);
    narr[p] = _wn[0]; narr[p + 1] = _wn[1]; narr[p + 2] = _wn[2];
  }
  pa.needsUpdate = true;
  na.needsUpdate = true;
  // 물 옆면의 윗변도 같은 파도식으로 맞춰 올려 수면과 정확히 맞물리게 한다
  updateWaterWalls(t);
  // 미세 법선맵을 서로 다른 속도로 흘려서 정지된 무늬처럼 보이지 않게
  FPWorld.waterNormal.offset.x = (t * 0.02) % 1;
  FPWorld.waterNormal.offset.y = (t * 0.013) % 1;

  updateClouds(dt);
  updateCars(dt, FPPlayer);    // 도로 주행 + 앞차 추종 + 교차로 양보 + 사람 앞에서 정지
  updateAnimals(dt, t);
  updateOceanLife(dt, t);
  updateExhaust(dt);

  // 공장 연기 (양·속도는 그해 화석 배출에 따라 applyWorldState 가 정한 rate를 따름)
  const sm = FPWorld.smoke;
  const sp = sm.geo.attributes.position;
  for (let i = 0; i < sm.count; i++) {
    sm.life[i] += dt * (sm.rate + (i % 7) * 0.012);
    if (sm.life[i] > 1) sm.life[i] = 0;
    const life = sm.life[i];
    sp.setXYZ(i,
      sm.x + Math.sin(i * 12.9 + t * 0.3) * 0.06 * life,
      FPWorld.GROUND_BASE + 0.35 + life * 0.75,
      sm.z + Math.cos(i * 7.3 + t * 0.2) * 0.06 * life);
  }
  sp.needsUpdate = true;
  FPWorld.towerFan.rotation.z = t * FPWorld.tower.speed;
  FPTechWorld.update(dt);     // 해상풍력 날개 회전(4차 T3)

  // 수중 화면 효과
  waterOverlay.classList.toggle('on', FPPlayer.underwater);

  // HUD는 초당 몇 번만 갱신 (매 프레임 DOM을 건드릴 이유가 없음)
  hudTimer += dt;
  if (hudTimer > 0.12) {
    hudTimer = 0;
    setText(hudZone, ZONE_NAME[zoneKeyAt()]);
    setText(hudZoneSub, FPPlayer.underwater ? '수중' : (FPPlayer.inWater ? '헤엄치는 중' : ''));
    const b = FPScenario.badge();
    setText(hudYear, b.text);
    if (hudYear.dataset.era !== b.era) hudYear.dataset.era = b.era;
    const sel = FPTools.selected;
    setText(hudTool, sel >= 0 && HOTBAR_LABELS[sel] ? HOTBAR_LABELS[sel] : '없음');
  }

  renderer.render(FPWorld.scene, camera);
  FPTools.render(renderer);   // 손·도구는 깊이 버퍼를 비우고 맨 위에 덧그림
}
animate();
// 4차 M1: 주소 ?stage=cafe&shot=wide 면 무대·카메라 자세로 바로(사진 자세 — 덮개·첫 안내 없이). 화면 준비가 다 끝난 뒤라 맨 끝
FPStage.boot();
