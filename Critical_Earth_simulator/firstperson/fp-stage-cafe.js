// ============================================================================
// 1인칭 미니게임 ① 카페 — 일회용 컵 vs 텀블러 (4차 M2) — 무대 '초록잔 카페'(가상 이름, 마스터 D10)
// ----------------------------------------------------------------------------
// 두 부분을 맡는다.
//   ① 세계 속 외관(world): 도시의 가장 낮은 건물(cityGroup 로컬 (0.35, 0.45), fp-world.js bldDefs 첫 줄 아래 일곱 번째) 1층의
//      교차로 쪽(−x) 면에 상점 정면 — 유리창·문·간판 한 장(캔버스) + 물결 차양 + 화분 2개. 드로우콜 +7(그림자 패스 포함, ≤ 8).
//      이 건물은 1750년부터 늘 서 있는 가장 낮은 건물이라(낮은 것부터 나타남, C5) 현재에 반드시 있다. 정면은 도시 규모가
//      2000년 수준 이상인 해에만 보인다(M §0-3, cityLevel 은 누적 배출 최댓값이라 그 뒤로 줄지 않는다).
//      정면 폭은 건물 면 폭(0.13유닛 ≈ 6.5 m)에 맞췄다 — 지시서의 '약 10 m'보다 좁다(8채 중 그만큼 넓은 면이 교차로 쪽에 없다).
//      유리창은 transmission 이 아니라 '실내 그림(발광) + 낮은 거칠기 반사'다 — 세계에 투명 패스를 하나 더하면 세계 전체를
//      한 번 더 그린다(마스터 §6-15).
//      문 앞 약 3 m 에서 겨누면 'E 카페에 들어가기'. 들어갈 수 있는 것은 현재(NOW_YEAR)뿐 — 다른 해엔 안내만(FPStage.addDoor).
//   ② 실내 무대(build): 미터 축척 약 6 × 4 × 3 m. 바닥 헤링본 타일 · 뒷벽 나무 판재 · 옆벽 회반죽 · 카운터(둥근 나무 상판 4 cm +
//      세로 홈 판재 앞판 + 발판 금속 띠) · 자동 커피 머신(헤어라인 스테인리스, 그룹헤드 2 · 포터필터 · 스팀 노즐 · 압력계 · 컵 받침 망) ·
//      그라인더(투명 호퍼 + 원두 160알) · 키오스크(세로 화면, 캔버스 UI) · 유리 진열장 + 빵 4종 · 펜던트 등 3(점광 3) ·
//      메뉴판(칠판) · 컵 쌓인 선반 · 화분 · 창. 사람(바리스타)은 넣지 않는다 — 머신이 스스로 추출한다(M §2-2).
// 흐름(M §2-3): 들어가기(문 → 카운터 1.2초) → 키오스크(메뉴 2개: 화면 UV 로 누르기 · 숫자 1·2) → 컵 고르기([일회용 컵] [내 텀블러] · 1·2)
//   → 추출(컵이 포물선으로 받침 위, 줄기 2개 2.5초, 액면 상승·크레마·김) → 받기(뚜껑: 돔 뚜껑 + 빨대 / 텀블러 돌려 닫기 0.4초)
//   → 결과 카드(HTML, 종이 테마) → [가게 나가기].
//   흐름은 시간표(update 의 st.t)로 돈다 — Promise 를 쓰면 사진 자세의 '시간 고정'(FPStage 가 update 를 동기로 여러 번 부름)에서 멈춘다.
// 숫자(M §2-4): 텀블러 1년 3.5 kg · 대중교통 285.4 kg · 장거리 왕복 비행 1,000 kg 은 ActionsCore(js/actions-core.js) 값 그대로.
//   '본전 약 220번'·'실제 평균 20여 회'는 문헌값 1-7(2차 — 등록부 tumbler_breakeven, unverified → ⓘ에 '확인 중' 경고).
//   1년 컵 더미는 개수만(주당 잔 수 × 52) — 잔당 배출 문헌값이 없어 kg 로 바꾸지 않는다(문헌값 1-7, 4부-11, 등록부 cafe_cup_pile).
// 결과 연결(M4): FPActions.recordCafe — 기록 한 줄(minigameLog.cafe) + 텀블러를 고르면 setMinigameResult('tumbler', …)(D13 '체험해야 켜짐').
//   일회용 컵을 고르면 '들고 나온 쓰레기'로 fp.actions.carry 에 'takeout_cup' 을 남긴다 — M3 분리배출 첫 품목.
// 사진 자세(M §2-5): wide · counter · machine · pour(추출 1.2초 고정) · result(결과 카드 + 컵 더미 104개). /firstperson/?stage=cafe&shot=wide
// 효과음 없음(D12). 외부 파일 0(D11). 실존 브랜드·로고·대표색 흉내 없음(M §0-2): 간판은 가상 이름 + 잔과 잎 그림, 색은 테라코타·크림·올리브.
// 모듈을 읽을 때는 등록만 한다(DOM·THREE 는 build·world 안에서만 — 마스터 §6-10).
// ============================================================================
const FPStageCafe = (() => {
  const TITLE = '초록잔 카페';
  // 문헌값 1-7 (2차 확인, 등록부 tumbler_breakeven — unverified). 화면 글에만 쓴다(행동 계산에는 쓰지 않는다)
  const BREAKEVEN_USES = 220;
  const REAL_USES_TEXT = '20여 회';
  const WEEKS = 52;
  const PER_WEEK_MAX = 14, PER_WEEK_DEFAULT = 2;   // 슬라이더 0~14잔(M §2-4). 사진 자세 result = 2잔 × 52 = 104개
  const pileCount = perWeek => Math.max(0, Math.min(PER_WEEK_MAX, Math.round(Number(perWeek) || 0))) * WEEKS;
  const DRINKS = { americano: { label: '아메리카노', key: 1 }, latte: { label: '카페라테', key: 2 } };
  const CUPS = { pet: { label: '일회용 컵', key: 1 }, tumbler: { label: '내 텀블러', key: 2 } };
  // 세계 쪽 자리(cityGroup 로컬, 유닛). 건물 (0.35, 0.45) 폭 0.13 → 교차로 쪽 면 x = 0.285
  const SHOP = { bx: 0.35, bz: 0.45, face: 0.285, w: 0.126, h: 0.085, doorU: [0.68, 0.9] };
  const NOW = () => (typeof FPModel !== 'undefined' ? FPModel.NOW_YEAR : 2026);

  // ── 크기 비교 막대 (§0-1) — ActionsCore 값 그대로 ─────────────────────────
  function compareRows() {
    const A = id => ActionsCore.ACTIONS.find(a => a.id === id);
    return [
      { id: 'tumbler', label: '텀블러 1년', kg: A('tumbler').kgPerYear, src: A('tumbler').src },
      { id: 'transit', label: '대중교통 1년', kg: A('transit').kgPerYear, src: A('transit').src },
      { id: 'flight', label: '장거리 비행 1번', kg: A('flight').kgPerYear, src: A('flight').src },
    ];
  }

  // ── 캔버스 그림 도우미 ──────────────────────────────────────────────────
  const fontOf = (name, fallback) => {
    try { return (getComputedStyle(document.documentElement).getPropertyValue(name) || '').trim() || fallback; } catch (e) { return fallback; }
  };
  function rrect(c, x, y, w, h, r) {
    c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  }
  // 가게 표시: 잔 하나 + 잎 하나(선 그림). 실존 로고(둥근 배지·인물·별)를 닮지 않게 단순한 선으로만
  function cupMark(c, x, y, s, col) {
    c.save(); c.translate(x, y); c.scale(s, s);
    c.strokeStyle = col; c.lineWidth = 6; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-34, -20); c.lineTo(-26, 34); c.quadraticCurveTo(0, 42, 26, 34); c.lineTo(34, -20); c.stroke();
    c.beginPath(); c.arc(42, 6, 13, -1.2, 1.3); c.stroke();
    c.beginPath(); c.moveTo(-2, -26); c.quadraticCurveTo(-4, -56, 22, -64); c.quadraticCurveTo(24, -36, -2, -26); c.stroke();
    c.beginPath(); c.moveTo(-2, -26); c.lineTo(12, -50); c.stroke();
    c.restore();
  }
  const COL = { cream: '#f3ead8', terra: '#b5653d', olive: '#4a5432', ink: '#2b2a26', sage: '#7f9367', wood: '#8a5a36' };

  // ============================================================================
  // ① 세계 속 외관
  // ============================================================================
  function world(w) {
    if (!w.scene || typeof FPWorld === 'undefined' || !FPWorld.buildings || !w.kit) return {};
    const kit = w.kit;
    const bld = FPWorld.buildings.find(b => Math.abs(b.mesh.position.x - SHOP.bx) < 1e-4 && Math.abs(b.mesh.position.z - SHOP.bz) < 1e-4);
    if (!bld) return {};
    const city = bld.mesh.parent, GB = FPWorld.GROUND_BASE, ZW = FPWorld.ZONE_W;
    const group = new THREE.Group();
    group.name = 'cafeFront';
    city.add(group);
    const bodyFont = fontOf('--font-body', 'sans-serif'), titleFont = fontOf('--font-title', 'serif');

    // 정면 한 장: 색 지도 + 발광 지도(창 안 불빛) + 거칠기 지도(유리 = 매끈 → 세계 환경맵이 비친다)
    const CW = 2048, CH = Math.round(CW * SHOP.h / SHOP.w);
    const winX = [0.06, 0.62], doorX = SHOP.doorU, top = 0.2, bottom = 0.96;
    const draw = (c, W, H, mode) => {
      // mode: 'color' · 'emit' · 'rough'
      const X = u => u * W, Y = v => v * H;
      if (mode === 'color') {
        c.fillStyle = '#e8e0d0'; c.fillRect(0, 0, W, H);                         // 회반죽 벽
        for (let i = 0; i < 900; i++) { c.fillStyle = `rgba(90,70,50,${0.02 + (i % 7) * 0.004})`; c.fillRect((i * 733) % W, (i * 389) % H, 3, 3); }
        c.fillStyle = COL.cream; c.fillRect(X(0.04), Y(0.03), X(0.92), Y(0.13));   // 간판 띠
        c.strokeStyle = COL.olive; c.lineWidth = 6; c.strokeRect(X(0.04), Y(0.03), X(0.92), Y(0.13));
        c.fillStyle = COL.olive; c.font = `700 ${Math.round(H * 0.085)}px ${titleFont}`; c.textBaseline = 'middle'; c.textAlign = 'left';
        cupMark(c, X(0.17), Y(0.1), H * 0.0011, COL.terra);
        c.fillText(TITLE, X(0.24), Y(0.098));
        c.font = `500 ${Math.round(H * 0.04)}px ${bodyFont}`; c.fillStyle = COL.ink; c.textAlign = 'right';
        c.fillText('커피 · 빵', X(0.94), Y(0.1));
        // 창: 실내 그림(따뜻한 빛, 카운터·펜던트·선반 실루엣)
        const g = c.createLinearGradient(0, Y(top), 0, Y(bottom));
        g.addColorStop(0, '#f6dcae'); g.addColorStop(0.6, '#e2b47c'); g.addColorStop(1, '#8a5d3a');
        c.fillStyle = g; c.fillRect(X(winX[0]), Y(top), X(winX[1] - winX[0]), Y(bottom - top));
        c.fillStyle = '#6b4428'; c.fillRect(X(winX[0]), Y(0.68), X(winX[1] - winX[0]), Y(0.12));   // 카운터
        for (let k = 0; k < 24; k++) { c.fillStyle = k % 2 ? '#5b3820' : '#704830'; c.fillRect(X(winX[0] + k * 0.0233), Y(0.8), X(0.0233), Y(0.16)); }
        c.fillStyle = '#c9cdd0'; rrect(c, X(0.14), Y(0.5), X(0.13), Y(0.18), 12); c.fill();               // 머신
        c.fillStyle = '#5a3a24'; c.fillRect(X(0.08), Y(0.36), X(0.5), Y(0.02));                            // 선반
        for (let k = 0; k < 9; k++) { c.fillStyle = '#efe8dc'; c.fillRect(X(0.1 + k * 0.05), Y(0.31), X(0.025), Y(0.05)); }
        for (const u of [0.18, 0.34, 0.5]) { c.fillStyle = '#3a2e24'; c.fillRect(X(u), Y(top), 4, Y(0.12)); c.fillStyle = '#fff3d6';
          c.beginPath(); c.ellipse(X(u), Y(top + 0.14), X(0.03), Y(0.025), 0, 0, Math.PI * 2); c.fill(); }
        // 창틀·문틀(짙은 금속)
        c.strokeStyle = '#33302c'; c.lineWidth = 18;
        c.strokeRect(X(winX[0]), Y(top), X(winX[1] - winX[0]), Y(bottom - top));
        c.beginPath(); c.moveTo(X((winX[0] + winX[1]) / 2), Y(top)); c.lineTo(X((winX[0] + winX[1]) / 2), Y(bottom)); c.stroke();
        c.fillStyle = '#e8c08a'; c.fillRect(X(doorX[0]), Y(top), X(doorX[1] - doorX[0]), Y(1 - top));
        c.fillStyle = 'rgba(80,50,30,0.55)'; c.fillRect(X(doorX[0]), Y(0.72), X(doorX[1] - doorX[0]), Y(0.28));
        c.strokeRect(X(doorX[0]), Y(top), X(doorX[1] - doorX[0]), Y(1 - top));
        c.fillStyle = '#c8c4bc'; c.fillRect(X(doorX[0] + 0.02), Y(0.5), X(0.012), Y(0.16));   // 손잡이
        c.fillStyle = COL.ink; c.font = `600 ${Math.round(H * 0.034)}px ${bodyFont}`; c.textAlign = 'center';
        c.fillText('들어오세요', X((doorX[0] + doorX[1]) / 2), Y(0.3));
        c.fillStyle = '#b8ad9a'; c.fillRect(0, Y(0.965), W, Y(0.035));                       // 걸레받이(돌)
      } else if (mode === 'emit') {
        c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
        c.fillStyle = '#7a5a34'; c.fillRect(X(winX[0]), Y(top), X(winX[1] - winX[0]), Y(bottom - top));
        c.fillStyle = '#6e5232'; c.fillRect(X(doorX[0]), Y(top), X(doorX[1] - doorX[0]), Y(0.52));
        for (const u of [0.18, 0.34, 0.5]) { c.fillStyle = '#ffe9b8'; c.beginPath(); c.ellipse(X(u), Y(top + 0.14), X(0.035), Y(0.03), 0, 0, Math.PI * 2); c.fill(); }
        c.fillStyle = '#3c3624'; c.fillRect(X(0.04), Y(0.03), X(0.92), Y(0.13));          // 간판은 살짝만 밝게
      } else {
        c.fillStyle = '#e6e6e6'; c.fillRect(0, 0, W, H);                                  // 벽 거칠기 0.9
        c.fillStyle = '#1a1a1a'; c.fillRect(X(winX[0]), Y(top), X(winX[1] - winX[0]), Y(bottom - top));   // 유리 0.1
        c.fillRect(X(doorX[0]), Y(top), X(doorX[1] - doorX[0]), Y(0.52));
      }
    };
    const map = kit.canvasTex((c, W, H) => draw(c, W, H, 'color'), CW, CH);
    const emi = kit.canvasTex((c, W, H) => draw(c, W, H, 'emit'), 1024, Math.round(1024 * CH / CW));
    const rgh = kit.canvasTex((c, W, H) => draw(c, W, H, 'rough'), 512, Math.round(512 * CH / CW), { linear: true });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(SHOP.w, SHOP.h),
      new THREE.MeshStandardMaterial({ map, emissiveMap: emi, emissive: 0xffffff, emissiveIntensity: 0.6, roughnessMap: rgh, roughness: 1, metalness: 0 }));
    front.rotation.y = -Math.PI / 2;
    front.position.set(SHOP.face - 0.0006, GB + SHOP.h / 2, SHOP.bz);
    front.receiveShadow = true;
    group.add(front);

    // 차양: 물결 단면(천 주름) — 평면을 주름 방향으로 휘고 앞으로 비스듬히 내민다. 테라코타·크림 줄무늬
    const AW = SHOP.w * 0.66, AD = 0.03, segX = 96;
    const ag = new THREE.PlaneGeometry(AW, AD, segX, 6);
    const ap = ag.attributes.position;
    for (let i = 0; i < ap.count; i++) {
      const x = ap.getX(i), y = ap.getY(i);            // x = 폭, y = 내민 쪽(−AD/2 벽 ~ +AD/2 끝)
      const t = (y + AD / 2) / AD;
      ap.setXYZ(i, x, -t * 0.012 + Math.sin(x / AW * Math.PI * 2 * 11) * 0.0005 * (0.4 + t), t * AD);
    }
    ag.computeVertexNormals();
    const stripe = kit.canvasTex((c, W, H) => {
      for (let k = 0; k < 22; k++) { c.fillStyle = k % 2 ? COL.cream : COL.terra; c.fillRect(k * W / 22, 0, W / 22 + 1, H); }
      c.fillStyle = 'rgba(0,0,0,0.12)'; c.fillRect(0, H * 0.92, W, H * 0.08);
    }, 1024, 128);
    const awning = new THREE.Mesh(ag, new THREE.MeshStandardMaterial({ map: stripe, roughness: 0.85, metalness: 0, side: THREE.DoubleSide }));
    awning.rotation.y = -Math.PI / 2;
    // 창 위(0.06~0.62 → 가운데 0.34)에. 벽에서 앞으로 1.5 m, 높이 약 3.2 m
    awning.position.set(SHOP.face, GB + SHOP.h * (1 - 0.2) + 0.002, SHOP.bz + SHOP.w * (0.34 - 0.5));
    awning.castShadow = true;
    group.add(awning);

    // 화분 2개(세계 축척 — 높이 약 0.8 m: 작은 물체지만 컵처럼 작지 않다). 화분끼리 합쳐 2 메시
    const potGeos = [], bushGeos = [];
    const spots = [SHOP.bz + SHOP.w * (0.04 - 0.5) + 0.006, SHOP.bz + SHOP.w * (0.94 - 0.5)];
    for (const z of spots) {
      const pg = new THREE.LatheGeometry([[0, 0], [0.0045, 0], [0.006, 0.011], [0.0064, 0.012], [0, 0.012]].map(p => new THREE.Vector2(p[0], p[1])), 24);
      pg.translate(SHOP.face - 0.008, GB, z);
      potGeos.push(pg);
      const bg = new THREE.IcosahedronGeometry(0.0085, 2);
      const bp = bg.attributes.position;
      for (let i = 0; i < bp.count; i++) {
        const v = new THREE.Vector3(bp.getX(i), bp.getY(i), bp.getZ(i));
        v.multiplyScalar(1 + (Math.sin(v.x * 900) * Math.cos(v.z * 700) + Math.sin(v.y * 1100)) * 0.08);
        bp.setXYZ(i, v.x, v.y * 1.15, v.z);
      }
      bg.computeVertexNormals();
      bg.translate(SHOP.face - 0.008, GB + 0.019, z);
      bushGeos.push(bg);
      // 충돌(월드 좌표)
      FPWorld.boxes.push({ minX: ZW + SHOP.face - 0.0145, maxX: ZW + SHOP.face - 0.0015, minZ: z - 0.0065, maxZ: z + 0.0065, top: GB + 0.012 });
    }
    const pots = new THREE.Mesh(FPStageKit.mergeGeometries(potGeos), new THREE.MeshStandardMaterial({ color: 0xa65f3c, roughness: 0.8 }));
    const bushes = new THREE.Mesh(FPStageKit.mergeGeometries(bushGeos), new THREE.MeshStandardMaterial({ color: 0x4f6e3a, roughness: 0.9 }));
    pots.castShadow = bushes.castShadow = true;
    pots.receiveShadow = bushes.receiveShadow = true;
    group.add(pots, bushes);

    // 입구
    const doorZ = SHOP.bz + SHOP.w * ((SHOP.doorU[0] + SHOP.doorU[1]) / 2 - 0.5);
    const LEVEL_2000 = (() => {
      try { return EarthVisual.cityLevel(FPModel.sample(2000, FPModel.pathRun(FPModel.BASE_PRESET)).cumFossilMax || 0); } catch (e) { return 0; }
    })();
    let shown = false;
    FPStage.addDoor({
      id: 'cafe', stage: 'cafe', label: '카페에 들어가기',
      pos: new THREE.Vector3(ZW + SHOP.face - 0.002, GB + 0.024, doorZ), radius: 0.065,
      visible: () => shown,
      canEnter: () => (typeof FPScenario !== 'undefined' && FPScenario.year === NOW() ? true : `현재(${NOW()})로 가야 들어갈 수 있어요`),
      // 나오면 문 앞 1.5 m, 길(−x) 쪽을 본다
      from: () => ({ x: ZW + SHOP.face - 0.03, y: FPPlayer.pos.y, z: doorZ, yaw: -Math.PI / 2, pitch: -0.05 }),
    });
    return {
      group, levelFrom: LEVEL_2000, doorZ,
      apply(year, city) {
        shown = !!(city && city.level >= LEVEL_2000 - 1e-9 && bld.mesh.visible);
        group.visible = shown;
      },
    };
  }

  // ============================================================================
  // ② 실내 무대
  // ============================================================================
  function build(kit, ctx) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x3a2e26);
    const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 30);
    const bodyFont = fontOf('--font-body', 'sans-serif'), titleFont = fontOf('--font-title', 'serif');
    const COUNTER_Y = 1.02;   // 카운터 상판 윗면

    // 조명: 주광(창 쪽 왼편 위에서) · 반구광 · 펜던트 점광 3. 그림자 범위 = 카운터 둘레(약 6 × 4 m)
    const PEND = [-1.15, -0.3, 0.55];
    kit.lightRig(scene, {
      size: [6, 4], center: [-0.2, -0.5],
      sun: { dir: [-0.55, 1, 0.45], intensity: 2.0, color: 0xfff1de },
      hemi: { sky: 0xf6ead8, ground: 0x6a5240, intensity: 0.7 },
      points: PEND.map(x => ({ pos: [x, 2.05, -0.75], color: 0xffcf8c, intensity: 2.2, distance: 3.2 })),
      env: { wall: 0xd9c8b0, floor: 0x5a4636, band: 0x4a3426 },
    });

    const S = new THREE.Group(); S.name = 'static'; scene.add(S);   // 움직이지 않는 것 — 끝에 kit.bake 로 합친다
    const M = (geo, mat, o = {}) => kit.mesh(geo, mat, { parent: S, ...o });
    const rb = (w, h, d, r, seg) => kit.roundedBox(w, h, d, r, seg);

    // ── 방 ──
    const floorMat = kit.matOf('tile', { noise: { pattern: 'herringbone', count: 8, color1: '#b8a58c', color2: '#9e8b74', altShare: 0.5, groutColor: '#6f655a', gloss: 0.3 } });
    M(rb(6, 0.05, 4, 0.005, 2), floorMat, { pos: [0, -0.025, 0], cast: false });
    const plaster = kit.matOf('plaster', { noise: { color: '#e9dfcd' } });
    const plasterCeil = kit.matOf('plaster', { noise: { color: '#f1ebe0', seed: 11 } });
    M(rb(6, 0.06, 4, 0.01, 2), plasterCeil, { pos: [0, 3.03, 0], cast: false });
    M(rb(0.08, 3, 4, 0.01, 2), plaster, { pos: [-3.04, 1.5, 0], cast: false });
    M(rb(0.08, 3, 4, 0.01, 2), plaster, { pos: [3.04, 1.5, 0], cast: false });
    M(rb(6, 3, 0.08, 0.01, 2), plaster, { pos: [0, 1.5, 2.04], cast: false });
    const wallWood = kit.matOf('wood', { noise: { planks: 10, light: '#a88866', dark: '#6f543c' } });
    M(rb(6, 3, 0.06, 0.01, 2), wallWood, { pos: [0, 1.5, -2.03], cast: false });
    // 걸레받이
    const darkWood = kit.matOf('wood', { noise: { planks: 6, light: '#6e4a30', dark: '#3e2818', seed: 5 } });
    M(rb(6, 0.1, 0.03, 0.006), darkWood, { pos: [0, 0.05, -1.985], cast: false });
    // 창(왼쪽 벽): 밝은 낮빛 판 + 창틀. 판은 빛을 내는 그림(조명은 주광이 맡는다)
    // 창 밖: 하늘 그러데이션 + 건너편 건물·가로수 실루엣(밝기를 낮춰 노출이 하얗게 타지 않게, Q5)
    const outside = kit.canvasTex((c, W, H) => {
      const g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#9fc2dc'); g.addColorStop(0.62, '#d9e6ec'); g.addColorStop(1, '#bfb8ab');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      const bl = [[0.02, 0.38, 0.2], [0.24, 0.3, 0.16], [0.42, 0.45, 0.22], [0.66, 0.34, 0.14], [0.82, 0.42, 0.18]];
      for (const [x, y, w] of bl) { c.fillStyle = '#b7bec4'; c.fillRect(x * W, y * H, w * W, (0.72 - y) * H);
        c.fillStyle = '#9aa4ac'; for (let k = 0; k < 6; k++) for (let j = 0; j < 3; j++) c.fillRect((x + 0.02 + j * w / 3.2) * W, (y + 0.04 + k * 0.05) * H, w * W * 0.18, H * 0.025); }
      c.fillStyle = '#6f8a5a'; for (const x of [0.15, 0.55, 0.9]) { c.beginPath(); c.ellipse(x * W, 0.62 * H, 0.08 * W, 0.1 * H, 0, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = '#8f8a82'; c.fillRect(0, 0.72 * H, W, 0.28 * H);
    }, 1024, 860);
    const winMat = new THREE.MeshBasicMaterial({ map: outside, color: 0xd8d8d8 });
    M(new THREE.PlaneGeometry(1.7, 1.4), winMat, { pos: [-2.995, 1.55, 0.35], rot: [0, Math.PI / 2, 0], cast: false, receive: false });
    const frameMat = kit.matOf('plasticMatte', { color: 0x3a3632, roughness: 0.5 });
    for (const [w, h, y, z] of [[0.06, 1.5, 1.55, -0.5], [0.06, 1.5, 1.55, 1.2], [0.06, 0.06, 2.27, 0.35], [0.06, 0.06, 0.83, 0.35], [0.06, 1.45, 1.55, 0.35]]) {
      M(rb(0.07, h, h > 0.1 ? 0.06 : 1.76, 0.01), frameMat, { pos: [-2.97, y, z], cast: false });
      void w;
    }

    // ── 카운터: 상판(나무 4 cm, 모서리 1 cm) · 몸통 · 세로 홈 판재 앞판(인스턴싱 1) · 발판 금속 띠 ──
    const CX = -0.3, CZ = -0.75, CW = 3.0, CD = 0.7;
    const top = kit.matOf('wood', { noise: { planks: 3, light: '#cdb08c', dark: '#9c7c58', seed: 3 } });
    M(rb(CW, 0.04, CD, 0.01, 4), top, { pos: [CX, COUNTER_Y - 0.02, CZ] });
    M(rb(CW - 0.04, COUNTER_Y - 0.04, CD - 0.08, 0.01), darkWood, { pos: [CX, (COUNTER_Y - 0.04) / 2, CZ - 0.02], cast: false });
    {
      const n = 36, sw = CW / n;
      const slat = new THREE.InstancedMesh(rb(sw * 0.82, COUNTER_Y - 0.1, 0.035, 0.008, 2), darkWood, n);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) slat.setMatrixAt(i, m4.makeTranslation(CX - CW / 2 + sw * (i + 0.5), (COUNTER_Y - 0.1) / 2 + 0.06, CZ + CD / 2 - 0.02));
      slat.castShadow = true; slat.receiveShadow = true;
      scene.add(slat);
      const steel = kit.matOf('brushedSteel', { repeat: [4, 1] });
      M(kit.tube([[CX - CW / 2 + 0.05, 0.16, CZ + CD / 2 + 0.07], [CX + CW / 2 - 0.05, 0.16, CZ + CD / 2 + 0.07]], 0.018, { tubular: 8 }), steel);
      for (const x of [CX - CW / 2 + 0.2, CX, CX + CW / 2 - 0.2]) M(kit.tube([[x, 0.16, CZ + CD / 2 + 0.07], [x, 0.18, CZ + CD / 2 + 0.02], [x, 0.2, CZ + CD / 2 - 0.01]], 0.01, { tubular: 12 }), steel);
    }
    // 뒤 작업대 + 선반 + 쌓인 컵
    M(rb(5.2, 0.9, 0.5, 0.01), darkWood, { pos: [0, 0.45, -1.75], cast: false });
    M(rb(5.2, 0.04, 0.54, 0.01), top, { pos: [0, 0.92, -1.74] });
    const shelfWood = kit.matOf('wood', { noise: { planks: 2, light: '#9e7f5e', dark: '#6a5038', seed: 9 } });
    for (const y of [1.62, 2.02]) M(rb(2.4, 0.035, 0.24, 0.008), shelfWood, { pos: [-0.3, y, -1.86] });
    const paperCup = kit.matOf('paper', { noise: { color: '#f4efe6' } });
    const ceramic = kit.mat.ceramic;
    {
      // 종이컵 쌓음: 겹친 컵 7개의 바깥 윤곽(아래 컵 몸통 → 테두리마다 한 단씩)을 회전체 하나로 — 컵 7개를 따로 그리면 보이지 않는 안쪽까지 삼각형이 7배
      const rOf = y => 0.03 + 0.011 * Math.max(0, y - 0.003) / 0.097;   // 컵 한 개의 몸통 반지름(높이 y)
      const prof = [[0, 0], [0.028, 0], [0.03, 0.003], [0.041, 0.1], [0.043, 0.102]];
      for (let k = 1; k < 7; k++) { const y = 0.102 + (k - 1) * 0.014; prof.push([rOf(y - k * 0.014), y + 0.0005], [0.041, 0.1 + k * 0.014], [0.043, 0.102 + k * 0.014]); }
      prof.push([0.04, 0.102 + 6 * 0.014], [0, 0.102 + 6 * 0.014 - 0.004]);
      const stackG = kit.lathe(prof, 24, { sharp: true, far: true, points: prof.length * 2 });
      for (let s = 0; s < 4; s++) M(stackG, paperCup, { pos: [-1.3 + s * 0.12, 1.6375, -1.86], cast: false });   // 벽 선반 소품은 그림자 패스에서 뺀다(삼각형 예산) — 선반 위라 떠 보이지 않는다
      // 머그 줄
      const mugG = kit.lathe([[0, 0], [0.036, 0], [0.04, 0.008], [0.042, 0.088], [0.038, 0.09], [0.035, 0.086], [0.035, 0.01], [0, 0.01]], 24, { sharp: true, far: true });
      for (let k = 0; k < 4; k++) M(mugG, ceramic, { pos: [-0.45 + k * 0.15, 2.0375, -1.86], cast: false });
      // 원두 병
      const jar = kit.lathe([[0, 0], [0.05, 0], [0.055, 0.01], [0.055, 0.17], [0.045, 0.18], [0.045, 0.2]], 24, { sharp: true, far: true });
      const lidM = kit.matOf('plasticMatte', { color: 0x2f2b27, roughness: 0.4 });
      const beanBag = kit.matOf('cardboard', { noise: { color: '#9a6a44', flutes: 0 } });
      for (let k = 0; k < 3; k++) {
        M(jar, beanBag, { pos: [0.2 + k * 0.16, 1.6375, -1.86] });
        M(kit.lathe([[0, 0], [0.047, 0], [0.048, 0.02], [0, 0.022]], 24, { far: true }), lidM, { pos: [0.2 + k * 0.16, 1.8375, -1.86] });
      }
    }

    // ── 메뉴판(칠판 느낌, 손글씨풍 — 맞춤법 확인) ──
    {
      const board = kit.canvasTex((c, W, H) => {
        c.fillStyle = '#2d3330'; c.fillRect(0, 0, W, H);
        for (let i = 0; i < 4000; i++) { c.fillStyle = `rgba(255,255,255,${0.012 + (i % 5) * 0.004})`; c.fillRect((i * 997) % W, (i * 613) % H, 2 + (i % 3), 2); }
        c.fillStyle = '#f4efe2'; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.font = `700 ${H * 0.13}px ${titleFont}`; c.fillText('오늘의 메뉴', W / 2, H * 0.16);
        c.strokeStyle = 'rgba(244,239,226,0.7)'; c.lineWidth = 4; c.beginPath(); c.moveTo(W * 0.3, H * 0.27); c.lineTo(W * 0.7, H * 0.27); c.stroke();
        c.textAlign = 'left'; c.font = `500 ${H * 0.085}px ${titleFont}`;
        const rows = [['아메리카노', '따뜻하게 · 시원하게'], ['카페라테', '따뜻하게 · 시원하게'], ['오늘의 빵', '진열장에서 골라 주세요']];
        rows.forEach(([a, b], i) => {
          const y = H * (0.42 + i * 0.16);
          c.fillStyle = '#f4efe2'; c.fillText(a, W * 0.1, y);
          c.fillStyle = '#e8c9a0'; c.font = `400 ${H * 0.06}px ${titleFont}`; c.fillText(b, W * 0.48, y + H * 0.005);
          c.font = `500 ${H * 0.085}px ${titleFont}`;
        });
        c.fillStyle = '#c9dcb0'; c.textAlign = 'center'; c.font = `500 ${H * 0.06}px ${titleFont}`;
        c.fillText('텀블러를 가져오면 그대로 담아 드려요', W / 2, H * 0.9);
        cupMark(c, W * 0.88, H * 0.17, H * 0.0012, '#e8c9a0');
      }, 2048, 1024);
      // 선반 머그(위 끝 약 2.13 m)에 가리지 않게 높이 2.2~2.96 m
      M(rb(1.7, 0.76, 0.04, 0.01), shelfWood, { pos: [-0.3, 2.58, -1.98] });
      M(new THREE.PlaneGeometry(1.6, 0.68), new THREE.MeshStandardMaterial({ map: board, roughness: 0.92 }), { pos: [-0.3, 2.58, -1.955], cast: false });
    }

    // ── 커피 머신 (주인공) ──
    const steel = kit.matOf('brushedSteel', { repeat: [5, 5] });   // 결을 촘촘하게(1 m 에 5번) — 넓은 몸체에서 줄무늬로 보이지 않게
    const chrome = kit.mat.chrome;
    const blackP = kit.matOf('plasticMatte', { color: 0x1f1e1d, roughness: 0.38 });
    const MX = -0.95, MZ = -0.82;
    const machine = new THREE.Group(); machine.position.set(MX, COUNTER_Y, MZ); S.add(machine);
    const MM = (geo, mat, o = {}) => kit.mesh(geo, mat, { parent: machine, ...o });
    MM(rb(0.74, 0.07, 0.5, 0.012), steel, { pos: [0, 0.035, 0] });                    // 받침대
    MM(rb(0.74, 0.32, 0.2, 0.014), steel, { pos: [0, 0.07 + 0.16, -0.15] });           // 뒤 기둥
    MM(rb(0.74, 0.21, 0.5, 0.016, 5), steel, { pos: [0, 0.39 + 0.105, 0] });           // 머리
    MM(rb(0.7, 0.012, 0.46, 0.004), blackP, { pos: [0, 0.606, 0] });                    // 윗판(컵 데우는 자리)
    MM(kit.tube([[-0.36, 0.63, 0.24], [-0.36, 0.63, -0.24], [0.36, 0.63, -0.24], [0.36, 0.63, 0.24]], 0.006, { tubular: 48 }), chrome);
    for (const x of [-0.36, 0.36]) for (const z of [0.24, -0.24]) MM(kit.tube([[x, 0.61, z], [x, 0.63, z]], 0.006, { tubular: 2 }), chrome);
    // 컵 받침 망: 물받이 + 막대 12개(인스턴싱)
    MM(rb(0.62, 0.022, 0.2, 0.006), blackP, { pos: [0, 0.081, 0.13] });
    {
      const bars = new THREE.InstancedMesh(rb(0.6, 0.008, 0.008, 0.002, 2), chrome, 12);
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < 12; i++) bars.setMatrixAt(i, m4.makeTranslation(MX, COUNTER_Y + 0.096, MZ + 0.05 + i * 0.015));
      bars.castShadow = true; bars.receiveShadow = true;
      scene.add(bars);
    }
    const TRAY_Y = COUNTER_Y + 0.1;
    // 그룹헤드 2 + 포터필터(나무 손잡이) + 이중 추출구
    const woodH = kit.matOf('wood', { noise: { planks: 1, light: '#9b6a43', dark: '#5c3a22', seed: 21 } });
    const GH = [MX - 0.17, MX + 0.17];
    const groupHead = kit.lathe([[0.045, 0], [0.048, 0.01], [0.04, 0.03], [0.032, 0.05], [0.03, 0.06]], 48);
    const basket = kit.lathe([[0, 0], [0.03, 0], [0.036, 0.008], [0.037, 0.025], [0.04, 0.03]], 48, { sharp: true });
    const spout = kit.lathe([[0.003, 0], [0.005, 0.004], [0.006, 0.018], [0.008, 0.022]], 24, { far: true });
    for (const gx of GH) {
      kit.mesh(groupHead, chrome, { parent: S, pos: [gx, COUNTER_Y + 0.33, MZ + 0.17] });
      kit.mesh(basket, chrome, { parent: S, pos: [gx, COUNTER_Y + 0.30, MZ + 0.17] });
      // 손잡이: 양 끝이 막힌 회전체를 눕힌다(관으로 만들면 끝이 뚫린 홈통처럼 보였다)
      kit.mesh(kit.lathe([[0, 0], [0.009, 0.003], [0.012, 0.03], [0.014, 0.12], [0.011, 0.14], [0, 0.143]], 48), woodH,
        { parent: S, pos: [gx, COUNTER_Y + 0.318, MZ + 0.2], rot: [Math.PI / 2 - 0.08, 0, 0] });
      for (const dx of [-0.012, 0.012]) kit.mesh(spout, chrome, { parent: S, pos: [gx + dx, COUNTER_Y + 0.278, MZ + 0.17] });
    }
    const SPOUT_Y = COUNTER_Y + 0.278;
    // 스팀 노즐(굽은 관) — 오른쪽
    const wandTip = new THREE.Vector3(MX + 0.33, COUNTER_Y + 0.17, MZ + 0.31);
    kit.mesh(kit.tube([[MX + 0.31, COUNTER_Y + 0.43, MZ + 0.2], [MX + 0.33, COUNTER_Y + 0.42, MZ + 0.27], [MX + 0.34, COUNTER_Y + 0.3, MZ + 0.31], wandTip.toArray()], 0.006, { tubular: 48 }), chrome, { parent: S });
    kit.mesh(kit.lathe([[0.012, 0], [0.014, 0.01], [0.014, 0.03], [0.01, 0.034]], 48), blackP, { parent: S, pos: [MX + 0.31, COUNTER_Y + 0.43, MZ + 0.2] });
    // 압력계: 크롬 테 + 눈금판(캔버스) + 유리 덮개(투명도 낮은 반사판 — transmission 은 꼭 필요한 컵·진열장·호퍼에만)
    {
      const dial = kit.canvasTex((c, W, H) => {
        c.fillStyle = '#f7f4ec'; c.beginPath(); c.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2); c.fill();
        c.translate(W / 2, H / 2);
        for (let i = 0; i <= 16; i++) {
          const a = -Math.PI * 1.25 + i / 16 * Math.PI * 1.5;
          c.strokeStyle = i >= 8 && i <= 11 ? '#b5653d' : '#2b2a26'; c.lineWidth = i % 2 ? 4 : 8;
          c.beginPath(); c.moveTo(Math.cos(a) * W * 0.36, Math.sin(a) * W * 0.36); c.lineTo(Math.cos(a) * W * (i % 2 ? 0.42 : 0.45), Math.sin(a) * W * (i % 2 ? 0.42 : 0.45)); c.stroke();
          if (i % 4 === 0) { c.fillStyle = '#2b2a26'; c.font = `600 ${W * 0.09}px ${bodyFont}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(i), Math.cos(a) * W * 0.27, Math.sin(a) * W * 0.27); }
        }
        c.font = `500 ${W * 0.07}px ${bodyFont}`; c.fillText('bar', 0, W * 0.2);
        const na = -Math.PI * 1.25 + 9 / 16 * Math.PI * 1.5;
        c.strokeStyle = '#1d1c1a'; c.lineWidth = 7; c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(na) * W * 0.38, Math.sin(na) * W * 0.38); c.stroke();
        c.fillStyle = '#1d1c1a'; c.beginPath(); c.arc(0, 0, W * 0.04, 0, Math.PI * 2); c.fill();
      }, 512, 512);
      const gz = MZ + 0.252, gy = COUNTER_Y + 0.495;
      kit.mesh(new THREE.CircleGeometry(0.042, 64), new THREE.MeshStandardMaterial({ map: dial, roughness: 0.6 }), { parent: S, pos: [MX, gy, gz], cast: false });
      kit.mesh(new THREE.TorusGeometry(0.045, 0.006, 16, 64), chrome, { parent: S, pos: [MX, gy, gz] });
      const cover = new THREE.Mesh(new THREE.SphereGeometry(0.045, 48, 12, 0, Math.PI * 2, 0, 0.35),
        new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.03, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, depthWrite: false }));
      cover.rotation.x = Math.PI / 2; cover.position.set(MX, gy, gz - 0.041);
      cover.renderOrder = kit.ORDER.clear; cover.castShadow = false;
      S.add(cover);
      // 단추 4개
      for (let k = 0; k < 4; k++) kit.mesh(rb(0.03, 0.018, 0.012, 0.004), blackP, { parent: S, pos: [MX - 0.27 + k * 0.05 + (k > 1 ? 0.36 : 0), COUNTER_Y + 0.55, MZ + 0.252] });
    }

    // ── 그라인더: 몸체 + 투명 호퍼 + 원두(인스턴싱 ≤ 200) ──
    const GX = -0.32, GZ = -0.9;
    M(rb(0.17, 0.3, 0.2, 0.02, 5), blackP, { pos: [GX, COUNTER_Y + 0.15, GZ] });
    M(kit.lathe([[0.05, 0], [0.055, 0.01], [0.05, 0.04], [0.045, 0.05]], 48), steel, { pos: [GX, COUNTER_Y + 0.3, GZ] });
    M(rb(0.05, 0.05, 0.06, 0.008), steel, { pos: [GX, COUNTER_Y + 0.15, GZ + 0.11] });
    const hopper = kit.mesh(kit.lathe([[0.03, 0], [0.04, 0.02], [0.085, 0.17], [0.088, 0.18]], 64, { sharp: true }), kit.matOf('clearPET', { thickness: 0.003 }), { pos: [GX, COUNTER_Y + 0.35, GZ] });
    hopper.userData.keep = true; scene.add(hopper);
    {
      const N = 160, bean = new THREE.SphereGeometry(0.0062, 7, 5);
      bean.scale(1, 0.62, 0.78);
      const beans = new THREE.InstancedMesh(bean, new THREE.MeshStandardMaterial({ color: 0x4a2a16, roughness: 0.45 }), N);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      for (let i = 0; i < N; i++) {
        const h = 0.01 + (i / N) * 0.1, r = (0.032 + h * 0.3) * Math.sqrt((i * 0.618) % 1) * 0.85, a = i * 2.39996;
        e.set(i * 1.3, i * 0.7, i * 2.1); q.setFromEuler(e);
        m4.compose(new THREE.Vector3(GX + Math.cos(a) * r, COUNTER_Y + 0.35 + h, GZ + Math.sin(a) * r), q, new THREE.Vector3(1, 1, 1));
        beans.setMatrixAt(i, m4);
      }
      beans.castShadow = false;
      scene.add(beans);
    }

    // ── 유리 진열장 + 빵 4종 ──
    {
      const DX = 0.78, DZ = -0.78;
      M(rb(0.72, 0.05, 0.44, 0.01), steel, { pos: [DX, COUNTER_Y + 0.025, DZ] });
      M(rb(0.66, 0.012, 0.38, 0.004), shelfWood, { pos: [DX, COUNTER_Y + 0.056, DZ] });
      const glassBox = kit.mesh(rb(0.72, 0.34, 0.44, 0.012, 4), kit.mat.glass, { pos: [DX, COUNTER_Y + 0.05 + 0.17, DZ] });
      glassBox.userData.keep = true; scene.add(glassBox);
      // 크러스트: 위는 짙게, 아래는 옅게(정점 색)
      const crust = (geo, top, low) => {
        const p = geo.attributes.position, col = [];
        geo.computeBoundingBox();
        const y0 = geo.boundingBox.min.y, y1 = geo.boundingBox.max.y, A = new THREE.Color(low), B = new THREE.Color(top), c = new THREE.Color();
        for (let i = 0; i < p.count; i++) { c.copy(A).lerp(B, Math.pow((p.getY(i) - y0) / (y1 - y0 || 1), 0.7)); col.push(c.r, c.g, c.b); }
        geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
        return geo;
      };
      const breadMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.72 });
      const Y0 = COUNTER_Y + 0.062;
      // 둥근 빵 2
      for (const [x, z] of [[-0.22, -0.06], [-0.12, 0.08]]) {
        const g = crust(kit.lathe([[0, 0], [0.05, 0], [0.058, 0.015], [0.05, 0.04], [0.03, 0.055], [0, 0.06]], 48), 0x9a5a24, 0xe0b57c);
        M(g, breadMat, { pos: [DX + x, Y0, DZ + z] });
      }
      // 크루아상: 관 + 굵기 바꾸기(가운데 두껍게)
      {
        const curve = new THREE.CatmullRomCurve3([[-0.07, 0, 0.03], [-0.03, 0, -0.01], [0.03, 0, -0.01], [0.07, 0, 0.03]].map(p => new THREE.Vector3(...p)));
        const g = kit.tube(curve, 0.022, { tubular: 48, radial: 16 });
        const p = g.attributes.position, n = 49, rs = 17;
        for (let i = 0; i <= 48; i++) {
          const t = i / 48, k = 0.45 + 0.55 * Math.sin(Math.PI * t), ctr = curve.getPointAt(t);
          for (let j = 0; j < rs; j++) {
            const idx = i * rs + j; if (idx >= p.count) continue;
            p.setXYZ(idx, ctr.x + (p.getX(idx) - ctr.x) * k, (p.getY(idx) - ctr.y) * k * 0.8 + 0.018 * k, ctr.z + (p.getZ(idx) - ctr.z) * k);
          }
        }
        void n;
        g.computeVertexNormals();
        crust(g, 0x8c4f1c, 0xd9a463);
        M(g, breadMat, { pos: [DX + 0.06, Y0, DZ - 0.05] });
      }
      // 머핀: 종이 컵 + 부푼 윗부분
      {
        const cup = kit.lathe([[0, 0], [0.032, 0], [0.04, 0.045], [0.042, 0.046]], 48, { sharp: true });
        M(cup, kit.matOf('paper', { noise: { color: '#c9b08a' } }), { pos: [DX + 0.2, Y0, DZ + 0.08] });
        const g = crust(kit.lathe([[0.04, 0], [0.05, 0.012], [0.045, 0.03], [0.025, 0.045], [0, 0.05]], 48), 0x6b3a1c, 0xb07a44);
        M(g, breadMat, { pos: [DX + 0.2, Y0 + 0.044, DZ + 0.08] });
      }
      // 긴 빵(바게트 조각)
      {
        const g = new THREE.CapsuleGeometry(0.025, 0.14, 12, 32);
        g.rotateZ(Math.PI / 2); g.scale(1, 0.75, 1); g.translate(0, 0.02, 0);
        crust(g, 0xa8662c, 0xe2bd88);
        M(g, breadMat, { pos: [DX + 0.18, Y0, DZ - 0.1], rot: [0, 0.3, 0] });
      }
    }

    // ── 펜던트 등 3: 줄 · 우윳빛 유리 갓(빛을 내는 갓 — 투명 재질 아님) · 전구 ──
    {
      const shadeMat = new THREE.MeshStandardMaterial({ color: 0xf6efe2, emissive: 0xffd9a0, emissiveIntensity: 0.9, roughness: 0.35, side: THREE.DoubleSide });
      const capMat = kit.matOf('brushedSteel', { color: 0x2d2a27 });
      const cordMat = kit.matOf('rubber', { color: 0x1e1d1c });
      const shade = kit.lathe([[0.012, 0.2], [0.03, 0.19], [0.09, 0.08], [0.13, 0.0]], 48);
      for (const x of PEND) {
        M(shade, shadeMat, { pos: [x, 2.0, -0.75], cast: false });
        M(kit.lathe([[0, 0.24], [0.022, 0.235], [0.024, 0.19], [0.012, 0.18]], 24, { far: true }), capMat, { pos: [x, 2.0, -0.75], cast: false });
        M(kit.tube([[x, 2.24, -0.75], [x, 3.0, -0.75]], 0.004, { tubular: 2 }), cordMat, { cast: false });
        M(new THREE.SphereGeometry(0.03, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xfff0cc).multiplyScalar(2) }), { pos: [x, 2.06, -0.75], cast: false, receive: false });
      }
    }

    // ── 화분 2 ──
    {
      const potM = kit.matOf('ceramic', { color: 0xb36a45 });
      const leafM = new THREE.MeshStandardMaterial({ color: 0x55703f, roughness: 0.8 });
      const pot = kit.lathe([[0, 0], [0.16, 0], [0.2, 0.36], [0.215, 0.38], [0, 0.38]], 48, { sharp: true });
      for (const [x, z, s] of [[-2.55, 1.2, 1], [2.55, -1.35, 0.85]]) {
        const pg = new THREE.Group(); pg.position.set(x, 0, z); pg.scale.setScalar(s); S.add(pg);
        kit.mesh(pot, potM, { parent: pg });
        for (let k = 0; k < 9; k++) {
          const g = new THREE.SphereGeometry(0.13, 16, 10);
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i++) { const f = 1 + 0.12 * Math.sin(p.getX(i) * 40 + k) * Math.cos(p.getZ(i) * 37); p.setXYZ(i, p.getX(i) * f, p.getY(i) * f * 1.1, p.getZ(i) * f); }
          g.computeVertexNormals();
          const a = k * 2.4, r = k ? 0.12 : 0;
          kit.mesh(g, leafM, { parent: pg, pos: [Math.cos(a) * r, 0.5 + (k % 3) * 0.14, Math.sin(a) * r] });
        }
        kit.groundShadow(pg, 0.55 * s, { y: 0 });
      }
    }

    // ── 키오스크(세로 화면, 캔버스 UI) ──
    const KW = 1152, KH = 2048;
    const BTN = { americano: [0.08, 0.36, 0.84, 0.2], latte: [0.08, 0.6, 0.84, 0.2] };   // 캔버스 비율 [x, y, w, h]
    let screenState = 'welcome';
    const drawScreen = (c, W, H) => {
      c.fillStyle = '#f6f1e7'; c.fillRect(0, 0, W, H);
      c.fillStyle = COL.terra; c.fillRect(0, 0, W, H * 0.14);
      cupMark(c, W * 0.14, H * 0.07, W * 0.0016, COL.cream);
      c.fillStyle = COL.cream; c.font = `700 ${W * 0.085}px ${titleFont}`; c.textAlign = 'left'; c.textBaseline = 'middle';
      c.fillText(TITLE, W * 0.27, H * 0.072);
      c.textAlign = 'center'; c.fillStyle = COL.ink;
      const big = (t, y, s = 0.075, wgt = 700) => { c.font = `${wgt} ${W * s}px ${bodyFont}`; c.fillText(t, W / 2, H * y); };
      if (screenState === 'welcome') {
        big('어서 오세요', 0.32, 0.1);
        big('화면을 눌러 주문하세요', 0.42, 0.065, 500);
        cupMark(c, W / 2, H * 0.62, W * 0.006, COL.olive);
        c.fillStyle = '#5f5a52'; big('키보드: Tab 으로 고르고 Enter', 0.86, 0.045, 500);
      } else if (screenState === 'menu') {
        big('음료를 골라 주세요', 0.24, 0.075);
        for (const [id, [x, y, w, h]] of Object.entries(BTN)) {
          c.fillStyle = '#ffffff'; rrect(c, W * x, H * y, W * w, H * h, 40); c.fill();
          c.strokeStyle = COL.olive; c.lineWidth = 8; c.stroke();
          c.fillStyle = COL.terra; c.beginPath(); c.arc(W * (x + 0.12), H * (y + h / 2), W * 0.06, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#fff'; c.font = `700 ${W * 0.07}px ${bodyFont}`; c.fillText(String(DRINKS[id].key), W * (x + 0.12), H * (y + h / 2));
          c.fillStyle = COL.ink; c.textAlign = 'left'; c.font = `700 ${W * 0.08}px ${bodyFont}`;
          c.fillText(DRINKS[id].label, W * (x + 0.24), H * (y + h / 2 - 0.02));
          c.font = `500 ${W * 0.045}px ${bodyFont}`; c.fillStyle = '#5f5a52';
          c.fillText(id === 'americano' ? '에스프레소 + 물' : '에스프레소 + 우유', W * (x + 0.24), H * (y + h / 2 + 0.04));
          c.textAlign = 'center';
          cupMark(c, W * (x + w - 0.12), H * (y + h / 2), W * 0.0022, COL.olive);
        }
        c.fillStyle = '#5f5a52'; big('숫자 1 · 2 로도 고를 수 있어요', 0.88, 0.045, 500);
      } else if (screenState === 'cup') {
        big(DRINKS[st.drink].label, 0.3, 0.09);
        big('어디에 받을까요?', 0.42, 0.07, 500);
        big('카운터 위의 컵을 골라 주세요', 0.5, 0.05, 500);
      } else if (screenState === 'brew') {
        big('만드는 중이에요', 0.4, 0.08);
        big(`${DRINKS[st.drink].label} · ${CUPS[st.cup].label}`, 0.5, 0.055, 500);
      } else {
        big('맛있게 드세요', 0.4, 0.09);
        cupMark(c, W / 2, H * 0.6, W * 0.005, COL.terra);
      }
    };
    const screenTex = kit.canvasTex(drawScreen, KW, KH);
    const setScreen = s => { screenState = s; screenTex.redraw(); };
    const kiosk = new THREE.Group();
    // 카운터 앞 오른쪽 끝 — 카운터 앞 시점(VIEW.counter)에서 컵·키오스크가 한 화면에 들어오게(화면 밖이면 Tab 으로도 못 고른다)
    kiosk.position.set(1.4, 0, 0.0);
    kiosk.rotation.y = -0.6;
    scene.add(kiosk);
    const kWhite = kit.matOf('plasticMatte', { color: 0xeeebe4, roughness: 0.45 });
    kit.mesh(rb(0.44, 0.03, 0.36, 0.008), steel, { parent: kiosk, pos: [0, 0.015, 0] });
    kit.mesh(rb(0.11, 0.98, 0.09, 0.02, 4), kWhite, { parent: kiosk, pos: [0, 0.52, -0.02] });
    const head = new THREE.Group(); head.position.set(0, 1.38, 0); head.rotation.x = -0.14; kiosk.add(head);
    kit.mesh(rb(0.46, 0.8, 0.07, 0.022, 5), kWhite, { parent: head });
    const screen = kit.mesh(new THREE.PlaneGeometry(0.4, 0.4 * KH / KW), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false }), { parent: head, pos: [0, 0.0, 0.0355], cast: false, receive: false });
    screen.userData.pick = { label: '키오스크', order: 1, enabled: () => st.phase === 'idle' || st.phase === 'kiosk' };
    kit.groundShadow(kiosk, [0.55, 0.45], { y: 0, opacity: 0.45 });

    // ── 고르는 컵 두 개 ──
    const petMat = kit.matOf('clearPET', { thickness: 0.004, roughness: 0.08 });
    const pet = new THREE.Group();
    // PET 컵: 얇은 몸통(한 겹), 위 테두리 말림, 돔 뚜껑·빨대는 받을 때 나타난다
    const PET_H = 0.14, PET_R0 = 0.029, PET_R1 = 0.046;
    // 몸통: 바닥 · 옆면(돋을 띠 2줄 — 투명 컵 윤곽에 하이라이트가 맺히는 자리) · 말린 테두리
    {
      const r = y => PET_R0 + (PET_R1 - PET_R0) * (y - 0.004) / (PET_H - 0.004);
      const prof = [[0, 0.001], [PET_R0 - 0.002, 0.001], [PET_R0, 0.004]];
      for (const y of [0.05, 0.1]) prof.push([r(y - 0.002), y - 0.002], [r(y) + 0.0012, y], [r(y + 0.002), y + 0.002]);
      prof.push([PET_R1, PET_H], [PET_R1 + 0.0022, PET_H + 0.0015], [PET_R1 + 0.001, PET_H + 0.003]);
      kit.mesh(kit.lathe(prof, 64, { sharp: true, points: 48 }), petMat, { parent: pet });
    }
    const dome = kit.mesh(kit.lathe([[PET_R1 + 0.002, 0], [PET_R1 + 0.003, 0.006], [0.04, 0.03], [0.015, 0.048], [0.009, 0.05], [0, 0.05]], 64), petMat, { parent: pet, pos: [0, PET_H, 0] });
    const straw = kit.mesh(kit.tube([[0.008, 0.02, 0], [0.009, 0.2, 0], [0.016, 0.24, 0]], 0.0035, { tubular: 24 }), kit.matOf('plasticMatte', { color: 0x6f8a4f, roughness: 0.35 }), { parent: pet });
    const ice = [];
    {
      const im = new THREE.MeshPhysicalMaterial({ color: 0xe9f3f8, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 });
      for (let k = 0; k < 5; k++) {
        const c = kit.mesh(rb(0.024, 0.022, 0.024, 0.004, 3), im, { parent: pet, cast: false });
        c.userData.slot = [Math.cos(k * 1.9) * 0.018, Math.sin(k * 1.9) * 0.018, 0.02 + (k % 2) * 0.022, k * 0.7];
        c.visible = false; ice.push(c);
      }
    }
    // 텀블러: 헤어라인 스테인리스 몸체 + 실리콘 띠 + 무광 뚜껑(돌려 닫음)
    const tum = new THREE.Group();
    const TUM_H = 0.18;
    kit.mesh(kit.lathe([[0, 0.001], [0.033, 0.001], [0.036, 0.005], [0.037, 0.08], [0.04, 0.17], [0.0405, TUM_H], [0.037, TUM_H], [0.036, 0.17], [0.034, 0.08], [0.031, 0.01], [0, 0.01]], 64, { sharp: true }), steel, { parent: tum });
    kit.mesh(kit.lathe([[0.0385, 0.06], [0.0393, 0.065], [0.0396, 0.095], [0.0389, 0.1]], 64), kit.matOf('rubber', { color: 0x5b6e4a }), { parent: tum });
    const tLid = new THREE.Group(); tLid.position.set(0, TUM_H, 0); tum.add(tLid);
    kit.mesh(kit.lathe([[0.041, -0.002], [0.042, 0.012], [0.036, 0.026], [0.012, 0.028], [0, 0.028]], 64), kit.matOf('plasticMatte', { color: 0x30332f, roughness: 0.42 }), { parent: tLid });
    kit.mesh(rb(0.03, 0.008, 0.012, 0.003), kit.matOf('plasticMatte', { color: 0x30332f, roughness: 0.42 }), { parent: tLid, pos: [0.015, 0.03, 0] });

    // 액체: 원뿔대 안쪽 그대로 차오르게 — 위로 넘치는 정점을 액면(L)에 눌러 붙이고 그 높이의 반지름으로 줄인다(크기 변환으로 늘이면 반쯤 찼을 때 위가 너무 넓다)
    function makeLiquid(r0, r1, H, y0) {
      const g = kit.lathe([[0, 0], [r0, 0], [r1, H], [0, H]], 48, { sharp: true, points: 30 });
      const base = Float32Array.from(g.attributes.position.array);
      const mat = kit.matOf('liquidCoffee');
      const mesh = kit.mesh(g, mat, { cast: false, pos: [0, y0, 0] });
      const crema = kit.mesh(new THREE.CircleGeometry(1, 48), kit.matOf('crema'), { cast: false, rot: [-Math.PI / 2, 0, 0] });
      const rAt = y => r0 + (r1 - r0) * Math.min(1, Math.max(0, y / H));
      let lvl = -1;
      return {
        mesh, crema, mat,
        set(level, topKind) {
          level = Math.max(0, Math.min(1, level));
          mesh.visible = level > 0.002;
          crema.visible = mesh.visible && !!topKind;
          if (level === lvl) return;
          lvl = level;
          const L = level * H, p = g.attributes.position.array;
          for (let i = 0; i < p.length; i += 3) {
            const y = base[i + 1];
            if (y > L) { const k = rAt(L) / (rAt(y) || 1); p[i] = base[i] * k; p[i + 1] = L; p[i + 2] = base[i + 2] * k; }
            else { p[i] = base[i]; p[i + 1] = y; p[i + 2] = base[i + 2]; }
          }
          g.attributes.position.needsUpdate = true;
          g.computeVertexNormals();
          crema.position.y = y0 + L + 0.0008;
          crema.scale.setScalar(rAt(L) * 0.97);
        },
      };
    }
    const petLiq = makeLiquid(PET_R0 - 0.002, PET_R1 - 0.002, PET_H - 0.025, 0.002); pet.add(petLiq.mesh, petLiq.crema);
    const tumLiq = makeLiquid(0.03, 0.035, TUM_H - 0.035, 0.011); tum.add(tumLiq.mesh, tumLiq.crema);
    const HOME = { pet: new THREE.Vector3(-0.08, COUNTER_Y, -0.52), tumbler: new THREE.Vector3(0.22, COUNTER_Y, -0.52) };
    const SERVE = new THREE.Vector3(0.05, COUNTER_Y, -0.5);
    const TRAY = new THREE.Vector3(GH[0], TRAY_Y, MZ + 0.17);
    const LID_ASIDE = new THREE.Vector3(GH[0] + 0.12, TRAY_Y + 0.002, MZ + 0.26);
    pet.position.copy(HOME.pet); tum.position.copy(HOME.tumbler);
    pet.userData.pick = { label: '일회용 컵', order: 2, enabled: () => st.phase === 'cup' };
    tum.userData.pick = { label: '내 텀블러', order: 3, enabled: () => st.phase === 'cup' };
    scene.add(pet, tum);
    kit.groundShadow(pet, 0.1, { y: COUNTER_Y });
    kit.groundShadow(tum, 0.1, { y: COUNTER_Y });
    const cupObj = { pet, tumbler: tum };

    // 추출 줄기 2개 · 김(컵 · 스팀 노즐)
    const streams = [-0.012, 0.012].map(dx => kit.pourStream({ from: [GH[0] + dx, SPOUT_Y, MZ + 0.17], to: [GH[0] + dx, TRAY_Y + 0.03, MZ + 0.17], r: 0.0016, color: 0x4a2410 }));
    streams.forEach(s => scene.add(s.obj));
    const cupSteam = kit.steam({ origin: [0, 0, 0], count: 26, spread: 0.025, height: 0.2, size: 0.045, autostart: false });
    scene.add(cupSteam.obj);
    const wandSteam = kit.steam({ origin: wandTip.toArray(), count: 30, spread: 0.03, height: 0.25, size: 0.06, autostart: false, opacity: 0.45 });
    scene.add(wandSteam.obj);

    // ── 1년 컵 더미(인스턴싱, 개수만 — kg 로 바꾸지 않는다) ──
    // 먼 소품이라 둘레 분할 16 의 낮은 회전체(Q2 의 48 은 화면 가까이 오는 회전체 규칙). 728개 × 160삼각형 ≈ 12만
    // 자리: 카운터 왼쪽 끝과 창 사이 바닥(키오스크에 가리지 않게)
    const PILE_MAX = PER_WEEK_MAX * WEEKS, PILE_C = new THREE.Vector3(-2.38, 0, -0.72), PILE_GAP = 0.09;
    const pileGeo = new THREE.LatheGeometry([[0, 0], [0.029, 0], [0.031, 0.004], [0.046, 0.14], [0.047, 0.142]].map(p => new THREE.Vector2(p[0], p[1])), 16);
    const pile = new THREE.InstancedMesh(pileGeo, new THREE.MeshStandardMaterial({ color: 0xdbe5e8, roughness: 0.28, metalness: 0, side: THREE.DoubleSide }), PILE_MAX);
    pile.count = 0; pile.castShadow = true; pile.receiveShadow = true;
    pile.frustumCulled = false;   // 경계 구는 처음(0개) 한 번만 재서 원점 둘레로 굳는다 — 그대로 두면 더미가 통째로 잘려 안 보였다
    scene.add(pile);
    const pileMats = (() => {
      // 층마다 격자가 줄어드는 더미(아래 13 × 13). 결정적 흔들림
      const out = [], m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
      let layer = 0;
      while (out.length < PILE_MAX) {
        const n = Math.max(1, 13 - layer), cells = [];
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) cells.push([i - (n - 1) / 2, j - (n - 1) / 2]);
        cells.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
        for (const [i, j] of cells) {
          if (out.length >= PILE_MAX) break;
          const k = out.length;
          e.set(Math.sin(k * 12.9) * 0.25, k * 0.77, Math.cos(k * 7.3) * 0.25); q.setFromEuler(e);
          m4.compose(new THREE.Vector3(PILE_C.x + i * PILE_GAP + Math.sin(k) * 0.008, layer * 0.125, PILE_C.z + j * PILE_GAP + Math.cos(k * 1.7) * 0.008), q, one);
          out.push(m4.clone());
        }
        layer++;
      }
      return out;
    })();
    let pileShown = 0, pileTarget = 0, pileT = 1;
    const POP = 0.25;
    function setPile(n, instant) {
      pileTarget = Math.min(PILE_MAX, n);
      if (instant || ctx.reducedMotion) { pileShown = pileTarget; pileT = 1; } else pileT = 0;
      pileFrom = pileShown;
    }
    let pileFrom = 0;
    const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();
    function updatePile(dt) {
      if (pileT < 1) pileT = Math.min(1, pileT + dt / 1.5);
      const cur = pileT >= 1 ? pileTarget : Math.round(pileFrom + (pileTarget - pileFrom) * kit.EASE.easeInOutSine(pileT));
      const head = pileT >= 1 ? 0 : 24;   // 막 생긴 것 몇 개는 위에서 떨어지며 커진다
      for (let i = 0; i < cur; i++) {
        const age = cur - i;
        if (age <= head && pileTarget > pileFrom) {
          pileMats[i].decompose(_p, _q, _s);
          const k = age / head;
          _p.y += (1 - k) * 0.25; _s.setScalar(0.4 + 0.6 * k);
          pile.setMatrixAt(i, _m.compose(_p, _q, _s));
        } else pile.setMatrixAt(i, pileMats[i]);
      }
      if (cur !== pile.count || pileT < 1 || pileShown !== cur) { pile.count = cur; pile.instanceMatrix.needsUpdate = true; }
      pileShown = cur;
      void POP;
    }

    // 굽기 — 움직이지 않는 것을 재질별로 합친다(드로우콜 예산)
    kit.bake(S);

    // ============================================================================
    // 흐름
    // ============================================================================
    const st = { phase: 'idle', drink: null, cup: null, t: 0, perWeek: PER_WEEK_DEFAULT, marks: {}, visited: false };
    const VIEW = {
      door: { pos: [0.25, 1.65, 1.85], target: [-0.2, 1.1, -0.9], fov: 58 },
      counter: { pos: [0.2, 1.62, 1.3], target: [0.5, 1.05, -0.7], fov: 55 },
      machine: { pos: [-0.7, 1.4, -0.12], target: [-1.05, 1.22, -0.66], fov: 44 },
    };
    // 키오스크 화면 앞 0.55 m
    {
      kiosk.updateMatrixWorld(true);
      const c = screen.getWorldPosition(new THREE.Vector3()), n = new THREE.Vector3(0, 0, 1).applyQuaternion(screen.getWorldQuaternion(new THREE.Quaternion()));
      VIEW.kiosk = { pos: c.clone().addScaledVector(n, 0.62).add(new THREE.Vector3(0, 0.04, 0)).toArray(), target: c.toArray(), fov: 50 };
    }
    let cam = null;   // { from, to, t, ms }
    const lerpV = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
    const _tg = new THREE.Vector3();
    function setView(v) {
      camera.position.set(...v.pos); camera.lookAt(...v.target); camera.fov = v.fov; camera.updateProjectionMatrix();
      cam = null; curView = v;
    }
    let curView = VIEW.counter;
    function moveView(v, ms) {
      if (ctx.reducedMotion || ctx.shotMode) { setView(v); return; }
      cam = { from: curView, to: v, t: 0, ms };
      curView = v;
    }
    function updateCam(dt) {
      if (!cam) return;
      cam.t = Math.min(1, cam.t + dt * 1000 / cam.ms);
      const e = kit.EASE.easeInOutCubic(cam.t);
      camera.position.set(...lerpV(cam.from.pos, cam.to.pos, e));
      _tg.set(...lerpV(cam.from.target, cam.to.target, e));
      camera.lookAt(_tg);
      camera.fov = cam.from.fov + (cam.to.fov - cam.from.fov) * e;
      camera.updateProjectionMatrix();
      if (cam.t >= 1) cam = null;
    }

    // ── HTML 겹침(종이 테마 부품) ──
    const ui = document.createElement('div');
    ui.className = 'cafe-ui';
    ui.innerHTML = `
      <p class="cafe-hint" hidden></p>
      <div class="cafe-ask" role="group" aria-label="컵 고르기" hidden>
        <p class="cafe-ask-q">어디에 받을까요?</p>
        <div class="cafe-ask-btns">
          <button class="btn btn--view" type="button" data-cup="pet"><span class="key">1</span>일회용 컵</button>
          <button class="btn btn--view" type="button" data-cup="tumbler"><span class="key">2</span>내 텀블러</button>
        </div>
      </div>
      <aside class="cafe-card" role="dialog" aria-labelledby="cafeCardTitle" hidden></aside>`;
    ctx.ui.appendChild(ui);
    ui.hidden = true;
    const hintEl = ui.querySelector('.cafe-hint'), askEl = ui.querySelector('.cafe-ask'), cardEl = ui.querySelector('.cafe-card');
    askEl.querySelectorAll('[data-cup]').forEach(b => b.addEventListener('click', () => chooseCup(b.dataset.cup)));
    const hint = t => { hintEl.textContent = t || ''; hintEl.hidden = !t; };

    function resetCups() {
      [pet, tum, tLid, dome, straw].forEach(o => kit.stop(o));
      pet.position.copy(HOME.pet); pet.rotation.set(0, 0, 0); pet.scale.set(1, 1, 1);
      tum.position.copy(HOME.tumbler); tum.rotation.set(0, 0, 0); tum.scale.set(1, 1, 1);
      kit.setShadowSurface(pet, COUNTER_Y); kit.setShadowSurface(tum, COUNTER_Y);
      dome.visible = false; dome.position.set(0, PET_H, 0);
      straw.visible = false; straw.position.set(0, 0, 0);
      tLid.parent !== tum && tum.add(tLid);
      tLid.position.set(0, TUM_H, 0); tLid.rotation.set(0, 0, 0);
      petLiq.set(0); tumLiq.set(0);
      ice.forEach(c => { c.visible = false; });
      streams.forEach(s => { s.obj.visible = false; });
      cupSteam.stop(); wandSteam.stop();
      kit.highlight(pet, false); kit.highlight(tum, false);
    }
    function reset() {
      st.phase = 'idle'; st.drink = null; st.cup = null; st.t = 0; st.marks = {};
      resetCups();
      setScreen('welcome');
      askEl.hidden = true; cardEl.hidden = true; hint('');
      setPile(0, true); updatePile(0);
    }
    function openKiosk() {
      if (st.phase !== 'idle') return;
      st.phase = 'kiosk';
      setScreen('menu');
      moveView(VIEW.kiosk, 900);
      hint('1 아메리카노 · 2 카페라테 — 화면을 눌러도 돼요');
    }
    function chooseDrink(d) {
      if (st.phase !== 'kiosk' || !DRINKS[d]) return;
      st.drink = d; st.phase = 'cup';
      setScreen('cup');
      moveView(VIEW.counter, 900);
      hint('');
      askEl.hidden = false;
      kit.highlight(pet, true); kit.highlight(tum, true);   // 두 컵을 강조(들림 + 테두리)
      const first = askEl.querySelector('button');
      if (first && !ctx.shotMode) first.focus();
    }
    function chooseCup(c) {
      if (st.phase !== 'cup' || !CUPS[c]) return;
      st.cup = c; st.phase = 'brew'; st.t = 0; st.marks = {};
      askEl.hidden = true;
      if (document.activeElement && ui.contains(document.activeElement)) document.activeElement.blur();
      kit.highlight(pet, false); kit.highlight(tum, false);
      setScreen('brew');
    }
    // 추출 시간표 (초). 줄기 2.5초(M §2-3-4). 사진 자세 pour = 추출 시작(0.7) + 1.2초
    const T = { arc: 0, pourOn: 0.7, pourOff: 3.2, back: 3.6, lid: 4.3, twist: 4.75, straw: 4.7, done: 5.3 };
    const once = (k, fn) => { if (!st.marks[k]) { st.marks[k] = true; fn(); } };
    const hot = () => st.cup === 'tumbler';   // 텀블러 = 따뜻하게, 일회용 투명 컵 = 시원하게(얼음이 보인다)
    function updateBrew(dt) {
      st.t += dt;
      const t = st.t, cup = cupObj[st.cup], liq = st.cup === 'pet' ? petLiq : tumLiq;
      const isLatte = st.drink === 'latte';
      once('arc', () => {
        moveView(VIEW.machine, 800);
        kit.arc(cup, HOME[st.cup].clone(), TRAY, 0.12, 600);
        if (st.cup === 'tumbler') {   // 뚜껑을 열어 옆에 둔다
          tum.updateMatrixWorld(true);
          const w = tLid.getWorldPosition(new THREE.Vector3());
          scene.attach(tLid); tLid.position.copy(w);
          kit.arc(tLid, w, LID_ASIDE, 0.08, 500);
        } else ice.forEach(c => { c.visible = true; });
        liq.mat.color.set(isLatte ? 0xb68a62 : 0x2a1208);
      });
      if (t >= T.arc + 0.62) once('tray', () => kit.setShadowSurface(cup, TRAY_Y));
      if (t >= T.pourOn) once('pour', () => {
        streams.forEach(s => { s.setEnds([s.obj.position.x, SPOUT_Y, MZ + 0.17], [s.obj.position.x, TRAY_Y + 0.02, MZ + 0.17]); s.start(250); });
        if (isLatte) wandSteam.start();
      });
      // 액면: 줄기가 이어지는 동안 0 → 0.92
      const fill = Math.max(0, Math.min(1, (t - T.pourOn - 0.15) / (T.pourOff - T.pourOn)));
      if (st.phase === 'brew' || st.phase === 'serve') {
        const topKind = fill > 0.55 ? (isLatte ? 'foam' : 'crema') : null;
        liq.set(fill * 0.92, topKind);
        liq.crema.material = topKind === 'foam' ? foamMat : cremaMat;
        if (st.cup === 'pet') ice.forEach(c => { const [x, z, y0, a] = c.userData.slot; c.position.set(x, 0.002 + Math.max(y0, fill * 0.92 * (PET_H - 0.025) - 0.012), z); c.rotation.set(a, a * 1.3, a * 0.7); });
      }
      // 줄기 아래 끝 = 지금 액면
      const surfY = cup.position.y + (st.cup === 'pet' ? 0.002 + fill * 0.92 * (PET_H - 0.025) : 0.011 + fill * 0.92 * (TUM_H - 0.035));
      if (t < T.pourOff + 0.4) streams.forEach(s => s.setEnds([s.obj.position.x, SPOUT_Y, MZ + 0.17], [s.obj.position.x, surfY, MZ + 0.17]));
      if (t >= T.pourOff) once('pourOff', () => { streams.forEach(s => s.stop(300)); wandSteam.stop(); });
      if (t >= T.back) once('back', () => {
        st.phase = 'serve';
        moveView(VIEW.counter, 800);
        kit.arc(cup, TRAY.clone(), SERVE, 0.1, 600);
      });
      if (t >= T.back + 0.62) once('served', () => kit.setShadowSurface(cup, COUNTER_Y));
      if (t >= T.lid) once('lid', () => {
        if (st.cup === 'pet') { dome.visible = true; dome.position.set(0, PET_H + 0.12, 0); kit.tween(dome, { position: [0, PET_H, 0] }, 350); }
        else kit.arc(tLid, tLid.position.clone(), new THREE.Vector3(SERVE.x, SERVE.y + TUM_H + 0.012, SERVE.z), 0.1, 420, { squash: false });
      });
      if (st.cup === 'tumbler' && t >= T.twist) once('twist', () => {
        tum.updateMatrixWorld(true);
        tum.attach(tLid);
        kit.tween(tLid, { position: [0, TUM_H, 0], rotation: [0, Math.PI * 2, 0] }, 400);   // 돌려 닫기 0.4초
      });
      if (st.cup === 'pet' && t >= T.straw) once('straw', () => { straw.visible = true; straw.position.set(0, 0.1, 0); kit.tween(straw, { position: [0, 0, 0] }, 300); });
      // 김: 따뜻한 텀블러는 액면이 반쯤 찬 뒤부터 뚜껑 닫을 때까지
      if (hot()) {
        cupSteam.origin.set(cup.position.x, surfY + 0.005, cup.position.z);
        if (fill > 0.4 && t < T.twist) cupSteam.start(); else cupSteam.stop();
      }
      if (t >= T.done) once('done', () => finish());
    }
    const cremaMat = petLiq.crema.material;
    const foamMat = new THREE.MeshStandardMaterial({ color: 0xf2ebe0, roughness: 0.75 });
    tumLiq.crema.material = cremaMat;

    // 썸네일: 받은 컵을 무대 렌더 그대로 작은 그림으로(같은 렌더러로 한 번 그리고 바로 캔버스에 옮긴다)
    const thumbCam = new THREE.PerspectiveCamera(32, 1, 0.03, 10);
    let thumbURL = '';
    function captureThumb() {
      const R = kit.renderer;
      if (!R || !R.domElement) return '';
      try {
        const cup = cupObj[st.cup];
        const c = cup.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0.1, 0));
        thumbCam.position.set(c.x + 0.16, c.y + 0.12, c.z + 0.38); thumbCam.lookAt(c);
        const el = R.domElement, size = Math.min(el.width, el.height);
        thumbCam.aspect = el.width / el.height; thumbCam.updateProjectionMatrix();
        R.render(scene, thumbCam);
        const cv = document.createElement('canvas'); cv.width = cv.height = 240;
        cv.getContext('2d').drawImage(el, (el.width - size) / 2, (el.height - size) / 2, size, size, 0, 0, 240, 240);
        return cv.toDataURL('image/png');
      } catch (e) { return ''; }
    }

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const kgTxt = v => (typeof FPActions !== 'undefined' ? FPActions.fmtKg(v) : String(v));
    function finish() {
      st.phase = 'result';
      setScreen('done');
      thumbURL = captureThumb();
      const result = { drink: st.drink, cup: st.cup, perWeek: null, at: new Date().toISOString() };
      // 결과 연결(M4 가 행동 계산·학습지 기록을 잇는다). 텀블러 = '나의 행동' 텀블러 켜짐(D13). 일회용 컵 = 분리배출 첫 품목
      if (!ctx.shotMode) {
        // 4차 M4: 기록 한 줄(fp.actions.minigameLog.cafe — G1 시트) + 텀블러면 '나의 행동' 텀블러 켜짐(FPActions.setMinigameResult('tumbler', …), D13)
        if (typeof FPActions !== 'undefined') FPActions.recordCafe({ ...result, drinkLabel: DRINKS[st.drink].label, cupLabel: CUPS[st.cup].label });
        if (st.cup === 'pet') {
          try { WorksheetStore.updateFp(fp => { const a = fp.actions || (fp.actions = {}); a.carry = [...new Set([...(Array.isArray(a.carry) ? a.carry : []), 'takeout_cup'])]; }); } catch (e) { /* 메모리 */ }
        }
      }
      st.result = result;
      showCard();
    }
    function showCard() {
      const tumKg = compareRows()[0].kg, rows = compareRows(), max = Math.max(...rows.map(r => r.kg));
      // ⓘ 는 srcButton('키')(js/source-tip.js)를 그대로 부른다 — check_sources.js 가 이 글꼴의 키를 훑어 등록부 누락을 막는다
      const sb = srcButton;
      cardEl.innerHTML = `
        <h2 id="cafeCardTitle">${esc(DRINKS[st.drink].label)} · ${esc(CUPS[st.cup].label)}</h2>
        <div class="cc-top">${thumbURL ? `<img class="cc-thumb" src="${thumbURL}" alt="받은 음료: ${esc(DRINKS[st.drink].label)}, ${esc(CUPS[st.cup].label)}">` : ''}
          <p class="cc-lead">텀블러를 1년 동안 쓰면 CO₂를 약 <b>${kgTxt(tumKg)} kg</b> 줄여요 <span class="cc-sub">(1인)</span>${srcButton('act_tumbler')}</p></div>
        <h3>텀블러는 오래 써야 이득이에요</h3>
        <p>텀블러도 만들 때 배출이 있어서, 약 <b>${BREAKEVEN_USES}번</b> 이상 써야 일회용 컵보다 낫다는 추정이 있어요(영국 환경청 발표를 인용한 보도).${srcButton('tumbler_breakeven')}
          그런데 실제로는 평균 <b>${REAL_USES_TEXT}</b> 쓰는 데 그친다고 해요.</p>
        <p class="cc-think">생각할 거리 — 내 텀블러는 몇 번 썼나요?</p>
        <h3>1년 컵 더미 보기 <span class="cc-sub">선택</span></h3>
        <label class="cc-slider"><span>일주일에 일회용 컵 <b class="cc-pw">${st.perWeek}</b>잔</span>
          <input type="range" class="range" min="0" max="${PER_WEEK_MAX}" step="1" value="${st.perWeek}" aria-label="일주일에 일회용 컵 몇 잔"></label>
        <p class="cc-pile">1년이면 일회용 컵 <b class="cc-n">${pileCount(st.perWeek).toLocaleString('ko-KR')}</b>개 <span class="cc-sub">(잔 수 × 52주 — 개수만 셉니다)</span>${srcButton('cafe_cup_pile')}</p>
        <h3>크기 비교 <span class="cc-sub">1인 · 1년에 줄이는 CO₂</span></h3>
        <div class="cc-bars">${rows.map(r => `<div class="cc-bar"><span class="cc-bl">${esc(r.label)}${sb(r.src)}</span>
          <span class="cc-track" role="img" aria-label="${esc(r.label)} ${kgTxt(r.kg)} kg"><i style="width:${Math.max(0.4, r.kg / max * 100).toFixed(2)}%"></i></span><b>${kgTxt(r.kg)} kg</b></div>`).join('')}</div>
        <p class="cc-sub">대중교통 = 자가용 대신 1년, 장거리 비행 = 왕복 1번을 줄였을 때. 텀블러는 작지만 확실한 행동이고, 큰 차이는 이동·비행에서 나와요.</p>
        <div class="cc-actions"><button class="btn btn--nav is-on" type="button" data-leave disabled>가게 나가기</button></div>`;
      cardEl.hidden = false;
      const range = cardEl.querySelector('input[type="range"]');
      range.addEventListener('input', () => {
        st.perWeek = Number(range.value);
        cardEl.querySelector('.cc-pw').textContent = st.perWeek;
        cardEl.querySelector('.cc-n').textContent = pileCount(st.perWeek).toLocaleString('ko-KR');
        if (st.result) st.result.perWeek = st.perWeek;
        setPile(pileCount(st.perWeek));
      });
      // 손을 뗐을 때 한 번만 기록을 고친다(input 마다 쓰면 끌 때 저장이 수십 번)
      range.addEventListener('change', () => { if (!ctx.shotMode && st.result && typeof FPActions !== 'undefined') FPActions.patchMinigameLog('cafe', st.result.at, { perWeek: st.perWeek }); });
      const leave = cardEl.querySelector('[data-leave]');
      leave.addEventListener('click', () => FPStage.exit());
      // 크기 비교를 건너뛸 수 없게 — 닫기는 1.5초 뒤에(M §0-1)
      setTimeout(() => { leave.disabled = false; }, 1500);
      if (typeof Icons !== 'undefined' && Icons.fill) Icons.fill(cardEl);
      if (!ctx.shotMode) cardEl.querySelector('h2').setAttribute('tabindex', '-1'), cardEl.querySelector('h2').focus();
      setPile(pileCount(st.perWeek));
    }

    // ── 사진 자세 ──
    const shots = {
      wide: { pos: [1.1, 1.75, 1.95], target: [-0.15, 1.05, -0.95], fov: 64 },
      counter: { pos: [0.08, 1.34, 0.3], target: [0.07, 1.08, -0.55], fov: 42 },
      machine: { pos: [-0.62, 1.42, -0.06], target: [-0.95, 1.33, -0.7], fov: 42 },
      pour: { pos: [-0.86, 1.33, -0.24], target: [-1.12, 1.21, -0.66], fov: 38, t: T.pourOn + 1.2, freeze: true },
      result: { pos: [-0.75, 1.55, 1.25], target: [-2.15, 0.35, -0.7], fov: 52, t: 1.6, freeze: true },
    };
    function onShot(name) {
      reset();
      if (name === 'pour') {
        st.drink = 'americano'; st.cup = 'pet'; st.phase = 'brew'; st.t = 0; st.marks = {};
        setScreen('brew');
        pet.position.copy(TRAY);
        st.marks.arc = true; ice.forEach(c => { c.visible = true; }); petLiq.mat.color.set(0x2a1208); kit.setShadowSurface(pet, TRAY_Y);
      } else if (name === 'counter') {
        st.drink = 'americano'; st.phase = 'cup';
        setScreen('cup');
        kit.highlight(pet, true); kit.highlight(tum, true);
        askEl.hidden = false;
      } else if (name === 'result') {
        st.drink = 'americano'; st.cup = 'pet'; st.perWeek = PER_WEEK_DEFAULT;
        pet.position.copy(SERVE);
        dome.visible = true; straw.visible = true; ice.forEach(c => { c.visible = true; });
        petLiq.mat.color.set(0x2a1208); petLiq.set(0.92, 'crema');
        ice.forEach(c => { const [x, z, , a] = c.userData.slot; c.position.set(x, 0.09, z); c.rotation.set(a, a, a); });
        st.phase = 'result'; setScreen('done');
        thumbURL = captureThumb();
        showCard();
        setPile(pileCount(st.perWeek));
      }
    }

    return {
      scene, camera, shots, enterShot: null,
      onShot,
      state: () => ({ phase: st.phase, t: +st.t.toFixed(2), drink: st.drink, cup: st.cup, perWeek: st.perWeek, pile: pile.count }),   // 검사·콘솔 확인용(읽기만)
      onEnter(info) {
        ui.hidden = false;
        if (info.shot) return;   // 사진 자세는 onShot 이 장면을 맞춘다
        reset();
        setView(VIEW.door);
        moveView(VIEW.counter, 1200);   // 문 → 카운터 앞 1.2초(움직임 줄이기면 바로)
        if (!st.visited) hint('키오스크에서 음료를 골라 보세요');
        st.visited = true;
      },
      onExit() {
        ui.hidden = true;
        reset();
      },
      update(dt) {
        updateCam(dt);
        if (st.phase === 'brew' || st.phase === 'serve') updateBrew(dt);
        updatePile(dt);
      },
      pick(obj, info) {
        if (obj === screen) {
          if (st.phase === 'idle') { openKiosk(); return; }
          if (st.phase === 'kiosk') {
            if (!info.uv) return;   // 키보드 Enter 는 숫자 1·2 로 고른다(안내에 적혀 있다)
            const x = info.uv.x, y = 1 - info.uv.y;
            for (const [id, [bx, by, bw, bh]] of Object.entries(BTN)) if (x >= bx && x <= bx + bw && y >= by && y <= by + bh) chooseDrink(id);
          }
          return;
        }
        if (obj === pet) chooseCup('pet');
        else if (obj === tum) chooseCup('tumbler');
      },
      key(e) {
        const n = { Digit1: 1, Numpad1: 1, Digit2: 2, Numpad2: 2 }[e.code];
        if (!n) return false;
        if (st.phase === 'kiosk') { chooseDrink(n === 1 ? 'americano' : 'latte'); return true; }
        if (st.phase === 'cup') { chooseCup(n === 1 ? 'pet' : 'tumbler'); return true; }
        return false;
      },
    };
  }

  // 등록 — 덮개 제목 · 노출(카페 1.0, M §1-3 출발값 — 🧑 조정)
  if (typeof FPStage !== 'undefined') {
    let W = null;
    FPStage.register('cafe', {
      title: TITLE, exposure: 1.0,
      build,
      world(w) { W = world(w); return W; },
      onWorldYear(year, city) { if (W && W.apply) W.apply(year, city); },
    });
  }
  return { TITLE, BREAKEVEN_USES, REAL_USES_TEXT, WEEKS, PER_WEEK_MAX, PER_WEEK_DEFAULT, pileCount, DRINKS, CUPS, SHOP, compareRows };
})();
