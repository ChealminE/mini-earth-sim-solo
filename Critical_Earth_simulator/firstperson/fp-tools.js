// ============================================================================
// 1인칭 모드 - 단축바(핫바) / 손에 든 도구 / 실측 도구
// ----------------------------------------------------------------------------
// 단축바 4칸(숫자키 1~4)으로 도구를 고르면 화면 우하단에 오른손이 나타나고
// 그 손이 도구를 들고 있다. 좌클릭하면 화면 중앙(크로스헤어)이 가리키는 지점을 측정해서
// 도구의 표시창(캔버스 텍스처)에 수치를 띄운다.
//
// 도구가 카메라를 따라다니게 하려고 camera에 직접 붙인다(camera.add). 단, three.js는
// 씬 그래프를 따라 렌더링하므로 카메라 자체를 씬에 넣어줘야 카메라의 자식이 그려진다.
// ============================================================================

// 4차 B4: 9칸 → 4칸(온도계·pH미터·CO₂센서·해수분석기). 빈 칸 5개는 쓰는 도구가 없었다.
// F(행동)에서 칸이 더 필요하면 이 수와 아래 HOTBAR_LABELS·HOTBAR_ICONS 를 같이 늘린다.
const HOTBAR_N = 4;
const FPTools = {
  slots: new Array(HOTBAR_N).fill(null),
  selected: -1,     // -1 = 맨손
  handGroup: null,
  camera: null,
  _rc: new THREE.Raycaster(),
};

// ── 측정 지점 종류 ──────────────────────────────────────────────────────────
// 온도계는 어디를 겨눠도 값이 나와야 하므로, 크로스헤어가 닿은 것을 5가지로 나눈다.
// 4차 C2(마스터 D9): 지면 3종(해변 모래·녹지 지면·도시 지면)을 뺐다 — 연평균 기준 문헌값이 없다.
//   땅을 겨눠도 그 구역의 '대기'를 잰다. 하늘·허공을 겨눠도 그 구역 대기다.
// 값은 전부 '그해 연평균(하루 평균)'이고 fp-model.js(FPModel)에서만 낸다(마스터 D2). 화면이 낮이어도 일교차·계절 항은 없다.
//   대기  : airTemp(구역) = AIR_T0 + 증폭 × 엔진 T (+ 도심 열섬)   — 증폭은 AR6 육지 1.46 · 해양 0.81
//   해수  : seaTemp(냉수대 근접도) = 엔진 o.sst (개방 해역) … 유빙 옆 −12 °C
//   빙하  : iceSurfaceTemp = min(0, −6 + 0.81 T)                  — 융해 잠열로 0 °C 상한
// 예전 표(base·amp·day: 여름 정오 기준값 + 근거 없는 증폭 1.30/1.00/0.75 + 일교차)는 지웠다.
const SPOT = {
  sea:      { label: '해수' },
  ice:      { label: '빙하' },
  airOcean: { label: '해양 대기', zone: 'ocean' },
  airGreen: { label: '녹지 대기', zone: 'green' },
  airCity:  { label: '도심 대기', zone: 'city' },
};
// 구역 → 대기 지점 이름 (땅·허공을 겨눴을 때)
const AIR_SPOT = { ocean: 'airOcean', green: 'airGreen', city: 'airCity' };

// 4차 B4(마스터 D8): 동물·어류 체온 측정을 뺐다. 동물·어류는 풍경으로 남고, 광선은 그들을 지나쳐
// 뒤의 땅·물·대기를 잰다(측정 대상 목록에서 뺐다).
const AIR_SAMPLE_DIST = 0.3;   // 허공을 겨눴을 때 대기를 뜨는 거리 (실척 15m)

// s = 지금 연도·경로의 엔진 표본(fp-world.js fpSample). 4차 C2에서 ppm 인자 대신 받는다 —
// 기온은 그해 엔진 상태(T·sst)가 정하지 그 자리 CO₂ 농도가 정하지 않는다.
function measureTemperature(spot, x, z, s) {
  // 해수는 fp-world.js의 seaTempAt() 하나만 쓴다. 해수 분석기·pH미터·산호가 읽는 수온과
  // 반드시 같아야 하므로 여기서는 지점 흔들림을 얹지 않는다(지점 간 차이는 냉수대가 만든다).
  if (spot === 'sea') return seaTempAt(x, z);
  // 같은 구역 안에서도 지점마다 조금씩 다르게 (측정하는 맛, ±0.3 °C — 등록부 fp_jitter, 연출)
  const jitter = FPModel.tempJitter(x, z);
  if (spot === 'ice') return Math.min(FPModel.K.ICE_CAP, FPModel.iceSurfaceTemp(s) + jitter);
  return FPModel.airTemp(SPOT[spot].zone, s) + jitter;
}

// 해양 pH: 예전엔 슬라이더 CO2 하나만 넣어서 바다 어디서 재도 같은 값이었다.
// 이제 그 지점의 해수 상태(seaStateAt: 수온 + 그해 엔진 해수 pCO2 — 4차 C4)에서 읽는다.
// 산호·해수 분석기와 같은 함수라 측정값과 세계 상태가 어긋나지 않는다.
// TA 일정 모형에서는 수온이 pH를 거의 못 움직인다(냉수대와 개방 해역 차이 ≈ 0.02).
// 온도 효과의 주 신호는 용존 CO2와 Ω이고, 그건 4번 해수 분석기가 맡는다.
function measurePH(x, z) {
  return seaStateAt(x, z).pH;
}
// 바다를 겨눴는가. pH미터·해수 분석기 공통 - 해양 구역이면서 수면 아래인 지점만 유효.
function isSeaHit(hit) {
  const waterY = FPPlayer.waterHeightAt(hit.point.x, hit.point.z, performance.now() / 1000);
  return hit.zone === 'ocean' && (hit.isWater || hit.point.y <= waterY + 0.002);
}

// ── 대기 CO2 ────────────────────────────────────────────────────────────────
// 4차 C3: 구역 대기 CO₂는 FPModel.zoneCO2(fp-model.js)가 그해 엔진 표본으로 바로 낸다(연평균).
//  - 해양 대기 = 배경(o.ppm) 그대로 — NOAA 지구 평균이 바다 위 관측소 평균이다(문헌값 2-4). 예전 −15~−30 ppm 삭제.
//  - 도심 = 배경 + 서울 '도시 증가분' 23 ppm × 그해 화석 배출 ÷ 2020년 (문헌값 2-3). 예전 +55~+120 ppm 삭제.
//  - 녹지·나무 밑 = 3차 낮 정상 상태값 그대로(정량 문헌 미확보 — assumption + unverified).
// 예전 구역 몫 D_z 를 τ 30초로 따라가던 적분(CO2_ZONE·zoneCO2Target·AIR_TAU_Z)은 C3에서 지웠다 — 연도를 뛰어넘는 구조와 맞지 않는다.
// 4차 C4: 남아 있던 0.2초 틱(FPAir — 해수 pCO2 동적 평형·산호 갱신용)과 게임일 환산(AIR_DAY_S)도 지웠다.
// 바다가 그해 엔진 표층 상태가 되어 시간에 따라 적분할 상태가 1인칭에 하나도 남지 않았다.

// 어떤 지점이 나무 수관에 얼마나 가까운지 (0=밖, 1=줄기 바로 옆)
function treeShadeAt(x, z) {
  let s = 0;
  for (const t of FPWorld.trees) s = Math.max(s, 1 - Math.hypot(x - t.x, z - t.z) / t.r);
  return Math.max(0, s);
}
// 센서 한 번의 참값 [ppm]. 값 계산은 FPModel.zoneCO2, 여기서는 세계 좌표로 '얼마나 가까운가'만 잰다.
// s = 그해 엔진 표본(fpSample). (x, z) = 겨눈 지점, (px, pz) = 서 있는 자리.
function measureCO2(s, x, z, zone, px, pz) {
  const opt = {};
  // 나무 그늘 아래는 낮에 특히 낮다(잎이 바로 위에서 CO2를 빨아들이는 자리).
  // 겨눈 지점과 '서 있는 자리' 중 나무에 가까운 쪽을 쓴다. 손에 든 센서가 실제로
  // 빨아들이는 건 내 주변 공기라, 나무 밑에 서 있으면 어디를 겨누든 낮게 나와야 한다.
  // (이걸 겨눈 지점만으로 계산했더니 나무 밑에서 비스듬히 내려다보는 순간 표본이
  //  수관 밖으로 빠져나가 효과가 사라졌다.)
  if (zone === 'green') opt.treeShade = Math.max(treeShadeAt(x, z), px == null ? 0 : treeShadeAt(px, pz));
  // 국소 배출원: 공장 굴뚝과 내연기관차 배기구 바로 옆은 확 치솟는다
  const sx = FPWorld.ZONE_W + 0.6, sz = 0.55;             // 공장 굴뚝 월드 좌표
  opt.stackNear = Math.max(0, 1 - Math.hypot(x - sx, z - sz) / 0.55);
  let ex = 0;
  for (const c of FPWorld.cars) {
    if (!c.isGas) continue;   // 전기차는 배기구가 없다
    ex += Math.max(0, 1 - Math.hypot(x - c.tailPos.x, z - c.tailPos.z) / 0.10);
  }
  opt.exhaustNear = ex;
  // 4차 F4: '우리 도시'가 함께 걷기·자전거·대중교통을 하면 도심의 도시 증가분이 준다(현재 바로, 미래는 나의 미래 갈래에서만 — fp-actions localCutFor)
  if (zone === 'city' && typeof FPActions !== 'undefined' && typeof FPScenario !== 'undefined') opt.localCut = FPActions.localCutFor(FPScenario.year, FPScenario.branch);
  return FPModel.zoneCO2(zone, s, opt);
}

// 크로스헤어가 가리키는 지점이 무엇인지 판정.
// 아무것도 안 맞으면(하늘) 광선을 far까지 늘린 지점의 '대기'를 대상으로 삼는다.
// 그래야 해안에 서서 바다 쪽 하늘을 겨누면 '해양 대기'가 나온다.
function pickTarget() {
  const cam = FPTools.camera;
  // 측정은 렌더 사이(마우스 이벤트)에서 호출되므로 카메라 행렬이 직전 프레임 것일 수 있다.
  // setFromCamera는 matrixWorld를 그대로 쓰기 때문에 여기서 한 번 갱신해줘야 조준이 정확해진다.
  cam.updateMatrixWorld();
  const rc = FPTools._rc;
  rc.setFromCamera({ x: 0, y: 0 }, cam);
  rc.far = 1.4;   // 실척 약 70m까지 닿음
  // 대상은 지형·수면·유빙뿐이다(전부 단일 메시). 동물·어류는 B4에서 측정 대상이 아니게 됐다.
  const targets = FPWorld.walkables.concat([FPWorld.waterMesh], FPWorld.iceMeshes);
  const hits = rc.intersectObjects(targets, false);
  const half = FPWorld.ZONE_W / 2;

  if (!hits.length) {
    // 허공 - 겨눈 방향의 '가까운' 대기를 잰다.
    // far(70m)까지 끌고 가면 안 된다. 나무나 건물은 이 광선의 대상이 아니어서 그냥
    // 통과해버리는데, 그러면 눈앞 15m의 나무를 겨눴는데 70m 뒤 엉뚱한 구역의 공기를
    // 재는 일이 생긴다(실제로 그랬다). 손에 든 센서가 빨아들이는 건 어차피 코앞 공기다.
    const p = rc.ray.at(AIR_SAMPLE_DIST, new THREE.Vector3());
    // 맵 밖으로는 안 나가게 (밖은 정의된 구역이 없다)
    const hw = FPWorld.BOX_W / 2 - 0.02, hd = FPWorld.BOX_D / 2 - 0.02;
    p.x = Math.max(-hw, Math.min(hw, p.x));
    p.z = Math.max(-hd, Math.min(hd, p.z));
    const zone = p.x < -half ? 'ocean' : (p.x > half ? 'city' : 'green');
    // 4차 C2: 지면 온도를 뺐으므로 '지면 바로 위 공기는 지면 쪽으로 끌린다'는 보정(aboveGround)도 없다.
    return {
      point: p, zone, isWater: false, isAir: true, dist: AIR_SAMPLE_DIST,
      spot: AIR_SPOT[zone],
    };
  }

  const h = hits[0], p = h.point;
  const isWater = h.object === FPWorld.waterMesh;
  const zone = p.x < -half ? 'ocean' : (p.x > half ? 'city' : 'green');

  let spot;
  if (FPWorld.iceMeshes.includes(h.object)) spot = 'ice';
  else if (isWater) spot = 'sea';
  else if (zone !== 'ocean') spot = AIR_SPOT[zone];   // 4차 C2(D9): 녹지·도심 땅을 겨눠도 그 구역 대기
  else {
    // 해양 구역의 단단한 바닥(해변 경사로·해저 모래). 수면 위로 나와 있으면 해양 대기(예전 '해변 모래'),
    // 수면 아래면 그 위를 덮고 있는 해수를 잰 것으로 본다.
    const waterY = FPPlayer.waterHeightAt(p.x, p.z, performance.now() / 1000);
    spot = p.y > waterY ? 'airOcean' : 'sea';
  }
  return { point: p, zone, isWater, isAir: false, spot, dist: h.distance };
}

// ── 계측기 사양 ─────────────────────────────────────────────────────────────
// 예전엔 좌클릭하는 순간 참값이 소수점까지 정확하게 떴다. 같은 지점을 백 번 눌러도
// 백 번 같은 값이 나오니, 반복측정·평균·표준편차라는 개념을 가르칠 수가 없었다.
// 실제 센서가 가진 세 가지 한계를 넣는다:
//   res    분해능. 표시할 수 있는 최소 눈금. 이보다 잘게는 못 읽는다.
//   sigma  재현성. 같은 조건에서 다시 재도 이만큼 흔들린다(1 표준편차).
//   settle 응답시간. 값이 안정될 때까지 걸리는 시간.
// 실제 기기는 훨씬 느리다(MH-Z19B는 T90이 60초 수준). 게임에서 60초를 기다릴 수는
// 없으니 눌러 놓고 기다리는 감각이 남을 만큼만 압축했다.
const TOOL_SPEC = {
  temp: { res: 0.1,  sigma: 0.15, settle: 1.2, cold: 20,  unit: '°C' },
  ph:   { res: 0.01, sigma: 0.02, settle: 2.5, cold: 7.00, unit: 'pH' },
  co2:  { res: 1,    sigma: 8,    settle: 3.0, cold: 400, unit: 'ppm' },
  // 해수 분석기: 한 번 떠서 네 값을 함께 낸다. 채널마다 분해능·재현성이 다르다.
  // 수온 채널은 온도계와 같은 사양 - 같은 물을 재면 같은 분포에서 값이 나와야 한다.
  // Ω 재현성 0.03은 418ppm 냉수대(≈2.2)와 개방 해역(≈2.9) 차이보다 훨씬 작아서
  // 한 번에 구분되지만, 같은 수온 안의 미세한 차이는 반복 측정이 있어야 보인다.
  sea:  { settle: 3.5, unit: 'Ω', ch: [
    { key: 'co2aq', name: 'CO₂',  res: 0.1,  sigma: 0.3,  cold: 10,   unit: 'µmol/kg' },
    { key: 'dic',   name: 'DIC',  res: 1,    sigma: 3,    cold: 2000, unit: 'µmol/kg' },
    { key: 'omega', name: 'Ω',    res: 0.01, sigma: 0.03, cold: 3,    unit: '' },
    { key: 'temp',  name: '수온', res: 0.1,  sigma: 0.15, cold: 20,   unit: '°C' },
  ] },
};
const UMOL = 1e6;   // mol/kg -> µmol/kg
// 표준정규난수 (Box-Muller). 균등난수를 쓰면 오차 분포가 실제와 달라서
// 평균을 내도 참값으로 수렴하는 맛이 안 난다.
function gaussNoise() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
function quantize(v, res) { return Math.round(v / res) * res; }
function fmtValue(v, res) {
  return v.toFixed(res >= 1 ? 0 : (res >= 0.1 ? 1 : 2));
}

// ── 도구 정의 ───────────────────────────────────────────────────────────────
// 4차 D1: 표시창 색은 css/theme.css 의 --lcd-* 토큰에서 읽는다(대비는 tools/check_contrast.js 가 확인).
// 기기 화면이라 1인칭 UI 의 종이 테마와 달리 어두운 LCD 그대로 둔다(D §1).
const LCD = k => Theme.color('--lcd-' + k);
// 글자 크기는 표시창 높이에 대한 비율로 정한다 — 해상도를 바꿔도 배치가 그대로 따라오게.
// 숫자 '-12.3'·'1000' 처럼 길어지면 폭에 맞춰 줄인다(잘리면 값을 잘못 읽는다).
function fitText(c, text, weight, size, family, maxW) {
  let px = size;
  c.font = `${weight} ${px}px ${family}`;
  while (px > 8 && c.measureText(text).width > maxW) { px -= 2; c.font = `${weight} ${px}px ${family}`; }
}
const LCD_MONO = '"Courier New", monospace';
function makeDisplayCanvas() {
  const cv = document.createElement('canvas');
  // 화면 판(PlaneGeometry)의 크기는 그대로, 텍스처 해상도만 두 배(예전 160×96) — 큰 숫자를 키워도 흐려지지 않게
  cv.width = 320; cv.height = 192;
  return cv;
}
function drawDisplay(tool, big, small, color, progress) {
  const cv = tool.canvas, c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  c.fillStyle = LCD('bg');
  c.fillRect(0, 0, W, H);
  c.strokeStyle = LCD('edge'); c.lineWidth = H * 0.042;
  c.strokeRect(H * 0.021, H * 0.021, W - H * 0.042, H - H * 0.042);
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  // 큰 숫자: 표시창 높이의 55 % 안팎(D1 — 예전 44/96 = 46 %). 단위·상태 글자도 18/96 → 22 %
  c.fillStyle = color;
  fitText(c, big, 'bold', Math.round(H * 0.55), LCD_MONO, W * 0.9);
  c.fillText(big, W / 2, H * 0.6);
  c.fillStyle = LCD('label');
  fitText(c, small, '600', Math.round(H * 0.22), 'sans-serif', W * 0.92);
  c.fillText(small, W / 2, H * 0.84);
  // 값이 안정되는 동안 아래쪽에 진행 막대. 다 차기 전 숫자는 아직 못 믿는다는 표시.
  if (progress != null && progress < 1) {
    const bx = W * 0.05, bw = W * 0.9, by = H * 0.9, bh = H * 0.05;
    c.fillStyle = LCD('track');
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = LCD('ok');
    c.fillRect(bx, by, bw * progress, bh);
  }
  tool.tex.needsUpdate = true;
  tool.lastResult = { big, small };   // 캔버스 픽셀을 읽지 않고도 결과를 확인할 수 있게 보관
}

// 해수 분석기 표시창: 네 값을 2x2 칸에. 손에 든 작은 화면이라 칸마다 작은 이름표 + 큰 숫자.
// Ω가 1 밑이면 빨간색 = 골격이 녹는 물.
function drawAnalyzer(tool, vals, status, color, progress) {
  const cv = tool.canvas, c = cv.getContext('2d');
  const W = cv.width, H = cv.height;
  c.fillStyle = LCD('bg');
  c.fillRect(0, 0, W, H);
  c.strokeStyle = LCD('edge'); c.lineWidth = H * 0.028;
  c.strokeRect(H * 0.014, H * 0.014, W - H * 0.028, H - H * 0.028);
  // 칸 나눔: 위 2줄(값 칸, 각 0.4H) + 맨 아래 상태 줄(0.2H)
  const CELL = H * 0.4, STATUS_Y = CELL * 2;
  c.strokeStyle = LCD('track'); c.lineWidth = Math.max(1, H * 0.007);
  c.beginPath();
  c.moveTo(W / 2, H * 0.05); c.lineTo(W / 2, STATUS_Y);
  c.moveTo(W * 0.03, CELL); c.lineTo(W * 0.97, CELL);
  c.moveTo(W * 0.03, STATUS_Y); c.lineTo(W * 0.97, STATUS_Y);
  c.stroke();
  const LABEL = { co2aq: '용존CO₂ µmol/kg', dic: 'DIC µmol/kg', omega: 'Ω 포화도', temp: '수온 °C' };
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  TOOL_SPEC.sea.ch.forEach((ch, i) => {
    const cx = (i % 2) * (W / 2) + W / 4, top = Math.floor(i / 2) * CELL;
    const v = vals ? vals[ch.key] : null;
    c.fillStyle = LCD('label');
    fitText(c, LABEL[ch.key], '600', Math.round(H * 0.1), 'sans-serif', W / 2 * 0.9);
    c.fillText(LABEL[ch.key], cx, top + CELL * 0.3);
    let col = color;
    const settled = progress == null && v != null;
    if (ch.key === 'omega' && settled) col = v < 1 ? LCD('alarm') : (v < 2 ? LCD('caution') : color);
    c.fillStyle = col;
    // 숫자: 칸 높이의 60 % 안팎(예전 30/144 = 표시창의 21 % → 24 %)
    const txt = v == null ? '--' : fmtValue(v, ch.res) + (ch.key === 'omega' && settled && v < 1 ? '!' : '');
    fitText(c, txt, 'bold', Math.round(H * 0.24), LCD_MONO, W / 2 * 0.88);
    c.fillText(txt, cx, top + CELL * 0.86);
  });
  c.fillStyle = LCD('label');
  fitText(c, status, '600', Math.round(H * 0.12), 'sans-serif', W * 0.92);
  c.fillText(status, W / 2, STATUS_Y + (H - STATUS_Y) * 0.62);
  if (progress != null && progress < 1) {
    const bx = W * 0.05, bw = W * 0.9, by = H * 0.91, bh = H * 0.035;
    c.fillStyle = LCD('track');
    c.fillRect(bx, by, bw, bh);
    c.fillStyle = LCD('ok');
    c.fillRect(bx, by, bw * progress, bh);
  }
  tool.tex.needsUpdate = true;
  tool.lastResult = {
    big: vals ? fmtValue(vals.omega, 0.01) : '--',
    small: status,
    values: vals ? { ...vals } : null,
  };
}

function buildTool(kind) {
  const g = new THREE.Group();
  const canvas = makeDisplayCanvas();
  // 해수 분석기는 네 줄을 띄워야 해서 표시창 해상도와 크기를 키운다 (가로세로 비는 그대로)
  if (kind === 'sea') { canvas.width = 480; canvas.height = 288; }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const caseMat = new THREE.MeshStandardMaterial({
    color: { temp: 0xe8e8ea, ph: 0xf0a33c, co2: 0x3c7fd0, sea: 0x2f9e8f }[kind],
    roughness: 0.5, metalness: 0.1,
  });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x24272b, roughness: 0.6 });

  // 공통: 손에 쥐는 본체 + 정면 표시창
  const big = kind === 'sea' ? 1.4 : 1;
  const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.011 * big, 0.016, 0.005), caseMat);
  g.add(bodyMesh);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.0085 * big, 0.0052 * big),
    new THREE.MeshBasicMaterial({ map: tex })
  );
  screen.position.set(0, 0.0042 - (big - 1) * 0.004, 0.00256);
  g.add(screen);

  // 측정부는 전부 본체 '아래'로, 본체 중심축을 그대로 따라 내려온다.
  // 예전엔 손과 겹치지 않게 z로 밀었는데, 손 그룹이 기울어져 있어서 화면상으로는
  // 탐침이 손 '옆'으로 삐져나온 것처럼 보였다. 실제 휴대용 계측기처럼 주먹을 관통해
  // 아래로 빠지게 두는 편이 훨씬 자연스럽다(가는 막대라 어색하지 않음).
  const PROBE_Z = 0;
  if (kind === 'temp') {
    // 디지털 온도계: 본체 아래로 뻗은 가느다란 금속 탐침
    const probe = new THREE.Mesh(new THREE.CylinderGeometry(0.0006, 0.0008, 0.014, 8),
      new THREE.MeshStandardMaterial({ color: 0xc8ccd2, roughness: 0.3, metalness: 0.85 }));
    probe.position.set(0, -0.015, PROBE_Z);
    g.add(probe);
  } else if (kind === 'ph') {
    // pH 미터: 아래로 내려온 프로브 끝에 유리 전극(둥근 구)
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.016, 10), darkMat);
    rod.position.set(0, -0.0155, PROBE_Z);
    g.add(rod);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.0017, 12, 10),
      new THREE.MeshPhysicalMaterial({ color: 0xbfe6ff, roughness: 0.1, transmission: 0.6, thickness: 0.001 }));
    bulb.position.set(0, -0.0238, PROBE_Z);
    g.add(bulb);
  } else if (kind === 'sea') {
    // 해수 분석기: 아래로 내려온 채수관 + 그 끝의 투명 시료 셀
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.0009, 0.0009, 0.016, 8), darkMat);
    tube.position.set(0, -0.0155, PROBE_Z);
    g.add(tube);
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.0024, 0.0024, 0.005, 12),
      new THREE.MeshPhysicalMaterial({ color: 0x9fe3d6, roughness: 0.1, transmission: 0.5, thickness: 0.001 }));
    cell.position.set(0, -0.0245, PROBE_Z);
    g.add(cell);
  } else {
    // CO2 센서: 아래로 내려온 흡입관 + 그 끝의 격자 흡입구
    const inlet = new THREE.Mesh(new THREE.CylinderGeometry(0.0022, 0.0022, 0.012, 10), darkMat);
    inlet.position.set(0, -0.014, PROBE_Z);
    g.add(inlet);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.0062, 0.0055, 0.0012),
      new THREE.MeshStandardMaterial({ color: 0x1a1d20, roughness: 0.7 }));
    grille.position.set(0, -0.0185, PROBE_Z + 0.0018);
    g.add(grille);
    for (let i = -1; i <= 1; i++) {
      const slit = new THREE.Mesh(new THREE.BoxGeometry(0.0009, 0.0042, 0.0008),
        new THREE.MeshStandardMaterial({ color: 0x000000 }));
      slit.position.set(i * 0.0018, -0.0185, PROBE_Z + 0.0024);
      g.add(slit);
    }
  }

  const tool = { kind, group: g, canvas, tex };
  if (kind === 'sea') drawAnalyzer(tool, null, '해수 분석기', LCD('ok'));
  else drawDisplay(tool, '--', kind === 'temp' ? '°C' : (kind === 'ph' ? 'pH' : 'ppm'), LCD('ok'));
  return tool;
}

// ── 손 ──────────────────────────────────────────────────────────────────────
function buildHand() {
  const g = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: 0xe8b58c, roughness: 0.75 });
  const sleeve = new THREE.MeshStandardMaterial({ color: 0x3f6fa8, roughness: 0.85 });
  // 팔은 화면 바깥(카메라 뒤쪽, +z)으로 뻗게 둔다. 처음엔 팔 앞끝이 카메라 근평면
  // 코앞(0.006)까지 와서 화면 절반을 팔로 가려버렸다 - 반드시 카메라에서 떨어뜨려야 한다.
  // 화면 아래에서 위로 팔 -> 손 -> 도구 순서로 쌓는다.
  // 팔은 카메라 쪽(+z)·아래(-y)로 뻗어 화면 밖으로 빠지고, 그 끝에 손이 붙고,
  // 손 바로 위(손끝)에 도구 본체가 얹힌다.
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.007, 0.007, 0.024), sleeve);
  arm.position.set(0, -0.006, 0.011);
  g.add(arm);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.0078, 0.0078, 0.0085), skin);
  hand.position.set(0, -0.001, 0);
  g.add(hand);
  return g;
}

// 창 크기가 바뀌면 뷰모델 카메라의 종횡비도 맞춰줘야 도구가 늘어나지 않는다
FPTools.resize = function (aspect) {
  if (!this.viewCamera) return;
  this.viewCamera.aspect = aspect;
  this.viewCamera.updateProjectionMatrix();
};

// 메인 씬을 그린 뒤 깊이만 비우고 그 위에 덧그린다
FPTools.render = function (renderer) {
  if (!this.handGroup.visible) return;
  const prevAutoClear = renderer.autoClear;
  renderer.autoClear = false;
  renderer.clearDepth();
  renderer.render(this.viewScene, this.viewCamera);
  renderer.autoClear = prevAutoClear;
};

// ── 초기화 ──────────────────────────────────────────────────────────────────
FPTools.init = function (camera) {
  this.camera = camera;

  // ── 뷰모델(손·도구) 전용 씬 ──────────────────────────────────────────────
  // 손을 메인 카메라에 그냥 붙이면, 바닥을 내려다볼 때 지면이 손보다 카메라에 가까워져서
  // 깊이 테스트에 걸려 도구가 땅에 파묻힌 것처럼 사라진다.
  // FPS 게임들이 쓰는 방식대로 뷰모델을 별도 씬/카메라로 분리해서, 메인 씬을 다 그린 뒤
  // 깊이 버퍼만 비우고 그 위에 덧그린다. 그러면 3D상 어디를 보든 도구는 항상 보인다.
  this.viewScene = new THREE.Scene();
  this.viewCamera = new THREE.PerspectiveCamera(75, 1, 0.001, 0.5);
  // 뷰모델 조명은 메인 씬과 무관하게 고정 - 어두운 곳에서도 도구는 항상 읽혀야 함
  this.viewScene.add(new THREE.AmbientLight(0xffffff, 1.15));
  const vl = new THREE.DirectionalLight(0xffffff, 1.6);
  vl.position.set(0.4, 0.8, 1);
  this.viewScene.add(vl);

  this.handGroup = new THREE.Group();
  // 화면 우하단. 뷰카메라(원점)에서 0.05유닛 떨어뜨려 화면 높이의 1/3쯤 차지하게 배치.
  this.handGroup.position.set(0.024, -0.023, -0.050);
  this.handGroup.rotation.set(-0.14, 0.24, 0.08);   // 표시창이 카메라를 더 정면으로 보게
  this.handGroup.visible = false;
  this.viewScene.add(this.handGroup);

  const hand = buildHand();
  this.handGroup.add(hand);

  this.slots[0] = buildTool('temp');
  this.slots[1] = buildTool('ph');
  this.slots[2] = buildTool('co2');
  this.slots[3] = buildTool('sea');
  this.slots.forEach(t => {
    if (!t) return;
    t.group.visible = false;
    // 표시창이 달린 본체를 손끝(주먹 윗면)에 얹는다. 본체 아랫부분이 손과 살짝 겹쳐야
    // '쥐고 있다'로 읽히고, 탐침은 그대로 주먹을 지나 아래로 빠진다.
    t.group.position.set(0, 0.0105, 0);
    this.handGroup.add(t.group);
  });

  buildHotbarUI();   // select()가 슬롯 DOM에 하이라이트를 넣으므로 UI를 먼저 만든다
  this.select(0);
};

FPTools.select = function (i) {
  this.selected = i;
  this.slots.forEach((t, idx) => { if (t) t.group.visible = idx === i; });
  this.handGroup.visible = i >= 0 && !!this.slots[i];
  document.querySelectorAll('#hotbar .slot').forEach((el, idx) => {
    el.classList.toggle('is-on', idx === i);   // .btn.is-on = 눌린 버튼(채움) — theme.css 버튼 체계
    el.setAttribute('aria-pressed', String(idx === i));
  });
};

// ── 측정 진행 ───────────────────────────────────────────────────────────────
// 좌클릭하면 참값을 바로 띄우는 게 아니라, 그 값을 향해 지수적으로 수렴하는
// '측정 중' 상태로 들어간다. 다 차면 그때 값이 확정되고 야장에 기록된다.
FPTools.beginReading = function (tool, trueValue, label, color) {
  const spec = TOOL_SPEC[tool.kind];
  tool.reading = {
    // 참값 + 이번 측정의 오차. 같은 자리를 다시 재면 다른 난수가 뽑히므로
    // 값이 매번 조금씩 다르다 = 반복측정에 의미가 생긴다.
    target: trueValue + gaussNoise() * spec.sigma,
    from: tool.lastValue != null ? tool.lastValue : spec.cold,
    t: 0, dur: spec.settle, spec, label, color,
  };
  // 클릭한 그 순간 표시창을 '측정 중'으로 바꾼다. 다음 프레임의 update()를 기다리면
  // 직전 측정값이 한 프레임 더 남아 있어서, 새로 누른 건지 아닌지 헷갈린다.
  drawDisplay(tool, fmtValue(quantize(tool.reading.from, spec.res), spec.res), '측정 중…', LCD('busy'), 0);
};
// 다채널 계측기(해수 분석기). 채널마다 따로 오차를 뽑고, 응답 곡선은 같이 탄다.
FPTools.beginMultiReading = function (tool, trueVals, label, color) {
  const spec = TOOL_SPEC[tool.kind];
  const last = tool.lastValue || {};
  const target = {}, from = {};
  for (const ch of spec.ch) {
    target[ch.key] = trueVals[ch.key] + gaussNoise() * ch.sigma;
    from[ch.key] = last[ch.key] != null ? last[ch.key] : ch.cold;
  }
  tool.reading = { multi: true, target, from, t: 0, dur: spec.settle, spec, label, color };
  drawAnalyzer(tool, this._quantizeAll(spec, from), '측정 중…', LCD('busy'), 0);
};
FPTools._quantizeAll = function (spec, vals) {
  const out = {};
  // 문자열을 거쳐 숫자로 되돌려 19.200000000000003 같은 부동소수 찌꺼기를 없앤다 (야장·CSV용)
  for (const ch of spec.ch) out[ch.key] = Number(fmtValue(quantize(vals[ch.key], ch.res), ch.res));
  return out;
};
FPTools._updateMulti = function (tool, dt) {
  const r = tool.reading;
  r.t = Math.min(r.dur, r.t + dt);
  const p = r.t / r.dur;
  const done = r.t >= r.dur;
  const shown = {};
  for (const ch of r.spec.ch) {
    const a = r.from[ch.key], b = r.target[ch.key];
    shown[ch.key] = done ? b : a + (b - a) * (1 - Math.exp(-3.5 * p));
  }
  const q = this._quantizeAll(r.spec, shown);
  drawAnalyzer(tool, q, done ? r.label : '측정 중…', done ? r.color : LCD('busy'), done ? null : p);
  if (done) {
    tool.lastValue = r.target;
    tool.reading = null;
    r.values = q;
    if (FPTools.onMeasured) FPTools.onMeasured(tool, q.omega, r);
  }
};
// 매 프레임 호출. 여러 도구가 동시에 측정 중일 일은 없지만 슬롯 전체를 훑는다.
FPTools.update = function (dt) {
  for (const tool of this.slots) {
    if (!tool || !tool.reading) continue;
    if (tool.reading.multi) { this._updateMulti(tool, dt); continue; }
    const r = tool.reading;
    r.t = Math.min(r.dur, r.t + dt);
    const p = r.t / r.dur;
    // 1차 지연계 응답 곡선. 실제 센서가 계단 입력에 반응하는 모양 그대로다.
    const shown = r.t >= r.dur ? r.target
                               : r.from + (r.target - r.from) * (1 - Math.exp(-3.5 * p));
    const q = quantize(shown, r.spec.res);
    const done = r.t >= r.dur;
    drawDisplay(tool, fmtValue(q, r.spec.res),
      done ? r.label : '측정 중…', done ? r.color : LCD('busy'), done ? 1 : p);
    if (done) {
      tool.lastValue = r.target;
      tool.reading = null;
      if (FPTools.onMeasured) FPTools.onMeasured(tool, quantize(r.target, r.spec.res), r);
    }
  }
};

// 4차 E2: 측정 중(계측기 수렴 중)에 연도·갈래가 바뀌면 그 측정은 취소한다 — 겨눈 순간의 해 값으로 수렴하다가
// 다른 해에서 확정되면 기록에 다른 해의 값이 섞인다. 취소했으면 true(fp-main goTo 가 알림을 띄운다)
FPTools.cancelReadings = function () {
  let n = 0;
  for (const tool of this.slots) {
    if (!tool || !tool.reading) continue;
    const multi = tool.reading.multi;
    tool.reading = null;
    n++;
    if (multi) drawAnalyzer(tool, null, '연도가 바뀌어 취소', LCD('idle'));
    else drawDisplay(tool, '--', '연도가 바뀌어 취소', LCD('idle'));
  }
  return n > 0;
};

// ── 측정 실행 (좌클릭) ──────────────────────────────────────────────────────
FPTools.use = function () {
  const tool = this.slots[this.selected];
  if (!tool || !TOOL_SPEC[tool.kind]) return;
  // 4차 E2: 시간 이동 덮개가 떠 있는 동안(0.4초)의 클릭은 무시 — 어느 해의 값인지 모호하다
  if (typeof FPScenario !== 'undefined' && FPScenario.inTransition) return;
  // 4차 D1: 예전 'const ppm = FPWorld.co2' 는 C3 뒤로 쓰는 곳이 없어 뺐다(구역 CO₂ 는 measureCO2 → FPModel.zoneCO2)

  const hit = pickTarget();   // 하늘을 겨눠도 null이 아니라 '대기'가 돌아온다

  if (tool.kind === 'co2') {
    // 대기 중에서만 - 물속에서는 공기를 못 빨아들임
    if (FPPlayer.underwater) {
      tool.reading = null;
      drawDisplay(tool, 'ERR', '수중 · 측정 불가', LCD('err'));
      return;
    }
    const v = measureCO2(fpSample(), hit.point.x, hit.point.z, hit.zone, FPPlayer.pos.x, FPPlayer.pos.z);
    const label = hit.zone === 'city' ? '도심' : (hit.zone === 'green' ? '녹지' : '해양');
    this.beginReading(tool, v, `ppm · ${label}`, LCD('co2'));
  } else if (tool.kind === 'temp') {
    const v = measureTemperature(hit.spot, hit.point.x, hit.point.z, fpSample());
    this.beginReading(tool, v, `°C · ${SPOT[hit.spot].label}`, LCD('temp'));
  } else if (tool.kind === 'ph') {
    // pH는 바다에서만. 해양 구역이면서 수면 아래인 지점만 유효.
    if (!isSeaHit(hit)) {
      tool.reading = null;
      drawDisplay(tool, '--', '바다에서만 측정', LCD('idle'));
      return;
    }
    // 표시창에 수온을 병기한다 (pH미터의 온도 보상 탐침 - 온도계와 같은 사양)
    const st = seaStateAt(hit.point.x, hit.point.z);
    const wt = quantize(st.temp + gaussNoise() * TOOL_SPEC.temp.sigma, TOOL_SPEC.temp.res);
    this.beginReading(tool, st.pH, `pH · 수온 ${wt.toFixed(1)}°C`, LCD('ph'));
    tool.reading.waterTemp = wt;
  } else if (tool.kind === 'sea') {
    // 해수 분석기: 바다를 겨눴을 때만. 육지·하늘이면 ERR.
    if (!isSeaHit(hit)) {
      tool.reading = null;
      drawAnalyzer(tool, null, 'ERR · 바다에서만 측정', LCD('err'));
      return;
    }
    const st = seaStateAt(hit.point.x, hit.point.z);
    this.beginMultiReading(tool, {
      co2aq: st.co2aq * UMOL, dic: st.dic * UMOL, omega: st.omega, temp: st.temp,
    }, '해수 분석 완료', LCD('sea'));
  }
  // 야장이 기록할 수 있게 이번 측정의 지점 정보를 붙여 둔다
  if (tool.reading) {
    tool.reading.spot = hit.spot;
    tool.reading.zone = hit.zone;
    tool.reading.at = hit.point.clone();
  }
};

// ── 단축바 UI ───────────────────────────────────────────────────────────────
const HOTBAR_LABELS = ['온도계', 'pH미터', 'CO₂센서', '해수분석기'];
// 4차 D1: 이모지(🌡️🧪🌫️🌊) 대신 조감과 같은 SVG 아이콘(js/icons.js) — 이모지는 Windows·macOS 마다 모양이 다르다
const HOTBAR_ICONS = ['thermo', 'drop', 'dots', 'flask'];
function buildHotbarUI() {
  const bar = document.getElementById('hotbar');
  bar.innerHTML = '';
  for (let i = 0; i < HOTBAR_N; i++) {
    // 누를 수 있으니 버튼(.btn 체계). 다만 초점은 받지 않는다 — 클릭으로 초점이 남으면 Space(점프)가 버튼을 또 누른다.
    // 키보드로는 1~4 키가 같은 일을 하므로 Tab 순서에서도 뺀다(tabIndex −1 + 누를 때 초점 이동 막기).
    const el = document.createElement('button');
    el.type = 'button';
    el.tabIndex = -1;
    el.addEventListener('mousedown', e => e.preventDefault());
    el.className = 'slot btn btn--nav btn--stack';
    el.setAttribute('aria-pressed', 'false');
    el.innerHTML = `<span class="num">${i + 1}</span>` +
      (HOTBAR_ICONS[i] ? `<span class="ico">${Icons.svg(HOTBAR_ICONS[i], 26)}</span><span class="nm">${HOTBAR_LABELS[i]}</span>` : '');
    el.addEventListener('click', () => FPTools.select(i));
    bar.appendChild(el);
  }
}
