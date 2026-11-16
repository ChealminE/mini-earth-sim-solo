// ============================================================================
// 1인칭 3장 '결정자' — 기후 정책 회의실 (4차 T2) — 시청 안의 미터 축척 무대
// ----------------------------------------------------------------------------
// 두 부분을 맡는다.
//   ① 세계 속 외관(world): 도시의 두 번째로 낮은 건물(cityGroup 로컬 (−0.15, −0.55), fp-world.js bldDefs 둘째 줄 첫째)의
//      간선도로 쪽(+z) 면에 시청 정면 — 기단 · 계단 2단 · 기둥 4개 · 보 · 삼각 박공(정점색으로 한 메시) + 간판 '미니지구 시청' +
//      문(캔버스) + 깃대와 깃발(가상 깃발 — 실존 기관 표시 없음). 드로우콜 +5(그림자 패스 1 포함, T §3-1 '+8 이하').
//      왜 이 건물인가: 카페(가장 낮은 건물)와 다른 건물이어야 하고(T §3-1), 2000년 도시 규모에서 이미 서 있어야 한다(2000년 = 낮은 5채).
//      '집 앞 멀티탭'(−0.52, 0.105)이 붙은 (−0.5, 0.2) 건물은 집이라 뺐고, 이 건물은 앞에 간선도로까지 0.4유닛(20 m) 광장이 비어 있어
//      계단·깃대를 놓을 수 있다. 정면 높이 약 7.2 m — 2000년 건물 높이(약 9.3 m) 아래다.
//      들어갈 수 있는 것은 현재(NOW_YEAR)뿐(M §0-3 과 같음). 다른 해엔 안내만.
//   ② 실내 무대(build): 약 8 × 5 × 3.5 m. 나무 바닥 + 양탄자(접지 그림자를 그려 넣음) · 회반죽 벽 + 뒷벽 나무 징두리 · 왼쪽 큰 창(바깥 도시가
//      흐린 배경판) · 천장 긴 조명 2 · 원목 회의 탁자(상판 5 cm, 둥근 모서리) + 의자 8(인스턴싱) + 명패 8(아틀라스 한 장) ·
//      탁자 위 디오라마(바다·녹지·도시 — 이 장면의 주인공) · 카드 13장(기술 7 · 정책 6, 두께 있는 카드, 앞면 캔버스) · 놓을 칸 13 ·
//      벽 화면 2(① CO₂·기온 편차 그래프 ② 전력 구성·2050 배출) · 탁자 끝 이젤 쟁점 판(찬성 | 우려 두 쪽, 경첩으로 펼침) · 물 주전자·컵(도자기 — 투명 재질 0).
// 흐름(T §3-3)
//   들어가면 문 → 탁자 위 내려다보기 1.2초. 카드 더미(탁자 양 끝)의 카드를 누르면 모형 옆 칸으로 날아가 1단계, 다시 누르면 2 → 3 → 빼기.
//   3단계가 정책 카드(열쇠, D16)로 잠겼으면 흔들림 + "탄소 가격제 카드가 필요해요" — 한 번 더 누르면 뺀다.
//   키보드: Tab 으로 카드 고르기 → Enter 누르기 / 숫자 1·2·3 단계 / 0·Delete 빼기. 오른쪽 판의 슬라이더 = 연속값(고등학생, D15 —
//   중학생 세 칸 판정·숫자 접기는 만들지 않는다). 놓을 때마다 디오라마가 0.6초 안에 바뀌고 벽 화면이 다시 그려진다(바뀔 때만).
//   원자력·포집·재생(부지)·탄소 가격제 카드를 처음 놓으면 이젤 쟁점이 펼쳐진다(찬성·우려 같은 분량 — SocietyCore.issues).
//   [이 사회로 2050년 보기]·[2100년 보기] → fp.society 에 저장(cards·levers·capture·savedAt) → 사회의 선택 '우리가 설계한 사회'(F3)
//   → 무대를 나와 goTo(2050 | 2100, 'base'). 다시 들어오면 마지막 설계(fp.society.cards)가 탁자에 그대로다.
// 숫자: 전부 SocietyCore(카드 → 레버) + FPModel.runFor(FPModel.emissionsFor('custom')) — 이 파일은 숫자를 만들지 않는다.
//   디오라마의 설비 수는 세계 속 기후테크(T3)와 같은 함수 FPModel.society → FPModel.techState(2050년, 등록부 fp_tech_visual — 연출).
//   나무는 디오라마 기본 14그루 × (1 + treePlus), 굴뚝 연기는 EarthVisual.stackLevel(2050년 화석 배출).
// 사진 자세(T §3-4): wide · table(카드 없음) · table_max(모든 카드 최대) · screen(그래프 화면) · issue(쟁점 판 펼침).
//   /firstperson/?stage=council&shot=table — 사진 자세는 저장하지 않는다.
// 품질(M §6): BoxGeometry 0(kit.roundedBox), 가까운 회전체 seg ≥ 48, 재질 구별(나무·금속·도자기·종이·플라스틱·천), 접지(그림자 맵 +
//   양탄자에 그린 접지 그림자 + groundShadow), 점광 ≤ 3, 투명 재질 0(물 주전자·컵은 도자기 — 함정 15), 효과음 없음(D12), 외부 파일 0(D11).
// 모듈을 읽을 때는 등록만 한다(DOM·THREE 는 build·world 안에서만 — 마스터 §6-10).
// ============================================================================
const FPStageCouncil = (() => {
  const TITLE = '기후 정책 회의실';
  // 세계 쪽 자리(cityGroup 로컬, 유닛). 건물 (−0.15, −0.55) 폭 0.13 → 간선도로 쪽 면 z = −0.485
  const HALL = { bx: -0.15, bz: -0.55, w: 0.13 };
  const NOW = () => (typeof FPModel !== 'undefined' ? FPModel.NOW_YEAR : 2026);
  // 명패(가상의 역할 — 실존 기관·인물 없음). 앞 넷은 뒷줄(카메라 쪽으로 글이 보임)
  const ROLES = ['에너지 담당', '산업 담당', '교통 담당', '환경 담당', '재정 담당', '시민 대표', '청소년 위원', '의장'];
  const TREE_BASE = 14;   // 디오라마 기본 나무 수(세계 26그루의 축소 — 연출). 늘어나는 비율은 techState.treePlus 그대로
  const MOVE_MS = 600;    // 디오라마 변화 0.6초 안(T §3-3)

  // ── 순수 계산(DOM·THREE 없음 — tools/test_fp_stage.js 가 node 로 검사) ─────────
  const SCx = () => SocietyCore;
  const techOf = id => SCx().TECH_CARDS.find(t => t.id === id);
  const policyOf = id => SCx().POLICY_CARDS.find(p => p.id === id);
  // 카드 값 → 가장 가까운 단계(1~3). 산림처럼 값이 작을수록 센 카드도 같은 규칙(거리)
  function levelOf(t, v) {
    let best = 0, bd = Infinity;
    t.levels.forEach((L, i) => { const d = Math.abs(v - L); if (d < bd - 1e-9) { bd = d; best = i; } });
    return best + 1;
  }
  // 누르기 규칙: 안 놓음 → 1단계 · 1 → 2 → 3 → 빼기. 3단계가 잠겼으면(D16) 2에서 '잠김' 한 번, 그다음 누르면 빼기
  function nextPress(t, placed, v, maxLevel, blocked) {
    if (!placed) return { action: 'level', level: 1 };
    const L = levelOf(t, v);
    if (L >= 3) return { action: 'remove' };
    if (L + 1 > maxLevel) return blocked ? { action: 'remove' } : { action: 'locked' };
    return { action: 'level', level: L + 1 };
  }
  const MINUS = '−';
  const trim = v => String(Math.round(v * 100) / 100);
  // 카드 값 글(화면용). 비중·비율은 %, 포집·산림은 GtC/년
  function fmtValue(t, v) {
    if (t.lever === 'renewShare' || t.lever === 'nuclearShare' || t.lever === 'ev') return `${Math.round(v * 100)} %`;
    if (t.lever === 'otherCut') return `${Math.round(v * 100)} % 감축`;
    if (t.lever === 'forest') return `${v < 0 ? MINUS : ''}${Math.abs(v).toFixed(2)} GtC/년`;
    return `${trim(v)} GtC/년`;
  }
  const LEVER_WORD = { renewShare: '재생 전력 비중', nuclearShare: '원자력 전력 비중', ev: '전기차 비율', ccs: '포집량',
    otherCut: '나머지 배출', forest: '토지이용 배출' };
  // 2100년 기온 편차 → 목표선과 견준 글(고등학생 — 숫자 그대로. 세 칸 판정은 만들지 않는다, D15)
  function verdict(T) {
    if (T < 1.5) return '1.5 °C 선 아래예요';
    if (T < 2) return `2 °C 선 아래예요 (1.5 °C 선보다 ${(T - 1.5).toFixed(2)} °C 높아요)`;
    return `2 °C 선보다 ${(T - 2).toFixed(2)} °C 높아요`;
  }
  // 설계 → 엔진 결과. 배출 함수·실행은 FPModel(emissionsFor·runFor — 엔진 궤적은 fp-model.js 에서만). 키 없음 = 캐시하지 않음 — 슬라이더를 끌 때마다 캐시가 쌓이지 않게)
  function summary(cards) {
    const d = SCx().design(cards || {}, 'value');
    const run = FPModel.runFor(FPModel.emissionsFor('custom', d.levers));
    const s50 = FPModel.sample(2050, run), s100 = FPModel.sample(2100, run);
    return { d, run, s50, s100, T2100: s100.T, ppm2100: s100.ppm, T2050: s50.T, fossil2050: s50.fossil,
      capture: { ccus: d.values.ccus || 0, dac: d.values.dac || 0 } };
  }
  // 디오라마에 보일 것 = 세계 속 기후테크(T3)와 같은 함수(2050년) — 나무만 디오라마 기본 수로 줄인다
  function dioramaState(sum) {
    const soc = FPModel.society(sum.s50, 'custom', sum.d.levers, sum.capture);
    const ts = FPModel.techState(sum.s50, soc);
    return { ...ts, trees: TREE_BASE + Math.round(TREE_BASE * ts.treePlus), stack: EarthVisual.stackLevel(sum.s50.fossil || 0) };
  }
  // 정책 카드가 하는 일(카드 뒷면·판 글). 열쇠 대상은 SocietyCore.POLICY_CARDS.opens 에서
  function policyText(p) {
    if (p.opens.length) return `${p.opens.map(id => techOf(id).label).join(' · ')} 카드의 3단계(최대)를 열어요`;
    if (p.id === 'phaseout') return '계산은 그대로예요 — 원자력·재생 비중이 오르면 화석 발전 비중이 저절로 내려가는 것을 화면에서 보여 줘요';
    if (p.id === 'ndc') return '그래프 화면에 1.5 °C·2 °C 목표선과 NDC 비교 경로가 나타나요';
    const g = SCx().GUIDE.find(x => x.id === p.id);
    return g ? `${g.what} ${g.hard}` : '';
  }
  // 잠긴 카드를 여는 정책 카드 이름
  const keyNames = id => SCx().POLICY_CARDS.filter(p => p.opens.includes(id)).map(p => p.label.replace(/\(.*\)/, '').trim());

  // ── 캔버스 도우미 ──────────────────────────────────────────────────────────
  const fontOf = (name, fallback) => {
    try { return (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback; } catch (e) { return fallback; }
  };
  const cssVar = (name, fallback) => fontOf(name, fallback);
  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // 한국어 줄바꿈: 띄어쓰기 단위로 넘기고, 한 낱말이 줄보다 길면 글자 단위로 자른다
  function wrapText(c, text, maxW) {
    const out = [];
    let line = '';
    for (const w of String(text).split(' ')) {
      const test = line ? line + ' ' + w : w;
      if (c.measureText(test).width <= maxW) { line = test; continue; }
      if (line) out.push(line);
      line = '';
      let part = '';
      for (const ch of w) { if (c.measureText(part + ch).width > maxW && part) { out.push(part); part = ch; } else part += ch; }
      line = part;
    }
    if (line) out.push(line);
    return out;
  }
  function drawLines(c, lines, x, y, lh) { lines.forEach((l, i) => c.fillText(l, x, y + i * lh)); return y + lines.length * lh; }
  function paint(geo, hex) {
    const col = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
  }
  // UV 를 위치에서 다시 정한다(카드 앞면·명패·디오라마 바닥판 — 둥근 상자의 UV 는 미터 단위라 그림 한 장을 한 면에 맞추려고)
  function remapUV(geo, fn) {
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) { const [u, v] = fn(p.getX(i), p.getY(i), p.getZ(i)); uv.setXY(i, u, v); }
    uv.needsUpdate = true;
    return geo;
  }

  // 카드 그림(선 그림 — 아이콘 모양만, 실존 표지 없음)
  function picto(c, id, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round';
    const line = (...p) => { c.beginPath(); c.moveTo(p[0], p[1]); for (let i = 2; i < p.length; i += 2) c.lineTo(p[i], p[i + 1]); c.stroke(); };
    const circ = (cx, cy, r, fill) => { c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); fill ? c.fill() : c.stroke(); };
    switch (id) {
      case 'renew':
        circ(-38, -34, 22); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; line(-38 + Math.cos(a) * 32, -34 + Math.sin(a) * 32, -38 + Math.cos(a) * 44, -34 + Math.sin(a) * 44); }
        line(40, 70, 40, -10); for (let k = 0; k < 3; k++) { const a = -Math.PI / 2 + k * 2 * Math.PI / 3; line(40, -10, 40 + Math.cos(a) * 46, -10 + Math.sin(a) * 46); }
        line(-70, 70, 80, 70); break;
      case 'nuclear':
        for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(0, 0, 70, 24, k * Math.PI / 3, 0, Math.PI * 2); c.stroke(); }
        circ(0, 0, 11, true); break;
      case 'ev':
        rrect(c, -72, -6, 144, 40, 14); c.stroke(); line(-48, -6, -30, -36, 30, -36, 50, -6);
        circ(-40, 40, 14); circ(40, 40, 14); line(-8, -70, -22, -46, 2, -46, -12, -20); break;
      case 'ccus':
        line(-60, 70, -60, -10, -20, -10, -20, 70); line(-40, -10, -40, -60);
        line(10, 70, 10, 20, 50, 20, 50, 70); line(30, -50, 30, 0); line(16, -14, 30, 0, 44, -14); line(-80, 70, 80, 70); break;
      case 'dac':
        circ(0, 0, 54); for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(Math.cos(k * Math.PI / 2) * 24, Math.sin(k * Math.PI / 2) * 24, 22, 9, k * Math.PI / 2, 0, Math.PI * 2); c.stroke(); }
        line(-96, -40, -66, -20); line(96, -40, 66, -20); line(-96, 40, -66, 20); line(96, 40, 66, 20); break;
      case 'industry':
        line(-80, 60, -80, -10, -40, 10, -40, -10, 0, 10, 0, -10, 40, 10, 40, 60, -80, 60); line(60, 60, 60, -50);
        c.beginPath(); c.ellipse(70, -64, 22, 10, -0.6, 0, Math.PI * 2); c.stroke(); break;
      case 'forest':
        for (const [dx, sc] of [[-52, 0.8], [0, 1.1], [52, 0.85]]) { c.beginPath(); c.moveTo(dx, -60 * sc); c.lineTo(dx + 34 * sc, 40); c.lineTo(dx - 34 * sc, 40); c.closePath(); c.stroke(); line(dx, 40, dx, 62); }
        break;
      case 'carbon_price':
        c.beginPath(); c.moveTo(-70, -30); c.lineTo(20, -30); c.lineTo(70, 10); c.lineTo(20, 50); c.lineTo(-70, 50); c.closePath(); c.stroke();
        circ(28, 10, 8); c.font = `700 40px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('CO₂', -24, 12); break;
      case 'border':
        circ(-20, 0, 52); c.beginPath(); c.ellipse(-20, 0, 22, 52, 0, 0, Math.PI * 2); c.stroke(); line(-72, 0, 32, 0);
        line(52, 60, 52, -40, 92, -40, 92, 60); break;
      case 'grid':
        line(-50, 70, -20, -60, 10, 70); line(-38, 10, 0, 10); line(-30, -20, -8, -20); line(-62, -30, 22, -30);
        rrect(c, 34, -10, 50, 74, 8); c.stroke(); line(52, -18, 66, -18); line(48, 34, 70, 22, 56, 22, 74, 6); break;
      case 'phaseout':
        line(-60, 70, -60, -40, -30, -40, -30, 70); line(-80, 70, 70, 70); line(-10, 70, -10, 10, 40, 10, 40, 70);
        line(10, -70, 80, 0); line(80, -70, 10, 0); break;
      case 'ndc':
        rrect(c, -56, -70, 104, 136, 10); c.stroke(); line(-36, -36, 26, -36); line(-36, -6, 26, -6); line(-34, 30, -16, 46, 20, 14);
        line(70, 70, 70, -70); c.beginPath(); c.moveTo(70, -70); c.lineTo(108, -56); c.lineTo(70, -42); c.closePath(); c.fill(); break;
      default:   // finance
        for (let k = 0; k < 4; k++) { c.beginPath(); c.ellipse(-26, 50 - k * 22, 44, 14, 0, 0, Math.PI * 2); c.stroke(); }
        circ(54, -22, 34); line(20, -22, 88, -22); c.beginPath(); c.ellipse(54, -22, 14, 34, 0, 0, Math.PI * 2); c.stroke();
    }
    c.restore();
  }
  const CARD_COL = { renew: '#a8700c', nuclear: '#5c4596', ev: '#2b64a0', ccus: '#23705f', dac: '#2a6e72', industry: '#6e5644', forest: '#356d31', policy: '#7a3b5e' };

  // ============================================================================
  // ① 세계 속 외관
  // ============================================================================
  function world(w) {
    if (!w.scene || typeof FPWorld === 'undefined' || !FPWorld.buildings || !w.kit) return {};
    const kit = w.kit, U = 1 / 50;
    const bld = FPWorld.buildings.find(b => Math.abs(b.mesh.position.x - HALL.bx) < 1e-4 && Math.abs(b.mesh.position.z - HALL.bz) < 1e-4);
    if (!bld) return {};
    const city = bld.mesh.parent, GB = FPWorld.GROUND_BASE, ZW = FPWorld.ZONE_W;
    const cx = HALL.bx, z0 = HALL.bz + HALL.w / 2;
    const group = new THREE.Group();
    group.name = 'cityHallFront';
    city.add(group);
    const titleFont = fontOf('--font-title', 'serif');
    let FLAG = null;
    // 돌 부위는 정점색 한 메시(드로우콜 1 + 그림자 1). 크기는 실척(m) × U
    const parts = [];
    const add = (geo, hex, x, y, z) => { geo.translate(x, y, z); parts.push(paint(geo, hex)); };
    const STONE = 0xd9d3c5, STEP = 0xbdb6a6, COLM = 0xe8e2d4;
    const PLAT_H = 0.45 * U, PLAT_D = 1.6 * U;
    add(kit.roundedBox(6.4 * U, PLAT_H, PLAT_D, 0.03 * U), STEP, cx, GB + PLAT_H / 2, z0 + PLAT_D / 2);          // 기단
    add(kit.roundedBox(5.6 * U, 0.3 * U, 0.35 * U, 0.03 * U), STEP, cx, GB + 0.15 * U, z0 + PLAT_D + 0.175 * U);  // 계단 윗단
    add(kit.roundedBox(5.6 * U, 0.15 * U, 0.35 * U, 0.03 * U), STEP, cx, GB + 0.075 * U, z0 + PLAT_D + 0.525 * U); // 계단 아랫단
    const COL_X = [-2.25, -0.75, 0.75, 2.25].map(x => cx + x * U), COL_Z = z0 + 1.1 * U, COL_H = 4.8 * U;
    for (const x of COL_X) {
      add(kit.roundedBox(0.7 * U, 0.15 * U, 0.7 * U, 0.03 * U), STONE, x, GB + PLAT_H + 0.075 * U, COL_Z);       // 받침
      add(new THREE.CylinderGeometry(0.24 * U, 0.27 * U, COL_H, 20), COLM, x, GB + PLAT_H + 0.15 * U + COL_H / 2, COL_Z);
      add(kit.roundedBox(0.72 * U, 0.2 * U, 0.72 * U, 0.03 * U), STONE, x, GB + PLAT_H + 0.15 * U + COL_H + 0.1 * U, COL_Z);   // 머리
    }
    const BEAM_Y = GB + PLAT_H + 0.35 * U + COL_H + 0.3 * U;
    add(kit.roundedBox(6.6 * U, 0.6 * U, 1.8 * U, 0.04 * U), STONE, cx, BEAM_Y, z0 + 0.9 * U);                    // 보
    {
      const tri = new THREE.Shape();
      tri.moveTo(-3.2 * U, 0); tri.lineTo(3.2 * U, 0); tri.lineTo(0, 1.1 * U); tri.closePath();
      const pg = new THREE.ExtrudeGeometry(tri, { depth: 0.3 * U, bevelEnabled: true, bevelSize: 0.05 * U, bevelThickness: 0.05 * U, bevelSegments: 2, curveSegments: 2 });
      add(pg, STONE, cx, BEAM_Y + 0.3 * U + 0.05 * U, z0 + 1.45 * U);                                            // 박공
    }
    const stone = new THREE.Mesh(FPStageKit.mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 }));
    stone.castShadow = true; stone.receiveShadow = true;
    group.add(stone);
    // 간판: 보 앞면(실존 기관 표시 없음 — 가상 이름 + 잎 하나)
    const signTex = kit.canvasTex((c, W, H) => {
      c.fillStyle = '#e9e3d5'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#33403a'; c.font = `700 ${H * 0.6}px ${titleFont}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('미니지구 시청', W / 2, H * 0.55);
    }, 1024, 96);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4 * U, 0.5 * U), new THREE.MeshStandardMaterial({ map: signTex, roughness: 0.7 }));
    sign.position.set(cx, BEAM_Y, z0 + 1.8 * U + 0.0004);
    group.add(sign);
    // 문(정면 벽 위의 그림 한 장): 나무 두 짝 + 위 유리창 + 안내판
    const doorTex = kit.canvasTex((c, W, H) => {
      c.fillStyle = '#5c3f2a'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#d6c7a2'; c.fillRect(W * 0.08, H * 0.05, W * 0.84, H * 0.16);                 // 위 창(빛)
      for (const x of [0.1, 0.52]) { c.strokeStyle = '#3c2818'; c.lineWidth = 10; c.strokeRect(W * x, H * 0.25, W * 0.38, H * 0.72); c.strokeRect(W * (x + 0.05), H * 0.32, W * 0.28, H * 0.26); c.strokeRect(W * (x + 0.05), H * 0.64, W * 0.28, H * 0.26); }
      c.fillStyle = '#c9b48a'; c.fillRect(W * 0.455, H * 0.55, W * 0.03, H * 0.12); c.fillRect(W * 0.515, H * 0.55, W * 0.03, H * 0.12);
    }, 512, 680);
    const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4 * U, 3.2 * U), new THREE.MeshStandardMaterial({ map: doorTex, roughness: 0.6 }));
    door.position.set(cx, GB + PLAT_H + 1.6 * U, z0 + 0.0006);
    group.add(door);
    // 깃대 + 깃발(가상: 흰 바탕에 초록 원과 파란 물결 — 실존 깃발 아님)
    {
      const FX = cx + 3.9 * U, FZ = z0 + 2.2 * U, FH = 8 * U;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * U, 0.07 * U, FH, 10), new THREE.MeshStandardMaterial({ color: 0xc9ccce, roughness: 0.3, metalness: 1 }));
      pole.position.set(FX, GB + FH / 2, FZ); pole.castShadow = true;
      group.add(pole);
      const flagTex = kit.canvasTex((c, W, H) => {
        c.fillStyle = '#f6f4ee'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#3f7a3a'; c.beginPath(); c.arc(W * 0.5, H * 0.45, H * 0.27, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#2b64a0'; c.lineWidth = H * 0.06; c.beginPath();
        for (let x = 0; x <= W; x += 8) { const y = H * 0.8 + Math.sin(x / W * Math.PI * 4) * H * 0.04; x ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      }, 256, 168);
      const fg = new THREE.PlaneGeometry(1.6 * U, 1.05 * U, 12, 1);
      const fp = fg.attributes.position;
      for (let i = 0; i < fp.count; i++) fp.setZ(i, Math.sin((fp.getX(i) / (1.6 * U) + 0.5) * Math.PI * 2) * 0.06 * U * (fp.getX(i) / (1.6 * U) + 0.5));
      fg.computeVertexNormals();
      const flag = new THREE.Mesh(fg, new THREE.MeshStandardMaterial({ map: flagTex, roughness: 0.85, side: THREE.DoubleSide }));
      flag.position.set(FX + 0.82 * U, GB + FH - 0.6 * U, FZ);
      group.add(flag);
      FLAG = { on: { x: ZW + FX, z: FZ, r: 0.1 * U, top: GB + FH } };
    }
    // 충돌: 기단·계단(오를 수 있는 높이 — 턱마다 15 cm) · 기둥. 보일 때만(카페·분리배출장과 같은 boxOn 방식)
    const boxes = [
      { minX: ZW + cx - 3.2 * U, maxX: ZW + cx + 3.2 * U, minZ: z0, maxZ: z0 + PLAT_D, top: GB + PLAT_H },
      { minX: ZW + cx - 2.8 * U, maxX: ZW + cx + 2.8 * U, minZ: z0 + PLAT_D, maxZ: z0 + PLAT_D + 0.35 * U, top: GB + 0.3 * U },
      { minX: ZW + cx - 2.8 * U, maxX: ZW + cx + 2.8 * U, minZ: z0 + PLAT_D + 0.35 * U, maxZ: z0 + PLAT_D + 0.7 * U, top: GB + 0.15 * U },
    ].map(b => ({ on: b }));
    const cols = [...COL_X.map(x => ({ on: { x: ZW + x, z: COL_Z, r: 0.27 * U, top: GB + PLAT_H + COL_H } })), FLAG];
    const setOn = on => {
      for (const b of boxes) { if (on) Object.assign(b, b.on); else { b.minX = b.maxX = b.minZ = b.maxZ = 1e9; b.top = -Infinity; } }
      for (const c of cols) { if (on) Object.assign(c, c.on); else { c.x = c.z = 1e9; c.r = 0; c.top = -Infinity; } }
    };
    setOn(false);
    FPWorld.boxes.push(...boxes);
    FPWorld.cylinders.push(...cols);
    const LEVEL_2000 = (() => {
      try { return EarthVisual.cityLevel(FPModel.sample(2000, FPModel.pathRun(FPModel.BASE_PRESET)).cumFossilMax || 0); } catch (e) { return 0; }
    })();
    let shown = false;
    FPStage.addDoor({
      id: 'council', stage: 'council', label: '기후 정책 회의실 들어가기',
      pos: new THREE.Vector3(ZW + cx, GB + PLAT_H + 0.024, z0 + 0.002), radius: 0.08,
      visible: () => shown,
      canEnter: () => (typeof FPScenario !== 'undefined' && FPScenario.year === NOW() ? true : `현재(${NOW()})로 가야 들어갈 수 있어요`),
      // 나오면 계단 앞, 간선도로(+z) 쪽을 본다
      from: () => ({ x: ZW + cx, y: FPPlayer.pos.y, z: z0 + PLAT_D + 1.3 * U, yaw: 0, pitch: -0.05 }),
    });
    group.visible = false;
    return {
      group, levelFrom: LEVEL_2000,
      apply(year, cityState) {
        shown = !!(cityState && cityState.level >= LEVEL_2000 - 1e-9 && bld.mesh.visible);
        group.visible = shown;
        setOn(shown);
      },
    };
  }

  // ============================================================================
  // ② 실내 무대
  // ============================================================================
  function build(kit, ctx) {
    const SC = SocietyCore, TECH = SC.TECH_CARDS, POL = SC.POLICY_CARDS;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3c3a36);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 40);
    const bodyFont = fontOf('--font-body', 'sans-serif'), titleFont = fontOf('--font-title', 'serif');
    const TOP = 0.76;   // 탁자 윗면

    // 조명: 주광(왼쪽 창에서) · 반구광 · 천장 조명 아래 점광 2 + 이젤 쪽 1. 그림자 범위 = 방(8 × 5 m)
    kit.lightRig(scene, {
      size: [8, 5], center: [0, 0],
      sun: { dir: [-0.85, 1, 0.35], intensity: 1.9, color: 0xfff3e2 },
      hemi: { sky: 0xeef0ef, ground: 0x6b5a48, intensity: 0.8 },
      points: [{ pos: [-0.9, 2.9, 0], color: 0xfff1dc, intensity: 2.0, distance: 4.5 }, { pos: [0.9, 2.9, 0], color: 0xfff1dc, intensity: 2.0, distance: 4.5 },
        { pos: [2.3, 2.6, 1.1], color: 0xffe9c8, intensity: 1.0, distance: 3.2 }],
      env: { wall: 0xddd7cb, floor: 0x6a5644, band: 0x3c3630, ceiling: 0xf4f1ea,
        panels: [{ pos: [0, 6, 0], size: [5, 1.4], color: 0xffffff, intensity: 5 }, { pos: [-6.6, 1.7, 0], size: [3.2, 1.8], color: 0xf2f7ff, intensity: 4.2 },
          { pos: [4, 1.6, 6.6], size: [2.6, 1.8], color: 0xf4f6f8, intensity: 2.5 }, { pos: [5.6, 2.4, -4], size: [1.4, 1.4], color: 0xffe4c0, intensity: 2.5 }] },
    });

    const S = new THREE.Group(); S.name = 'static'; scene.add(S);   // 움직이지 않는 것 — 끝에 kit.bake 로 합친다
    const M = (geo, mat, o = {}) => kit.mesh(geo, mat, { parent: S, ...o });
    const rb = (w, h, d, r, seg, uvm) => kit.roundedBox(w, h, d, r, seg, uvm);

    // ── 방 ──
    const floorMat = kit.matOf('wood', { noise: { planks: 7, light: '#b49470', dark: '#86664a', seed: 21 } });
    M(rb(8, 0.05, 5, 0.005, 2), floorMat, { pos: [0, -0.025, 0], cast: false });
    const plaster = kit.matOf('plaster', { noise: { color: '#e7e1d5' } });
    const plasterCeil = kit.matOf('plaster', { noise: { color: '#f2eee6', seed: 11 } });
    M(rb(8, 0.06, 5, 0.01, 2), plasterCeil, { pos: [0, 3.53, 0], cast: false });
    M(rb(8, 3.5, 0.06, 0.01, 2), plaster, { pos: [0, 1.75, -2.53], cast: false });
    M(rb(8, 3.5, 0.06, 0.01, 2), plaster, { pos: [0, 1.75, 2.53], cast: false });
    M(rb(0.06, 3.5, 5, 0.01, 2), plaster, { pos: [4.03, 1.75, 0], cast: false });
    // 왼쪽 벽: 창(z −1.6~1.6, 높이 0.85~2.65) 둘레만
    M(rb(0.06, 0.85, 5, 0.01, 2), plaster, { pos: [-4.03, 0.425, 0], cast: false });
    M(rb(0.06, 0.85, 5, 0.01, 2), plaster, { pos: [-4.03, 3.075, 0], cast: false });
    for (const z of [-2.05, 2.05]) M(rb(0.06, 1.8, 0.9, 0.01, 2), plaster, { pos: [-4.03, 1.75, z], cast: false });
    // 뒷벽 나무 징두리(1 m) + 띠
    const wallWood = kit.matOf('wood', { noise: { planks: 9, light: '#a5845f', dark: '#715639', seed: 4 } });
    const darkWood = kit.matOf('wood', { noise: { planks: 5, light: '#6e4a30', dark: '#3e2818', seed: 5 } });
    M(rb(8, 1.0, 0.03, 0.008, 2), wallWood, { pos: [0, 0.5, -2.485], cast: false });
    M(rb(8, 0.04, 0.05, 0.01), darkWood, { pos: [0, 1.02, -2.475], cast: false });
    for (const z of [2.485]) M(rb(8, 0.1, 0.03, 0.006), darkWood, { pos: [0, 0.05, z], cast: false });
    M(rb(0.03, 0.1, 5, 0.006), darkWood, { pos: [3.985, 0.05, 0], cast: false });
    // 창: 바깥 도시(흐림 — 초점은 방 안) + 창틀 + 창턱
    const outside = kit.canvasTex((c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#a9c6dc'); g.addColorStop(0.6, '#dce7ec'); g.addColorStop(1, '#c4bdb0');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      try { c.filter = 'blur(6px)'; } catch (e) { /* 흐림이 없으면 또렷한 그림 */ }
      const bl = [[0.0, 0.42, 0.16], [0.14, 0.3, 0.12], [0.3, 0.5, 0.2], [0.52, 0.36, 0.14], [0.68, 0.46, 0.16], [0.84, 0.32, 0.16]];
      for (const [x, y, w] of bl) {
        c.fillStyle = '#b4bcc2'; c.fillRect(x * W, y * H, w * W, (0.78 - y) * H);
        c.fillStyle = '#98a2aa'; for (let k = 0; k < 7; k++) for (let j = 0; j < 3; j++) c.fillRect((x + 0.015 + j * w / 3.2) * W, (y + 0.04 + k * 0.05) * H, w * W * 0.18, H * 0.022);
      }
      c.fillStyle = '#7b9562'; for (const x of [0.1, 0.4, 0.62, 0.93]) { c.beginPath(); c.ellipse(x * W, 0.7 * H, 0.07 * W, 0.1 * H, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#8e8a82'; c.fillRect(0, 0.78 * H, W, 0.22 * H);
      c.filter = 'none';
    }, 1024, 640);
    M(new THREE.PlaneGeometry(4.2, 2.6), new THREE.MeshBasicMaterial({ map: outside, color: 0xd4d4d4 }), { pos: [-4.4, 1.75, 0], rot: [0, Math.PI / 2, 0], cast: false, receive: false });
    const frameMat = kit.matOf('plasticMatte', { color: 0x34383c, roughness: 0.45 });
    for (const z of [-1.6, -0.53, 0.53, 1.6]) M(rb(0.07, 1.8, 0.05, 0.008), frameMat, { pos: [-3.99, 1.75, z], cast: false });
    for (const y of [0.87, 2.12, 2.63]) M(rb(0.07, 0.05, 3.25, 0.008), frameMat, { pos: [-3.99, y, 0], cast: false });
    M(rb(0.24, 0.04, 3.35, 0.01), darkWood, { pos: [-3.9, 0.85, 0] });
    // 문(오른쪽 벽): 나무 판 + 틀 + 크롬 손잡이
    M(rb(0.05, 2.12, 1.0, 0.01), darkWood, { pos: [3.975, 1.06, 1.6], cast: false });
    M(rb(0.06, 2.2, 0.07, 0.01), frameMat, { pos: [3.97, 1.1, 1.06], cast: false });
    M(rb(0.06, 2.2, 0.07, 0.01), frameMat, { pos: [3.97, 1.1, 2.14], cast: false });
    M(rb(0.06, 0.07, 1.15, 0.01), frameMat, { pos: [3.97, 2.17, 1.6], cast: false });
    const chrome = kit.mat.chrome, steel = kit.matOf('brushedSteel', { repeat: [2, 1] });
    M(kit.tube([[3.93, 1.0, 1.22], [3.88, 1.0, 1.24], [3.88, 1.0, 1.4]], 0.012), chrome);
    // 천장 긴 조명 2 + 매달림 줄
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff3e0, emissiveIntensity: 1.5, roughness: 0.5 });
    for (const z of [-0.35, 0.35]) {
      M(rb(2.6, 0.06, 0.22, 0.02), frameMat, { pos: [0, 3.0, z], cast: false });
      M(rb(2.52, 0.012, 0.16, 0.004), lampMat, { pos: [0, 2.966, z], cast: false, receive: false });
      for (const x of [-1.1, 1.1]) M(kit.tube([[x, 3.03, z], [x, 3.5, z]], 0.004, { tubular: 2 }), steel, { cast: false });
    }
    // 뒷벽 낮은 수납장(화면 아래)
    M(rb(3.6, 0.7, 0.45, 0.015), wallWood, { pos: [0, 0.37, -2.22] });
    M(rb(3.64, 0.03, 0.48, 0.01), darkWood, { pos: [0, 0.735, -2.215] });
    for (const x of [-1.2, -0.4, 0.4, 1.2]) M(kit.tube([[x - 0.08, 0.55, -1.99], [x + 0.08, 0.55, -1.99]], 0.007, { tubular: 2 }), chrome, { cast: false });
    M(rb(3.5, 0.03, 0.4, 0.01), darkWood, { pos: [0, 0.015, -2.22], cast: false });
    // 화분 2(구석) — 도자기 화분 + 잎 덩어리
    const potM = kit.matOf('ceramic', { color: 0x5d6a6e }), leafM = kit.matOf('plasticMatte', { color: 0x4d6e3c, roughness: 0.82 });
    for (const [x, z] of [[-3.45, -2.05], [3.45, -2.05]]) {
      M(kit.lathe([[0, 0], [0.15, 0], [0.19, 0.06], [0.21, 0.42], [0.19, 0.44], [0, 0.42]], 48, { sharp: true }), potM, { pos: [x, 0, z] });
      const lg = [];
      for (let k = 0; k < 9; k++) {
        const g = new THREE.IcosahedronGeometry(0.16 + (k % 3) * 0.03, 1);
        const a = k * 2.4, r = 0.12 + (k % 2) * 0.08;
        g.scale(1, 1.3, 1); g.translate(Math.cos(a) * r, 0.62 + (k % 4) * 0.16, Math.sin(a) * r);
        lg.push(g);
      }
      M(FPStageKit.mergeGeometries(lg), leafM, { pos: [x, 0, z] });
    }

    // ── 양탄자: 천(골판지 무늬 결 대신 펠트 색) + 탁자·의자 접지 그림자를 그림으로 넣는다(그림자 맵이 꺼진 '낮음'에서도 떠 보이지 않게, Q4) ──
    const RUG = { w: 5.4, d: 3.4 };
    const CHAIRS = [];
    for (const x of [-1.35, -0.45, 0.45, 1.35]) { CHAIRS.push({ x, z: -1.2, yaw: 0 }); CHAIRS.push({ x, z: 1.2, yaw: Math.PI }); }
    const rugTex = kit.canvasTex((c, W, H) => {
      c.fillStyle = '#4e5d50'; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 9000; i++) { c.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${0.025 + (i % 5) * 0.006})`; c.fillRect((i * 733) % W, (i * 389) % H, 2, 2); }
      c.strokeStyle = '#c9b98f'; c.lineWidth = 10; c.strokeRect(46, 46, W - 92, H - 92);
      c.strokeStyle = '#3a463c'; c.lineWidth = 26; c.strokeRect(80, 80, W - 160, H - 160);
      const X = x => (x / RUG.w + 0.5) * W, Y = z => (z / RUG.d + 0.5) * H, sx = W / RUG.w;
      const blob = (x, z, rx, rz, a) => {
        c.save(); c.translate(X(x), Y(z)); c.scale(rx * sx, rz * sx);
        const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
        c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill(); c.restore();
      };
      blob(0, 0, 2.1, 0.95, 0.35);                                           // 탁자 아래
      for (const x of [-1.25, 1.25]) blob(x, 0, 0.18, 0.72, 0.4);           // 다리 판
      for (const ch of CHAIRS) blob(ch.x, ch.z, 0.34, 0.32, 0.38);
    }, 2048, Math.round(2048 * RUG.d / RUG.w));
    const rugGeo = remapUV(rb(RUG.w, 0.012, RUG.d, 0.004, 2), (x, y, z) => [x / RUG.w + 0.5, 0.5 - z / RUG.d]);
    M(rugGeo, new THREE.MeshStandardMaterial({ map: rugTex, roughness: 0.95, metalness: 0 }), { pos: [0, 0.006, 0], cast: false });

    // ── 회의 탁자: 원목 상판 5 cm(둥근 모서리) · 앞치마 · 다리 판 2 · 가로대 ──
    const tableWood = kit.matOf('wood', { noise: { planks: 4, light: '#9c6c45', dark: '#6a4428', seed: 13 } });
    M(rb(3.6, 0.05, 1.6, 0.018, 4), tableWood, { pos: [0, TOP - 0.025, 0] });
    M(rb(3.3, 0.08, 1.3, 0.012), darkWood, { pos: [0, TOP - 0.09, 0], cast: false });
    for (const x of [-1.25, 1.25]) {
      M(rb(0.1, TOP - 0.17, 1.0, 0.02), darkWood, { pos: [x, (TOP - 0.17) / 2 + 0.04, 0] });
      M(rb(0.16, 0.04, 1.25, 0.015), darkWood, { pos: [x, 0.032, 0] });
    }
    M(rb(2.4, 0.08, 0.08, 0.015), darkWood, { pos: [0, 0.28, 0], cast: false });

    // ── 의자 8: 천 씌운 좌판·등판(인스턴싱 1) + 금속 다리(인스턴싱 1) ──
    {
      const seat = rb(0.46, 0.06, 0.44, 0.02, 3); seat.translate(0, 0.47, 0.02);
      const back = rb(0.44, 0.4, 0.05, 0.02, 3); back.rotateX(-0.12); back.translate(0, 0.76, -0.2);
      const shell = FPStageKit.mergeGeometries([seat, back]);
      const legs = [];
      for (const [x, z] of [[-0.19, 0.18], [0.19, 0.18], [-0.19, -0.17], [0.19, -0.17]]) legs.push(kit.tube([[x, 0, z], [x * 0.97, 0.44, z * 0.95]], 0.011, { tubular: 2 }));
      for (const x of [-0.17, 0.17]) legs.push(kit.tube([[x, 0.46, -0.17], [x, 0.62, -0.2], [x, 0.9, -0.235]], 0.009, { tubular: 6 }));
      legs.push(kit.tube([[-0.19, 0.44, 0.18], [0.19, 0.44, 0.18]], 0.008, { tubular: 2 }), kit.tube([[-0.19, 0.44, -0.17], [0.19, 0.44, -0.17]], 0.008, { tubular: 2 }));
      const frame = FPStageKit.mergeGeometries(legs);
      const fabric = kit.matOf('cardboard', { noise: { color: '#3f5e5a', flutes: 0 } });
      const a = new THREE.InstancedMesh(shell, fabric, CHAIRS.length), b = new THREE.InstancedMesh(frame, steel, CHAIRS.length);
      const m4 = new THREE.Matrix4();
      CHAIRS.forEach((ch, i) => { m4.makeRotationY(ch.yaw).setPosition(ch.x, 0, ch.z); a.setMatrixAt(i, m4); b.setMatrixAt(i, m4); });
      a.castShadow = b.castShadow = true; a.receiveShadow = b.receiveShadow = true;
      scene.add(a, b);
    }

    // ── 명패 8: 아틀라스 한 장(4 × 2 칸) + 비스듬히 선 판(합쳐 한 메시). 글은 탁자 가운데 쪽(맞은편 사람)을 본다 ──
    {
      const atlas = kit.canvasTex((c, W, H) => {
        const cw = W / 4, ch = H / 2;
        ROLES.forEach((r, i) => {
          const x = (i % 4) * cw, y = Math.floor(i / 4) * ch;
          c.fillStyle = '#f5f2ea'; c.fillRect(x, y, cw, ch);
          c.fillStyle = '#3f5e5a'; c.fillRect(x, y + ch - 22, cw, 22);
          c.fillStyle = '#23272b'; c.font = `700 ${ch * 0.34}px ${titleFont}`; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(r, x + cw / 2, y + ch * 0.45);
        });
      }, 2048, 512);
      const geos = [];
      const PW = 0.22, PH = 0.07, PD = 0.012;
      CHAIRS.forEach((chr, i) => {
        // 뒷줄(z < 0) = 명패 0~3(글이 +z — 카메라 쪽), 앞줄 = 4~7
        const k = chr.z < 0 ? [-1.35, -0.45, 0.45, 1.35].indexOf(chr.x) : 4 + [-1.35, -0.45, 0.45, 1.35].indexOf(chr.x);
        const u0 = (k % 4) / 4, v0 = 1 - (Math.floor(k / 4) + 1) / 2;
        const g = remapUV(rb(PW, PH, PD, 0.004, 2), (x, y, z) => (z < -PD * 0.25 ? [u0 + 0.004, v0 + 0.49] : [u0 + (x / PW + 0.5) / 4, v0 + (y / PH + 0.5) / 2]));   // 뒷면 = 칸 구석의 빈 종이
        g.rotateX(-0.22);
        if (chr.z > 0) g.rotateY(Math.PI);
        g.translate(chr.x, TOP + PH / 2 + 0.002, chr.z < 0 ? -0.7 : 0.72);
        geos.push(g);
      });
      M(FPStageKit.mergeGeometries(geos), new THREE.MeshStandardMaterial({ map: atlas, roughness: 0.35, metalness: 0 }));
    }

    // ── 물 주전자·컵(도자기) — 처음엔 유리였는데 투명 재질 하나가 장면 전체를 한 번 더 그려(함정 15) 드로우콜이 120을 넘었다 ──
    {
      const cer = kit.matOf('ceramic', { color: 0xf1eee6 });
      const pitcher = kit.mesh(kit.lathe([[0, 0], [0.055, 0], [0.064, 0.02], [0.066, 0.13], [0.05, 0.2], [0.046, 0.23], [0.052, 0.245], [0.046, 0.25], [0, 0.24]], 64), cer, { pos: [1.62, TOP, 0.52] });
      pitcher.add(kit.mesh(kit.tube([[0.062, 0.19], [0.1, 0.17], [0.105, 0.09], [0.064, 0.06]].map(([x, y]) => [x, y, 0]), 0.008, { tubular: 16 }), cer));
      const cupG = kit.lathe([[0, 0], [0.03, 0], [0.034, 0.01], [0.037, 0.085], [0.033, 0.087], [0.031, 0.012], [0, 0.012]], 64, { sharp: true });
      const cups = [[1.44, 0.62], [1.73, 0.66]].map(([x, z]) => kit.mesh(cupG, cer, { pos: [x, TOP, z] }));
      for (const o of [pitcher, ...cups]) { scene.add(o); kit.groundShadow(o, 0.11, { opacity: 0.35 }); }
    }

    // ============================================================================
    // 디오라마(탁자 가운데) — 바다 · 녹지 · 도시 (조감 아크릴 모형의 축소판 느낌)
    // ============================================================================
    const BW = 1.56, BD = 0.66, BH = 0.06, GY = TOP + BH + 0.003;   // GY = 모형 땅 높이
    const ZX = { ocean: [-0.75, -0.25], green: [-0.25, 0.25], city: [0.25, 0.75] };
    const dioBase = M(rb(BW, BH, BD, 0.012, 3), darkWood, { pos: [0, TOP + BH / 2, 0] });
    kit.groundShadow(dioBase, [BW, BD], { opacity: 0.4 });   // 그림자 맵이 꺼진 '낮음'에서도 모형이 떠 보이지 않게(Q4)
    const groundTex = kit.canvasTex((c, W, H) => {
      const X = x => (x / 1.5 + 0.5) * W, Z = z => (z / 0.6 + 0.5) * H;
      c.fillStyle = '#20486a'; c.fillRect(0, 0, X(-0.25), H);                             // 바다 밑(물판 아래)
      const g = c.createLinearGradient(X(-0.25), 0, X(0.25), 0); g.addColorStop(0, '#d7c79b'); g.addColorStop(0.08, '#7fa35a'); g.addColorStop(1, '#6e9450');
      c.fillStyle = g; c.fillRect(X(-0.25), 0, X(0.25) - X(-0.25), H);                     // 녹지(바닷가 모래 띠)
      for (let i = 0; i < 2600; i++) { c.fillStyle = i % 3 ? 'rgba(40,70,30,0.18)' : 'rgba(210,230,170,0.16)'; c.fillRect(X(-0.24) + (i * 733) % (X(0.25) - X(-0.24)), (i * 389) % H, 3, 3); }
      c.strokeStyle = '#c8b98c'; c.lineWidth = 10; c.beginPath(); c.moveTo(X(-0.2), Z(0.27)); c.bezierCurveTo(X(-0.05), Z(0.05), X(0.05), Z(-0.05), X(0.25), Z(0.02)); c.stroke();   // 산책길
      c.fillStyle = '#b7b3aa'; c.fillRect(X(0.25), 0, W - X(0.25), H);                     // 도시
      c.fillStyle = '#5d5f62'; c.fillRect(X(0.25), Z(-0.01), W - X(0.25), Z(0.04) - Z(-0.01));   // 간선도로
      c.fillRect(X(0.52), 0, X(0.555) - X(0.52), H);                                         // 교차도로
      c.strokeStyle = '#e8e4d8'; c.lineWidth = 3; c.setLineDash([14, 12]);
      c.beginPath(); c.moveTo(X(0.25), Z(0.015)); c.lineTo(W, Z(0.015)); c.stroke(); c.setLineDash([]);
      c.fillStyle = '#e8e4d8'; for (let k = 0; k < 6; k++) c.fillRect(X(0.505) - k * 0, Z(-0.008) + k * 9 - 2, 10, 5);
    }, 2048, 820);
    M(remapUV(rb(1.5, 0.004, 0.6, 0.0015, 2), (x, y, z) => [x / 1.5 + 0.5, 0.5 - z / 0.6]), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.82 }),
      { pos: [0, TOP + BH + 0.001, 0], cast: false });
    // 바다: 윤나는 물판(투명 아님 — 환경맵이 비친다)
    M(rb(0.5, 0.008, 0.6, 0.0016, 2), new THREE.MeshPhysicalMaterial({ color: 0x1d4c72, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06 }),
      { pos: [-0.5, GY + 0.002, 0], cast: false });
    const SEA_Y = GY + 0.006;
    // 모형 앞면 이름 띠
    {
      const t = kit.canvasTex((c, W, H) => {
        c.fillStyle = '#3e2818'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#efe6d2'; c.font = `700 ${H * 0.62}px ${bodyFont}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        [['바다', 1 / 6], ['녹지', 0.5], ['도시', 5 / 6]].forEach(([s, u]) => c.fillText(s, W * u, H * 0.54));
        c.font = `500 ${H * 0.36}px ${bodyFont}`; c.textAlign = 'right'; c.fillText('2050년 모습', W - 14, H * 0.54);
      }, 1536, 64);
      M(new THREE.PlaneGeometry(1.5, 0.0625), new THREE.MeshStandardMaterial({ map: t, roughness: 0.6 }), { pos: [0, TOP + BH / 2, BD / 2 + 0.0008], cast: false });
    }
    // 도시 건물 5(지붕판 포함 — 지붕 태양광 자리) · 공장 + 굴뚝
    const BLDS = [[0.33, -0.2, 0.09, 0.13], [0.45, -0.21, 0.09, 0.17], [0.33, -0.07, 0.09, 0.09], [0.46, -0.08, 0.085, 0.11], [0.34, 0.1, 0.09, 0.07]];
    {
      const facade = kit.canvasTex((c, W, H) => {
        c.fillStyle = '#e4ded2'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#7d8a94'; for (let j = 0; j < 8; j++) for (let i = 0; i < 6; i++) c.fillRect(i * W / 6 + 8, j * H / 8 + 8, W / 6 - 16, H / 8 - 14);
      }, 256, 256, { repeat: true });
      facade.repeat.set(11, 11);
      const fm = new THREE.MeshStandardMaterial({ map: facade, roughness: 0.62 });
      const roofM = kit.matOf('concrete', { noise: { color: '#a19d95' } });
      for (const [x, z, w, h] of BLDS) {
        M(rb(w, h, w, 0.004, 2), fm, { pos: [x, GY + h / 2, z] });
        M(rb(w + 0.004, 0.006, w + 0.004, 0.002, 2), roofM, { pos: [x, GY + h + 0.003, z] });
      }
      const factM = kit.matOf('concrete', { noise: { color: '#8f8a80', seed: 3 } });
      M(rb(0.12, 0.045, 0.09, 0.004, 2), factM, { pos: [0.63, GY + 0.0225, -0.2] });
      M(kit.lathe([[0, 0], [0.013, 0], [0.012, 0.15], [0.014, 0.152], [0, 0.152]], 48, { sharp: true }), kit.matOf('concrete', { noise: { color: '#a8a29a', seed: 8 } }), { pos: [0.705, GY, -0.255] });
    }
    // 소품 묶음(인스턴싱): 자리마다 0 ↔ 1 크기로 자라기·줄기(0.6초 안 — 차례로 0.04초씩 늦게)
    const sets = [];
    const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _m = new THREE.Matrix4();
    function itemSet(geo, mat, slots, opts = {}) {
      const im = new THREE.InstancedMesh(geo, mat, slots.length);
      im.castShadow = opts.cast !== false; im.receiveShadow = true;
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      scene.add(im);
      const st = slots.map(s => ({ pos: s.pos, yaw: s.yaw || 0, sc: s.s || 1, cur: 0, from: 0, to: 0, t: 1, delay: 0 }));
      const set = {
        im, st, n: 0, spin: opts.spin || null, dirty: true,
        set(n, instant) {
          n = Math.max(0, Math.min(st.length, n | 0));
          let k = 0;
          const changed = st.filter((x, i) => (i < n ? 1 : 0) !== x.to).length;
          const lag = changed > 1 ? Math.min(40, (MOVE_MS - 380) / (changed - 1)) : 0;
          st.forEach((x, i) => {
            const to = i < n ? 1 : 0;
            if (to === x.to && !instant) return;
            x.from = x.cur; x.to = to; x.t = 0; x.delay = (ctx.reducedMotion ? 0 : k++ * lag) / 1000;
            if (instant) { x.cur = to; x.t = 1; }
          });
          this.n = n; this.dirty = true;
        },
        update(dt, clock) {
          const dur = ctx.reducedMotion ? 0.1 : 0.36;
          let any = false;
          for (const x of st) {
            if (x.t >= 1) continue;
            if (x.delay > 0) { x.delay -= dt; continue; }
            x.t = Math.min(1, x.t + dt / dur);
            const e = x.to > x.from ? kit.EASE.easeOutBack(x.t) : kit.EASE.easeInCubic(x.t);
            x.cur = x.from + (x.to - x.from) * e;
            any = true;
          }
          if (!any && !this.dirty && !this.spin) return;
          let vis = false;
          st.forEach((x, i) => {
            const k = Math.max(1e-4, x.cur) * x.sc;
            _e.set(0, x.yaw, 0);
            if (this.spin && x.cur > 1e-3) _e.set(0, x.yaw, this.spin(clock, i));
            _m.compose(_p.set(...x.pos), _q.setFromEuler(_e), _s.set(k, k, k));
            im.setMatrixAt(i, _m);
            if (x.cur > 1e-3) vis = true;
          });
          im.instanceMatrix.needsUpdate = true;
          im.visible = vis;
          this.dirty = false;
        },
      };
      sets.push(set);
      return set;
    }
    const vmat = (rough, metal) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal });
    const bakeCol = list => FPStageKit.mergeGeometries(list.map(([g, hex, p]) => { g.translate(...p); return paint(g, hex); }));
    // 해상풍력 6: 탑(회전체) + 나셀 / 날개(셋을 한 지오메트리 — 회전은 행렬로)
    const TURB = [[-0.66, -0.16], [-0.5, -0.2], [-0.34, -0.14], [-0.62, 0.1], [-0.46, 0.15], [-0.32, 0.08]];
    const HUB_Y = 0.16;
    const towers = itemSet(bakeCol([
      [kit.lathe([[0, 0], [0.012, 0], [0.012, 0.006], [0.0062, 0.008], [0.0042, HUB_Y], [0, HUB_Y]], 48, { sharp: true }), 0xf1f2ef, [0, 0, 0]],
      [kit.roundedBox(0.012, 0.012, 0.028, 0.003), 0xe8eae6, [0, HUB_Y + 0.004, -0.006]],
    ]), vmat(0.35, 0.05), TURB.map(([x, z]) => ({ pos: [x, SEA_Y, z] })));
    const rotorGeo = (() => {
      const sh = new THREE.Shape();
      sh.moveTo(-0.004, 0); sh.quadraticCurveTo(-0.005, 0.03, -0.0014, 0.075); sh.lineTo(0.0012, 0.075); sh.quadraticCurveTo(0.004, 0.025, 0.004, 0); sh.closePath();
      const parts = [];
      for (let k = 0; k < 3; k++) {
        const g = new THREE.ExtrudeGeometry(sh, { depth: 0.0012, bevelEnabled: true, bevelSize: 0.0006, bevelThickness: 0.0005, bevelSegments: 2, curveSegments: 6 });
        g.translate(0, 0.004, 0); g.rotateZ(k * Math.PI * 2 / 3); parts.push(paint(g, 0xf4f5f2));
      }
      parts.push(paint(new THREE.SphereGeometry(0.0055, 16, 12), 0xf4f5f2));
      return FPStageKit.mergeGeometries(parts);
    })();
    const rotors = itemSet(rotorGeo, vmat(0.35, 0.05), TURB.map(([x, z]) => ({ pos: [x, SEA_Y + HUB_Y + 0.004, z + 0.01] })),
      { spin: (t, i) => (ctx.shotMode ? 0.4 : t * 1.4) + i * 0.7 });
    // 지붕 태양광: 건물마다 판 하나(남쪽 = 카메라 쪽 +z 로 기울임). 셀 무늬 캔버스
    const cells = kit.canvasTex((c, W, H) => {
      c.fillStyle = '#c9ced3'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#1d2f4f'; for (let j = 0; j < 4; j++) for (let i = 0; i < 6; i++) c.fillRect(6 + i * (W - 12) / 6 + 2, 6 + j * (H - 12) / 4 + 2, (W - 12) / 6 - 4, (H - 12) / 4 - 4);
    }, 256, 160);
    const solarGeo = (() => { const g = remapUV(rb(0.066, 0.003, 0.05, 0.001, 2), (x, y, z) => [x / 0.066 + 0.5, 0.5 - z / 0.05]); g.rotateX(0.42); return g; })();
    const solar = itemSet(solarGeo, new THREE.MeshStandardMaterial({ map: cells, roughness: 0.22, metalness: 0.35 }),
      BLDS.map(([x, z, w, h]) => ({ pos: [x, GY + h + 0.016, z], s: w / 0.075 })));
    // 숲: 기본 TREE_BASE + 최대 50 %(techState.treePlus 상한) — 줄기·잎 정점색 한 지오메트리
    const TREES = (() => {
      const out = [];
      let seed = 97;
      const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
      for (let tries = 0; out.length < TREE_BASE + Math.ceil(TREE_BASE * FPModel.TECH.TREE_PLUS_MAX) && tries < 4000; tries++) {
        const x = -0.22 + rnd() * 0.44, z = -0.26 + rnd() * 0.52;
        if (Math.abs(z - (0.27 - (x + 0.2) * 0.5)) < 0.03) continue;   // 산책길 비우기(대략)
        if (out.some(p => Math.hypot(p.pos[0] - x, p.pos[2] - z) < 0.065)) continue;
        out.push({ pos: [x, GY, z], yaw: rnd() * 6.28, s: 0.8 + rnd() * 0.45 });
      }
      return out;
    })();
    const crownG = new THREE.IcosahedronGeometry(0.024, 2);
    { const p = crownG.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + Math.sin(p.getX(i) * 300) * Math.cos(p.getZ(i) * 260) * 0.08; p.setXYZ(i, p.getX(i) * k, p.getY(i) * 1.25 * k, p.getZ(i) * k); } crownG.computeVertexNormals(); }
    const trees = itemSet(bakeCol([
      [kit.lathe([[0, 0], [0.0045, 0], [0.0035, 0.028], [0, 0.03]], 24, { far: true }), 0x6b4a2e, [0, 0, 0]],
      [crownG, 0x4f7f3a, [0, 0.048, 0]],
    ]), vmat(0.85, 0), TREES);
    // CCUS 3(굴뚝 옆 흡수탑 + 압축기) · DAC 팬 벽 3 · SMR 3 · 충전기 4 — fp-tech-world.js 와 같은 모양·색(청록 = 포집 장치)
    const ccus = itemSet(bakeCol([
      [kit.roundedBox(0.036, 0.003, 0.03, 0.001), 0xa9a69e, [0, 0.0015, 0]],
      [kit.lathe([[0, 0], [0.008, 0], [0.008, 0.055], [0.0045, 0.062], [0, 0.063]], 48), 0xc9ced3, [0.006, 0, 0]],
      [kit.roundedBox(0.014, 0.014, 0.016, 0.003), 0x2f8f7a, [-0.01, 0.009, 0.002]],
    ]), vmat(0.42, 0.4), [[0.58, -0.1], [0.64, -0.1], [0.7, -0.1]].map(([x, z]) => ({ pos: [x, GY, z] })));
    const dacG = (() => {
      const parts = [[kit.roundedBox(0.064, 0.046, 0.022, 0.003), 0xb9bec2, [0, 0.023, 0]]];
      for (const x of [-0.02, 0, 0.02]) {
        const d = new THREE.CylinderGeometry(0.008, 0.008, 0.002, 24); d.rotateX(Math.PI / 2);
        parts.push([d, 0x30353a, [x, 0.026, 0.011]]);
        const r = new THREE.TorusGeometry(0.0085, 0.0013, 8, 24);
        parts.push([r, 0x2f8f7a, [x, 0.026, 0.0115]]);
      }
      return bakeCol(parts);
    })();
    const dac = itemSet(dacG, vmat(0.42, 0.4), [[0.3, 0.24], [0.38, 0.24], [0.46, 0.24]].map(([x, z]) => ({ pos: [x, GY, z] })));
    const smr = itemSet(bakeCol([
      [kit.roundedBox(0.07, 0.003, 0.055, 0.001), 0xa9a69e, [0, 0.0015, 0]],
      [kit.roundedBox(0.03, 0.026, 0.045, 0.003), 0xd9d6cf, [0.015, 0.013, 0]],
      [kit.lathe([[0, 0], [0.016, 0], [0.016, 0.022], [0.012, 0.032], [0.005, 0.0365], [0, 0.037]], 48), 0xc8ccd0, [-0.017, 0, 0]],
      [kit.roundedBox(0.031, 0.005, 0.046, 0.001), 0x2f8f7a, [0.015, 0.024, 0]],
    ]), vmat(0.7, 0.08), [[0.6, 0.15], [0.69, 0.15], [0.645, 0.25]].map(([x, z]) => ({ pos: [x, GY, z] })));
    const chargers = itemSet(bakeCol([
      [kit.roundedBox(0.009, 0.002, 0.007, 0.0006), 0xa9a69e, [0, 0.001, 0]],
      [kit.roundedBox(0.005, 0.02, 0.004, 0.001), 0xf1f2ef, [0, 0.011, 0]],
      [kit.roundedBox(0.004, 0.006, 0.0012, 0.0004), 0x1f8f6a, [0, 0.016, 0.0022]],
    ]), vmat(0.35, 0.2), [0.59, 0.63, 0.67, 0.71].map(x => ({ pos: [x, GY, 0.05] })), { cast: false });
    // 굴뚝 연기: 2050년 화석 배출(stackLevel 0~1)을 세 단계로 — 김 도구(kit.steam)를 회색으로 셋
    const smoke = [0, 1, 2].map(k => kit.steam({ origin: [0.705 + (k - 1) * 0.004, GY + 0.155, -0.255], count: 16, spread: 0.012 + k * 0.004, height: 0.12 + k * 0.03,
      size: 0.022 + k * 0.006, life: 2.6 + k * 0.4, color: 0x8d8b86, opacity: 0.38, autostart: false }));
    smoke.forEach(s => scene.add(s.obj));
    let smokeN = -1;
    function setSmoke(level) {
      const n = level <= 0 ? 0 : level < 0.35 ? 1 : level < 0.7 ? 2 : 3;
      if (n === smokeN) return;
      smokeN = n;
      smoke.forEach((s, i) => (i < n ? s.start() : s.stop()));
    }

    // ============================================================================
    // 카드 13장 + 놓을 칸
    // ============================================================================
    const CARD = { w: 0.15, h: 0.005, d: 0.21 };
    const cardGeo = remapUV(rb(CARD.w, CARD.h, CARD.d, 0.003, 2), (x, y, z) => [x / CARD.w + 0.5, 0.5 - z / CARD.d]);
    const paperRough = kit.noiseTex('paper', { color: '#ffffff' }).roughnessMap;
    const SLOT_Y = TOP + 0.003, CARD_Y = TOP + CARD.h / 2 + 0.0005;
    const HOME = id => {
      const ti = TECH.findIndex(t => t.id === id);
      if (ti >= 0) return new THREE.Vector3(-1.7 + (ti % 4) * 0.17, CARD_Y, ti < 4 ? -0.13 : 0.12);
      const pi = POL.findIndex(p => p.id === id);
      return new THREE.Vector3(1.19 + (pi % 3) * 0.17, CARD_Y, pi < 3 ? -0.13 : 0.12);
    };
    const SLOT = id => {
      const ti = TECH.findIndex(t => t.id === id);
      if (ti >= 0) return new THREE.Vector3(-0.66 + ti * 0.22, SLOT_Y + CARD.h / 2 + 0.0005, 0.47);
      const pi = POL.findIndex(p => p.id === id);
      return new THREE.Vector3(-0.55 + pi * 0.22, SLOT_Y + CARD.h / 2 + 0.0005, -0.47);
    };
    // 칸: 펠트 판(카드 이름을 연하게 찍음) — 아틀라스 한 장, 합쳐 한 메시
    {
      const cols = 7, cw = 2048 / cols, chh = 400;
      const felt = kit.canvasTex((c, W, H) => {
        c.fillStyle = '#2f4a3c'; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 6000; i++) { c.fillStyle = `rgba(255,255,255,${0.02 + (i % 4) * 0.008})`; c.fillRect((i * 733) % W, (i * 389) % H, 2, 2); }
        [...TECH, ...POL].forEach((t, i) => {
          const x = (i % cols) * cw, y = Math.floor(i / cols) * chh;
          c.strokeStyle = 'rgba(214,226,206,0.55)'; c.lineWidth = 5; c.setLineDash([16, 10]); rrect(c, x + 16, y + 16, cw - 32, chh - 32, 18); c.stroke(); c.setLineDash([]);
          c.fillStyle = 'rgba(214,226,206,0.85)'; c.font = `700 36px ${bodyFont}`; c.textAlign = 'center'; c.textBaseline = 'middle';
          const lines = wrapText(c, t.label, cw - 60);
          drawLines(c, lines, x + cw / 2, y + chh / 2 - (lines.length - 1) * 21, 42);
        });
      }, 2048, 800);
      const geos = [];
      [...TECH, ...POL].forEach((t, i) => {
        const u0 = (i % cols) / cols, v0 = 1 - (Math.floor(i / cols) + 1) / 2;
        const TW = 0.165, TD = 0.225;
        const g = remapUV(rb(TW, 0.003, TD, 0.001, 2), (x, y, z) => [u0 + (x / TW + 0.5) / cols, v0 + (0.5 - z / TD) / 2]);
        const p = SLOT(t.id);
        g.translate(p.x, TOP + 0.0015, p.z);
        geos.push(g);
      });
      M(FPStageKit.mergeGeometries(geos), new THREE.MeshStandardMaterial({ map: felt, roughness: 0.95 }), { cast: false });
    }
    // 카드 앞면 그리기(상태가 바뀐 카드만 다시)
    function drawCard(c, W, H, card) {
      const tech = card.kind === 'tech', def = card.def, col = CARD_COL[tech ? def.id : 'policy'];
      c.clearRect(0, 0, W, H);
      c.fillStyle = '#f4efe3'; c.fillRect(0, 0, W, H);
      c.fillStyle = col; rrect(c, 18, 18, W - 36, 96, 14); c.fill();
      c.fillStyle = '#ffffff'; c.font = `700 36px ${bodyFont}`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(tech ? '기술 카드' : (def.opens.length ? '정책 카드 · 열쇠' : '정책 카드'), 40, 67);
      c.fillStyle = '#20252a'; c.font = `700 46px ${titleFont}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      const lines = wrapText(c, def.label, W - 70).slice(0, 3);
      drawLines(c, lines, W / 2, 178, 54);
      picto(c, tech ? def.id : def.id, W / 2, 400, 1.35, col);
      c.textAlign = 'center';
      if (tech) {
        // 안 놓은 카드 = 지금 값(LEVER_NOW). 포집은 CCUS·DAC 둘 다 지금 0
        const v = card.placed ? card.shown : (def.lever === 'ccs' ? 0 : EarthSystem.LEVER_NOW[def.lever]);
        c.fillStyle = '#3d434b'; c.font = `600 34px ${bodyFont}`;
        c.fillText(card.placed ? `2050년 목표 ${fmtValue(def, v)}` : `지금 ${fmtValue(def, v)}`, W / 2, 560);
        const L = card.placed ? levelOf(def, v) : 0, max = card.max;
        for (let k = 0; k < 3; k++) {
          const x = W / 2 + (k - 1) * 74, y = 630;
          if (k === 2 && max < 3) {   // 잠긴 3단계: 자물쇠
            c.strokeStyle = '#8a3d00'; c.lineWidth = 6; c.beginPath(); c.arc(x, y - 12, 13, Math.PI, 0); c.stroke();
            c.fillStyle = '#8a3d00'; rrect(c, x - 20, y - 12, 40, 32, 6); c.fill();
            continue;
          }
          c.beginPath(); c.arc(x, y, 20, 0, Math.PI * 2);
          if (k < L) { c.fillStyle = col; c.fill(); } else { c.strokeStyle = col; c.lineWidth = 5; c.stroke(); }
        }
      } else {
        c.fillStyle = '#3d434b'; c.font = `600 30px ${bodyFont}`;
        const t = def.opens.length ? `여는 카드: ${def.opens.map(id => techOf(id).label.replace(/\(.*\)/, '')).join(' · ')}` : (card.placed ? '놓았어요' : '설명 카드');
        drawLines(c, wrapText(c, t, W - 70).slice(0, 3), W / 2, 560, 38);
        if (card.placed) { c.fillStyle = col; c.beginPath(); c.arc(W / 2, 672, 16, 0, Math.PI * 2); c.fill(); }
      }
      c.strokeStyle = col; c.lineWidth = 6; rrect(c, 8, 8, W - 16, H - 16, 22); c.stroke();
    }
    const cards = [];
    [...TECH.map(def => ({ kind: 'tech', def })), ...POL.map(def => ({ kind: 'policy', def }))].forEach((card, i) => {
      card.id = card.def.id; card.placed = false; card.shown = null; card.max = 3; card.blocked = false;
      card.tex = kit.canvasTex((c, W, H) => drawCard(c, W, H, card), 512, 716);
      card.mesh = kit.mesh(cardGeo, new THREE.MeshStandardMaterial({ map: card.tex, roughnessMap: paperRough, roughness: 1, metalness: 0 }), { cast: true });
      card.mesh.position.copy(HOME(card.id));
      card.mesh.userData.pick = { label: card.def.label, order: i };
      card.mesh.userData.card = card;
      scene.add(card.mesh);
      cards.push(card);
    });
    const cardById = Object.fromEntries(cards.map(c => [c.id, c]));

    // ============================================================================
    // 벽 화면 2 — ① 2026~2100 CO₂·기온 편차 ② 전력 구성 · 2050 배출 (캔버스, 설계가 바뀔 때만 다시 그림)
    // ============================================================================
    const COLS = { co2: cssVar('--data-co2', '#6b4a2b'), temp: cssVar('--data-temp', '#c0262d'), ours: cssVar('--ctl-scen', '#175e31'),
      ndc: cssVar('--data-ph', '#0b7285'), base: '#6d6a63', warn: cssVar('--warn', '#8a3d00'), ink: '#20252a', ink2: '#3d434b' };
    let SUM = null, BASE = null, NDC = null;
    const SCR = { w: 1.8, h: 1.0125 };
    function drawGraph(c, W, H) {
      c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, W, H);
      if (!SUM) return;
      const showNdc = !!(state.cards.ndc === true);
      c.fillStyle = COLS.ink; c.font = `700 60px ${titleFont}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText('2026~2100년 — 기준 사회와 우리 사회', 70, 92);
      const L = 210, R = W - 420, Y0 = 2026, Y1 = 2100, X = y => L + (y - Y0) / (Y1 - Y0) * (R - L);
      const panel = (top, bot, key, lo, hi, step, unit, title, targets) => {
        const Yv = v => bot - (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * (bot - top);
        c.strokeStyle = '#d3cab7'; c.lineWidth = 2; c.fillStyle = COLS.ink2; c.font = `500 42px ${bodyFont}`; c.textAlign = 'right'; c.textBaseline = 'middle';
        for (let v = lo; v <= hi + 1e-9; v += step) { const y = Yv(v); c.beginPath(); c.moveTo(L, y); c.lineTo(R, y); c.stroke(); c.fillText(key === 'ppm' ? String(Math.round(v)) : v.toFixed(1), L - 16, y); }
        c.textAlign = 'left'; c.font = `700 46px ${bodyFont}`; c.fillStyle = key === 'ppm' ? COLS.co2 : COLS.temp; c.fillText(`${title} (${unit})`, L, top - 30);
        if (targets && showNdc) for (const [v, txt, col] of targets) {
          c.strokeStyle = col; c.lineWidth = 4; c.setLineDash([18, 12]); c.beginPath(); c.moveTo(L, Yv(v)); c.lineTo(R, Yv(v)); c.stroke(); c.setLineDash([]);
          c.fillStyle = col; c.font = `700 40px ${bodyFont}`; c.textAlign = 'left'; c.fillText(txt, L + 12, Yv(v) - 26);
        }
        const series = [['기준 사회', BASE, COLS.base, 6, [22, 14]], ...(showNdc ? [['NDC 비교', NDC, COLS.ndc, 6, [6, 10]]] : []), ['우리 사회', SUM.run, COLS.ours, 11, []]];
        const ends = [];
        for (const [name, run, col, lw, dash] of series) {
          c.strokeStyle = col; c.lineWidth = lw; c.setLineDash(dash); c.beginPath();
          for (let y = Y0; y <= Y1; y++) { const s = FPModel.sample(y, SC.pickRun(y, BASE, run)); const py = Yv(s[key]); y === Y0 ? c.moveTo(X(y), py) : c.lineTo(X(y), py); }
          c.stroke(); c.setLineDash([]);
          const v = FPModel.sample(Y1, run)[key];
          ends.push({ name, col, v, y: Yv(v) });
        }
        // 끝 이름표(겹치면 아래로 민다)
        ends.sort((a, b) => a.y - b.y);
        let lastY = -1e9;
        for (const e of ends) {
          const y = Math.max(e.y, lastY + 52); lastY = y;
          c.fillStyle = e.col; c.font = `700 42px ${bodyFont}`; c.textAlign = 'left'; c.textBaseline = 'middle';
          c.fillText(`${e.name} ${key === 'ppm' ? Math.round(e.v) : e.v.toFixed(2)}`, R + 18, y);
        }
      };
      panel(210, 560, 'ppm', 300, 700, 100, 'ppm', 'CO₂ 농도', null);
      panel(700, 1030, 'T', 0.5, 3.0, 0.5, '°C', '기온 편차', [[1.5, '1.5 °C 목표선', COLS.warn], [2, '2 °C 목표선', COLS.temp]]);
      c.fillStyle = COLS.ink2; c.font = `500 42px ${bodyFont}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
      for (const y of [2026, 2050, 2075, 2100]) c.fillText(String(y), X(y), 1100);
      if (!showNdc) { c.textAlign = 'right'; c.fillStyle = COLS.ink2; c.font = `500 36px ${bodyFont}`; c.fillText('국제 협약·NDC 카드를 놓으면 목표선과 NDC 비교 경로가 나타나요', W - 70, 150); }
    }
    function drawPower(c, W, H) {
      c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, W, H);
      if (!SUM) return;
      const N0 = EarthSystem.LEVER_NOW, Lv = SUM.d.levers;
      c.fillStyle = COLS.ink; c.font = `700 60px ${titleFont}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      c.fillText('전력 구성 · 2050년 배출', 70, 92);
      const PC = { fossil: '#6b4a2b', nuclear: '#5c4596', renew: '#2f7d3a' };
      const bar = (y, label, l) => {
        c.fillStyle = COLS.ink2; c.font = `700 36px ${bodyFont}`; c.textBaseline = 'middle'; c.fillText(label, 70, y + 40);
        let x = 520; const w = W - 620;
        for (const [k, name] of [['fossilShare', '화석'], ['nuclearShare', '원자력'], ['renewShare', '재생']]) {
          const ww = w * l[k];
          c.fillStyle = PC[k.replace('Share', '')]; c.fillRect(x, y, ww, 80);
          if (ww > 150) { c.fillStyle = '#ffffff'; c.font = `700 34px ${bodyFont}`; c.textAlign = 'center'; c.fillText(`${name} ${Math.round(l[k] * 100)} %`, x + ww / 2, y + 42); c.textAlign = 'left'; }
          x += ww;
        }
      };
      bar(160, '지금 (2023년)', N0);
      bar(270, '2050년 우리 사회', Lv);
      c.font = `600 34px ${bodyFont}`; c.fillStyle = state.cards.phaseout === true ? COLS.warn : COLS.ink2; c.textBaseline = 'alphabetic';
      c.fillText(SUM.d.cleanPower100 ? SC.NOTES.cleanPower : `화석 발전 ${Math.round(N0.fossilShare * 100)} % → ${Math.round(Lv.fossilShare * 100)} %${state.cards.phaseout === true ? ' — 석탄 발전 단계적 폐쇄' : ''}`, 520, 412);
      // 2050년 화석 배출(GtC/년): 카드 없음 vs 우리 사회 — 0 이 기준선, 음수(순흡수)는 왼쪽
      c.fillStyle = COLS.ink; c.font = `700 40px ${bodyFont}`; c.fillText('2050년 화석 배출 (GtC/년)', 70, 520);
      const none = FPModel.sample(2050, NONE_RUN).fossil, ours = SUM.fossil2050;
      const Z0 = 700, sc = (W - 900) / 11;
      c.strokeStyle = COLS.ink2; c.lineWidth = 3; c.beginPath(); c.moveTo(Z0, 560); c.lineTo(Z0, 740); c.stroke();
      [[580, '카드 없음', none, COLS.base], [670, '우리 사회', ours, COLS.ours]].forEach(([y, name, v, col]) => {
        c.fillStyle = COLS.ink2; c.font = `600 34px ${bodyFont}`; c.textBaseline = 'middle'; c.fillText(name, 70, y + 30);
        c.fillStyle = col; const w = v * sc; c.fillRect(v >= 0 ? Z0 : Z0 + w, y, Math.abs(w), 60);
        c.fillStyle = COLS.ink; c.font = `700 34px ${bodyFont}`; c.fillText(`${v < 0 ? MINUS : ''}${Math.abs(v).toFixed(2)}`, Math.max(Z0, Z0 + w) + 16, y + 30);
      });
      // 다른 레버
      c.textBaseline = 'alphabetic'; c.font = `600 34px ${bodyFont}`; c.fillStyle = COLS.ink2;
      const rows = [['전기차 비율', `${Math.round(N0.ev * 100)} % → ${Math.round(Lv.ev * 100)} %`], ['포집량', `${trim(N0.ccs)} → ${trim(Lv.ccs)} GtC/년`],
        ['나머지 배출 감축', `${Math.round(Lv.otherCut * 100)} %`], ['토지이용 배출', `${N0.forest.toFixed(2)} → ${Lv.forest < 0 ? MINUS : ''}${Math.abs(Lv.forest).toFixed(2)} GtC/년`]];
      rows.forEach(([a, b], i) => { const x = 70 + (i % 2) * 900, y = 830 + Math.floor(i / 2) * 60; c.fillText(`${a}  `, x, y); c.fillStyle = COLS.ink; c.fillText(b, x + 330, y); c.fillStyle = COLS.ink2; });
      c.fillStyle = COLS.temp; c.font = `700 54px ${titleFont}`;
      c.fillText(`2100년 기온 편차 ${SUM.T2100.toFixed(2)} °C — ${verdict(SUM.T2100).split(' (')[0]}`, 70, 1060);
    }
    const scrTex = [kit.canvasTex(drawGraph, 2048, 1152), kit.canvasTex(drawPower, 2048, 1152)];
    const screens = [-1.05, 1.05].map((x, i) => {
      M(rb(SCR.w + 0.08, SCR.h + 0.08, 0.05, 0.015), kit.matOf('plasticMatte', { color: 0x25272a, roughness: 0.4 }), { pos: [x, 1.78, -2.475], cast: false });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(SCR.w, SCR.h), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, emissive: 0xffffff, emissiveMap: scrTex[i], emissiveIntensity: 0.92, roughness: 0.2, metalness: 0 }));
      m.position.set(x, 1.78, -2.4485);
      m.userData.pick = { label: i ? '전력 구성 화면' : '그래프 화면', order: 40 + i };
      scene.add(m);
      return m;
    });

    // ============================================================================
    // 쟁점 판(이젤) — 왼쪽 쪽 = 찬성 근거, 오른쪽 쪽 = 우려 근거. 닫혀 있으면 오른쪽 판이 접혀 표지가 보인다
    // ============================================================================
    const easel = new THREE.Group();
    easel.position.set(2.45, 0, 0.1);
    easel.rotation.y = -0.93;   // 판 앞(+z)이 탁자·카메라 쪽(−x, +z)을 본다
    scene.add(easel);
    const EZ = 0.1, BOARD_Y = 1.36, PW = 0.52, PH = 0.74;
    {
      const legWood = kit.matOf('wood', { noise: { planks: 2, light: '#b48a5e', dark: '#7d5a3a', seed: 17 } });
      const g = [
        kit.tube([[-0.36, 0, 0.1], [-0.12, 1.86, -0.03]], 0.016, { tubular: 2 }), kit.tube([[0.36, 0, 0.1], [0.12, 1.86, -0.03]], 0.016, { tubular: 2 }),   // 앞다리는 판 뒤(판 높이에서 z ≈ 0.01)
        kit.tube([[0, 0, -0.55], [0, 1.74, -0.05]], 0.015, { tubular: 2 }),
        rb(0.86, 0.035, 0.08, 0.008), rb(0.5, 0.03, 0.03, 0.008),
      ];
      g[3].translate(0, BOARD_Y - PH / 2 - 0.02, EZ + 0.01);
      g[4].translate(0, 0.72, 0.06);
      const legs = M(FPStageKit.mergeGeometries(g), legWood);
      S.remove(legs); easel.add(legs);   // 이젤은 회전된 무리 안에 둔다(굽기 대상 아님)
    }
    const boardMat = kit.matOf('plasticMatte', { color: 0xf3f1ea, roughness: 0.6 });
    const issueTex = {
      pro: kit.canvasTex(() => {}, 1024, 1456), con: kit.canvasTex(() => {}, 1024, 1456),
      cover: kit.canvasTex((c, W, H) => {
        c.fillStyle = '#f4efe3'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#7a3b5e'; rrect(c, 40, 40, W - 80, 170, 20); c.fill();
        c.fillStyle = '#fff'; c.font = `700 84px ${titleFont}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('쟁점 카드', W / 2, 126);
        c.fillStyle = '#20252a'; c.font = `600 54px ${bodyFont}`; c.textBaseline = 'alphabetic';
        drawLines(c, wrapText(c, '원자력·포집·태양광과 풍력·탄소 가격제 카드를 놓으면 여기 펼쳐져요.', W - 160), W / 2, 420, 80);
        c.fillStyle = '#3d434b'; c.font = `500 46px ${bodyFont}`;
        drawLines(c, wrapText(c, '찬성 근거와 우려 근거를 같은 분량으로 실었어요. 정답은 정해져 있지 않아요.', W - 160), W / 2, 900, 70);
      }, 1024, 1456),
    };
    const faceGeo = new THREE.PlaneGeometry(PW - 0.02, PH - 0.02);
    const leftPanel = new THREE.Group(); leftPanel.position.set(-PW / 2 - 0.002, BOARD_Y, EZ); easel.add(leftPanel);
    leftPanel.add(kit.mesh(rb(PW, PH, 0.018, 0.006, 2), boardMat));
    const leftFace = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: issueTex.pro, color: 0xe2e2e2, roughness: 0.85 })); leftFace.position.z = 0.0095; leftPanel.add(leftFace);
    const hinge = new THREE.Group(); hinge.position.set(0.002, BOARD_Y, EZ); easel.add(hinge);
    const rightPanel = new THREE.Group(); rightPanel.position.x = PW / 2; hinge.add(rightPanel);
    rightPanel.add(kit.mesh(rb(PW, PH, 0.018, 0.006, 2), boardMat));
    const rightFace = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: issueTex.con, color: 0xe2e2e2, roughness: 0.85 })); rightFace.position.z = 0.0095; rightPanel.add(rightFace);
    const coverFace = new THREE.Mesh(faceGeo, new THREE.MeshStandardMaterial({ map: issueTex.cover, color: 0xe2e2e2, roughness: 0.85 })); coverFace.position.z = -0.0095; coverFace.rotation.y = Math.PI; rightPanel.add(coverFace);
    const HINGE_CLOSED = -Math.PI + 0.06, HINGE_OPEN = 0;
    hinge.rotation.y = HINGE_CLOSED;
    const board = new THREE.Group(); easel.add(board); board.add(leftPanel, hinge);
    board.userData.pick = { label: '쟁점 판', order: 50 };
    kit.groundShadow(easel, [0.9, 0.75], { opacity: 0.4 });
    function drawIssue(issueId) {
      const is = SC.issues[issueId];
      if (!is) return;
      const side = (c, W, H, head, list, col, extra) => {
        c.fillStyle = '#f7f4ec'; c.fillRect(0, 0, W, H);
        let y = 70;
        c.fillStyle = '#20252a'; c.font = `700 52px ${titleFont}`; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
        if (head) { y = drawLines(c, wrapText(c, is.title, W - 120), 60, y + 40, 64); y += 20; } else y += 104;
        c.fillStyle = col; rrect(c, 50, y, W - 100, 84, 16); c.fill();
        c.fillStyle = '#fff'; c.font = `700 48px ${bodyFont}`; c.textBaseline = 'middle'; c.fillText(head ? '찬성 근거' : '우려 근거', 80, y + 44);
        y += 150; c.textBaseline = 'alphabetic';
        for (const s of list) {
          c.fillStyle = col; c.beginPath(); c.arc(76, y - 14, 10, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#15191d'; c.font = `600 42px ${bodyFont}`;
          y = drawLines(c, wrapText(c, s, W - 170), 104, y, 58) + 34;
        }
        if (extra) { c.fillStyle = '#3d434b'; c.font = `600 38px ${bodyFont}`; drawLines(c, wrapText(c, extra, W - 140), 70, Math.max(y + 10, H - 220), 52); }
      };
      issueTex.pro.redraw((c, W, H) => side(c, W, H, true, is.pro, '#2b64a0', ''));
      issueTex.con.redraw((c, W, H) => side(c, W, H, false, is.con, '#8a3d00', is.note || ''));
    }

    // ============================================================================
    // 흐름 · 상태
    // ============================================================================
    const state = { cards: {}, issue: null, issuesOpened: [], open: false, visited: false, dirtyAt: -1, applying: false };
    NONE_RUN = FPModel.runFor(FPModel.emissionsFor('custom', SC.leversFrom({})));   // '카드 없음 = 지금 그대로' — 비교 막대용(한 번만)
    const VIEW = {
      door: { pos: [3.3, 1.65, 1.9], target: [0.4, 0.9, 0], fov: 58 },
      table: { pos: [0.6, 3.3, 1.55], target: [0.6, 0.5, -0.06], fov: 56 },   // 앞줄 의자 위에서 내려다본다(탁자 양 끝 카드 더미까지 왼쪽 70 %에)
      screen: { pos: [-0.6, 1.76, -0.55], target: [-0.6, 1.77, -2.45], fov: 50 },   // 그래프 화면이 왼쪽 2/3 에
      wide: { pos: [3.35, 2.55, 2.25], target: [-0.5, 0.95, -0.7], fov: 62 },
    };
    {
      easel.updateMatrixWorld(true);
      const c = easel.localToWorld(new THREE.Vector3(0, BOARD_Y, EZ)), n = new THREE.Vector3(0, 0, 1).applyQuaternion(easel.quaternion), r = new THREE.Vector3(1, 0, 0).applyQuaternion(easel.quaternion);
      // 판이 화면 왼쪽 70 %에 오게(오른쪽은 설계 판 HTML) 시선을 판 오른쪽으로 비킨다
      VIEW.issue = { pos: c.clone().addScaledVector(n, 1.3).add(new THREE.Vector3(0, 0.02, 0)).addScaledVector(r, 0.3).toArray(), target: c.clone().addScaledVector(r, 0.3).toArray(), fov: 46 };
    }
    let cam = null, curView = VIEW.table;
    const lerpV = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const _tg = new THREE.Vector3();
    function setView(v) { camera.position.set(...v.pos); camera.lookAt(...v.target); camera.fov = v.fov; camera.updateProjectionMatrix(); cam = null; curView = v; }
    function moveView(v, ms = 900) {
      if (ctx.reducedMotion || ctx.shotMode) { setView(v); syncViewBtns(); return; }
      cam = { from: curView, to: v, t: 0, ms }; curView = v; syncViewBtns();
    }
    function updateCam(dt) {
      if (!cam) return;
      cam.t = Math.min(1, cam.t + dt * 1000 / cam.ms);
      const e = kit.EASE.easeInOutCubic(cam.t);
      camera.position.set(...lerpV(cam.from.pos, cam.to.pos, e));
      _tg.set(...lerpV(cam.from.target, cam.to.target, e)); camera.lookAt(_tg);
      camera.fov = cam.from.fov + (cam.to.fov - cam.from.fov) * e; camera.updateProjectionMatrix();
      if (cam.t >= 1) cam = null;
    }

    // ── HTML 겹침(종이 테마) ──
    const ui = document.createElement('div');
    ui.className = 'council-ui';
    ui.innerHTML = `
      <p class="cs-hint" hidden></p>
      <aside class="cs-panel" aria-labelledby="csTitle">
        <h2 id="csTitle">2050년 우리 사회 설계</h2>
        <div class="cs-views" role="group" aria-label="보기">
          <button class="btn btn--view btn--sm" type="button" data-view="table" aria-pressed="true">탁자</button>
          <button class="btn btn--view btn--sm" type="button" data-view="screen" aria-pressed="false">그래프 화면</button>
          <button class="btn btn--view btn--sm" type="button" data-view="issue" aria-pressed="false">쟁점 판</button>
        </div>
        <div class="cs-result" aria-live="polite"></div>
        <div class="cs-notes"></div>
        <h3>놓은 카드</h3>
        <ul class="cs-cards"></ul>
        <p class="cs-tip">카드 하나만 3단계로 써서는 2100년 기온 편차가 2 °C 아래로 내려가지 않아요. 여러 카드를 함께 써 보세요.</p>
        <p class="cs-sub">카드 더미(탁자 양 끝)의 카드를 누르면 모형 옆 칸에 놓여요. 다시 누르면 단계가 올라가고, 3단계에서 한 번 더 누르면 빠져요.
          <span class="key">Tab</span> 카드 고르기 · <span class="key">1</span><span class="key">2</span><span class="key">3</span> 단계 · <span class="key">0</span> 빼기.</p>
        <section class="cs-issue" hidden></section>
        <div class="cs-actions">
          <button class="btn btn--sm" type="button" data-reset>처음부터</button>
          <button class="btn btn--nav is-on" type="button" data-go="2050">이 사회로 2050년 보기</button>
          <button class="btn btn--nav" type="button" data-go="2100">2100년 보기</button>
        </div>
      </aside>`;
    ctx.ui.appendChild(ui);
    ui.hidden = true;
    const $ = s => ui.querySelector(s);
    const hintEl = $('.cs-hint'), resEl = $('.cs-result'), notesEl = $('.cs-notes'), listEl = $('.cs-cards'), issueEl = $('.cs-issue');
    const hint = t => { hintEl.textContent = t || ''; hintEl.hidden = !t; };
    let hintTimer = 0;
    const flash = (t, ms = 2600) => { hint(t); clearTimeout(hintTimer); hintTimer = setTimeout(() => { hint(''); hintTimer = 0; }, ms); };
    function syncViewBtns() {
      const name = Object.keys(VIEW).find(k => VIEW[k] === curView);
      ui.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === name)));
    }
    ui.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => moveView(VIEW[b.dataset.view])));
    $('[data-reset]').addEventListener('click', () => { for (const c of cards) if (c.placed) removeCard(c, true); refresh(); });
    ui.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => confirmDesign(Number(b.dataset.go))));

    // ── 카드 놓기 · 단계 · 빼기 ──
    function placeCard(card, value, instant) {
      const was = card.placed;
      card.placed = true;
      state.cards[card.id] = card.kind === 'tech' ? value : true;
      if (!was) {
        const to = SLOT(card.id);
        if (instant || ctx.reducedMotion) { kit.stop(card.mesh); card.mesh.position.copy(to); }
        else kit.arc(card.mesh, card.mesh.position.clone(), to, 0.12, 450).then(() => kit.squash(card.mesh));
        if (card.def.issue && !instant) openIssue(card.def.issue);
      }
      card.blocked = false;
    }
    function removeCard(card, instant) {
      if (!card.placed) return;
      card.placed = false; card.blocked = false;
      delete state.cards[card.id];
      const to = HOME(card.id);
      if (instant || ctx.reducedMotion) { kit.stop(card.mesh); card.mesh.position.copy(to); }
      else kit.arc(card.mesh, card.mesh.position.clone(), to, 0.1, 420).then(() => kit.squash(card.mesh));
    }
    function shake(card) {
      if (ctx.reducedMotion) return;
      const p = card.mesh.position.clone();
      kit.tween(card.mesh, { position: [p.x + 0.012, p.y, p.z] }, 70).then(() => kit.tween(card.mesh, { position: [p.x - 0.01, p.y, p.z] }, 90))
        .then(() => kit.tween(card.mesh, { position: [p.x, p.y, p.z] }, 80));
    }
    const lockMsg = card => `3단계(최대)는 잠겨 있어요 — ${keyNames(card.id).join(' 또는 ')} 카드가 필요해요. 한 번 더 누르면 카드를 빼요.`;
    function press(card, via) {
      if (card.kind === 'policy') {
        if (card.placed) removeCard(card); else placeCard(card, true);
        refresh();
        return;
      }
      const shown = card.placed ? card.shown : null;
      const r = nextPress(card.def, card.placed, shown, card.max, card.blocked);
      if (r.action === 'locked') { card.blocked = true; shake(card); flash(lockMsg(card), 3600); return; }
      if (r.action === 'remove') removeCard(card);
      else placeCard(card, card.def.levels[r.level - 1]);
      refresh();
      void via;
    }
    function setLevel(card, level) {
      if (card.kind !== 'tech') return;
      if (level > card.max) { shake(card); flash(lockMsg(card).replace(' 한 번 더 누르면 카드를 빼요.', ''), 3200); return; }
      placeCard(card, card.def.levels[level - 1]);
      refresh();
    }

    // ── 쟁점 판 ──
    let issueTok = 0;
    function openIssue(id, instant) {
      if (!SC.issues[id]) return;
      if (!state.issuesOpened.includes(id)) state.issuesOpened.push(id);
      const swap = () => { drawIssue(id); state.issue = id; renderIssue(); };
      const openNow = () => { state.open = true; if (instant || ctx.reducedMotion) { kit.stop(hinge); hinge.rotation.y = HINGE_OPEN; } else kit.tween(hinge, { rotation: [0, HINGE_OPEN, 0] }, 650, 'easeInOutCubic'); };
      const tok = ++issueTok;   // 쟁점 카드를 잇달아 놓으면 마지막 것만 펼친다(앞의 접기 애니메이션 끝 처리를 버림)
      if (state.open && state.issue !== id && !instant && !ctx.reducedMotion) {
        kit.tween(hinge, { rotation: [0, HINGE_CLOSED, 0] }, 320, 'easeInCubic').then(() => { if (tok === issueTok) { swap(); openNow(); } });
      } else { swap(); openNow(); }
    }
    function closeIssue(instant) {
      state.open = false;
      if (instant || ctx.reducedMotion) { kit.stop(hinge); hinge.rotation.y = HINGE_CLOSED; } else kit.tween(hinge, { rotation: [0, HINGE_CLOSED, 0] }, 400, 'easeInOutCubic');
      renderIssue();
    }
    function renderIssue() {
      const is = state.issue && SC.issues[state.issue];
      issueEl.hidden = !is;
      if (!is) return;
      const li = a => a.map(s => `<li>${esc(s)}</li>`).join('');
      const others = state.issuesOpened.filter(x => x !== state.issue);
      issueEl.innerHTML = `<h3>쟁점: ${esc(is.title)}${srcButton(is.src)}</h3>
        <div class="cs-issue-cols"><div><h4>찬성 근거</h4><ul>${li(is.pro)}</ul></div><div><h4>우려 근거</h4><ul>${li(is.con)}</ul></div></div>
        ${is.note ? `<p class="cs-note">${esc(is.note)}</p>` : ''}
        <p class="cs-sub">정답은 정해져 있지 않아요. 학습지 [우리 사회] 탭에 이 쟁점에 대한 내 생각을 적을 수 있어요(쓰지 않아도 진행돼요).</p>
        ${others.length ? `<p class="cs-sub">다른 쟁점: ${others.map(o => `<button class="btn btn--view btn--sm" type="button" data-issue="${o}">${esc(SC.issues[o].title)}</button>`).join(' ')}</p>` : ''}`;
      issueEl.querySelectorAll('[data-issue]').forEach(b => b.addEventListener('click', () => { openIssue(b.dataset.issue); moveView(VIEW.issue); }));
      if (typeof Icons !== 'undefined' && Icons.fill) Icons.fill(issueEl);
    }

    // ── 설계 → 엔진 → 화면 전부 ──
    function refresh(opts = {}) {
      SUM = summary(state.cards);
      if (!BASE) { BASE = FPModel.pathRun(FPModel.BASE_PRESET); NDC = FPModel.pathRun('ndc'); }
      const d = SUM.d;
      for (const c of cards) {
        const max = c.kind === 'tech' ? d.unlocked[c.id] : 3;
        const shown = c.kind === 'tech' && c.placed ? d.values[c.id] : null;
        if (shown !== c.shown || max !== c.max || c._placedDrawn !== c.placed) {
          c.shown = shown; c.max = max; c._placedDrawn = c.placed;
          c.tex.redraw((cx, W, H) => drawCard(cx, W, H, c));
        }
        c.mesh.userData.pick.label = c.kind === 'tech'
          ? `${c.def.label} — ${c.placed ? `${levelOf(c.def, shown)}단계 ${fmtValue(c.def, shown)}` : '안 놓음'}`
          : `${c.def.label} — ${c.placed ? '놓음' : '안 놓음'}`;
      }
      const ds = dioramaState(SUM), inst = !!opts.instant;
      towers.set(ds.turbines, inst); rotors.set(ds.turbines, inst);
      solar.set(Math.round(BLDS.length * ds.solarFrac), inst);
      trees.set(ds.trees, inst);
      ccus.set(ds.ccusUnits, inst); dac.set(ds.dacUnits, inst); smr.set(ds.smrUnits, inst); chargers.set(ds.chargers, inst);
      setSmoke(ds.stack);
      scrTex[0].redraw(); scrTex[1].redraw();
      renderResult(); renderNotes();
      if (!opts.keepList) renderList();
      else listEl.querySelectorAll('[data-slider]').forEach(r => { const c = cardById[r.dataset.slider]; if (c && c.shown != null && document.activeElement !== r) r.value = c.shown; });
      if (!state.applying && !ctx.shotMode) saveDraft();
    }
    function renderResult() {
      const T = SUM.T2100;
      resEl.innerHTML = `<div class="cs-big"><span>2100년 기온 편차<small>산업화 이전 대비</small></span><b>${T.toFixed(2)} °C</b>${srcButton('model_temp')}</div>
        <p class="cs-verdict">${esc(verdict(T))}</p>
        <dl class="cs-stats"><dt>2100년 CO₂</dt><dd>${Math.round(SUM.ppm2100)} ppm</dd><dt>2050년 기온 편차</dt><dd>${SUM.T2050.toFixed(2)} °C</dd>
          <dt>2050년 화석 배출</dt><dd>${SUM.fossil2050 < 0 ? MINUS : ''}${Math.abs(SUM.fossil2050).toFixed(2)} GtC/년</dd></dl>`;
    }
    function renderNotes() {
      const d = SUM.d, out = [];
      if (!Object.keys(state.cards).length) out.push([SC.NOTES.baseline, 'society_card_levels', '']);
      if (d.cleanPower100) out.push([SC.NOTES.cleanPower + (d.powerScaled ? ' (원자력 + 재생이 100 %를 넘어 같은 비율로 줄였어요)' : ''), 'lever_fossil', '']);
      if (state.cards.ccus != null || state.cards.dac != null) out.push([SC.NOTES.capture, 'issue_capture', 'is-warn']);
      if (d.ccsClipped) out.push(['포집량 합은 엔진 범위(최대 3 GtC/년)에서 잘렸어요.', 'lever_ccs', '']);
      if (d.capped.length) out.push([`${SC.NOTES.locked} ${SC.UNLOCK_NOTE}`, SC.UNLOCK_SRC, 'is-warn']);
      notesEl.innerHTML = out.map(([t, k, cls]) => `<p class="cs-note ${cls}">${esc(t)}${srcButton(k)}</p>`).join('')
        + `<p class="cs-sub">모형 위 풍력·태양광·숲·포집 설비 수는 미래 세계와 같은 규칙의 연출이에요.${srcButton('fp_tech_visual')}</p>`;
      if (typeof Icons !== 'undefined' && Icons.fill) Icons.fill(notesEl);
    }
    function renderList() {
      const placed = cards.filter(c => c.placed);
      if (!placed.length) { listEl.innerHTML = '<li class="cs-empty">아직 놓은 카드가 없어요.</li>'; return; }
      listEl.innerHTML = placed.map(c => {
        if (c.kind === 'policy') return `<li class="cs-card is-policy"><div class="cs-card-top"><b>${esc(c.def.label)}</b>
          <button class="btn btn--sm" type="button" data-remove="${c.id}">빼기</button></div><p class="cs-sub">${esc(policyText(c.def))}${srcButton(c.def.src)}</p></li>`;
        const [lo, hi] = SC.sliderRange(c.id, state.cards), t = c.def, v = c.shown;
        const step = t.lever === 'ccs' || t.lever === 'forest' ? 0.05 : 0.01;
        const a = Math.min(lo, hi), b = Math.max(lo, hi);
        const lock = c.max < 3 ? `<p class="cs-lock">3단계(최대)는 ${esc(keyNames(c.id).join(' 또는 '))} 카드가 열어요</p>` : '';
        return `<li class="cs-card"><div class="cs-card-top"><b>${esc(t.label)}</b>
          <span class="cs-val" data-val="${c.id}">${levelOf(t, v)}단계 · ${esc(fmtValue(t, v))}</span>
          <button class="btn btn--sm" type="button" data-remove="${c.id}">빼기</button></div>
          <label class="cs-range"><span class="stage-sr">${esc(t.label)} 2050년 목표(${esc(LEVER_WORD[t.lever])})</span>
          <input type="range" class="range range--scen" min="${a}" max="${b}" step="${step}" value="${v}" data-slider="${c.id}"
            ${t.levels[2] < t.levels[0] ? 'style="direction: rtl"' : ''}></label>${lock}
          <p class="cs-sub">${esc(LEVER_WORD[t.lever])} · 2050년 목표${srcButton(t.src)}</p></li>`;
      }).join('');
      listEl.querySelectorAll('[data-remove]').forEach(b => b.addEventListener('click', () => { removeCard(cardById[b.dataset.remove]); refresh(); }));
      listEl.querySelectorAll('[data-slider]').forEach(r => {
        const c = cardById[r.dataset.slider];
        r.addEventListener('input', () => {
          state.cards[c.id] = Number(r.value);
          state.dirtyAt = 0;   // update 가 0.1초마다 한 번만 다시 계산한다(끄는 동안)
          const vEl = listEl.querySelector(`[data-val="${c.id}"]`);
          if (vEl) vEl.textContent = `${levelOf(c.def, Number(r.value))}단계 · ${fmtValue(c.def, Number(r.value))}`;
        });
        r.addEventListener('change', () => { state.cards[c.id] = Number(r.value); state.dirtyAt = -1; refresh({ keepList: true }); });
      });
      if (typeof Icons !== 'undefined' && Icons.fill) Icons.fill(listEl);
    }
    // 저장: 초안(cards·issuesOpened)은 바뀔 때마다, 레버(= 사회의 선택 '우리가 설계한 사회'를 여는 값)는 확정할 때만
    function saveDraft() {
      try {
        WorksheetStore.updateFp(fp => {
          const so = fp.society && typeof fp.society === 'object' ? fp.society : (fp.society = {});
          so.cards = { ...state.cards }; so.issuesOpened = state.issuesOpened.slice(); so.draftAt = new Date().toISOString();
        });
      } catch (e) { /* 저장 못 해도 이번 화면에서는 쓴다 */ }
    }
    function confirmDesign(year) {
      if (ctx.shotMode || !SUM) return;
      try {
        WorksheetStore.updateFp(fp => {
          const so = fp.society && typeof fp.society === 'object' ? fp.society : (fp.society = {});
          so.cards = { ...state.cards }; so.levers = { ...SUM.d.levers }; so.capture = { ...SUM.capture }; so.issuesOpened = state.issuesOpened.slice();
          so.savedAt = new Date().toISOString(); so.result = { T2100: +SUM.T2100.toFixed(3), ppm2100: +SUM.ppm2100.toFixed(1), T2050: +SUM.T2050.toFixed(3) };
        });
      } catch (e) { /* 메모리 */ }
      const ok = typeof FPScenario !== 'undefined' && FPScenario.useDesign ? FPScenario.useDesign() : false;
      FPStage.exit();
      if (ok !== false && typeof FPScenario !== 'undefined') setTimeout(() => FPScenario.goTo(year, 'base'), 650);
    }
    // 저장된 설계를 탁자에 그대로(다시 들어올 때)
    function loadSaved() {
      let so = null;
      try { so = WorksheetStore.readFp().society; } catch (e) { so = null; }
      const saved = so && so.cards && typeof so.cards === 'object' ? so.cards : {};
      applyCards(saved, true);
      state.issuesOpened = Array.isArray(so && so.issuesOpened) ? so.issuesOpened.filter(id => SC.issues[id]) : [];
      if (state.issuesOpened.length) openIssue(state.issuesOpened[state.issuesOpened.length - 1], true); else { state.issue = null; closeIssue(true); }
    }
    function applyCards(cs, instant) {
      state.applying = true;
      for (const c of cards) {
        const v = cs[c.id];
        if (c.kind === 'policy' ? v === true : typeof v === 'number' && Number.isFinite(v)) placeCard(c, c.kind === 'policy' ? true : v, instant);
        else removeCard(c, instant);
      }
      refresh({ instant });
      state.applying = false;
    }

    // ── 사진 자세 ──
    const MID = Object.fromEntries(TECH.map(t => [t.id, t.levels[1]]));
    const MAX = { ...Object.fromEntries(TECH.map(t => [t.id, t.levels[2]])), ...Object.fromEntries(POL.map(p => [p.id, true])) };
    const shots = {
      wide: { ...VIEW.wide },
      table: { ...VIEW.table },
      table_max: { ...VIEW.table },
      screen: { ...VIEW.screen },
      issue: { ...VIEW.issue, t: 1.2, freeze: true },
    };
    function onShot(name) {
      cam = null;
      curView = VIEW[name === 'table_max' ? 'table' : name] || VIEW.table;
      syncViewBtns();
      state.applying = true;
      const set = name === 'table' ? {} : name === 'table_max' ? MAX : name === 'issue' ? { ...MID, nuclear: SC.TECH_CARDS.find(t => t.id === 'nuclear').levels[2] }
        : { ...MID, ndc: true, carbon_price: true };
      applyCards(set, true);
      state.issuesOpened = [];
      if (name === 'issue') openIssue('nuclear', true); else { state.issue = null; closeIssue(true); }
      hint('');
      state.applying = false;
    }

    kit.bake(S);

    return {
      scene, camera, shots, enterShot: null, onShot,
      state: () => ({ cards: { ...state.cards }, issue: state.issue, open: state.open, T2100: SUM ? +SUM.T2100.toFixed(3) : null,
        diorama: SUM ? dioramaState(SUM) : null, sets: sets.map(s => s.n) }),   // 검사·콘솔 확인용(읽기만)
      onEnter(info) {
        ui.hidden = false;
        if (info.shot) return;
        loadSaved();
        setView(VIEW.door);
        moveView(VIEW.table, 1200);   // 문 → 탁자 위 1.2초
        flash(state.visited ? '' : '2050년 우리 사회를 설계해 보세요. 카드를 모형 옆 칸에 놓으면 미래가 바뀌어요.', 5200);
        state.visited = true;
      },
      onExit() { ui.hidden = true; hint(''); for (const c of cards) kit.stop(c.mesh); },
      update(dt, clock) {
        updateCam(dt);
        if (state.dirtyAt >= 0) { state.dirtyAt += dt; if (state.dirtyAt >= 0.1) { state.dirtyAt = -1; refresh({ keepList: true }); state.dirtyAt = -1; } }
        for (const s of sets) s.update(dt, clock);
      },
      hover(obj, on) {
        if (!on) { if (!hintTimer) hint(''); return; }
        const card = obj.userData.card;
        if (card) {
          const r = card.kind === 'policy' ? (card.placed ? '누르면 빼요' : '누르면 정책 칸에 놓아요')
            : (() => { const n = nextPress(card.def, card.placed, card.shown, card.max, card.blocked); return n.action === 'remove' ? '누르면 빼요' : n.action === 'locked' ? '3단계는 잠겨 있어요' : `누르면 ${n.level}단계`; })();
          clearTimeout(hintTimer); hintTimer = 0;
          hint(`${obj.userData.pick.label} · ${r}`);
        } else if (obj === board) hint(state.open ? '쟁점 판 — 누르면 가까이 보기' : '쟁점 판 — 쟁점 카드를 놓으면 펼쳐져요');
        else hint(`${obj.userData.pick.label} — 누르면 가까이 보기`);
      },
      pick(obj) {
        const card = obj.userData.card;
        if (card) { press(card); return; }
        if (obj === board) { if (state.issue && !state.open) openIssue(state.issue); moveView(curView === VIEW.issue ? VIEW.table : VIEW.issue); return; }
        if (screens.includes(obj)) moveView(curView === VIEW.screen ? VIEW.table : VIEW.screen);
      },
      key(e) {
        const f = FPStage.focused, card = f && f.userData && f.userData.card;
        const n = { Digit1: 1, Numpad1: 1, Digit2: 2, Numpad2: 2, Digit3: 3, Numpad3: 3 }[e.code];
        if (card && n) { setLevel(card, n); return true; }
        if (card && (e.code === 'Digit0' || e.code === 'Numpad0' || e.code === 'Delete' || e.code === 'Backspace')) { removeCard(card); refresh(); return true; }
        return false;
      },
    };
  }
  let NONE_RUN = null;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // 등록 — 덮개 제목 · 노출(회의실 1.0 — 🧑 조정)
  if (typeof FPStage !== 'undefined') {
    let W = null;
    FPStage.register('council', {
      title: TITLE, exposure: 1.0,
      build,
      world(w) { W = world(w); return W; },
      onWorldYear(year, city) { if (W && W.apply) W.apply(year, city); },
    });
  }
  return { TITLE, HALL, ROLES, TREE_BASE, MOVE_MS, levelOf, nextPress, fmtValue, verdict, summary, dioramaState, policyText, keyNames };
})();
