// ============================================================================
// 1인칭 모드 - 미니맵
// ----------------------------------------------------------------------------
// 왼쪽 아래에 하늘에서 내려다본 지도를 그린다. 현위치를 점으로, 보고 있는 방향을
// 부채꼴로 표시한다.
//
// three.js로 두 번째 씬을 만들어 위에서 렌더하는 방법도 있지만, 그러면 드로우콜이
// 두 배가 된다(수중에서 이미 578개다). 맵이 6x3짜리 고정 지형이고 그릴 것도
// 구역 3개 + 도로 2줄 + 점 몇 개뿐이라 2D 캔버스로 직접 그리는 편이 훨씬 싸다.
//
// 좌표 변환: 월드 (x, z) -> 화면 (sx, sy).
//   x∈[-3,3] -> 가로,  z∈[-1.5,1.5] -> 세로 (z가 커지면 화면 아래로)
// 시선 방향은 fp-player.js의 전진 벡터 (sin yaw, 0, cos yaw) 를 그대로 쓴다.
// z가 아래로 증가하게 그리므로 화면에서도 (sin yaw, cos yaw) 가 그대로 맞는다.
// ============================================================================

const FPMinimap = {
  mode: 1,          // 0=끔, 1=보통, 2=크게
  _t: 0,
};

// mode별 캔버스 가로 폭(px). 단축바는 화면 중앙 하단에 있으므로 좁은 화면(1000px)에서도
// 겹치지 않는 선까지만 키운다.
const MINI_SIZES = [0, 220, 310];
const MINI_REFRESH = 0.1;              // 초당 10회면 충분하다 (매 프레임 그릴 이유가 없다)

// ── 측정값 색점 ─────────────────────────────────────────────────────────────
// 이 시뮬의 강점은 공간 변이(열섬·나무 밑 CO2·냉수대)인데, 측정하면 숫자 하나만 나와서
// 패턴이 안 보였다. 지금 손에 든 도구의 기록만 골라 값에 따라 색을 칠한다.
// 축은 고정이다 - 기록 범위에 맞춰 늘이면 도심만 열 번 재도 노이즈가 빨강~파랑으로 퍼진다.
//   온도  : 0 → 36 °C, 파랑 → 흰색 → 빨강 (18 °C 근처가 흰색)
//   CO2   : 그해 전 지구 평균 대비 −50 → +50 ppm, 초록 → 노랑 → 주황 (연도를 바꿔도 공간 패턴이 같게)
//           4차 D2: 예전 −60 → +120 은 실제 폭보다 넓어 바다(0)·도심(+25)이 모두 노랑 근처에 몰렸다. 실제 폭(fp-model zoneCO2,
//           2023~2100): 녹지 −30~−45 · 나무 밑 −85~−122 · 바다 0 · 도심 0~+25 · 배기구 곁 +110 이상. 0(바다 = 배경)을 가운데
//           노랑에 두고 ±50 으로 잡으면 녹지는 초록, 도심은 주황 쪽으로 갈린다. 나무 밑·배기구 곁은 양 끝에 붙는다(색이 넘치지 않음).
//   pH    : 7.65 → 8.25, 주황 → 노랑 → 파랑
//   해수 분석기: Ω 0.8 → 3.5, 빨강(1 밑 = 용해) → 주황 → 청록
const DOT_SCALE = {
  temp: { lo: 0, hi: 36, stops: ['#38a0ff', '#f2ecdc', '#e8402f'], label: '온도', fmt: v => v.toFixed(0) + '°', val: r => r.value },
  co2:  { lo: -50, hi: 50, stops: ['#4fc36a', '#e8d25a', '#e8642a'], label: 'CO₂ 평균 대비', fmt: v => (v > 0 ? '+' : '') + v.toFixed(0), val: r => r.value - r.co2 },
  ph:   { lo: 7.65, hi: 8.25, stops: ['#e8683a', '#e2d35c', '#4a9be0'], label: 'pH', fmt: v => v.toFixed(2), val: r => r.value },
  sea:  { lo: 0.8, hi: 3.5, stops: ['#e2483a', '#f0b45c', '#5dcaa5'], label: 'Ω', fmt: v => v.toFixed(1), val: r => r.value },
};
function _hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
for (const k in DOT_SCALE) DOT_SCALE[k].rgb = DOT_SCALE[k].stops.map(_hex);
function dotColor(S, v) {
  const t = Math.min(1, Math.max(0, (v - S.lo) / (S.hi - S.lo))) * (S.rgb.length - 1);
  const i = Math.min(S.rgb.length - 2, Math.floor(t)), f = t - i;
  const a = S.rgb[i], b = S.rgb[i + 1];
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}

FPMinimap.init = function () {
  this.el = document.getElementById('minimap');
  if (!this.el) return;
  this.box = document.getElementById('minimapBox') || this.el;
  // 4차 D2: 범례 글자는 캔버스 밖 HTML(#minimapLegend, 토큰 색·--fs-1). 바뀔 때만 다시 쓴다
  this.lgName = document.getElementById('mmName');
  this.lgBar = document.getElementById('mmBar');
  this.lgHi = document.getElementById('mmHi');
  this._lgKey = '';
  this.ctx = this.el.getContext('2d');
  this.applyMode();
};

// 4차 M4: 미니게임 장소 목표(학습지 [나의 행동]의 [카페에서 해 보기]·[분리배출장에서 해 보기] → fp-main 의 FPActions.minigameHook).
//   stage = 'cafe' | 'recycle' | null. 지도 아래 HTML 줄(#mmTarget)에 '목표: 초록잔 카페'를 적는다 — 캔버스 안 작은 글자는 쓰지 않는다(13 px 규칙)
const MM_PLACE = { cafe: '#e0a066', recycle: '#6fd08a', council: '#9db8ea' };   // 4차 T2: 시청(회의실)
FPMinimap.target = null;
FPMinimap.setTarget = function (stage) {
  this.target = stage || null;
  if (this.target && this.mode === 0) { this.mode = 1; this.applyMode(); }
  const el = document.getElementById('mmTarget');
  if (el) {
    const q = this.target && typeof FPStage !== 'undefined' && FPStage.places ? FPStage.places().find(p => p.stage === this.target) : null;
    el.hidden = !q;
    if (q) el.textContent = `목표: ${q.title} — 지도의 화살표를 따라가요`;
  }
  this._t = 0;
};

FPMinimap.toggle = function () {
  this.mode = (this.mode + 1) % 3;
  this.applyMode();
};

FPMinimap.applyMode = function () {
  const w = MINI_SIZES[this.mode];
  if (!this.el) return;
  if (w === 0) { this.box.style.display = 'none'; return; }
  this.box.style.display = '';
  // 맵이 6x3(가로:세로 = 2:1)이라 캔버스도 그 비율에 여백만 더한다 (글자 줄은 캔버스 밖으로 뺐다)
  const h = Math.round((w - 12) / 2) + 12;
  this.el.width = w;
  this.el.height = h;
  this.el.style.width = w + 'px';
  this.el.style.height = h + 'px';
  this.box.style.width = w + 'px';
  this._t = MINI_REFRESH;   // 다음 프레임에 바로 다시 그리게
};

// 범례: 손에 든 도구의 기록이 있으면 [이름 최소 ▬▬ 최대], 없으면 'M 지도 크기' 안내
FPMinimap.legend = function (L) {
  const key = L ? L.label : '';
  if (key === this._lgKey || !this.lgName) return;
  this._lgKey = key;
  if (!L) {
    this.lgName.innerHTML = '<span class="key">M</span>지도 크기';
    this.lgBar.hidden = true;
    this.lgHi.textContent = '';
    return;
  }
  this.lgName.textContent = `${L.label} ${L.fmt(L.lo)}`;
  this.lgBar.style.background = `linear-gradient(90deg, ${L.stops.join(', ')})`;
  this.lgBar.hidden = false;
  this.lgHi.textContent = L.fmt(L.hi);
};

FPMinimap.update = function (dt) {
  if (this.mode === 0 || !this.ctx) return;
  this._t -= dt;
  if (this._t > 0) return;
  // 남은 시간을 버리지 않고 차감해야 실제 주기가 정확해진다.
  // (= MINI_REFRESH 로 리셋하면 매번 한 프레임분이 버려져 초당 10회가 8회가 된다)
  this._t += MINI_REFRESH;
  this.draw();
};

FPMinimap.draw = function () {
  const c = this.ctx, W = this.el.width, H = this.el.height;
  const BW = FPWorld.BOX_W, BD = FPWorld.BOX_D, Z = FPWorld.ZONE_W;
  const PAD = 6;
  const mw = W - PAD * 2, mh = mw / (BW / BD);     // 지도 영역
  const oy = PAD;
  const X = wx => PAD + (wx + BW / 2) / BW * mw;
  const Y = wz => oy + (wz + BD / 2) / BD * mh;

  c.clearRect(0, 0, W, H);
  // 바탕
  c.fillStyle = 'rgba(10,15,19,.72)';
  c.strokeStyle = 'rgba(120,150,165,.28)';
  c.lineWidth = 1;
  roundRect(c, 0.5, 0.5, W - 1, H - 1, 8);
  c.fill(); c.stroke();

  // 구역 세 덩어리
  const zones = [[-Z, '#26536e'], [0, '#3d6b32'], [Z, '#575a5e']];
  for (const [cx, col] of zones) {
    c.fillStyle = col;
    c.fillRect(X(cx - Z / 2), Y(-BD / 2), mw / 3, mh);
  }

  // 도로 (Stage D에서 내보낸 좌표를 그대로 쓴다)
  const RD = FPWorld.road;
  if (RD) {
    c.strokeStyle = '#8e9298';
    c.lineWidth = Math.max(1.5, RD.width / BW * mw);
    c.beginPath();
    c.moveTo(X(Z - RD.mainHalf), Y(RD.mainZ));
    c.lineTo(X(Z + RD.mainHalf), Y(RD.mainZ));
    c.moveTo(X(Z + RD.crossX), Y(-RD.crossHalf));
    c.lineTo(X(Z + RD.crossX), Y(RD.crossHalf));
    c.stroke();
  }

  // 나무 (녹지가 어디까지인지 한눈에 보인다)
  c.fillStyle = 'rgba(120,190,95,.75)';
  for (const t of FPWorld.trees) {
    c.beginPath(); c.arc(X(t.x), Y(t.z), 1.6, 0, Math.PI * 2); c.fill();
  }

  // 달리는 자동차 - 내연은 회색, 전기는 청록
  for (const car of FPWorld.cars) {
    const wx = car.group.position.x + Z, wz = car.group.position.z;
    c.fillStyle = car.isGas ? '#c9c2b6' : '#4fd6c0';
    c.fillRect(X(wx) - 1.5, Y(wz) - 1.5, 3, 3);
  }

  // 야장 측정 지점 - 조사한 경로가 지도에 남는다.
  // 손에 든 도구의 기록은 값에 따라 색점으로, 나머지 기록은 흐린 십자로.
  if (typeof FPField !== 'undefined' && FPField.rows.length) {
    const held = typeof FPTools !== 'undefined' ? FPTools.slots[FPTools.selected] : null;
    const S = held ? DOT_SCALE[held.kind] : null;
    c.strokeStyle = S ? 'rgba(255,214,120,.35)' : 'rgba(255,214,120,.9)';
    c.lineWidth = 1;
    let colored = 0;
    for (const r of FPField.rows) {
      if (S && r.kind === held.kind) { colored++; continue; }
      const x = X(r.x), y = Y(r.z);
      c.beginPath();
      c.moveTo(x - 2, y); c.lineTo(x + 2, y);
      c.moveTo(x, y - 2); c.lineTo(x, y + 2);
      c.stroke();
    }
    if (S && colored) {
      // 작은 지도라 점은 크게, 테두리는 밝게 - 파란 바다 위 파란 점도 묻히지 않게
      const rad = this.mode === 2 ? 3.6 : 2.8;
      c.strokeStyle = 'rgba(255,255,255,.85)';
      for (const r of FPField.rows) {
        if (r.kind !== held.kind) continue;
        c.fillStyle = dotColor(S, S.val(r));
        c.beginPath(); c.arc(X(r.x), Y(r.z), rad, 0, Math.PI * 2); c.fill(); c.stroke();
      }
      this._legend = S;   // 범례는 지도 아래 HTML 줄(#minimapLegend)에 — 지도 위를 가리지 않게
    } else {
      this._legend = null;
    }
    // 횡단 조사 중이면 시작점에서 현위치까지 선을 그어 준다
    const T = FPField.transect;
    if (T) {
      c.strokeStyle = 'rgba(255,214,120,.55)';
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(X(T.x0), Y(T.z0));
      c.lineTo(X(FPPlayer.pos.x), Y(FPPlayer.pos.z));
      c.stroke();
      c.setLineDash([]);
    }
  }

  // 4차 M4: 미니게임 장소(카페·분리배출장) — 모양 + 색으로 구분(카페 = 둥근 점, 분리배출장 = 세모). 그해 보이는 곳만.
  //   [카페에서 해 보기] 등으로 목표를 고르면 목표 둘레에 고리가 깜박이고 내 위치에서 목표로 화살표를 긋는다(순간이동은 하지 않는다).
  const places = typeof FPStage !== 'undefined' && FPStage.places ? FPStage.places() : [];
  const tgt = this.target ? places.find(q => q.stage === this.target) : null;
  for (const q of places) {
    if (!q.shown && q !== tgt) continue;
    const x = X(q.x), y = Y(q.z), r = this.mode === 2 ? 4.5 : 3.6;
    c.fillStyle = MM_PLACE[q.stage] || '#e8d25a';
    c.strokeStyle = 'rgba(255,255,255,.9)';
    c.lineWidth = 1.2;
    c.beginPath();
    if (q.stage === 'recycle') { c.moveTo(x, y - r * 1.2); c.lineTo(x + r * 1.1, y + r * 0.8); c.lineTo(x - r * 1.1, y + r * 0.8); c.closePath(); }
    else c.arc(x, y, r, 0, Math.PI * 2);
    c.fill(); c.stroke();
  }
  if (tgt) {
    const tx = X(tgt.x), ty = Y(tgt.z), fx = X(FPPlayer.pos.x), fy = Y(FPPlayer.pos.z);
    const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 250);
    c.strokeStyle = `rgba(255,214,120,${0.55 + 0.45 * pulse})`;
    c.lineWidth = 2;
    c.beginPath(); c.arc(tx, ty, 7 + pulse * 3, 0, Math.PI * 2); c.stroke();
    const dx = tx - fx, dy = ty - fy, d = Math.hypot(dx, dy);
    if (d > 14) {
      const ux = dx / d, uy = dy / d, ex = tx - ux * 10, ey = ty - uy * 10, sx = fx + ux * 6, sy = fy + uy * 6;
      c.strokeStyle = 'rgba(255,214,120,.95)';
      c.setLineDash([4, 3]);
      c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex, ey); c.stroke();
      c.setLineDash([]);
      c.fillStyle = 'rgba(255,214,120,.95)';
      c.beginPath(); c.moveTo(ex + ux * 5, ey + uy * 5); c.lineTo(ex - uy * 4, ey + ux * 4); c.lineTo(ex + uy * 4, ey - ux * 4); c.closePath(); c.fill();
    }
    // 도착(입구 반경 안)하거나 그 무대에 들어가면 목표를 지운다
    if (Math.hypot(tgt.x - FPPlayer.pos.x, tgt.z - FPPlayer.pos.z) < 0.06) this.setTarget(null);
  }

  // 플레이어: 시야 부채꼴 + 점
  const px = X(FPPlayer.pos.x), py = Y(FPPlayer.pos.z);
  // 전진 벡터 (sin yaw, cos yaw). 화면 y가 월드 +z 방향이라 그대로 쓰면 된다.
  const yaw = FPPlayer.yaw;
  const half = (75 / 2) * Math.PI / 180;          // 카메라 FOV 75도의 절반
  // canvas의 arc는 +x축에서 시작해 시계방향으로 각을 재므로, (sin,cos)를 atan2로 바꾼다
  const ang = Math.atan2(Math.cos(yaw), Math.sin(yaw));
  const R = Math.max(14, mw * 0.07);
  const grd = c.createRadialGradient(px, py, 0, px, py, R);
  grd.addColorStop(0, 'rgba(255,255,255,.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  c.fillStyle = grd;
  c.beginPath();
  c.moveTo(px, py);
  c.arc(px, py, R, ang - half, ang + half);
  c.closePath();
  c.fill();

  c.fillStyle = '#ffffff';
  c.strokeStyle = 'rgba(0,0,0,.6)';
  c.lineWidth = 1;
  c.beginPath(); c.arc(px, py, 3, 0, Math.PI * 2); c.fill(); c.stroke();

  // 범례(HTML). 구역 이름은 HUD 가 보여 주므로 지도에는 다시 적지 않는다(4차 D2)
  this.legend(FPField && FPField.rows.length ? this._legend : null);
};

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
