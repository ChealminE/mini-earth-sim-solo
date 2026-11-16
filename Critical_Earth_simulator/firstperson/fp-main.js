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

// ── 배출 경로 + 연도 → 전 지구 CO₂ (3차 E4) ─────────────────────────────────
// 예전에는 CO₂ 슬라이더로 농도를 직접 넣었다. 조감 모드에서는 CO₂가 배출을 쌓은 '결과'라(3차 마스터 결정 9)
// 두 화면이 같은 값을 쓰도록 조감 미래 예측과 같은 엔진(js/earth-system.js)으로 그 해의 전 지구 CO₂를 계산해 applyWorldCO2 에 넣는다.
// 시작 값은 주소에서: /firstperson/?scenario=ssp245&year=2100 (단일 HTML 파일에서는 껍데기가 window.__FP_QUERY__ 로 넘긴다).
// 도시 열섬·나무 밑 CO₂ 같은 공간 차이 계산은 그대로 — HUD에 '전 지구'와 '이 지점'을 나눠 적는다.
const FPScenario = (() => {
  const q = new URLSearchParams(window.__FP_QUERY__ || location.search);
  const PRESETS = { ssp245: '현재 정책', ssp126: '파리협약 2 °C', ssp119: '1.5 °C 탄소중립', custom: '직접 설계' };
  let levers = null;
  try { levers = q.get('levers') ? JSON.parse(q.get('levers')) : null; } catch (e) { levers = null; }
  const S = {
    preset: PRESETS[q.get('scenario')] && (q.get('scenario') !== 'custom' || levers) ? q.get('scenario') : 'ssp245',
    // 4차 E1: 기본 연도 = '현재'(FPModel.NOW_YEAR, 마스터 D6). 예전 기본 2023(LAST_HIST_YEAR)은 '마지막 실제 배출 해'라 현재와 다르다
    year: Math.max(FPModel.YEAR_MIN, Math.min(FPModel.YEAR_MAX, Math.round(Number(q.get('year')) || FPModel.NOW_YEAR))),
    // 갈래: 'base' = 기준 미래(고른 경로), 'mine' = 나의 미래(F3 가 연다). E1 에서는 base 만 켜진다(fp-timeline.js)
    branch: 'base',
    PRESETS,
  };
  // 4차 C1: 엔진 궤적·그해 표본은 FPModel(fp-model.js)에서만 낸다 — 조감과 같은 해 같은 값을 node(test_fp_model)로 검사하려고.
  // 경로별 캐시도 FPModel 이 갖는다.
  // 4차 E2: 갈래 → 경로 실행. 기준 미래 = 고른 경로(E 에서는 주소 ?scenario=, 없으면 현재 정책).
  // 나의 미래 = F3 가 S.mineRun(행동 조합의 실행을 돌려주는 함수)을 채운다 — 실행 캐시(행동을 바꿀 때만 버림)도 F3 쪽이 갖는다.
  // 경로마다 EarthSystem.run 한 번(1750~2200, 약 10 ms)은 FPModel.pathRun 캐시가 맡는다.
  S.mineRun = null;
  S.runOf = (branch, year) => FPModel.shownRun(year,
    branch === 'mine' && typeof S.mineRun === 'function' ? S.mineRun() : FPModel.pathRun(S.preset, levers));
  // '현재까지는 하나의 역사'(마스터 D6): year ≤ NOW_YEAR 면 어느 갈래·경로든 기준 경로 실행(FPModel.shownRun)
  S.sample = () => FPModel.sample(S.year, S.runOf(S.branch, S.year));
  S.ppm = () => S.sample().ppm;
  // 그해 사회 모습(전기차 비율 등) — 조감과 같은 규칙(FPModel.society). 직접 설계면 레버 값. 현재까지는 기준 경로의 사회(D6)
  S.society = s => FPModel.shownSociety(s, S.preset, levers);
  // 4차 E2: 해를 인자로 받는다 — 전환 덮개(0.4초) 동안 S.year 는 아직 떠나는 해라서. 현재까지는 하나의 역사(D6)
  S.label = (y = S.year) => (y <= EarthSystem.LAST_HIST_YEAR ? `${y}년 (실제 배출)`
    : y <= FPModel.NOW_YEAR ? `${y}년 (하나의 역사)` : `${PRESETS[S.preset]} ${y}년`);
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  FPTools.resize(w / h);
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
  if (FPScenario.branch === 'mine') return { text: `${y}년 · 나의 미래`, era: 'future' };
  return { text: `${y}년 · 기준 미래 (${FPScenario.PRESETS[FPScenario.preset]})`, era: 'future' };
};
// 타임라인 오른쪽 글: 시대(과거·현재·미래)와 갈래 이름. 과거 = 2023년까지 실제 배출, 2024~현재 = 기준 경로 하나의 역사(D6),
// 그 뒤 = 고른 경로(조감과 같은 약속). 4차 E2: 전환 중에는 '가는 해'를 먼저 보여 주므로 연도·갈래를 인자로 받는다
const ERA_TEXT = { past: '과거', now: '현재', future: '미래' };
const eraOf = y => (y < FPModel.NOW_YEAR ? 'past' : y === FPModel.NOW_YEAR ? 'now' : 'future');
FPScenario.timelineInfo = (y = FPScenario.year, br = FPScenario.branch) => {
  const era = eraOf(y);
  const branchName = y <= EarthSystem.LAST_HIST_YEAR ? '실제 배출'
    : y <= FPModel.NOW_YEAR ? '하나의 역사 (현재 정책)'
    : (br === 'mine' ? '나의 미래' : `기준 미래 · ${FPScenario.PRESETS[FPScenario.preset]}`);
  return { era, eraText: ERA_TEXT[era], branchName };
};
// 전환 덮개 가운데 글: '2100년 · 기준 미래'
const branchLabel = (y, br) => (y > FPModel.NOW_YEAR ? (br === 'mine' ? '나의 미래' : '기준 미래') : ERA_TEXT[eraOf(y)]);
function applyScenarioYear() {
  const s = FPScenario.sample();
  applyWorldState(s, FPScenario.society(s));   // 도시·차·굴뚝·산호·유빙 (C5) — 하늘·파도는 연도와 무관
  FPTimeline.show(FPScenario.year, FPScenario.branch, FPScenario.timelineInfo());
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

  FPPlayer.update(dt, t);
  FPTools.update(dt);          // 측정 중인 계측기의 값이 안정되어 가는 과정
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
