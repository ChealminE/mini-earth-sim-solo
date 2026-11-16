// ============================================================================
// 1인칭 미니게임 ② 분리배출장 (4차 M3) — 쓰레기를 준비(비우기·헹구기·라벨 떼기…)하고 맞는 수거함에 넣는다
// ----------------------------------------------------------------------------
// 두 부분을 맡는다.
//   ① 세계 속 외관(world): 교차로 동쪽 보도, 카페(초록잔 카페) 남쪽 옆 빈터(cityGroup 로컬 (0.215, 0.27))에 지붕 있는 배출장 —
//      철골 기둥 + 반투명 지붕판 + 콘크리트 바닥 + 수거함 줄 + 간판. 앞(열린 쪽)은 교차로(−x)를 본다. 크기 약 5 × 3 m, 높이 2.6 m.
//      드로우콜 +4(정점색으로 합친 틀·수거함 1 + 그림자 1 · 지붕 1 · 간판 1, ≤ 8). 도시 규모가 2000년 수준 이상인 해에만 보이고(카페와 같은 규칙),
//      들어갈 수 있는 것은 현재(NOW_YEAR)뿐이다(M §0-3). 자리는 큰길·교차로·충전소(z 0.085)·카페 화분과 겹치지 않는다.
//   ② 무대(build): 미터 축척 약 5 × 3 m. 수거함 9개(왼쪽부터 숫자 1~9 — 몸체·앞판·이름표를 정점색 + 표지 그림 한 장으로 합쳐 수거함마다 메시 1,
//      경첩 뚜껑 9개는 인스턴싱 1) · 스테인리스 작업대(개수대 + 수도꼭지 물줄기 · 고무 매트 · 가위) · 쓰레기 상자 · 벽 안내판(분리배출 4원칙) · 화분.
// 흐름(M §3-4): 상자에서 품목이 작업대로 떠오른다(0.5초, 천천히 돈다 — 빈 곳을 끌면 돌려 볼 수 있다) → 준비 단추 6개(정답을 알려 주지 않게 늘 6개 다)
//   → 품목을 끌어 수거함 위에 놓거나(위에 오면 뚜껑이 살짝 열림) 숫자 1~9 · Tab+Enter → 포물선으로 들어간다
//   → 판정: 맞음 = 뚜껑 닫힘 + 초록 테두리 + ✔ + '맞아요' / 틀림 = 튕겨 나와 작업대로 + 빨간 테두리 + ✕ + 이유 + [다시 넣기] / 준비 빠짐 = 반점(0.5)
//   → 10개가 끝나면 끝 화면(표 · 정확도 · 88 kg × 정확도 · 크기 막대 · [한 판 더] [나가기]).
//   흐름은 시간표(later)로 돈다 — Promise 를 쓰면 사진 자세의 '시간 고정'(FPStage 가 update 를 동기로 여러 번 부름)에서 멈춘다(카페와 같은 까닭).
// 품목·정답·이유는 firstperson/fp-recycle-items.js(RecycleItems — 선생님이 고치는 파일). 모양은 이 파일 MODELS(이름 = 품목의 model).
// 숫자: 분리배출 88 kg · 대중교통 285.4 kg · 장거리 비행 1,000 kg 은 ActionsCore 값 그대로. 정확도 → kg 은 RecycleItems.kgFor(등록부 recycle_accuracy, 연출).
// 결과 연결: 카페에서 들고 나온 일회용 컵(fp.actions.carry 'takeout_cup')이 있으면 첫 품목으로 쓰고 carry 에서 지운다.
//   판 결과는 lastResult · onRound 로 내보내고, 등록할 때 onRound 에 FPActions.recordRecycle 을 건다(M4) — 기록 한 줄(minigameLog.recycle)
//   + '나의 행동' 분리배출 = 88 kg × 이 판 정확도(D13 '체험해야 켜짐'). 사진 자세에서는 부르지 않는다.
// 사진 자세(M §3-6): wide · bench · label(라벨 벗기는 중 0.35초 고정) · throw(포물선 중간) · summary(끝 화면). /firstperson/?stage=recycle&shot=wide
// 효과음 없음(D12). 외부 파일 0(D11). 실존 브랜드·지자체 로고 없음(M §0-2) — 포장 인쇄는 품목 종류 낱말과 단순 무늬만.
// 모듈을 읽을 때는 등록만 한다(DOM·THREE 는 build·world 안에서만 — 마스터 §6-10).
// ============================================================================
const FPStageRecycle = (() => {
  const TITLE = '분리배출장';
  const NOW = () => (typeof FPModel !== 'undefined' ? FPModel.NOW_YEAR : 2026);
  // 세계 쪽 자리(cityGroup 로컬, 유닛 — 1유닛 = 50 m). 앞(열린 쪽) = −x(교차로), 길이 5 m = z 방향, 깊이 3 m = x 방향
  const SPOT = { x: 0.215, z: 0.27, len: 0.1, dep: 0.06, h: 0.052 };
  // 사진 자세에서 쓰는 고정 판(같은 주소 = 같은 화면). 함정 5개(간장 페트·컵라면·아이스팩·깨진 유리컵·은박 에어캡)
  const roundListeners = [];   // 판이 끝날 때 결과를 받을 함수들(M4: '나의 행동'·학습지 기록)
  const FIXED_ROUND = ['water_pet', 'soy_pet', 'milk_carton', 'ramen_cup', 'box', 'can', 'ice_pack', 'snack_bag', 'broken_glass', 'foil_bubble'];

  // ── 크기 비교 막대 (§0-1) — ActionsCore 값 그대로. 분리배출은 이번 판 kg ─────────
  function compareRows(kg) {
    const A = id => ActionsCore.ACTIONS.find(a => a.id === id);
    return [
      { id: 'recycle', label: '분리배출 (이번 판)', kg, src: 'recycle_accuracy' },
      { id: 'transit', label: '대중교통 1년', kg: A('transit').kgPerYear, src: A('transit').src },
      { id: 'flight', label: '장거리 비행 1번', kg: A('flight').kgPerYear, src: A('flight').src },
    ];
  }

  // ── 준비를 할 수 있나 (모양이 가진 부속) — node 검사가 품목 데이터와 맞춰 본다 ─────
  // has: label(떼어 낼 라벨 띠) · parts(빨대·뚜껑·은박 같은 부속) · tape(송장·테이프) · content(안에 든 것 — 비우면 사라짐)
  const MODEL_HAS = {
    waterPet: ['label', 'content'], soyPet: ['content'], oilPet: ['content'], yogurt: ['parts', 'content'], can: ['content'],
    glassBottle: ['content'], brokenGlass: [], box: ['tape'], milkCarton: ['content'], aseptic: ['parts', 'content'],
    oilPaper: [], ramenCup: [], styroBlock: [], sashimiTray: ['content'], woodlock: [], snackBag: ['content'], foilBubble: [],
    icePack: [], toothbrush: [], mayo: ['content'], dirtyVinyl: [], takeoutCup: ['parts', 'content'], label: [],
  };
  const MODEL_NAMES = Object.keys(MODEL_HAS);
  function canDo(item, prep) {
    if (!item) return false;
    if ((item.cant || []).includes(prep)) return false;
    const has = MODEL_HAS[item.model] || [];
    if (prep === 'label' || prep === 'parts' || prep === 'tape') return has.includes(prep);
    return true;
  }
  const CANT_WHY = { label: '떼어 낼 라벨이 없어요', parts: '떼어 낼 부속이 없어요', tape: '뗄 송장·테이프가 없어요', flatten: '납작하게 누를 수 없어요' };
  const cantText = prep => `이 품목은 할 수 없어요 — ${CANT_WHY[prep] || '모양이 맞지 않아요'}`;

  // ── 캔버스 그림 도우미 ──────────────────────────────────────────────────
  const fontOf = (name, fallback) => {
    try { return (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback; } catch (e) { return fallback; }
  };
  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // 수거함 그림 기호(선 그림 — 지자체 표지를 따라 그리지 않는다). s = 크기(px), 가운데 (x, y)
  function drawIcon(c, kind, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s / 100, s / 100);
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 6; c.lineJoin = 'round'; c.lineCap = 'round';
    const P = pts => { c.beginPath(); pts.forEach(([a, b], i) => (i ? c.lineTo(a, b) : c.moveTo(a, b))); };
    if (kind === 'bottle') {
      P([[-8, -46], [8, -46], [8, -34], [20, -18], [20, 42], [-20, 42], [-20, -18], [-8, -34]]); c.closePath(); c.stroke();
      c.fillRect(-10, -54, 20, 8); c.strokeRect(-20, -2, 40, 18);
    } else if (kind === 'tub') {
      P([[-34, -22], [34, -22], [26, 40], [-26, 40]]); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-40, -30); c.lineTo(40, -30); c.stroke();
      c.beginPath(); c.arc(0, 10, 10, 0, Math.PI * 2); c.stroke();
    } else if (kind === 'bag') {
      P([[-30, -20], [30, -20], [36, 42], [-36, 42]]); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-16, -20); c.bezierCurveTo(-16, -52, 16, -52, 16, -20); c.stroke();
    } else if (kind === 'can') {
      c.beginPath(); c.ellipse(0, -36, 24, 7, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.moveTo(-24, -36); c.lineTo(-24, 36); c.ellipse(0, 36, 24, 7, 0, Math.PI, 0, true); c.lineTo(24, -36); c.stroke();
      c.beginPath(); c.moveTo(-24, -6); c.lineTo(24, -6); c.moveTo(-24, 10); c.lineTo(24, 10); c.stroke();
    } else if (kind === 'glass') {
      P([[-6, -50], [6, -50], [6, -24], [18, -8], [18, 44], [-18, 44], [-18, -8], [-6, -24]]); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-10, 6); c.lineTo(-10, 30); c.stroke();
    } else if (kind === 'paper') {
      c.strokeRect(-30, -40, 52, 70); c.strokeRect(-20, -30, 52, 70);
      c.beginPath(); for (const yy of [-14, 0, 14]) { c.moveTo(-10, yy); c.lineTo(22, yy); } c.stroke();
    } else if (kind === 'carton') {
      P([[-22, -20], [0, -46], [22, -20], [22, 44], [-22, 44]]); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-22, -20); c.lineTo(22, -20); c.moveTo(-6, -52); c.lineTo(6, -40); c.stroke();
    } else if (kind === 'styro') {
      P([[-38, -10], [-10, -30], [38, -30], [38, 22], [10, 42], [-38, 42]]); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-38, -10); c.lineTo(10, -10); c.lineTo(38, -30); c.moveTo(10, -10); c.lineTo(10, 42); c.stroke();
      for (const [a, b] of [[-26, 8], [-14, 24], [-28, 30], [-6, 6]]) { c.beginPath(); c.arc(a, b, 3, 0, Math.PI * 2); c.fill(); }
    } else {   // trash — 묶은 봉투
      P([[-30, -8], [30, -8], [36, 42], [-36, 42]]); c.closePath(); c.stroke();
      c.beginPath(); c.moveTo(-10, -8); c.lineTo(-18, -34); c.moveTo(10, -8); c.lineTo(18, -34); c.moveTo(-14, -18); c.lineTo(14, -18); c.stroke();
    }
    c.restore();
  }
  // 재활용 화살표 세 개(일반 기호) — 간판·안내판
  function drawLoop(c, x, y, r, col) {
    c.save(); c.translate(x, y); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = r * 0.16; c.lineCap = 'round';
    for (let k = 0; k < 3; k++) {
      c.rotate(Math.PI * 2 / 3);
      c.beginPath(); c.arc(0, 0, r, -0.95, 0.35); c.stroke();
      const a = 0.35, ex = Math.cos(a) * r, ey = Math.sin(a) * r;
      c.beginPath(); c.moveTo(ex + Math.cos(a + 1.2) * r * 0.32, ey + Math.sin(a + 1.2) * r * 0.32); c.lineTo(ex - Math.cos(a) * r * 0.24, ey - Math.sin(a) * r * 0.24);
      c.lineTo(ex + Math.cos(a) * r * 0.24, ey + Math.sin(a) * r * 0.24); c.closePath(); c.fill();
    }
    c.restore();
  }

  // ============================================================================
  // ① 세계 속 외관
  // ============================================================================
  // 지오메트리에 한 색을 칠한다(정점색 — 여러 부품을 한 메시로 합쳐도 색이 남는다)
  function paint(geo, hex) {
    const c = new THREE.Color(hex), n = geo.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
  }
  function world(w) {
    if (!w.scene || typeof FPWorld === 'undefined' || !FPWorld.buildings || !FPWorld.buildings.length || !w.kit) return {};
    const kit = w.kit, U = 1 / 50;
    const city = FPWorld.buildings[0].mesh.parent, GB = FPWorld.GROUND_BASE, ZW = FPWorld.ZONE_W;
    const group = new THREE.Group();
    group.name = 'recycleFront';
    city.add(group);
    const front = SPOT.x - SPOT.dep / 2, back = SPOT.x + SPOT.dep / 2, z0 = SPOT.z - SPOT.len / 2, z1 = SPOT.z + SPOT.len / 2;
    const parts = [];
    const add = (geo, hex, x, y, z) => { geo.translate(x, y, z); parts.push(paint(geo, hex)); };
    const STEEL = 0x3b3f44, H = 2.6 * U;
    add(kit.roundedBox(3.3 * U, 0.1 * U, 5.4 * U, 0.02 * U), 0x9d9b95, SPOT.x, GB + 0.05 * U, SPOT.z);            // 바닥 콘크리트
    for (const x of [front + 0.05 * U, back - 0.05 * U]) for (const z of [z0 + 0.05 * U, z1 - 0.05 * U]) add(kit.roundedBox(0.1 * U, H, 0.1 * U, 0.02 * U), STEEL, x, GB + H / 2, z);
    for (const x of [front + 0.05 * U, back - 0.05 * U]) add(kit.roundedBox(0.12 * U, 0.16 * U, SPOT.len, 0.02 * U), STEEL, x, GB + H - 0.08 * U, SPOT.z);
    add(kit.roundedBox(0.06 * U, 1.15 * U, SPOT.len - 0.2 * U, 0.01 * U), STEEL, back - 0.06 * U, GB + 0.65 * U, SPOT.z);   // 뒤판(수거함 뒤)
    const B = RecycleItems.RECYCLE_BINS, pitch = (SPOT.len - 0.4 * U) / B.length;
    B.forEach((id, i) => {
      const z = z0 + 0.2 * U + pitch * (i + 0.5), x = back - 0.42 * U;
      add(kit.roundedBox(0.6 * U, 1.0 * U, pitch * 0.9, 0.03 * U), STEEL, x, GB + 0.6 * U, z);                       // 몸체
      add(kit.roundedBox(0.02 * U, 0.75 * U, pitch * 0.78, 0.008 * U), RecycleItems.BIN_INFO[id].color, x - 0.31 * U, GB + 0.55 * U, z);   // 앞판(색)
    });
    const frame = new THREE.Mesh(FPStageKit.mergeGeometries(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.15 }));
    frame.castShadow = true; frame.receiveShadow = true;
    group.add(frame);
    // 지붕판: 청동빛 반투명(transmission 아님 — 세계에 투명 패스를 더하지 않는다, 마스터 §6-15)
    const roof = new THREE.Mesh(kit.roundedBox(3.5 * U, 0.04 * U, 5.6 * U, 0.01 * U),
      new THREE.MeshStandardMaterial({ color: 0x8a6a48, roughness: 0.25, metalness: 0.1, transparent: true, opacity: 0.6, depthWrite: false }));
    roof.position.set(SPOT.x - 0.1 * U, GB + H + 0.03 * U, SPOT.z);
    roof.renderOrder = 2;
    group.add(roof);
    // 간판(앞 보 위): '분리배출장' + 재활용 화살표. 지자체 로고 없음
    const titleFont = fontOf('--font-title', 'serif');
    const signTex = kit.canvasTex((c, W, Hh) => {
      c.fillStyle = '#33373c'; c.fillRect(0, 0, W, Hh);
      c.fillStyle = '#f2f0ea'; c.font = `700 ${Hh * 0.62}px ${titleFont}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('분리배출장', W * 0.52, Hh * 0.54);
      drawLoop(c, W * 0.18, Hh * 0.5, Hh * 0.3, '#9fd3a8');
    }, 1024, 128);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(SPOT.len * 0.8, 0.42 * U), new THREE.MeshStandardMaterial({ map: signTex, emissiveMap: signTex, emissive: 0xffffff, emissiveIntensity: 0.25, roughness: 0.6 }));
    sign.rotation.y = -Math.PI / 2;
    // 지붕판 앞 끝(앞 기둥보다 0.35 m 앞) 바로 앞, 지붕 위로 선다 — 지붕 뒤에 두면 반투명 판에 가려 흐려졌다
    sign.position.set(SPOT.x - 1.88 * U, GB + H + 0.29 * U, SPOT.z);
    group.add(sign);
    // 충돌: 수거함 쪽(뒤 절반)만 — 앞 절반은 지붕 아래 들어설 수 있다. 보일 때만(tech-world 의 boxOn 과 같은 방식)
    const box = { on: { minX: ZW + SPOT.x - 0.004, maxX: ZW + back, minZ: z0, maxZ: z1, top: GB + H + 0.06 * U } };
    const boxOn = on => { if (on) Object.assign(box, box.on); else { box.minX = box.maxX = box.minZ = box.maxZ = 1e9; box.top = -Infinity; } };
    boxOn(false);
    FPWorld.boxes.push(box);
    const LEVEL_2000 = (() => {
      try { return EarthVisual.cityLevel(FPModel.sample(2000, FPModel.pathRun(FPModel.BASE_PRESET)).cumFossilMax || 0); } catch (e) { return 0; }
    })();
    let shown = false;
    FPStage.addDoor({
      id: 'recycle', stage: 'recycle', label: '분리배출하기',
      pos: new THREE.Vector3(ZW + front - 0.004, GB + 0.024, SPOT.z), radius: 0.07,
      visible: () => shown,
      canEnter: () => (typeof FPScenario !== 'undefined' && FPScenario.year === NOW() ? true : `현재(${NOW()})로 가야 들어갈 수 있어요`),
      // 나오면 배출장 앞 1.25 m, 교차로(−x) 쪽을 본다
      from: () => ({ x: ZW + front - 0.025, y: FPPlayer.pos.y, z: SPOT.z, yaw: -Math.PI / 2, pitch: -0.05 }),
    });
    group.visible = false;
    return {
      group, levelFrom: LEVEL_2000,
      apply(year, cityState) {
        shown = !!(cityState && cityState.level >= LEVEL_2000 - 1e-9);
        group.visible = shown;
        boxOn(shown);
      },
    };
  }

  // ============================================================================
  // 품목 모양 (미터 축척 — 원점 = 바닥 가운데). make(kit, mats, tex) → { g, parts: { label, parts[], tape[] }, content, flat }
  // ============================================================================
  // 품목 인쇄(가상 — 종류 낱말과 단순 무늬만). 회전체 라벨 띠는 u = 둘레라 글자를 가운데(u 0.5)에 쓰고 띠를 π 돌려 앞에 오게 한다
  const PRINT = {
    water: { bg: '#e9f4fb', band: '#2f7fb8', word: '생수', sub: '먹는샘물 500 mL', ink: '#16466b' },
    soy: { bg: null, band: '#7a2a1c', word: '진간장', sub: '양조간장 900 mL', ink: '#f4e6d0' },
    oil: { bg: null, band: '#b7861b', word: '식용유', sub: '콩기름 900 mL', ink: '#3b2a05' },
    yogurt: { bg: '#fdf6ec', band: '#d9443c', word: '요구르트', sub: '65 mL', ink: '#7a1d17' },
    can: { bg: '#1f7a6a', band: '#f2efe4', word: '사이다', sub: '355 mL', ink: '#ffffff' },
    milk: { bg: '#f7fbff', band: '#3a76c4', word: '우유', sub: '1,000 mL', ink: '#173a6a' },
    aseptic: { bg: '#f3ead5', band: '#7f9d3a', word: '두유', sub: '190 mL', ink: '#344315' },
    ramen: { bg: null, band: '#d0352c', word: '컵라면', sub: '', ink: '#d0352c' },
    snack: { bg: '#e8b33a', band: '#c2412b', word: '감자칩', sub: '', ink: '#5a1d10' },
    ice: { bg: null, band: '#2f7fb8', word: '아이스팩', sub: '냉장 보관', ink: '#1e4f78' },
    mayo: { bg: null, band: '#c2412b', word: '마요네즈', sub: '', ink: '#a3301f' },
  };

  // ============================================================================
  // ② 무대
  // ============================================================================
  function build(kit, ctx) {
    const RI = RecycleItems, BINS = RI.RECYCLE_BINS;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xc9d8e2);
    const camera = new THREE.PerspectiveCamera(52, 1, 0.03, 40);
    const bodyFont = fontOf('--font-body', 'sans-serif'), titleFont = fontOf('--font-title', 'serif');
    const DECK = 0.02, BENCH_Y = 0.92;
    const D = s => (ctx.reducedMotion ? Math.min(s, 0.1) : s);   // 움직임 줄이기면 시간표도 0.1초로

    // 조명: 바깥 지붕 아래 — 하늘빛 반구광이 크고, 주광은 지붕판을 지난 낮빛(앞 왼쪽 위). 점광 1(작업대 위 등)
    kit.lightRig(scene, {
      size: [5.6, 3.6], center: [0, -0.3],
      sun: { dir: [-0.5, 1, 0.75], intensity: 2.1, color: 0xfff3e4 },
      hemi: { sky: 0xe4eef6, ground: 0x7d7a72, intensity: 0.85 },
      points: [{ pos: [0, 2.35, 0.2], color: 0xfff2dc, intensity: 1.4, distance: 3.5 }],
      env: { wall: 0xd8e2e8, floor: 0x6f6d68, band: 0x3e4247, ceiling: 0xf4f6f8,
        panels: [{ pos: [0, 6, 0], size: [6, 3], color: 0xffffff, intensity: 4 }, { pos: [-6.5, 1.6, 2], size: [3, 2.4], color: 0xf2f7ff, intensity: 3.5 },
          { pos: [4, 1.6, 6.5], size: [4, 2.2], color: 0xf4f8ff, intensity: 3 }, { pos: [6.5, 2, -3], size: [2, 1.6], color: 0xfff1dc, intensity: 2 }] },
    });

    const S = new THREE.Group(); S.name = 'static'; scene.add(S);
    const M = (geo, mat, o = {}) => kit.mesh(geo, mat, { parent: S, ...o });
    const rb = (w, h, d, r, seg, uvm) => kit.roundedBox(w, h, d, r, seg, uvm);

    // ── 바닥 · 배출장 틀 ──
    const paving = kit.matOf('tile', { noise: { count: 8, color1: '#b9b6ae', color2: '#a7a39a', altShare: 0.35, groutColor: '#7c786f', gloss: 0.7 } });
    M(rb(9, 0.06, 7, 0.01, 2, 2), paving, { pos: [0, -0.03, 0.6], cast: false });
    // 철판 바닥(무늬 강판 느낌 — 헤어라인 금속을 짙게)
    const deckMat = kit.matOf('brushedSteel', { color: 0x9aa0a6, repeat: [6, 6], noise: { rough: 0.42 } });
    M(rb(5.3, DECK, 3.2, 0.008, 2), deckMat, { pos: [0, DECK / 2, -0.1], cast: false });
    const frameMat = kit.matOf('plasticMatte', { color: 0x3b3f44, roughness: 0.42 });
    for (const x of [-2.6, 2.6]) for (const z of [-1.62, 1.42]) M(rb(0.1, 2.7, 0.1, 0.012), frameMat, { pos: [x, 1.35, z] });
    for (const z of [-1.62, 1.42]) M(rb(5.3, 0.16, 0.12, 0.012), frameMat, { pos: [0, 2.66, z] });
    for (const x of [-2.6, 2.6]) M(rb(0.12, 0.12, 3.1, 0.012), frameMat, { pos: [x, 2.66, -0.1] });
    for (const x of [-1.3, 0, 1.3]) M(rb(0.06, 0.08, 3.1, 0.01), frameMat, { pos: [x, 2.72, -0.1], cast: false });   // 지붕 서까래
    // 뒤판(수거함 뒤, 아래 1.1 m) + 위쪽 안내판 셋(가운데 = 4원칙, 양옆 = 바깥이 비치는 빈 틀)
    M(rb(5.1, 1.1, 0.05, 0.01), frameMat, { pos: [0, 0.57, -1.6], cast: false });
    // 지붕판(청동빛 반투명). transmission 이 아니라 일반 투명 — 머리 위라 굴절이 필요 없다(마스터 §6-15)
    const roof = M(rb(5.5, 0.025, 3.4, 0.006), new THREE.MeshStandardMaterial({ color: 0x86684a, roughness: 0.2, metalness: 0.05, transparent: true, opacity: 0.55, depthWrite: false }),
      { pos: [0, 2.78, -0.1], cast: false });
    roof.renderOrder = 2;
    // 왼쪽 옆판(반 높이)
    M(rb(0.04, 1.1, 2.8, 0.01), frameMat, { pos: [-2.62, 0.57, -0.2], cast: false });

    // 바깥 배경: 하늘 + 나무·건물 실루엣(밝기를 낮춰 노출이 하얗게 타지 않게, Q5)
    const outside = kit.canvasTex((c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#a9c6dc'); g.addColorStop(0.55, '#dbe6ec'); g.addColorStop(1, '#c4c0b6');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const bl = [[0.0, 0.34, 0.16], [0.2, 0.42, 0.12], [0.62, 0.3, 0.18], [0.84, 0.4, 0.16]];
      for (const [x, y, w] of bl) { c.fillStyle = '#b9c0c6'; c.fillRect(x * W, y * H, w * W, (0.78 - y) * H);
        c.fillStyle = '#9ea8b0'; for (let k = 0; k < 7; k++) for (let j = 0; j < 3; j++) c.fillRect((x + 0.015 + j * w / 3.1) * W, (y + 0.03 + k * 0.05) * H, w * W * 0.2, H * 0.022); }
      c.fillStyle = '#6f8c58';
      for (let k = 0; k < 14; k++) { const x = (k * 0.077 + 0.02) % 1; c.beginPath(); c.ellipse(x * W, (0.6 + (k % 3) * 0.03) * H, (0.05 + (k % 4) * 0.012) * W, (0.12 + (k % 2) * 0.04) * H, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#8b877f'; c.fillRect(0, 0.78 * H, W, 0.22 * H);
    }, 2048, 768);
    M(new THREE.PlaneGeometry(20, 7.5), new THREE.MeshBasicMaterial({ map: outside, color: 0xd6d6d6 }), { pos: [0, 2.6, -6.5], cast: false, receive: false });

    // 가운데 안내판: 분리배출 4원칙(문헌값 5부 끝 — 환경부 원문 표기 확인 중, 등록부 rec_rules4)
    {
      const board = kit.canvasTex((c, W, H) => {
        c.fillStyle = '#f4f1e8'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#2f6b45'; c.fillRect(0, 0, W, H * 0.24);
        drawLoop(c, W * 0.1, H * 0.12, H * 0.07, '#e8f3ea');
        c.fillStyle = '#ffffff'; c.font = `700 ${H * 0.13}px ${titleFont}`; c.textAlign = 'left'; c.textBaseline = 'middle';
        c.fillText('분리배출 4원칙', W * 0.17, H * 0.125);
        const words = ['비우기', '헹구기', '분리하기', '섞지 않기'];
        words.forEach((t, i) => {
          const x = W * (0.13 + i * 0.245), y = H * 0.6;
          c.fillStyle = '#2f6b45'; c.beginPath(); c.arc(x, y - H * 0.06, H * 0.11, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#fff'; c.font = `700 ${H * 0.12}px ${bodyFont}`; c.textAlign = 'center'; c.fillText(String(i + 1), x, y - H * 0.055);
          c.fillStyle = '#1d2025'; c.font = `700 ${H * 0.11}px ${bodyFont}`; c.fillText(t, x, y + H * 0.17);
        });
        c.fillStyle = '#4b5057'; c.font = `500 ${H * 0.06}px ${bodyFont}`; c.textAlign = 'center';
        c.fillText('수거함마다 이름과 그림을 보고 넣어 주세요', W / 2, H * 0.93);
      }, 2048, 900);
      M(rb(1.9, 0.92, 0.05, 0.012), frameMat, { pos: [0, 1.72, -1.6] });
      M(new THREE.PlaneGeometry(1.8, 0.81), new THREE.MeshStandardMaterial({ map: board, roughness: 0.7 }), { pos: [0, 1.72, -1.573], cast: false });
      // 양옆: 철망 울타리(세로 살) — 뒤의 나무·건물이 비쳐 보이게. 살은 인스턴싱 1
      const bar = new THREE.InstancedMesh(rb(0.022, 1.02, 0.022, 0.006, 2), frameMat, 2 * 22);
      const m4 = new THREE.Matrix4();
      for (let k = 0; k < 44; k++) { const side = k < 22 ? -1 : 1, j = k % 22; bar.setMatrixAt(k, m4.makeTranslation(side * (1.02 + j * 0.068), 1.63, -1.6)); }
      bar.castShadow = false; bar.receiveShadow = true;
      scene.add(bar);
      for (const x of [-1.75, 1.75]) for (const y of [1.12, 2.14]) M(rb(1.5, 0.05, 0.05, 0.01), frameMat, { pos: [x, y, -1.6], cast: false });
    }

    // ── 수거함 9개 ──
    // 몸체(짙은 철판) · 앞판(색) · 손잡이 · 이름표(표지 그림 한 장의 칸)를 정점색 + 같은 그림 한 장으로 합쳐 수거함마다 메시 1 —
    //   색 칸(정점색) 위에 그림의 흰 띠(오른쪽 끝 128 px)를 곱해 쓴다. 이름표 칸은 정점색 흰색 × 그림.
    const BIN_W = 0.5, BIN_D = 0.62, BIN_H = 1.0, PITCH = 0.54, BIN_Z = -1.2;
    const binX = i => (i - 4) * PITCH;
    const ATL = 2048, CELL = 640, WHITE_U = (ATL - 64) / ATL;
    const atlas = kit.canvasTex((c, W, H) => {
      c.fillStyle = '#ffffff'; c.fillRect(0, 0, W, H);
      BINS.forEach((id, i) => {
        const info = RI.BIN_INFO[id], cx = (i % 3) * CELL, cy = Math.floor(i / 3) * CELL;
        c.save(); c.translate(cx, cy);
        c.fillStyle = '#fbfaf6'; rrect(c, 14, 14, CELL - 28, CELL - 28, 36); c.fill();
        c.fillStyle = info.color; rrect(c, 14, 14, CELL - 28, 150, 36); c.fill(); c.fillRect(14, 120, CELL - 28, 44);
        // 숫자 키
        c.fillStyle = '#ffffff'; c.beginPath(); c.arc(92, 89, 52, 0, Math.PI * 2); c.fill();
        c.fillStyle = '#1d2025'; c.font = `800 74px ${bodyFont}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i + 1), 92, 93);
        c.fillStyle = '#ffffff'; c.font = `800 ${info.name.length > 4 ? 66 : 82}px ${bodyFont}`; c.textAlign = 'left';
        c.fillText(info.name, 162, 92);
        drawIcon(c, info.icon, CELL / 2, 370, 300, '#1d2025');
        if (info.sub) { c.fillStyle = '#3d434b'; c.font = `600 44px ${bodyFont}`; c.textAlign = 'center'; c.fillText(info.sub, CELL / 2, 570); }
        c.restore();
      });
    }, ATL, ATL);
    const binMat = new THREE.MeshStandardMaterial({ map: atlas, vertexColors: true, roughness: 0.5, metalness: 0.12 });
    const uvWhite = geo => { const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, WHITE_U, 0.5); return geo; };
    const bins = BINS.map((id, i) => {
      const info = RI.BIN_INFO[id];
      const parts = [];
      const add = (geo, hex, x, y, z) => { geo.translate(x, y, z); parts.push(paint(geo, hex)); };
      add(uvWhite(rb(BIN_W, BIN_H, BIN_D, 0.02, 3)), 0x41464c, 0, BIN_H / 2, 0);
      add(uvWhite(rb(BIN_W - 0.06, 0.82, 0.02, 0.008, 2)), info.color, 0, 0.47, BIN_D / 2 + 0.006);                   // 앞판(색)
      add(uvWhite(rb(0.12, 0.022, 0.03, 0.008, 2)), 0xb9bdc2, 0, 0.13, BIN_D / 2 + 0.024);                           // 아래 손잡이
      add(uvWhite(rb(BIN_W - 0.04, 0.03, 0.03, 0.008, 2)), 0x2c3035, 0, 0.012, 0);                                    // 아래 받침 띠(바닥과 맞닿는 곳이 어둡게)
      // 이름표: 앞판 위쪽 0.4 × 0.4 m
      const lab = new THREE.PlaneGeometry(0.4, 0.4);
      const col = i % 3, row = Math.floor(i / 3), uv = lab.attributes.uv;
      for (let k = 0; k < uv.count; k++) uv.setXY(k, (col * CELL + uv.getX(k) * CELL) / ATL, 1 - (row * CELL + (1 - uv.getY(k)) * CELL) / ATL);
      add(lab, 0xffffff, 0, 0.62, BIN_D / 2 + 0.0175);
      const g = new THREE.Group();
      g.position.set(binX(i), DECK, BIN_Z);
      const mesh = kit.mesh(FPStageKit.mergeGeometries(parts), binMat, { parent: g });
      mesh.name = 'bin:' + id;
      g.userData.pick = { label: `${i + 1} ${info.name}`, order: 10 + i, enabled: () => st.phase === 'item' };
      g.userData.bin = id;
      scene.add(g);
      return { id, i, g, lid: 0, lidTo: 0, info };
    });
    // 경첩 뚜껑 9개 = 인스턴싱 1(수거함이 들리거나 흔들려도 따라가게 프레임마다 행렬을 다시 만든다)
    const lidGeo = (() => {
      const a = paint(uvWhite(rb(BIN_W + 0.02, 0.035, BIN_D + 0.02, 0.01, 3)), 0x50565d);
      const slot = paint(uvWhite(rb(0.3, 0.008, 0.16, 0.004, 2)), 0x1f2226); slot.translate(0, 0.018, 0.12);
      const handle = paint(uvWhite(rb(0.16, 0.02, 0.025, 0.008, 2)), 0xb9bdc2); handle.translate(0, 0.004, BIN_D / 2 + 0.02);
      const g = FPStageKit.mergeGeometries([a, slot, handle]);
      g.translate(0, 0.0175, BIN_D / 2 + 0.01);   // 원점 = 경첩(뒤 위 모서리)
      return g;
    })();
    const lids = new THREE.InstancedMesh(lidGeo, binMat, BINS.length);
    lids.castShadow = true; lids.receiveShadow = true; lids.frustumCulled = false;
    lids.userData.pickThrough = true; lids.raycast = () => {};
    scene.add(lids);
    const _lm = new THREE.Matrix4(), _lh = new THREE.Matrix4(), _lr = new THREE.Matrix4();
    function updateLids(dt) {
      for (const b of bins) {
        b.lid += (b.lidTo - b.lid) * Math.min(1, dt * (b.lidTo > b.lid ? 14 : 10));
        b.g.updateMatrixWorld(true);
        _lh.makeTranslation(0, BIN_H, -BIN_D / 2 - 0.01);
        _lr.makeRotationX(-b.lid);
        _lm.copy(b.g.matrixWorld).multiply(_lh).multiply(_lr);
        lids.setMatrixAt(b.i, _lm);
      }
      lids.instanceMatrix.needsUpdate = true;
    }
    // 판정 테두리(앞판 둘레 — 맞음 초록 · 틀림 빨강 · 반점 주황). 색 + 기호(HTML ✔✕) + 움직임 + 문구를 함께(Q8)
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x2fa35a, toneMapped: false, transparent: true, opacity: 1 });
    const ring = new THREE.Mesh(kit.tube([[-0.24, 0.05, 0], [0.24, 0.05, 0], [0.24, 0.9, 0], [-0.24, 0.9, 0]], 0.012, { closed: true, tubular: 64, radial: 12 }), ringMat);
    ring.visible = false; ring.userData.pickThrough = true; ring.raycast = () => {};
    scene.add(ring);
    let ringT = 0;
    function flashRing(bin, kind) {
      const col = { ok: 0x2fa35a, half: 0xd9962b, bad: 0xd2333b }[kind];
      ringMat.color.setHex(col);
      ring.position.set(bin.g.position.x, DECK, BIN_Z + BIN_D / 2 + 0.03);
      ring.visible = true; ringT = 2.2; ringMat.opacity = 1;
    }

    // ── 작업대: 스테인리스 상판 + 개수대 + 수도꼭지 · 고무 매트 · 가위 ──
    const BX = 0, BZ = 0.2, BW = 2.6, BD = 0.66;
    // 작업대 스테인리스는 조금 어둡게 — 밝은 하늘 환경을 그대로 비추면 상판이 하얗게 탔다(Q5)
    const steel = kit.matOf('brushedSteel', { repeat: [4, 4], color: 0xaeb3b8 });
    const SINK = { x: 0.78, z: 0.2, w: 0.52, d: 0.38, depth: 0.2 };
    {
      const t = 0.035, y = BENCH_Y - t / 2;
      // 상판은 개수대 구멍 둘레 네 조각
      const xl = BX - BW / 2, xr = BX + BW / 2, sx0 = SINK.x - SINK.w / 2, sx1 = SINK.x + SINK.w / 2, sz0 = SINK.z - SINK.d / 2, sz1 = SINK.z + SINK.d / 2;
      M(rb(sx0 - xl, t, BD, 0.006), steel, { pos: [(xl + sx0) / 2, y, BZ] });
      M(rb(xr - sx1, t, BD, 0.006), steel, { pos: [(sx1 + xr) / 2, y, BZ] });
      M(rb(SINK.w, t, sz0 - (BZ - BD / 2), 0.006), steel, { pos: [SINK.x, y, (BZ - BD / 2 + sz0) / 2] });
      M(rb(SINK.w, t, BZ + BD / 2 - sz1, 0.006), steel, { pos: [SINK.x, y, (sz1 + BZ + BD / 2) / 2] });
      // 개수대: 바닥 + 네 벽 + 배수구
      const by = BENCH_Y - SINK.depth;
      M(rb(SINK.w, 0.012, SINK.d, 0.004), steel, { pos: [SINK.x, by, SINK.z], cast: false });
      M(rb(0.012, SINK.depth, SINK.d, 0.004), steel, { pos: [sx0 + 0.006, by + SINK.depth / 2, SINK.z], cast: false });
      M(rb(0.012, SINK.depth, SINK.d, 0.004), steel, { pos: [sx1 - 0.006, by + SINK.depth / 2, SINK.z], cast: false });
      M(rb(SINK.w, SINK.depth, 0.012, 0.004), steel, { pos: [SINK.x, by + SINK.depth / 2, sz0 + 0.006], cast: false });
      M(rb(SINK.w, SINK.depth, 0.012, 0.004), steel, { pos: [SINK.x, by + SINK.depth / 2, sz1 - 0.006], cast: false });
      M(kit.lathe([[0, 0], [0.035, 0], [0.04, 0.004], [0.03, 0.006], [0, 0.006]], 48, { sharp: true }), kit.mat.chrome, { pos: [SINK.x, by + 0.006, SINK.z], cast: false });
      // 앞 띠 · 다리 4 · 아래 선반
      M(rb(BW, 0.08, 0.03, 0.008), steel, { pos: [BX, BENCH_Y - 0.075, BZ + BD / 2 - 0.015] });
      for (const x of [xl + 0.06, xr - 0.06]) for (const z of [BZ - BD / 2 + 0.06, BZ + BD / 2 - 0.06]) M(rb(0.045, BENCH_Y - 0.06, 0.045, 0.008), steel, { pos: [x, (BENCH_Y - 0.06) / 2 + DECK, z] });
      M(rb(BW - 0.08, 0.025, BD - 0.1, 0.006), steel, { pos: [BX, 0.22, BZ] });
      // 수도꼭지(굽은 관, 크롬) + 손잡이
      M(kit.lathe([[0, 0], [0.03, 0], [0.032, 0.012], [0.02, 0.03], [0.018, 0.06]], 48), kit.mat.chrome, { pos: [SINK.x, BENCH_Y, BZ - BD / 2 + 0.07] });
      M(kit.tube([[SINK.x, BENCH_Y + 0.05, BZ - BD / 2 + 0.07], [SINK.x, BENCH_Y + 0.3, BZ - BD / 2 + 0.07], [SINK.x, BENCH_Y + 0.36, BZ - BD / 2 + 0.14],
        [SINK.x, BENCH_Y + 0.32, BZ - 0.06], [SINK.x, BENCH_Y + 0.27, BZ - 0.04]], 0.013, { tubular: 64 }), kit.mat.chrome);
      M(kit.tube([[SINK.x + 0.03, BENCH_Y + 0.12, BZ - BD / 2 + 0.07], [SINK.x + 0.1, BENCH_Y + 0.14, BZ - BD / 2 + 0.07]], 0.008, { tubular: 4 }), kit.mat.chrome);
    }
    const FAUCET = new THREE.Vector3(SINK.x, BENCH_Y + 0.262, BZ - 0.04);
    // 고무 매트 · 가위
    const rubber = kit.matOf('rubber', { color: 0x3d5a45 });
    M(rb(0.78, 0.012, 0.48, 0.004, 2), rubber, { pos: [-0.12, BENCH_Y + 0.006, BZ + 0.02] });
    {
      const blade = kit.matOf('brushedSteel', { repeat: [1, 1] });
      const handleM = kit.matOf('plasticMatte', { color: 0xc94a3a, roughness: 0.35 });
      const sc = new THREE.Group(); sc.position.set(0.32, BENCH_Y + 0.004, BZ - 0.18); sc.rotation.y = 0.5; S.add(sc);
      for (const s of [-1, 1]) {
        const b = kit.mesh(rb(0.13, 0.003, 0.016, 0.0015, 2), blade, { parent: sc, pos: [0.065, 0.002 + (s > 0 ? 0.003 : 0), 0], rot: [0, s * 0.12, 0] });
        void b;
        kit.mesh(new THREE.TorusGeometry(0.022, 0.006, 12, 48), handleM, { parent: sc, pos: [-0.03, 0.006, s * 0.022], rot: [Math.PI / 2, 0, 0] });
      }
      kit.mesh(kit.lathe([[0, 0], [0.005, 0], [0.005, 0.01], [0, 0.011]], 24, { far: true }), kit.mat.chrome, { parent: sc, pos: [0.01, 0, 0] });
    }
    // 쓰레기 상자(열린 골판지 상자 + 안에 구겨진 것들)
    const BOXP = new THREE.Vector3(-1.0, BENCH_Y, BZ + 0.02);
    {
      const card = kit.matOf('cardboard', { noise: { color: '#b48a5c', flutes: 40 } });
      const bw = 0.44, bh = 0.26, bd = 0.36, t = 0.008;
      M(rb(bw, t, bd, 0.003), card, { pos: [BOXP.x, BENCH_Y + t / 2, BOXP.z] });
      for (const s of [-1, 1]) {
        M(rb(t, bh, bd, 0.003), card, { pos: [BOXP.x + s * (bw / 2 - t / 2), BENCH_Y + bh / 2, BOXP.z] });
        M(rb(bw, bh, t, 0.003), card, { pos: [BOXP.x, BENCH_Y + bh / 2, BOXP.z + s * (bd / 2 - t / 2)] });
        // 바깥으로 젖힌 날개
        M(rb(bw, t, 0.16, 0.003), card, { pos: [BOXP.x, BENCH_Y + bh + 0.05, BOXP.z + s * (bd / 2 + 0.055)], rot: [s * 1.0, 0, 0] });
      }
      const fill = [[0xd9d4c8, -0.1, -0.06], [0x6f9fc2, 0.08, 0.05], [0xe0b04a, -0.04, 0.09], [0xf2f2ee, 0.12, -0.08]];
      fill.forEach(([col, x, z], k) => {
        const g = pillowGeo(0.15, 0.12, 0.03, 0.6, 30 + k);
        g.rotateX(-Math.PI / 2 + 0.3 * (k % 2 ? 1 : -1)); g.rotateY(k * 1.3);
        M(g, kit.matOf('plasticMatte', { color: col, roughness: 0.5 }), { pos: [BOXP.x + x, BENCH_Y + bh - 0.06, BOXP.z + z], cast: false });
      });
    }
    // 화분(오른쪽 앞)
    {
      const potM = kit.matOf('concrete', { noise: { color: '#a8a39a' } });
      const leafM = new THREE.MeshStandardMaterial({ color: 0x55703f, roughness: 0.8 });
      const pg = new THREE.Group(); pg.position.set(2.25, DECK, 0.95); S.add(pg);
      kit.mesh(kit.lathe([[0, 0], [0.18, 0], [0.22, 0.42], [0.235, 0.44], [0, 0.44]], 48, { sharp: true }), potM, { parent: pg });
      for (let k = 0; k < 9; k++) {
        const g = new THREE.SphereGeometry(0.14, 16, 10);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const f = 1 + 0.12 * Math.sin(p.getX(i) * 40 + k) * Math.cos(p.getZ(i) * 37); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 1.1, p.getZ(i) * f); }
        g.computeVertexNormals();
        const a = k * 2.4, r = k ? 0.13 : 0;
        kit.mesh(g, leafM, { parent: pg, pos: [Math.cos(a) * r, 0.58 + (k % 3) * 0.15, Math.sin(a) * r] });
      }
      kit.groundShadow(pg, 0.6, { y: DECK });
    }
    // 오른쪽 안내 기둥(재활용 기호 + '분리배출장')
    {
      const colTex = kit.canvasTex((c, W, H) => {
        c.fillStyle = '#2f6b45'; c.fillRect(0, 0, W, H);
        drawLoop(c, W / 2, H * 0.16, W * 0.26, '#eaf4ec');
        c.fillStyle = '#ffffff'; c.font = `700 ${W * 0.2}px ${titleFont}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        ['분', '리', '배', '출', '장'].forEach((ch, i) => c.fillText(ch, W / 2, H * (0.36 + i * 0.12)));
      }, 256, 1024);
      M(rb(0.32, 2.2, 0.32, 0.03), kit.matOf('plasticMatte', { color: 0x2f6b45, roughness: 0.4 }), { pos: [2.82, 1.1 + DECK, -1.2] });
      M(new THREE.PlaneGeometry(0.26, 1.04), new THREE.MeshStandardMaterial({ map: colTex, roughness: 0.5 }), { pos: [2.82, 1.45, -1.038], cast: false });
    }
    kit.bake(S);

    // ============================================================================
    // 품목 모양
    // ============================================================================
    const mats = {};
    const mat = (k, f) => mats[k] || (mats[k] = f());
    const texCache = {};
    // 인쇄 그림: 라벨 띠(회전체 — 가운데에 글자) · 판(봉지·상자 — 앞면 전체)
    function printTex(kind, mode = 'band') {
      const key = kind + mode;
      if (texCache[key]) return texCache[key];
      const p = PRINT[kind];
      const W = mode === 'band' ? 1024 : 512, H = mode === 'band' ? 256 : 512;
      return (texCache[key] = kit.canvasTex((c, w, h) => {
        if (p.bg) { c.fillStyle = p.bg; c.fillRect(0, 0, w, h); } else c.clearRect(0, 0, w, h);
        c.textAlign = 'center'; c.textBaseline = 'middle';
        if (mode === 'band') {
          if (p.bg) { c.fillStyle = p.band; c.fillRect(0, h * 0.08, w, h * 0.12); c.fillRect(0, h * 0.8, w, h * 0.12); }
          else { c.fillStyle = p.band; rrect(c, w * 0.32, h * 0.18, w * 0.36, h * 0.64, 18); c.fill(); }
          c.fillStyle = p.bg ? p.band : p.ink; c.font = `800 ${h * 0.34}px ${bodyFont}`; c.fillText(p.word, w / 2, h * 0.46);
          if (p.sub) { c.fillStyle = p.bg ? p.ink : p.ink; c.font = `600 ${h * 0.13}px ${bodyFont}`; c.fillText(p.sub, w / 2, h * 0.7); }
          // 뒤쪽 무늬(물결) — 빙 둘러 같은 그림이 아니게
          c.strokeStyle = p.band; c.globalAlpha = 0.5; c.lineWidth = 4;
          for (const u0 of [0.06, 0.82]) { c.beginPath(); for (let k = 0; k <= 30; k++) { const x = (u0 + k / 30 * 0.12) * w, y = h * (0.5 + 0.1 * Math.sin(k * 0.8)); k ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke(); }
          c.globalAlpha = 1;
        } else {
          c.fillStyle = p.band; c.globalAlpha = 0.9; c.fillRect(0, h * 0.06, w, h * 0.06); c.fillRect(0, h * 0.88, w, h * 0.06); c.globalAlpha = 1;
          c.fillStyle = p.ink; c.font = `800 ${w * 0.17}px ${bodyFont}`; c.fillText(p.word, w / 2, h * 0.42);
          if (p.sub) { c.font = `600 ${w * 0.07}px ${bodyFont}`; c.fillText(p.sub, w / 2, h * 0.62); }
          if (kind === 'snack') for (let k = 0; k < 7; k++) { c.fillStyle = '#f2d27a'; c.beginPath(); c.ellipse(w * (0.2 + (k % 4) * 0.2), h * (0.72 + Math.floor(k / 4) * 0.1), w * 0.07, h * 0.035, k, 0, Math.PI * 2); c.fill(); }
        }
      }, W, H));
    }
    // 인쇄 띠(회전체). 투명 바탕 인쇄(병에 직접 찍힌 글자)는 alphaTest — 뒤 정렬 문제를 피한다
    function band(profile, kind, o = {}) {
      const tex = printTex(kind, 'band'), clear = !PRINT[kind].bg;
      const m = new THREE.MeshStandardMaterial({ map: tex, roughness: o.rough == null ? 0.42 : o.rough, metalness: o.metal || 0, transparent: false, alphaTest: clear ? 0.5 : 0, side: THREE.DoubleSide });
      const mesh = kit.mesh(kit.lathe(profile, 64, { sharp: true, points: 24 }), m, { cast: !clear });
      mesh.rotation.y = Math.PI;   // 글자(u 0.5)가 앞(+z)으로
      return mesh;
    }
    // 홈 파인 뚜껑(둘레에 홈 n 개 — 반지름을 cos 로 흔든다)
    function ribbed(geo, n, amp, y0, y1) {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const y = p.getY(i); if (y < y0 || y > y1) continue;
        const x = p.getX(i), z = p.getZ(i), a = Math.atan2(x, z), k = 1 + amp * Math.cos(a * n);
        p.setX(i, x * k); p.setZ(i, z * k);
      }
      geo.computeVertexNormals();
      return geo;
    }
    const water = () => mat('water', () => new THREE.MeshStandardMaterial({ color: 0xbfe2f2, roughness: 0.05, transparent: true, opacity: 0.45, depthWrite: false }));
    const liquid = (k, col, op = 0.92) => mat('liq' + k, () => new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.08, transparent: op < 1, opacity: op, clearcoat: 1, clearcoatRoughness: 0.05, depthWrite: op >= 1 }));
    const plastic = (col, r = 0.4) => mat('pl' + col + r, () => kit.matOf('plasticMatte', { color: col, roughness: r }));
    const pet = () => mat('pet', () => kit.matOf('clearPET', { thickness: 0.002, roughness: 0.05 }));
    const glassG = () => mat('glassG', () => kit.matOf('glass', { thickness: 0.004, tint: 0x9fd8b0, tintDistance: 0.012 }));
    const glassC = () => mat('glassC', () => kit.matOf('glass', { thickness: 0.004 }));
    const foam = () => mat('foam', () => kit.matOf('concrete', { noise: { color: '#f4f3ee', seed: 21 } }));
    const foil = () => mat('foil', () => new THREE.MeshStandardMaterial({ color: 0xd9dde2, roughness: 0.3, metalness: 1 }));
    const PET_BOTTLE = [[0, 0.002], [0.022, 0], [0.03, 0.006], [0.033, 0.02], [0.033, 0.13], [0.031, 0.148], [0.018, 0.182], [0.0135, 0.194], [0.0135, 0.206]];
    const MODELS = {
      waterPet(o) {
        o.add(kit.mesh(kit.lathe(PET_BOTTLE, 64), pet()));
        const cap = kit.mesh(ribbed(kit.lathe([[0, 0], [0.0152, 0], [0.0155, 0.017], [0.013, 0.02], [0, 0.02]], 64, { sharp: true, points: 28 }), 32, 0.05, 0.002, 0.016), plastic(0x2f7fb8, 0.35));
        cap.position.y = 0.204; o.add(cap);
        o.label = band([[0.0336, 0.06], [0.0336, 0.118]], 'water', { rough: 0.35 }); o.add(o.label);
        o.content = kit.mesh(kit.lathe([[0, 0.004], [0.029, 0.004], [0.03, 0.045], [0, 0.045]], 48, { sharp: true }), water(), { cast: false }); o.add(o.content);
        o.top = 0.21;
      },
      soyPet(o) {
        const prof = [[0, 0.002], [0.026, 0], [0.034, 0.006], [0.036, 0.02], [0.036, 0.15], [0.033, 0.17], [0.017, 0.2], [0.014, 0.21], [0.014, 0.222]];
        o.add(kit.mesh(kit.lathe(prof, 64), pet()));
        o.add(band([[0.0362, 0.06], [0.0362, 0.13]], 'soy'));
        const cap = kit.mesh(ribbed(kit.lathe([[0, 0], [0.0165, 0], [0.017, 0.02], [0.012, 0.024], [0, 0.024]], 64, { sharp: true }), 24, 0.04, 0.002, 0.018), plastic(0xb4271c, 0.35));
        cap.position.y = 0.22; o.add(cap);
        o.content = kit.mesh(kit.lathe([[0, 0.004], [0.033, 0.004], [0.034, 0.06], [0, 0.06]], 48, { sharp: true }), liquid('soy', 0x2a0d05), { cast: false }); o.add(o.content);
        o.top = 0.24;
      },
      oilPet(o) {
        const prof = [[0, 0.002], [0.028, 0], [0.036, 0.008], [0.037, 0.03], [0.035, 0.12], [0.037, 0.2], [0.032, 0.22], [0.016, 0.245], [0.0145, 0.26]];
        o.add(kit.mesh(kit.lathe(prof, 64), pet()));
        o.add(band([[0.0372, 0.07], [0.0372, 0.15]], 'oil'));
        const cap = kit.mesh(kit.lathe([[0, 0], [0.018, 0], [0.019, 0.02], [0.014, 0.026], [0, 0.026]], 64, { sharp: true }), plastic(0xe0b21a, 0.35));
        cap.position.y = 0.256; o.add(cap);
        o.content = kit.mesh(kit.lathe([[0, 0.004], [0.034, 0.004], [0.034, 0.05], [0, 0.05]], 48, { sharp: true }), liquid('oil', 0xd9a520, 0.75), { cast: false }); o.add(o.content);
        o.top = 0.28;
      },
      yogurt(o) {
        const prof = [[0, 0.001], [0.016, 0], [0.02, 0.006], [0.021, 0.025], [0.016, 0.042], [0.018, 0.06], [0.0175, 0.075], [0.015, 0.078]];
        o.add(kit.mesh(kit.lathe(prof, 64), mat('yog', () => new THREE.MeshPhysicalMaterial({ color: 0xf6efe2, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2 }))));
        o.add(band([[0.0212, 0.008], [0.0212, 0.024]], 'yogurt'));
        const lid = new THREE.Group(); lid.position.y = 0.078;
        kit.mesh(kit.lathe([[0, 0], [0.0165, 0], [0.0172, 0.001], [0, 0.0015]], 64, { sharp: true }), foil(), { parent: lid });
        kit.mesh(rb(0.01, 0.0012, 0.008, 0.0004, 2), foil(), { parent: lid, pos: [0.019, 0.0005, 0] });
        o.add(lid); o.parts = [lid];
        o.content = null; o.top = 0.08;
      },
      can(o) {
        const tex = printTex('can', 'band');
        const body = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.3, metalness: 0.75 });
        const prof = [[0.026, 0.0], [0.031, 0.006], [0.0325, 0.016], [0.0325, 0.104], [0.029, 0.116], [0.0275, 0.12]];
        const m = kit.mesh(kit.lathe(prof, 64, { sharp: true, points: 30 }), body); m.rotation.y = Math.PI; o.add(m);
        const alu = mat('alu', () => kit.matOf('brushedSteel', { color: 0xd8dade, repeat: [2, 2] }));
        o.add(kit.mesh(kit.lathe([[0, 0.004], [0.026, 0], [0.0262, 0.002], [0.02, 0.006], [0, 0.006]], 64, { sharp: true }), alu));
        o.add(kit.mesh(kit.lathe([[0, 0.114], [0.024, 0.115], [0.0275, 0.12], [0.026, 0.122], [0.024, 0.117], [0, 0.116]], 64, { sharp: true }), alu));
        o.add(kit.mesh(rb(0.012, 0.0015, 0.022, 0.0006, 2), alu, { pos: [0, 0.118, 0.006] }));
        o.content = null; o.top = 0.122; o.flat = [1.12, 0.3, 1.12];
      },
      glassBottle(o) {
        const prof = [[0, 0.003], [0.026, 0], [0.03, 0.006], [0.031, 0.02], [0.031, 0.12], [0.028, 0.14], [0.014, 0.18], [0.0115, 0.21], [0.0125, 0.214], [0.0115, 0.22]];
        o.add(kit.mesh(kit.lathe(prof, 64), glassG()));
        o.add(kit.mesh(ribbed(kit.lathe([[0, 0], [0.0138, 0], [0.0138, 0.008], [0, 0.009]], 64, { sharp: true }), 21, 0.06, 0.001, 0.007), mat('crown', () => new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.3, metalness: 1 })), { pos: [0, 0.218, 0] }));
        o.content = kit.mesh(kit.lathe([[0, 0.005], [0.028, 0.005], [0.028, 0.11], [0.025, 0.13], [0, 0.13]], 48, { sharp: true }), liquid('amber', 0xc7781a, 0.8), { cast: false }); o.add(o.content);
        o.top = 0.226;
      },
      brokenGlass(o) {
        // 유리컵 하나를 네 조각으로(각도 나누기) + 윗변을 들쭉날쭉하게. 조각마다 눕혀 흩어 놓는다
        const prof = [[0.03, 0], [0.033, 0.004], [0.04, 0.1]];
        for (let k = 0; k < 4; k++) {
          const g = kit.lathe(prof, 48, { sharp: true, phiStart: k * Math.PI / 2 + 0.1, phiLength: Math.PI / 2 - 0.2 });
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0.05) p.setY(i, y - Math.abs(Math.sin(Math.atan2(p.getX(i), p.getZ(i)) * 9 + k)) * 0.035 * (y - 0.05) / 0.05); }
          g.computeVertexNormals();
          const s = kit.mesh(g, glassC(), { cast: false });
          s.rotation.set(Math.PI / 2 + 0.2, k * 1.5, 0.2 * k); s.position.set(Math.cos(k * 1.7) * 0.05, 0.02, Math.sin(k * 1.7) * 0.04);
          o.add(s);
        }
        o.top = 0.05;
      },
      box(o) {
        const card = mat('card', () => kit.matOf('cardboard', { noise: { color: '#b98d5d', flutes: 60, seed: 4 } }));
        o.add(kit.mesh(rb(0.3, 0.16, 0.22, 0.006, 3, 0.3), card, { pos: [0, 0.08, 0] }));
        const tape = new THREE.Group();
        const tm = mat('tape', () => new THREE.MeshStandardMaterial({ color: 0xd7b27a, roughness: 0.25, transparent: true, opacity: 0.88 }));
        kit.mesh(rb(0.05, 0.002, 0.226, 0.0008, 2), tm, { parent: tape, pos: [0, 0.161, 0] });
        for (const s of [-1, 1]) kit.mesh(rb(0.05, 0.06, 0.002, 0.0008, 2), tm, { parent: tape, pos: [0, 0.13, s * 0.112] });
        const slip = kit.canvasTex((c, W, H) => {
          c.fillStyle = '#fbfbf7'; c.fillRect(0, 0, W, H);
          c.fillStyle = '#1d2025'; for (let k = 0; k < 40; k++) { const x = 24 + k * 6.3; c.fillRect(x, 20, (k * 7) % 3 + 1.5, 70); }
          c.font = `700 30px ${bodyFont}`; c.textAlign = 'left'; c.fillText('받는 분  ○○○', 24, 130);
          c.font = `500 24px ${bodyFont}`; c.fillText('○○시 ○○로 12, 3층', 24, 172); c.fillText('주의: 뜯을 때 조심', 24, 210);
        }, 320, 240);
        kit.mesh(new THREE.PlaneGeometry(0.1, 0.075), new THREE.MeshStandardMaterial({ map: slip, roughness: 0.7 }), { parent: tape, pos: [0.085, 0.1615, 0.03], rot: [-Math.PI / 2, 0, 0.1], cast: false });
        o.add(tape); o.tape = [tape];
        o.top = 0.17; o.flat = [1.25, 0.14, 1.0];
      },
      milkCarton(o) {
        const paper = mat('milkP', () => kit.matOf('paper', { noise: { color: '#f6f8fb' } }));
        o.add(kit.mesh(rb(0.07, 0.15, 0.07, 0.003, 2), paper, { pos: [0, 0.075, 0] }));
        const sh = new THREE.Shape(); sh.moveTo(-0.035, 0); sh.lineTo(0.035, 0); sh.lineTo(0, 0.032); sh.closePath();
        const roofG = new THREE.ExtrudeGeometry(sh, { depth: 0.07, bevelEnabled: false }); roofG.translate(0, 0, -0.035);
        o.add(kit.mesh(roofG, paper, { pos: [0, 0.15, 0], rot: [0, Math.PI / 2, 0] }));
        o.add(kit.mesh(rb(0.072, 0.014, 0.004, 0.0015, 2), paper, { pos: [0, 0.188, 0] }));
        const tex = printTex('milk', 'flat');
        for (const s of [1, -1]) o.add(kit.mesh(new THREE.PlaneGeometry(0.066, 0.12), mat('milkPrint', () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 })), { pos: [0, 0.075, s * 0.0356], rot: [0, s > 0 ? 0 : Math.PI, 0], cast: false }));
        o.content = null; o.top = 0.196; o.flat = [1.2, 0.3, 0.45];
      },
      aseptic(o) {
        const tex = printTex('aseptic', 'flat');
        const paper = mat('asP', () => kit.matOf('paper', { noise: { color: '#efe6d0' } }));
        o.add(kit.mesh(rb(0.062, 0.1, 0.04, 0.003, 2), paper, { pos: [0, 0.05, 0] }));
        o.add(kit.mesh(new THREE.PlaneGeometry(0.058, 0.094), mat('asPrint', () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55 })), { pos: [0, 0.05, 0.0206], cast: false }));
        // 옆에 붙은 빨대(비닐에 싸임)
        const st = new THREE.Group(); st.position.set(-0.033, 0.05, 0); st.rotation.z = 0.12;
        kit.mesh(kit.tube([[0, -0.04, 0], [0, 0.04, 0]], 0.0028, { tubular: 4 }), plastic(0xe6d7a8, 0.4), { parent: st });
        kit.mesh(rb(0.008, 0.088, 0.01, 0.002, 2), mat('wrap', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.15, transparent: true, opacity: 0.35, depthWrite: false })), { parent: st, cast: false });
        o.add(st); o.parts = [st];
        o.content = null; o.top = 0.1;
      },
      oilPaper(o) {
        const tex = kit.canvasTex((c, W, H) => {
          c.fillStyle = '#f1e9d6'; c.fillRect(0, 0, W, H);
          for (let k = 0; k < 9; k++) { const g = c.createRadialGradient(0, 0, 0, 0, 0, 1); g.addColorStop(0, 'rgba(176,124,40,0.55)'); g.addColorStop(1, 'rgba(176,124,40,0)');
            c.save(); c.translate(W * ((k * 0.37) % 1), H * ((k * 0.61 + 0.2) % 1)); c.scale(W * (0.12 + (k % 3) * 0.05), H * (0.09 + (k % 2) * 0.06)); c.fillStyle = g; c.beginPath(); c.arc(0, 0, 1, 0, Math.PI * 2); c.fill(); c.restore(); }
        }, 512, 512);
        const g = sheetGeo(0.26, 0.24, 0.012, 1.0, 5);
        o.add(kit.mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, side: THREE.DoubleSide }), { pos: [0, 0.014, 0] }));
        o.top = 0.03;
      },
      ramenCup(o) {
        const prof = [[0, 0.002], [0.04, 0], [0.042, 0.004], [0.052, 0.1], [0.055, 0.102], [0.056, 0.106]];
        o.add(kit.mesh(kit.lathe(prof, 64, { sharp: true }), foam()));
        o.add(band([[0.0485, 0.035], [0.0525, 0.085]], 'ramen'));
        const stain = kit.canvasTex((c, W, H) => {
          c.fillStyle = '#f2efe6'; c.fillRect(0, 0, W, H);
          const g = c.createLinearGradient(0, H * 0.95, 0, H * 0.35); g.addColorStop(0, 'rgba(190,96,40,0.75)'); g.addColorStop(0.55, 'rgba(200,110,50,0.55)'); g.addColorStop(0.62, 'rgba(160,70,30,0.8)'); g.addColorStop(0.66, 'rgba(200,110,50,0)');
          c.fillStyle = g; c.fillRect(0, 0, W, H);
          for (let k = 0; k < 30; k++) { c.fillStyle = 'rgba(170,80,30,0.5)'; c.beginPath(); c.arc((k * 97) % W, H * (0.45 + ((k * 13) % 30) / 100), 3 + (k % 4), 0, Math.PI * 2); c.fill(); }
        }, 512, 256);
        const inner = kit.lathe([[0, 0.005], [0.038, 0.005], [0.049, 0.101]], 64, { sharp: true });
        o.add(kit.mesh(inner, new THREE.MeshStandardMaterial({ map: stain, roughness: 0.7, side: THREE.BackSide }), { cast: false }));
        o.top = 0.106;
      },
      styroBlock(o) {
        o.add(kit.mesh(rb(0.22, 0.05, 0.13, 0.008, 3), foam(), { pos: [0, 0.025, 0] }));
        o.add(kit.mesh(rb(0.22, 0.1, 0.04, 0.008, 3), foam(), { pos: [0, 0.1, -0.045] }));
        o.add(kit.mesh(rb(0.04, 0.1, 0.13, 0.008, 3), foam(), { pos: [0.09, 0.1, 0] }));
        o.top = 0.15; o.flat = [1.05, 0.55, 1.05];
      },
      sashimiTray(o) {
        o.add(kit.mesh(rb(0.24, 0.01, 0.16, 0.003, 2), foam(), { pos: [0, 0.005, 0] }));
        for (const s of [-1, 1]) {
          o.add(kit.mesh(rb(0.24, 0.028, 0.012, 0.004, 2), foam(), { pos: [0, 0.016, s * 0.074] }));
          o.add(kit.mesh(rb(0.012, 0.028, 0.16, 0.004, 2), foam(), { pos: [s * 0.114, 0.016, 0] }));
        }
        const c = new THREE.Group();
        const fish = mat('fish', () => new THREE.MeshPhysicalMaterial({ color: 0xf08a6e, roughness: 0.35, clearcoat: 0.6 }));
        for (let k = 0; k < 4; k++) kit.mesh(rb(0.05, 0.007, 0.032, 0.002, 2), fish, { parent: c, pos: [-0.06 + k * 0.035, 0.014 + k * 0.002, 0.005], rot: [0, 0.2, 0.15] });
        kit.mesh(sheetGeo(0.06, 0.05, 0.008, 1.4, 9), plastic(0x5f8f3a, 0.6), { parent: c, pos: [0.075, 0.016, 0.02] });
        o.add(c); o.content = c;
        o.top = 0.03;
      },
      woodlock(o) {
        o.add(kit.mesh(rb(0.3, 0.01, 0.2, 0.002, 2), foam(), { pos: [0, 0.005, 0] }));
        const poster = kit.canvasTex((c, W, H) => {
          c.fillStyle = '#fdfcf8'; c.fillRect(0, 0, W, H);
          c.fillStyle = '#3a76c4'; c.font = `800 ${H * 0.14}px ${bodyFont}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('과학 탐구 발표', W / 2, H * 0.22);
          c.strokeStyle = '#7f9d3a'; c.lineWidth = 8; c.beginPath(); c.moveTo(W * 0.15, H * 0.75); for (let k = 0; k <= 10; k++) c.lineTo(W * (0.15 + k * 0.07), H * (0.75 - k * 0.035 - Math.sin(k) * 0.03)); c.stroke();
          c.fillStyle = '#e0b04a'; c.fillRect(W * 0.12, H * 0.4, W * 0.3, H * 0.18);
        }, 512, 340);
        o.add(kit.mesh(new THREE.PlaneGeometry(0.29, 0.19), new THREE.MeshStandardMaterial({ map: poster, roughness: 0.75 }), { pos: [0, 0.0102, 0], rot: [-Math.PI / 2, 0, 0], cast: false }));
        o.top = 0.012; o.flat = [1.02, 0.7, 1.02];
      },
      snackBag(o) {
        const tex = printTex('snack', 'flat');
        const g = pillowGeo(0.17, 0.22, 0.032, 0.55, 11);
        g.rotateX(-Math.PI / 2);
        o.add(kit.mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.32, metalness: 0.5 }), { pos: [0, 0.034, 0] }));
        o.content = null; o.top = 0.07; o.flat = [1.05, 0.45, 1.05];
      },
      foilBubble(o) {
        const back = sheetGeo(0.26, 0.18, 0.004, 0.3, 3);
        o.add(kit.mesh(back, mat('foilS', () => new THREE.MeshStandardMaterial({ color: 0xcfd4da, roughness: 0.28, metalness: 1, side: THREE.DoubleSide })), { pos: [0, 0.003, 0] }));
        const N = 11 * 8, bub = new THREE.SphereGeometry(0.0085, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        bub.scale(1, 0.6, 1);
        const im = new THREE.InstancedMesh(bub, mat('bub', () => new THREE.MeshStandardMaterial({ color: 0xf2f6f8, roughness: 0.12, transparent: true, opacity: 0.5, depthWrite: false })), N);
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < N; i++) im.setMatrixAt(i, m4.makeTranslation(-0.115 + (i % 11) * 0.023, 0.004, -0.08 + Math.floor(i / 11) * 0.023 + (i % 2) * 0.004));
        im.renderOrder = kit.ORDER.clear; im.castShadow = false;
        o.add(im);
        o.top = 0.012; o.flat = [1.02, 0.6, 1.02];
      },
      icePack(o) {
        const tex = printTex('ice', 'flat');
        const g = pillowGeo(0.16, 0.12, 0.024, 0.15, 7);
        g.rotateX(-Math.PI / 2);
        o.add(kit.mesh(g, mat('gel', () => new THREE.MeshPhysicalMaterial({ map: tex, color: 0xdcecf7, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.9 })), { pos: [0, 0.025, 0] }));
        o.top = 0.05; o.flat = [1.04, 0.7, 1.04];
      },
      toothbrush(o) {
        const hm = plastic(0x3a8fc4, 0.3);
        const curve = [[-0.09, 0.008, 0], [-0.03, 0.009, 0], [0.03, 0.011, 0], [0.07, 0.012, 0]];
        o.add(kit.mesh(kit.tube(curve, 0.0055, { tubular: 32, radial: 16 }), hm));
        o.add(kit.mesh(new THREE.SphereGeometry(0.0055, 16, 12), hm, { pos: [-0.09, 0.008, 0] }));
        o.add(kit.mesh(rb(0.03, 0.007, 0.012, 0.003, 2), hm, { pos: [0.08, 0.012, 0] }));
        const br = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0013, 0.0013, 0.011, 8), plastic(0xf4f6f8, 0.6), 15);
        const m4 = new THREE.Matrix4();
        for (let i = 0; i < 15; i++) br.setMatrixAt(i, m4.makeTranslation(0.069 + (i % 5) * 0.0055, 0.0205, -0.0035 + Math.floor(i / 5) * 0.0035));
        br.castShadow = true; o.add(br);
        o.top = 0.026;
      },
      mayo(o) {
        const prof = [[0, 0.002], [0.026, 0], [0.031, 0.01], [0.032, 0.11], [0.028, 0.13], [0.018, 0.145], [0.014, 0.15]];
        o.add(kit.mesh(kit.lathe(prof, 64), mat('mayoB', () => new THREE.MeshPhysicalMaterial({ color: 0xf1e6c4, roughness: 0.28, clearcoat: 0.7, transmission: 0 }))));
        o.add(band([[0.0322, 0.035], [0.0322, 0.095]], 'mayo'));
        const cap = kit.mesh(ribbed(kit.lathe([[0, 0], [0.017, 0], [0.017, 0.016], [0.008, 0.026], [0.004, 0.036], [0, 0.036]], 64, { sharp: true }), 8, 0.08, 0.016, 0.036), plastic(0xc8392c, 0.35));
        cap.position.y = 0.148; o.add(cap);
        o.content = null; o.top = 0.19;
      },
      dirtyVinyl(o) {
        const tex = kit.canvasTex((c, W, H) => {
          c.fillStyle = '#f4f4f0'; c.fillRect(0, 0, W, H);
          for (let k = 0; k < 7; k++) { c.fillStyle = `rgba(${130 + k * 6},${80 + k * 4},40,0.45)`; c.beginPath(); c.ellipse(W * ((k * 0.29 + 0.15) % 1), H * ((k * 0.47 + 0.3) % 1), W * (0.06 + (k % 3) * 0.03), H * 0.04, k, 0, Math.PI * 2); c.fill(); }
        }, 256, 256);
        const g = pillowGeo(0.24, 0.26, 0.022, 1.2, 17);
        g.rotateX(-Math.PI / 2);
        o.add(kit.mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35, transparent: true, opacity: 0.88, side: THREE.DoubleSide }), { pos: [0, 0.024, 0] }));
        o.top = 0.05; o.flat = [1.05, 0.6, 1.05];
      },
      takeoutCup(o) {
        // 카페(M2)와 같은 PET 컵 — 얇은 몸통 + 말린 테두리 · 돔 뚜껑 · 빨대 · 남은 커피와 얼음
        const H = 0.14, R0 = 0.029, R1 = 0.046;
        o.add(kit.mesh(kit.lathe([[0, 0.001], [R0 - 0.002, 0.001], [R0, 0.004], [R1, H], [R1 + 0.0022, H + 0.0015], [R1 + 0.001, H + 0.003]], 64, { sharp: true, points: 40 }), pet()));
        const dome = kit.mesh(kit.lathe([[R1 + 0.002, 0], [R1 + 0.003, 0.006], [0.04, 0.03], [0.015, 0.048], [0.009, 0.05], [0, 0.05]], 64), pet(), { pos: [0, H, 0] });
        const straw = kit.mesh(kit.tube([[0.008, 0.02, 0], [0.009, 0.2, 0], [0.016, 0.24, 0]], 0.0035, { tubular: 24 }), plastic(0x6f8a4f, 0.35));
        o.add(dome, straw); o.parts = [dome, straw];
        const c = new THREE.Group();
        kit.mesh(kit.lathe([[0, 0], [R0 - 0.003, 0], [R0 + 0.004, 0.035], [0, 0.035]], 48, { sharp: true }), liquid('coffee', 0x3a1a0a, 0.95), { parent: c, pos: [0, 0.003, 0], cast: false });
        const im = mat('ice', () => new THREE.MeshPhysicalMaterial({ color: 0xe9f3f8, roughness: 0.12, clearcoat: 1, transparent: true, opacity: 0.8 }));
        for (let k = 0; k < 3; k++) kit.mesh(rb(0.02, 0.018, 0.02, 0.004, 2), im, { parent: c, pos: [Math.cos(k * 2.1) * 0.012, 0.03 + k * 0.004, Math.sin(k * 2.1) * 0.012], rot: [k, k * 0.7, 0], cast: false });
        o.add(c); o.content = c;
        o.top = 0.19;
      },
      label(o) {
        // 떼어 낸 라벨: 말린 띠(반원통을 반쯤 편 모양) — 생수 라벨 그림 그대로
        const g = new THREE.CylinderGeometry(0.03, 0.03, 0.058, 48, 1, true, 0, Math.PI * 1.4);
        const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(x, z); p.setX(i, x * (1 + a * 0.35)); p.setZ(i, z * (1 + a * 0.2)); }
        g.computeVertexNormals();
        g.rotateZ(Math.PI / 2);
        o.add(kit.mesh(g, new THREE.MeshStandardMaterial({ map: printTex('water', 'band'), roughness: 0.35, side: THREE.DoubleSide }), { pos: [0, 0.03, 0] }));
        o.top = 0.06;
      },
    };
    // 품목 3D 를 id 마다 한 번 만들어 두고 다시 쓴다(접지 그림자 수가 판마다 늘지 않게). reset 으로 처음 모습
    const itemObjs = {};
    function itemObj(id) {
      if (itemObjs[id]) return itemObjs[id];
      const item = RI.itemFor(id, 'common');
      const root = new THREE.Group(); root.name = 'item:' + id;
      const body = new THREE.Group(); root.add(body);
      const o = { add: (...a) => body.add(...a), label: null, parts: [], tape: [], content: null, top: 0.1, flat: [1.1, 0.35, 1.1] };
      (MODELS[item.model] || MODELS.box)(o);
      root.traverse(m => { if (m.isMesh) m.userData.pickThrough = true; });   // 무대 강조(호버)는 품목 뒤 수거함을 본다 — 품목은 직접 끈다
      const detach = [o.label, ...o.parts, ...o.tape].filter(Boolean).map(m => ({ m, parent: m.parent, pos: m.position.clone(), rot: m.rotation.clone(), scl: m.scale.clone() }));
      root.visible = false;
      scene.add(root);
      kit.fixOrder(root);
      body.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(body);
      const size = Math.max(0.08, Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z));
      kit.groundShadow(root, size * 0.95, { y: BENCH_Y, opacity: 0.45 });
      const obj = {
        id, root, body, o, size, detach,
        reset() {
          kit.stop(root); kit.stop(body);
          for (const d of detach) { kit.stop(d.m); d.parent.add(d.m); d.m.position.copy(d.pos); d.m.rotation.copy(d.rot); d.m.scale.copy(d.scl); d.m.visible = true; }
          if (o.content) { o.content.visible = true; o.content.scale.set(1, 1, 1); }
          body.scale.set(1, 1, 1); body.rotation.set(0, 0, 0); body.position.set(0, 0, 0);
          root.rotation.set(0, 0, 0); root.scale.set(1, 1, 1);
          root.visible = false;
        },
      };
      itemObjs[id] = obj;
      return obj;
    }

    // ============================================================================
    // 흐름
    // ============================================================================
    const ITEM = new THREE.Vector3(-0.12, BENCH_Y + 0.012, BZ + 0.02);
    const SIDE = new THREE.Vector3(0.34, BENCH_Y, BZ + 0.16);
    const SINK_HOLD = new THREE.Vector3(SINK.x, BENCH_Y + 0.02, SINK.z);
    const DROP_Y = BIN_H + DECK + 0.12;
    const st = { phase: 'idle', round: [], idx: 0, rows: [], cur: null, done: [], spawnQ: [], region: 'common', t: 0, carryUsed: false, spin: 0, filterWrong: false };
    const timers = [];
    const later = (s, fn) => { timers.push({ t: D(s), fn }); };
    function runTimers(dt) {
      for (let i = 0; i < timers.length; i++) {
        const tm = timers[i];
        tm.t -= dt;
        if (tm.t <= 0) { timers.splice(i, 1); i--; tm.fn(); }
      }
    }
    const regionNow = () => { try { const r = WorksheetStore.readFp().ui.recycleRegion; return RI.REGION_RULES[r] ? r : 'common'; } catch (e) { return 'common'; } };

    // 물줄기(수도꼭지) · 비울 때 내용물 줄기 · 물방울
    const tap = kit.pourStream({ from: FAUCET.toArray(), to: [SINK.x, BENCH_Y - SINK.depth, BZ - 0.04], r: 0.0045, color: 0xcfe9f5, opacity: 0.55 });
    scene.add(tap.obj);
    const spill = kit.pourStream({ from: [0, 1, 0], to: [0, 0.8, 0], r: 0.0035, color: 0x6a4a2a, opacity: 0.85 });
    scene.add(spill.obj);
    const drops = [];
    {
      const dm = new THREE.MeshStandardMaterial({ color: 0xd8eef8, roughness: 0.05, transparent: true, opacity: 0.6, depthWrite: false });
      for (let k = 0; k < 6; k++) { const d = new THREE.Mesh(new THREE.SphereGeometry(0.005, 12, 8), dm); d.visible = false; d.raycast = () => {}; d.userData.pickThrough = true; scene.add(d); drops.push(d); }
    }
    function dripFrom(p) {
      drops.forEach((d, k) => {
        d.position.set(p.x + Math.cos(k * 2.3) * 0.03, p.y - 0.01, p.z + Math.sin(k * 2.3) * 0.03);
        d.visible = true; d.scale.setScalar(0.7 + (k % 3) * 0.25);
        later(0.05 * k, () => kit.tween(d, { position: [d.position.x, BENCH_Y - SINK.depth + 0.01, d.position.z] }, 380, 'easeInCubic'));
        later(0.05 * k + 0.42, () => { d.visible = false; });
      });
    }

    // ── HTML 겹침(종이 테마 부품) ──
    const ui = document.createElement('div');
    ui.className = 'rc-ui';
    const P = RI.RECYCLE_PREP;
    ui.innerHTML = `
      <section class="rc-panel" aria-label="분리배출 — 지금 품목">
        <p class="rc-count"></p>
        <h2 class="rc-name"></h2>
        <p class="rc-sub">준비할 것을 고른 뒤 수거함에 넣어요 <span class="rc-region"></span></p>
        <div class="rc-prep" role="group" aria-label="준비 단계">
          ${RI.PREP_ORDER.map(k => `<button class="btn btn--view btn--sm" type="button" data-prep="${k}" aria-pressed="false"><span class="rc-done" aria-hidden="true">✓</span>${P[k]}</button>`).join('')}
        </div>
        <p class="rc-how">품목을 <b>끌어서</b> 수거함 위에 놓거나 숫자 <span class="key">1</span>~<span class="key">9</span> · 빈 곳을 끌면 돌려 봐요</p>
        <p class="rc-rules">분리배출 4원칙: 비우기 · 헹구기 · 분리하기 · 섞지 않기${srcButton('rec_rules4')}</p>
      </section>
      <p class="rc-note" role="status" aria-live="polite" hidden></p>
      <section class="rc-feed" role="alertdialog" aria-labelledby="rcFeedTitle" hidden></section>
      <aside class="rc-card" role="dialog" aria-labelledby="rcCardTitle" hidden></aside>`;
    ctx.ui.appendChild(ui);
    ui.hidden = true;
    const $q = s => ui.querySelector(s);
    const panelEl = $q('.rc-panel'), noteEl = $q('.rc-note'), feedEl = $q('.rc-feed'), cardEl = $q('.rc-card');
    const prepBtns = [...ui.querySelectorAll('[data-prep]')];
    prepBtns.forEach(b => b.addEventListener('click', () => doPrep(b.dataset.prep)));
    if (typeof Icons !== 'undefined' && Icons.fill) Icons.fill(panelEl);
    let noteTimer = 0;
    function note(t, ms = 2200) {
      noteEl.textContent = t; noteEl.hidden = !t;
      clearTimeout(noteTimer);
      if (t) noteTimer = setTimeout(() => { noteEl.hidden = true; }, ms);
    }
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const kgTxt = v => (typeof FPActions !== 'undefined' ? FPActions.fmtKg(v) : (Math.round(v * 10) / 10).toLocaleString('ko-KR'));
    const srcs = keys => (keys || []).map(k => srcButton(k)).join('');
    function syncPanel() {
      const it = st.cur && st.cur.item;
      panelEl.hidden = !it || st.phase === 'summary';
      if (!it) return;
      const main = st.round.length;
      $q('.rc-count').textContent = st.cur.spawned ? `딸린 품목 — ${Math.min(st.idx, main)}번째 품목에서 나왔어요` : `품목 ${st.idx} / ${main}`;
      $q('.rc-name').textContent = it.name;
      $q('.rc-region').textContent = st.region !== 'common' ? `· ${RI.REGION_LABEL[st.region]}` : '';
      const busy = st.phase !== 'item';
      prepBtns.forEach(b => {
        const on = st.done.includes(b.dataset.prep);
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('is-on', on);
        b.disabled = busy;
      });
    }

    // ── 한 판 ──
    function newRound(opts = {}) {
      timers.length = 0;
      for (const id in itemObjs) itemObjs[id].reset();
      bins.forEach(b => { b.lidTo = 0; kit.stop(b.g); b.g.rotation.set(0, 0, 0); b.g.scale.set(1, 1, 1); });
      ring.visible = false;
      st.region = opts.region || regionNow();
      let carry = [];
      if (!ctx.shotMode && !opts.round) {
        try { const a = WorksheetStore.readFp().actions || {}; carry = Array.isArray(a.carry) ? a.carry : []; } catch (e) { carry = []; }
      }
      st.round = opts.round ? opts.round.slice() : RI.makeRound({ carry, seed: opts.seed });
      // 카페에서 들고 나온 컵은 이번 판 첫 품목으로 썼으니 carry 에서 지운다(한 번만)
      if (!ctx.shotMode && st.round[0] === 'takeout_cup' && carry.includes('takeout_cup')) {
        try { WorksheetStore.updateFp(fp => { const a = fp.actions || (fp.actions = {}); a.carry = (Array.isArray(a.carry) ? a.carry : []).filter(x => x !== 'takeout_cup'); }); } catch (e) { /* 메모리 */ }
      }
      st.idx = 0; st.rows = []; st.cur = null; st.done = []; st.spawnQ = []; st.filterWrong = false;
      st.phase = 'idle';
      feedEl.hidden = true; cardEl.hidden = true;
    }
    function nextItem(instant) {
      feedEl.hidden = true;
      ring.visible = false;
      let entry = null;
      if (st.spawnQ.length) entry = st.spawnQ.shift();
      else if (st.idx < st.round.length) {
        const id = st.round[st.idx++];
        const obj = itemObj(id);
        obj.reset();
        entry = { id, obj, item: RI.itemFor(id, st.region), spawned: false, from: 'box' };
      }
      if (!entry) { finish(); return; }
      st.cur = entry; st.done = []; st.tries = [];
      const root = entry.obj.root;
      root.visible = true;
      st.phase = 'rise';
      syncPanel();
      const from = entry.from === 'box' ? BOXP.clone().setY(BENCH_Y + 0.08) : root.position.clone();
      kit.setShadowSurface(root, BENCH_Y);
      if (instant || ctx.shotMode) {
        root.position.copy(ITEM);
        st.phase = 'item'; syncPanel();
        return;
      }
      root.position.copy(from);
      kit.arc(root, from, ITEM, 0.25, 500);   // 0.5초, 천천히 돌며(update 의 spin)
      later(0.52, () => { st.phase = 'item'; syncPanel(); if (!ctx.shotMode && document.activeElement && ui.contains(document.activeElement) && document.activeElement.disabled) document.activeElement.blur(); });
    }

    // ── 준비 ──
    function doPrep(k) {
      if (st.phase !== 'item' || !st.cur) return;
      const it = st.cur.item, obj = st.cur.obj, root = obj.root, o = obj.o;
      if (!canDo(it, k)) {
        note(cantText(k));
        // 흔들림(좌우 3번)
        st.phase = 'prep'; syncPanel();
        const r0 = root.rotation.y;
        [0.07, -0.07, 0.05, -0.05, 0].forEach((a, i) => later(i * 0.08, () => kit.tween(root, { rotation: [0, r0 + a, a * 0.6] }, 80)));
        later(0.45, () => { root.rotation.set(0, r0, 0); st.phase = 'item'; syncPanel(); });
        return;
      }
      st.phase = 'prep'; syncPanel();
      const done = () => { if (!st.done.includes(k)) st.done.push(k); st.phase = 'item'; syncPanel(); if (it.notes && it.notes[k]) note(it.notes[k], 2600); };
      if (k === 'empty' || k === 'rinse') {
        // 개수대로 옮겨서: 비우기 = 기울여 내용물 줄기 · 헹구기 = 물줄기 1초 + 물방울
        root.rotation.set(0, 0, 0);
        const hold = SINK_HOLD.clone().setY(BENCH_Y + (k === 'empty' ? 0.1 : 0.0));
        kit.arc(root, root.position.clone(), hold, 0.18, 450, { squash: false });
        later(0.47, () => kit.setShadowSurface(root, BENCH_Y - SINK.depth));
        if (k === 'empty') {
          later(0.5, () => kit.tween(obj.body, { rotation: [0, 0, 2.2], position: [0.04, o.top * 0.5, 0] }, 350));
          later(0.9, () => {
            obj.body.updateMatrixWorld(true);
            const mouth = obj.body.localToWorld(new THREE.Vector3(0, o.top, 0));
            const col = o.content && o.content.material && o.content.material.color ? o.content.material.color : (o.content ? new THREE.Color(0x6a4a2a) : new THREE.Color(0xd8e8ee));
            spill.obj.material.uniforms.uColor.value.copy(col);
            spill.setEnds(mouth.toArray(), [mouth.x, BENCH_Y - SINK.depth + 0.008, mouth.z]);
            spill.start(200);
            if (o.content) kit.tween(o.content, { scale: [1, 0.02, 1] }, 650);
          });
          later(1.6, () => { spill.stop(250); if (o.content) o.content.visible = false; kit.tween(obj.body, { rotation: [0, 0, 0], position: [0, 0, 0] }, 350); });
          later(2.0, () => { kit.arc(root, root.position.clone(), ITEM, 0.15, 450); });
          later(2.47, () => { kit.setShadowSurface(root, BENCH_Y); done(); });
        } else {
          later(0.5, () => { tap.setEnds(FAUCET.toArray(), [FAUCET.x, BENCH_Y + o.top * 0.7, FAUCET.z]); tap.start(200); });
          later(0.75, () => kit.tween(root, { rotation: [0, Math.PI, 0] }, 900, 'easeInOutSine'));
          later(1.5, () => { tap.stop(250); obj.body.updateMatrixWorld(true); dripFrom(root.position.clone().setY(BENCH_Y + 0.02)); });
          later(1.9, () => { kit.arc(root, root.position.clone(), ITEM, 0.15, 450); });
          later(2.37, () => { kit.setShadowSurface(root, BENCH_Y); done(); });
        }
        return;
      }
      if (k === 'label') {
        // 라벨 띠가 나선으로 돌며 위로 벗겨지고 → 작업대 옆에 떨어져 '떼어 낸 라벨'(새 품목)이 된다
        const lab = o.label;
        root.updateMatrixWorld(true);
        scene.attach(lab);
        const p0 = lab.position.clone();
        kit.tween(lab, { position: [p0.x, p0.y + 0.07, p0.z], rotation: [0.25, lab.rotation.y + Math.PI * 3, 0.35], scale: [1.18, 0.85, 1.18] }, 600, 'easeInOutSine');
        later(0.62, () => kit.arc(lab, lab.position.clone(), SIDE.clone().setY(BENCH_Y + 0.02), 0.08, 450));
        later(1.1, () => {
          lab.visible = false;
          const spawnId = it.spawns && it.spawns.label;
          if (spawnId) {
            const sobj = itemObj(spawnId);
            sobj.reset();
            sobj.root.visible = true; sobj.root.position.copy(SIDE); sobj.root.rotation.set(0, 0.6, 0);
            kit.squash(sobj.root);
            st.spawnQ.push({ id: spawnId, obj: sobj, item: RI.itemFor(spawnId, st.region), spawned: true, from: 'side', parent: st.cur.id });
            note('떼어 낸 라벨이 작업대에 남았어요 — 이 품목 다음에 넣어요', 2600);
          }
          done();
        });
        return;
      }
      if (k === 'parts' || k === 'tape') {
        const list = k === 'parts' ? o.parts : o.tape;
        root.updateMatrixWorld(true);
        list.forEach((m, i) => {
          scene.attach(m);
          const p0 = m.position.clone();
          later(i * 0.15, () => kit.tween(m, { position: [p0.x, p0.y + 0.05, p0.z], rotation: [m.rotation.x + 0.6, m.rotation.y + 1.2, m.rotation.z] }, 300));
          later(i * 0.15 + 0.32, () => kit.arc(m, m.position.clone(), new THREE.Vector3(1.45 + i * 0.05, BENCH_Y - 0.3, BZ + 0.1 - i * 0.08), 0.12, 500, { squash: false }));
          later(i * 0.15 + 0.85, () => { m.visible = false; });
        });
        later(list.length * 0.15 + 0.9, done);
        return;
      }
      if (k === 'flatten') {
        // 위아래로 눌림(0.4초) + 살짝 주름진 기울기 — 판 모양 품목은 덜 눌린다(flat)
        root.rotation.set(0, root.rotation.y, 0);
        kit.tween(obj.body, { scale: o.flat, rotation: [0.04, 0, -0.03] }, 400, 'easeOutBack');
        later(0.42, () => { kit.squash(root, 0.04); });
        later(0.6, done);
      }
    }

    // ── 넣기 · 판정 ──
    function drop(binId) {
      if (st.phase !== 'item' || !st.cur) return;
      const bin = bins.find(b => b.id === binId);
      if (!bin) return;
      if (dragging) endDrag(true);
      const it = st.cur.item, root = st.cur.obj.root;
      const res = RI.judge(it, binId, st.done);
      const first = !st.tries.length;
      st.tries.push(binId);
      st.phase = 'throw'; syncPanel();
      bins.forEach(b => { if (b !== bin) b.lidTo = 0; });
      bin.lidTo = 1.25;
      const top = new THREE.Vector3(bin.g.position.x, DROP_Y, BIN_Z + 0.04);
      root.rotation.x = 0;
      kit.arc(root, root.position.clone(), top, 0.35, 600, { squash: false });
      later(0.62, () => {
        if (res.binOk) {
          kit.tween(root, { position: [top.x, DECK + 0.55, top.z], scale: [0.7, 0.7, 0.7] }, 260, 'easeInCubic');
          later(0.27, () => { root.visible = false; bin.lidTo = 0; });
          later(0.42, () => kit.squash(bin.g, 0.035));
        } else {
          kit.tween(root, { position: [top.x, DROP_Y - 0.08, top.z] }, 140, 'easeInCubic');
          later(0.16, () => { kit.arc(root, root.position.clone(), ITEM, 0.3, 600); bin.lidTo = 0; });
          [0.05, -0.05, 0.035, -0.035, 0].forEach((a, i) => later(0.18 + i * 0.07, () => kit.tween(bin.g, { rotation: [0, 0, a] }, 70)));
          later(0.8, () => kit.setShadowSurface(root, BENCH_Y));
        }
        flashRing(bin, res.binOk ? (res.score < 1 ? 'half' : 'ok') : 'bad');
        // 기록: 점수는 첫 시도 기준, 다시 넣기는 기록만(M §3-4)
        if (first) {
          st.rows.push({ id: st.cur.id, name: it.name, bin: it.bin, chosen: binId, tries: [binId], prep: it.prep.slice(), done: st.done.slice(),
            missing: res.missing, score: res.score, spawned: !!st.cur.spawned, region: !!it.region, why: it.why, src: it.src, retryOk: false });
        } else {
          const row = st.rows[st.rows.length - 1];
          row.tries.push(binId);
          if (res.binOk) row.retryOk = true;
        }
        showFeed(res, bin);
      });
    }
    function showFeed(res, bin) {
      const it = st.cur.item;
      const kind = res.binOk ? (res.score < 1 ? 'half' : 'ok') : 'bad';
      const sym = kind === 'bad' ? '✕' : '✔';
      const title = kind === 'ok' ? '맞아요' : kind === 'half' ? '수거함은 맞아요 (반점)' : '아니에요';
      const first = st.tries.length === 1;
      const sub = kind === 'bad' ? `'${esc(bin.info.name)}' 수거함이 아니에요` : !first ? '두 번째 시도에서 맞혔어요 — 점수는 첫 시도로 셉니다' : '';
      feedEl.className = `rc-feed is-${kind}`;
      feedEl.innerHTML = `
        <div class="rf-sym" aria-hidden="true">${sym}</div>
        <div class="rf-body">
          <h3 id="rcFeedTitle">${title}${sub ? ` <span class="rf-sub">${sub}</span>` : ''}</h3>
          ${kind === 'half' ? `<p class="rf-miss">${esc(RI.missingText(res.missing))}</p>` : ''}
          <p class="rf-why">${esc(it.why)}${srcs(it.src)}</p>
          ${it.region ? '<p class="rf-region">지역마다 기준이 다를 수 있어요 — 우리 동네 기준 확인하기(내 손안의 분리배출 앱)</p>' : ''}
        </div>
        <div class="rf-act">${kind === 'bad'
          ? '<button class="btn btn--view is-on" type="button" data-again>다시 넣기</button>'
          : `<button class="btn btn--nav is-on" type="button" data-next>${st.spawnQ.length || st.idx < st.round.length ? '다음 품목' : '결과 보기'}</button>`}</div>`;
      feedEl.hidden = false;
      st.phase = 'judge'; syncPanel();
      if (typeof Icons !== 'undefined' && Icons.fill) Icons.fill(feedEl);
      const btn = feedEl.querySelector('[data-again], [data-next]');
      btn.addEventListener('click', () => {
        if (btn.hasAttribute('data-again')) { feedEl.hidden = true; ring.visible = false; st.phase = 'item'; syncPanel(); }
        else nextItem();
      });
      if (!ctx.shotMode) btn.focus();
    }

    // ── 끝 화면 ──
    let lastResult = null;
    const listeners = roundListeners;   // 모듈 수준 — M4 가 무대를 만들기 전에도 FPStageRecycle.onRound(fn) 로 걸 수 있게
    function finish() {
      st.phase = 'summary';
      panelEl.hidden = true; feedEl.hidden = true; ring.visible = false;
      const acc = RI.accuracy(st.rows), kg = RI.kgFor(acc);
      lastResult = { accuracy: acc, kg, region: st.region, rows: st.rows.map(r => ({ ...r })), at: new Date().toISOString() };
      if (!ctx.shotMode) for (const fn of listeners) { try { fn(lastResult); } catch (e) { /* 연결 쪽 오류가 게임을 멈추지 않게 */ } }
      showCard();
    }
    function showCard() {
      const r = lastResult, rows = compareRows(r.kg), max = Math.max(...rows.map(x => x.kg));
      const binName = id => (RI.BIN_INFO[id] || {}).name || id;
      const prepTxt = row => {
        if (!row.prep.length) return '<span class="rc-dim">없음</span>';
        return row.prep.map(p => `<span class="${row.done.includes(p) ? 'rc-pok' : 'rc-pmiss'}">${row.done.includes(p) ? '✓' : '✕'} ${esc(RI.RECYCLE_PREP[p])}</span>`).join(' ');
      };
      const mark = s => (s === 1 ? '<b class="rc-s1">1</b>' : s === 0.5 ? '<b class="rc-s5">0.5</b>' : '<b class="rc-s0">0</b>');
      const main = r.rows.filter(x => !x.spawned).length, wrong = r.rows.filter(x => x.score < 1).length;
      cardEl.innerHTML = `
        <h2 id="rcCardTitle">분리배출 결과</h2>
        <p class="rc-lead">정확도 <b>${Math.round(r.accuracy * 100)}%</b> <span class="cc-sub">(첫 시도 점수 합 ÷ ${RI.ROUND_SIZE}${main < RI.ROUND_SIZE ? ` — 아직 ${RI.ROUND_SIZE - main}개 남음` : ''})</span>
          → 1년에 CO₂ 약 <b>${kgTxt(r.kg)} kg</b> 줄이는 셈 <span class="cc-sub">(${kgTxt(RI.kgPerYear())} kg × 정확도)</span>${srcButton('recycle_accuracy')}${srcButton('act_recycle')}</p>
        ${ctx.shotMode ? '' : '<p class="rc-saved">학습지 [나의 행동] 분리배출 카드에 이 판 정확도를 반영하고 기록에 남겼어요.</p>'}
        <p class="cc-sub">제대로 분리배출되지 못한 재활용품은 선별 과정에서 잔재물로 분류돼 결국 소각·매립돼요. 그래서 정확도만큼만 셉니다.</p>
        <div class="rc-tools"><button class="btn btn--view btn--sm" type="button" data-filter aria-pressed="${st.filterWrong}">틀린 것만 보기 (${wrong})</button>
          ${r.region !== 'common' ? `<span class="cc-sub">${esc(RI.REGION_LABEL[r.region])} 적용</span>` : ''}</div>
        <div class="rc-table-wrap"><table class="rc-table">
          <thead><tr><th scope="col">품목</th><th scope="col">내가 고른 곳</th><th scope="col">정답</th><th scope="col">준비</th><th scope="col">맞음</th><th scope="col">이유</th></tr></thead>
          <tbody>${r.rows.map(x => `<tr class="${x.score < 1 ? 'is-wrong' : ''}${x.spawned ? ' is-spawn' : ''}"${st.filterWrong && x.score >= 1 ? ' hidden' : ''}>
            <th scope="row">${esc(x.name)}${x.spawned ? ' <span class="cc-sub">(딸린 품목 — 정확도에 안 넣음)</span>' : ''}${x.region ? ' <span class="rc-badge">지역차</span>' : ''}</th>
            <td>${esc(binName(x.chosen))}${x.tries.length > 1 ? `<span class="cc-sub"> → ${x.tries.slice(1).map(t => esc(binName(t))).join(' → ')}${x.retryOk ? ' ✓' : ''}</span>` : ''}</td>
            <td>${esc(binName(x.bin))}</td><td>${prepTxt(x)}</td><td>${mark(x.score)}</td><td class="rc-why">${esc(x.why)}${srcs(x.src)}</td></tr>`).join('')}</tbody>
        </table></div>
        <h3>크기 비교 <span class="cc-sub">1인 · 1년에 줄이는 CO₂</span></h3>
        <div class="cc-bars">${rows.map(x => `<div class="cc-bar"><span class="cc-bl">${esc(x.label)}${srcButton(x.src)}</span>
          <span class="cc-track" role="img" aria-label="${esc(x.label)} ${kgTxt(x.kg)} kg"><i style="width:${Math.max(0.4, x.kg / max * 100).toFixed(2)}%"></i></span><b>${kgTxt(x.kg)} kg</b></div>`).join('')}</div>
        <p class="cc-sub">분리배출은 꼭 해야 하는 작은 행동이에요. 큰 차이는 이동·비행에서 나와요.</p>
        <div class="cc-actions"><button class="btn btn--view" type="button" data-again disabled>한 판 더</button><button class="btn btn--nav is-on" type="button" data-leave disabled>나가기</button></div>`;
      cardEl.hidden = false;
      const f = cardEl.querySelector('[data-filter]');
      f.addEventListener('click', () => {
        st.filterWrong = !st.filterWrong;
        f.setAttribute('aria-pressed', String(st.filterWrong));
        cardEl.querySelectorAll('tbody tr').forEach(tr => { tr.hidden = st.filterWrong && !tr.classList.contains('is-wrong'); });
      });
      const again = cardEl.querySelector('[data-again]'), leave = cardEl.querySelector('[data-leave]');
      again.addEventListener('click', () => { newRound(); nextItem(); });
      leave.addEventListener('click', () => FPStage.exit());
      // 크기 비교를 건너뛸 수 없게 — 닫기는 1.5초 뒤에(M §0-1)
      setTimeout(() => { again.disabled = false; leave.disabled = false; }, 1500);
      if (typeof Icons !== 'undefined' && Icons.fill) Icons.fill(cardEl);
      if (!ctx.shotMode) { const h = cardEl.querySelector('h2'); h.setAttribute('tabindex', '-1'); h.focus(); }
    }

    // ── 끌기(품목 → 수거함) · 빈 곳 끌기(돌려 보기) ──
    const canvas = kit.renderer && kit.renderer.domElement;
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(DROP_Y + 0.02)), hitP = new THREE.Vector3();
    let dragging = null, noClickUntil = 0;
    const toNdc = e => { const rc = canvas.getBoundingClientRect(); ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1); };
    const binAt = x => bins.find(b => Math.abs(x - b.g.position.x) <= PITCH / 2);
    function endDrag(silent) {
      const d = dragging; dragging = null;
      if (!d || silent) return;
      if (d.mode === 'carry') {
        const root = st.cur.obj.root;
        const b = d.over;
        bins.forEach(x => { x.lidTo = 0; });
        if (b) drop(b.id);
        else { kit.arc(root, root.position.clone(), ITEM, 0.08, 400); later(0.42, () => kit.setShadowSurface(root, BENCH_Y)); }
      }
    }
    if (canvas) {
      canvas.addEventListener('pointerdown', e => {
        if (FPStage.active() !== 'recycle' || st.phase !== 'item' || e.button !== 0 || !st.cur) return;
        toNdc(e); ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObject(st.cur.obj.root, true).length > 0;
        dragging = { mode: hit ? 'carry' : 'rotate', x: e.clientX, y: e.clientY, moved: 0, over: null };
        if (hit) kit.stop(st.cur.obj.root);
      });
      window.addEventListener('pointermove', e => {
        if (!dragging || FPStage.active() !== 'recycle') return;
        dragging.moved += Math.abs(e.clientX - dragging.x) + Math.abs(e.clientY - dragging.y);
        const dx = e.clientX - dragging.x; dragging.x = e.clientX; dragging.y = e.clientY;
        if (dragging.mode === 'rotate') { if (st.cur) st.cur.obj.root.rotation.y += dx * 0.012; st.spin = 1.2; return; }
        if (dragging.moved < 4) return;
        toNdc(e); ray.setFromCamera(ndc, camera);
        if (!ray.ray.intersectPlane(plane, hitP)) return;
        const root = st.cur.obj.root;
        root.position.set(Math.max(-2.4, Math.min(2.4, hitP.x)), DROP_Y + 0.02, Math.max(BIN_Z, Math.min(BZ + 0.3, hitP.z)));
        kit.setShadowSurface(root, root.position.z < BIN_Z + BIN_D / 2 ? DECK + BIN_H : BENCH_Y);
        const over = root.position.z < BIN_Z + BIN_D / 2 + 0.12 ? binAt(root.position.x) : null;
        if (over !== dragging.over) { if (dragging.over) dragging.over.lidTo = 0; if (over) over.lidTo = 0.35; dragging.over = over; }   // 수거함 위면 뚜껑이 살짝
      });
      window.addEventListener('pointerup', () => {
        if (!dragging) return;
        if (dragging.moved > 4) noClickUntil = performance.now() + 250;   // 끈 뒤 따라오는 click 이 수거함을 또 누르지 않게
        endDrag(false);
      });
    }

    // ── 사진 자세 ──
    const VIEW = { pos: [0, 1.95, 2.75], target: [0, 0.82, -0.5], fov: 54 };
    const shots = {
      wide: { pos: [0.7, 1.8, 4.9], target: [0, 1.15, -0.7], fov: 56 },
      bench: { pos: [0.05, 1.5, 1.2], target: [-0.08, 0.96, 0.05], fov: 48 },
      label: { pos: [-0.1, 1.16, 0.72], target: [-0.12, 1.0, 0.17], fov: 38, t: 0.35, freeze: true },
      throw: { pos: [-0.55, 2.1, 1.25], target: [-1.85, 1.05, -1.0], fov: 52, t: 0.3, freeze: true },
      summary: { pos: VIEW.pos, target: VIEW.target, fov: VIEW.fov },
    };
    function setView(v) { camera.position.set(...v.pos); camera.lookAt(...v.target); camera.fov = v.fov; camera.updateProjectionMatrix(); }
    function onShot(name) {
      newRound({ round: FIXED_ROUND, region: 'common' });
      nextItem(true);
      if (name === 'label') doPrep('label');
      else if (name === 'throw') {
        // 비우고 납작하게 누른 생수병(라벨은 안 뗌 — 반점이 될 판)을 투명 페트병 수거함(1)으로
        const o = st.cur.obj;
        st.done = ['empty', 'flatten']; o.body.scale.set(...o.o.flat); if (o.o.content) o.o.content.visible = false;
        drop('pet');
      }
      else if (name === 'summary') {
        // 한 판을 미리 채운 끝 화면(맞음 6 · 반점 2 · 틀림 2 → 정확도 70 %)
        const plan = { water_pet: ['pet', ['empty', 'flatten']], soy_pet: ['pet', []], milk_carton: ['carton', ['empty', 'rinse', 'flatten']], ramen_cup: ['general', []],
          box: ['paper', ['tape']], can: ['can', ['empty']], ice_pack: ['general', []], snack_bag: ['vinyl', ['empty']], broken_glass: ['glass', []], foil_bubble: ['general', []] };
        st.rows = FIXED_ROUND.map(id => {
          const it = RI.itemFor(id, 'common'), [b, done] = plan[id], j = RI.judge(it, b, done);
          return { id, name: it.name, bin: it.bin, chosen: b, tries: [b], prep: it.prep.slice(), done, missing: j.missing, score: j.score, spawned: false, region: !!it.region, why: it.why, src: it.src, retryOk: false };
        });
        for (const id in itemObjs) itemObjs[id].root.visible = false;
        st.idx = st.round.length; st.cur = null;
        finish();
      }
    }

    return {
      scene, camera, shots, enterShot: null,
      onShot,
      state: () => ({ phase: st.phase, idx: st.idx, round: st.round.slice(), cur: st.cur && st.cur.id, done: st.done.slice(), rows: st.rows.length, region: st.region,
        accuracy: RI.accuracy(st.rows), spawnQ: st.spawnQ.map(s => s.id) }),   // 검사·콘솔 확인용(읽기만)
      get lastResult() { return lastResult; },
      onRound: fn => { listeners.push(fn); },
      onEnter(info) {
        ui.hidden = false;
        setView(VIEW);
        if (info.shot) return;   // 사진 자세는 onShot 이 장면을 맞춘다
        newRound();
        nextItem();
        if (info.first) note('상자에서 나온 품목을 준비하고 맞는 수거함에 넣어 보세요', 3200);
      },
      onExit() {
        ui.hidden = true;
        timers.length = 0;
        if (dragging) endDrag(true);
        for (const id in itemObjs) itemObjs[id].reset();
        tap.obj.visible = false; spill.obj.visible = false;
        drops.forEach(d => { d.visible = false; });
        st.phase = 'idle';
      },
      update(dt) {
        runTimers(dt);
        updateLids(dt);
        if (ringT > 0) { ringT -= dt; if (ringT < 0.5) ringMat.opacity = Math.max(0, ringT / 0.5); if (ringT <= 0) ring.visible = false; }
        // 작업대 위 품목은 천천히 돈다(끄는 중·준비 중엔 멈춤). 직접 돌리면 1.2초 쉬었다가
        if (st.spin > 0) st.spin -= dt;
        else if (st.cur && (st.phase === 'item' || st.phase === 'rise') && !dragging && !ctx.shotMode) st.cur.obj.root.rotation.y += dt * 0.35;
      },
      pick(obj) {
        if (performance.now() < noClickUntil) return;
        if (obj.userData.bin) drop(obj.userData.bin);
      },
      key(e) {
        if (st.phase === 'item') {
          const m = /^(?:Digit|Numpad)([1-9])$/.exec(e.code);
          if (m) { drop(BINS[Number(m[1]) - 1]); return true; }
          if ((e.code === 'ArrowLeft' || e.code === 'ArrowRight') && st.cur) { st.cur.obj.root.rotation.y += e.code === 'ArrowLeft' ? -0.3 : 0.3; st.spin = 1.2; return true; }
        }
        return false;
      },
    };
  }

  // ── 소품 모양 도우미(모듈 수준 — THREE 는 부를 때만 읽는다) ──────────────
  // 베개 모양(봉지·아이스팩): 앞뒤 두 장을 붙인 판. 가장자리는 0, 가운데가 부푼다. crumple = 구김 세기
  function pillowGeo(w, h, t, crumple, seed) {
    const N = FPStageKit._noise;
    const front = new THREE.PlaneGeometry(w, h, 32, 28), p = front.attributes.position;
    for (let i = 0; i < p.count; i++) {
      // u·v 를 [0, 1] 로 자른다 — 가장자리에서 sin 이 −0 아래로 조금 내려가면 pow(음수, 0.6) = NaN
      const u = Math.min(1, Math.max(0, p.getX(i) / w + 0.5)), v = Math.min(1, Math.max(0, p.getY(i) / h + 0.5));
      const e = Math.min(1, 4 * Math.sin(Math.PI * u) * Math.sin(Math.PI * v));
      const bulge = Math.pow(Math.max(0, Math.sin(Math.PI * u)), 0.6) * Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.5);
      const n = (N.vnoise(u * 7, v * 7, 7, 7, seed) - 0.5) * 2 + (N.vnoise(u * 17, v * 17, 17, 17, seed + 3) - 0.5);
      p.setZ(i, t * bulge * (1 + n * 0.25 * crumple) + n * t * 0.18 * crumple * e);
    }
    front.computeVertexNormals();
    const back = front.clone(); back.rotateY(Math.PI);
    return FPStageKit.mergeGeometries([front, back]);
  }
  // 한 장(기름종이·에어캡 바닥): 눕힌 판 + 물결·구김
  function sheetGeo(w, d, amp, crumple, seed) {
    const N = FPStageKit._noise;
    const g = new THREE.PlaneGeometry(w, d, 32, 28), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const u = p.getX(i) / w + 0.5, v = p.getY(i) / d + 0.5;
      const n = (N.vnoise(u * 6, v * 6, 6, 6, seed) - 0.5) * 2 + (N.vnoise(u * 15, v * 15, 15, 15, seed + 5) - 0.5) * 0.6;
      const edge = Math.pow(Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5)) * 2, 3);
      p.setZ(i, (n * crumple + edge * 0.8) * amp);
    }
    g.rotateX(-Math.PI / 2);
    g.computeVertexNormals();
    return g;
  }

  // 학습지 [과제] '분리배출 지역 기준'(마스터 D14 — 기본 공통). 고른 값 = 학습지 공용 저장소 fp.ui.recycleRegion, 다음 판부터 적용
  function initRegionUi() {
    if (typeof document === 'undefined') return;
    const btns = [...document.querySelectorAll('[data-recycle-region]')];
    if (!btns.length) return;
    const sync = () => {
      let r = 'common';
      try { r = WorksheetStore.readFp().ui.recycleRegion || 'common'; } catch (e) { /* 기본 */ }
      if (!RecycleItems.REGION_RULES[r]) r = 'common';
      btns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.recycleRegion === r)));
    };
    btns.forEach(b => b.addEventListener('click', () => {
      try { WorksheetStore.updateFp(fp => { fp.ui.recycleRegion = b.dataset.recycleRegion; }); } catch (e) { /* 저장 못 해도 화면은 */ }
      sync();
      if (typeof FPField !== 'undefined') FPField.toast(`분리배출 기준: ${RecycleItems.REGION_LABEL[b.dataset.recycleRegion]} — 다음 판부터 적용돼요`, 2600);
    }));
    sync();
  }

  // 등록 — 덮개 제목 · 노출(분리배출장 1.1, M §1-3 출발값 — 🧑 조정)
  const api = { TITLE, SPOT, FIXED_ROUND, MODEL_HAS, MODEL_NAMES, canDo, cantText, compareRows, live: null,
    onRound: fn => { roundListeners.push(fn); },                       // 판 결과 { accuracy, kg, region, rows, at } (사진 자세에서는 안 부름)
    get lastResult() { return api.live ? api.live.lastResult : null; } };
  // M4: 판이 끝나면 '나의 행동'·학습지 기록으로(FPActions 는 이 파일보다 먼저 읽힌다)
  roundListeners.push(r => { if (typeof FPActions !== 'undefined' && FPActions.recordRecycle) FPActions.recordRecycle(r); });
  if (typeof FPStage !== 'undefined') {
    let W = null;
    FPStage.register('recycle', {
      title: TITLE, exposure: 1.1,
      build(kit, ctx) { const b = build(kit, ctx); api.live = b; return b; },
      world(w) { initRegionUi(); W = world(w); return W; },
      onWorldYear(year, city) { if (W && W.apply) W.apply(year, city); },
    });
  }
  return api;
})();
