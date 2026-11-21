// ============================================================================
// 1인칭 세계 속 기후테크 (4차 T3) — 해상풍력 · 지붕 태양광 · 숲 · CCUS 설비 · DAC 팬 벽 · SMR 모듈 · 충전소
// ----------------------------------------------------------------------------
// 왜 따로 떼었나:
//   3장 '결정자'에서 학생이 회의실(T2)에서 설계한 사회가 미래 세계에 구역마다 보여야 한다(TASK_4차_T §4).
//   fp-world.js 는 이미 2,000줄이라 소품 일곱 종을 더 넣으면 찾기 어렵다. 그래서 만들기·갱신만 여기 두고,
//   세계 상태를 바꾸는 통로는 C5 applyWorldState(s, soc) 하나 그대로다 — 그 끝에서 FPTechWorld.apply 를 부른다(새 통로 없음).
//   '몇 기·몇 그루를 보일지'는 값 모듈 FPModel.techState(s, soc)에서만 정한다(node 로 검사, 등록부 fp_tech_visual — 연출).
//
// 축척(함정 13): 세계는 1유닛 = 50 m. 소품 크기는 주석에 실척(m)으로 적는다. 다만 세계 속 건물이 가장 높아야 24 m 라,
//   해상풍력(실제 허브 높이 100 m 넘음)은 그대로 세우면 세계를 덮는다 → 허브 21 m · 날개 8.5 m 로 줄인 '세계 축척 연출'이다.
// 성능(마스터 §5-13 '세계 드로우콜 +30 이하'): 종류마다 InstancedMesh 하나(정적 부위는 정점색으로 한 지오메트리에 굽는다) →
//   최대 9 드로우콜 + 그림자 7. 보일 것이 0개인 종류는 mesh.visible = false 라 드로우콜도 0.
//   해상풍력 날개는 날개 하나를 인스턴싱하고 회전은 행렬 갱신으로(T §4).
// 품질(M §6 Q1·Q3·Q4): 둥근 모서리(돌출 + 경사 roundedBox) · 접지(받침판 + 그림자 받기/드리우기) · 종류별 재질(금속·콘크리트·유리판).
// 렌더러 설정(노출·그림자·scene.environment)은 건드리지 않는다(함정 14). 투명 재질 없음(함정 15).
// 로드 순서: fp-world → fp-tech-world → fp-minimap … (firstperson/index.html 과 tools/build_single_html.py FP_JS 를 같이 맞춘다)
// ============================================================================
const FPTechWorld = (() => {
  const W = FPWorld;
  let B = null;   // build() 결과

  // ── 지오메트리 도우미 ────────────────────────────────────────────────────
  // 둥근 모서리 상자: 모서리를 둥글린 직사각형을 돌출하고 경사(bevel)로 앞뒤 모서리까지 둥글린다.
  // r160 코어에는 RoundedBoxGeometry 가 없고 examples/jsm 애드온은 쓰지 않는다(함정 11).
  function roundedBox(w, h, d, r) {
    r = Math.max(1e-4, Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4));
    const iw = w - 2 * r, ih = h - 2 * r, rc = Math.min(iw, ih) * 0.25;
    const s = new THREE.Shape();
    const x0 = -iw / 2, x1 = iw / 2, y0 = -ih / 2, y1 = ih / 2;
    s.moveTo(x0 + rc, y0); s.lineTo(x1 - rc, y0); s.quadraticCurveTo(x1, y0, x1, y0 + rc);
    s.lineTo(x1, y1 - rc); s.quadraticCurveTo(x1, y1, x1 - rc, y1);
    s.lineTo(x0 + rc, y1); s.quadraticCurveTo(x0, y1, x0, y1 - rc);
    s.lineTo(x0, y0 + rc); s.quadraticCurveTo(x0, y0, x0 + rc, y0);
    const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(1e-4, d - 2 * r), bevelEnabled: true,
      bevelSize: r, bevelThickness: r, bevelSegments: 2, curveSegments: 3 });
    g.translate(0, 0, -(d - 2 * r) / 2);
    return g;
  }
  // 여러 조각을 정점색 하나의 지오메트리로 굽는다(fp-world.js bakeGroup 과 같은 방식 — 개체당 1 드로우콜).
  // parts: [geo, 색(hex), [x, y, z], [rx, ry, rz]?, [sx, sy, sz]?]
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
  const _c = new THREE.Color();
  function bake(parts) {
    const gs = parts.map(([geo, hex, p, r, sc]) => {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      _m.compose(_v.set(...p), _q.setFromEuler(_e.set(...(r || [0, 0, 0]))), _s.set(...(sc || [1, 1, 1])));
      g.applyMatrix4(_m);
      return { g, hex };
    });
    const total = gs.reduce((n, { g }) => n + g.attributes.position.count, 0);
    const pos = new Float32Array(total * 3), nor = new Float32Array(total * 3), col = new Float32Array(total * 3);
    let off = 0;
    for (const { g, hex } of gs) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, off * 3);
      nor.set(g.attributes.normal.array, off * 3);
      _c.setHex(hex);   // 작업 색공간(선형)으로 바뀐 값이라 정점색에 그대로 넣는다
      for (let i = 0; i < n; i++) { const j = (off + i) * 3; col[j] = _c.r; col[j + 1] = _c.g; col[j + 2] = _c.b; }
      off += n;
      g.dispose();
    }
    for (const [geo] of parts) geo.dispose();
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return out;
  }
  function instanced(geo, mat, max, shadow) {
    const im = new THREE.InstancedMesh(geo, mat, max);
    im.count = 0;
    im.visible = false;
    im.castShadow = shadow;
    im.receiveShadow = true;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    W.scene.add(im);
    return im;
  }
  // 재질은 종류마다 하나 — 조각 색은 정점색, 거칠기·금속성으로 재질을 구별한다(Q4)
  const vmat = (roughness, metalness, extra = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness, metalness, ...extra });

  // 결정적 난수 — 숲 추가 나무 자리가 불러올 때마다 바뀌면 같은 해에 다시 와서 잰 '나무 밑' 값이 달라진다
  function rng(seed) { return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

  // 충돌체 켜고 끄기: 숨은 것은 반경 −1·윗면 −∞ (fp-player 충돌·동물 회피가 둘 다 반경을 먼저 본다)
  function colOn(c, on) { c.r = on ? c.r0 : -1; c.top = on ? c.top0 : -Infinity; }
  function boxOn(b, on) {
    if (on) Object.assign(b, b.on); else { b.minX = b.maxX = b.minZ = b.maxZ = 1e9; b.top = -Infinity; }
  }

  // ── 만들기 ───────────────────────────────────────────────────────────────
  function build() {
    if (B) return B;
    const GB = W.GROUND_BASE, Z = W.ZONE_W, WY = W.waveBaseY;
    const dummy = new THREE.Object3D();
    B = {};

    // ① 바다: 해상풍력 6기 — 해변(동쪽, x = −1)에서 먼 서쪽 가장자리에 한 줄. 유빙 자리(로컬 x ≥ −0.5)와 겹치지 않는다.
    //   실척: 수면 위 허브 21 m, 탑 지름 0.8~0.9 m, 날개 8.5 m(세계 축척 연출 — 머리말)
    {
      const HUB_Y = 0.425;   // 수면에서 허브까지
      const g = bake([
        [new THREE.CylinderGeometry(0.010, 0.011, 0.20, 14), 0x6d7378, [0, -0.10, 0]],                 // 단일 말뚝(물속·해저까지)
        [new THREE.CylinderGeometry(0.012, 0.012, 0.03, 14), 0xe0b43a, [0, 0.015, 0]],                 // 전이부(노란 안전색)
        [new THREE.CylinderGeometry(0.022, 0.022, 0.004, 18), 0x8b9196, [0, 0.032, 0]],                // 작업 발판
        [new THREE.CylinderGeometry(0.0055, 0.0085, HUB_Y - 0.034, 14), 0xeef0ee, [0, 0.034 + (HUB_Y - 0.034) / 2, 0]], // 탑
        [roundedBox(0.048, 0.018, 0.018, 0.005), 0xe8eae8, [0.012, HUB_Y, 0]],                         // 나셀(발전기 집, 회전축 x 방향으로 길다)
        [new THREE.SphereGeometry(0.008, 12, 8), 0xf4f5f2, [-0.014, HUB_Y, 0], [0, 0, Math.PI / 2], [1, 1.5, 1]], // 허브(스피너)
      ]);
      const im = instanced(g, vmat(0.45, 0.25), 6, true);
      // 날개 하나: 뿌리 폭 1.1 m → 끝 0.25 m, 길이 8.5 m. 회전축 = x(바다 쪽을 보는 로터면)
      const bs = new THREE.Shape();
      bs.moveTo(-0.0055, 0.004); bs.quadraticCurveTo(0.002, 0.06, 0.0013, 0.17);
      bs.lineTo(-0.0013, 0.17); bs.quadraticCurveTo(-0.004, 0.08, -0.0055, 0.004);
      const bg = new THREE.ExtrudeGeometry(bs, { depth: 0.0012, bevelEnabled: true, bevelSize: 0.0006, bevelThickness: 0.0006, bevelSegments: 1, curveSegments: 6 });
      bg.rotateY(Math.PI / 2);
      const blades = instanced(bg, new THREE.MeshStandardMaterial({ color: 0xf4f5f2, roughness: 0.4, metalness: 0.1 }), 18, true);
      const zs = [-1.15, -0.69, -0.23, 0.23, 0.69, 1.15];
      const list = zs.map((z, i) => {
        const lx = -0.80 + (i % 2) * 0.06;   // 살짝 엇갈리게(한 줄이 기계처럼 보이지 않게)
        const x = lx - Z, y = WY;
        const col = { x, z, r0: 0.016, top0: y + HUB_Y, r: -1, top: -Infinity };
        W.cylinders.push(col);
        return { x, y, z, hub: new THREE.Vector3(x - 0.022, y + HUB_Y, z), phase: i * 0.7, col };
      });
      B.wind = { im, blades, list, n: 0, angle: 0 };
    }

    // ② 도시 지붕 태양광: 건물 지붕마다 패널 2~4장(너비 3 m × 1.75 m, 남쪽으로 25° 기울임). 서는 건물·높이가 해마다 바뀌어
    //   자리는 apply 에서 그해 건물 높이로 다시 잡는다.
    {
      const g = bake([
        [roundedBox(0.060, 0.003, 0.035, 0.001), 0xb9bec4, [0, 0, 0]],          // 알루미늄 틀
        [new THREE.BoxGeometry(0.056, 0.0016, 0.031), 0x1d3357, [0, 0.0016, 0]], // 셀 판
        [new THREE.BoxGeometry(0.0008, 0.0018, 0.031), 0x8fa2bd, [0, 0.0018, 0]],  // 셀 사이 띠(가로)
        [new THREE.BoxGeometry(0.056, 0.0018, 0.0008), 0x8fa2bd, [0, 0.0018, 0]],  // 셀 사이 띠(세로)
        [new THREE.BoxGeometry(0.003, 0.012, 0.003), 0x8b9196, [-0.024, -0.006, 0.012]], // 받침 다리(뒤쪽이 높다)
        [new THREE.BoxGeometry(0.003, 0.012, 0.003), 0x8b9196, [0.024, -0.006, 0.012]],
      ]);
      B.solar = { im: instanced(g, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.15 }),
        W.buildings.length * 4, false) };
    }

    // ③ 녹지: 숲 되살리기 — 지금 나무(26그루)의 최대 +50 % = 13그루. 줄기·수관 두 InstancedMesh(지금 나무와 같은 재질).
    {
      const base = W.treeMats || {};
      const trunkMat = base.trunk || new THREE.MeshStandardMaterial({ color: 0x6b4f35, roughness: 0.9 });
      const leafMat = base.leaf || new THREE.MeshStandardMaterial({ color: 0x3f7433, roughness: 0.8, flatShading: true });
      const trunkGeo = new THREE.CylinderGeometry(0.012, 0.018, 1, 8);
      trunkGeo.translate(0, 0.5, 0);           // 밑동이 원점 → 높이는 y 배율 하나로
      // 수관: 잎 덩어리 4개(지금 나무와 같은 납작한 타원체, 반지름 1.75~2.75 m)를 하나로 굽는다. 원점 = 수관 가운데.
      //   줄기는 높이(7~11.5 m)만큼 y 배율, 수관은 배율 없이 줄기 높이의 0.82 자리에 놓는다(지금 나무의 잎 높이 0.7~0.95 h)
      const crownParts = [0, 1, 2, 3].map(k => {
        const a = k / 4 * Math.PI * 2;
        return [new THREE.SphereGeometry(0.035 + (k % 2) * 0.015, 7, 6), 0xffffff, [Math.cos(a) * 0.03, (k % 2) * 0.02 - 0.01, Math.sin(a) * 0.03], [0, a, 0], [1, 0.55, 1.6]];
      });
      const crownGeo = bake(crownParts);
      crownGeo.deleteAttribute('color');      // 잎 색은 지금 나무와 같은 재질 색 하나
      const trunks = instanced(trunkGeo, trunkMat, 13, true), crowns = instanced(crownGeo, leafMat, 13, true);
      const BASE_N = W.trees.length;
      const r = rng(20261115);
      const obst = W.greenObstacles || [];
      const slots = [];
      let tries = 0;
      while (slots.length < 13 && tries++ < 4000) {
        const x = (r() - 0.5) * 2 * GREEN_HALF_W, z = (r() - 0.5) * 2 * GREEN_HALF_D;
        if (Math.hypot(x - MUD_X, z - MUD_Z) < MUD_AVOID_R + 0.04) continue;
        if (obst.some(o => Math.hypot(x - o.x, z - o.z) < (o.r0 || o.r) + 0.08)) continue;
        if (slots.some(s => Math.hypot(x - s.x, z - s.z) < 0.12)) continue;
        const h = 0.14 + r() * 0.09, y = wetlandY(x, z);
        const col = { x, z, r0: 0.018 + 0.004, top0: y + h, r: -1, top: -Infinity };
        W.cylinders.push(col);
        obst.push(col);                       // 동물이 피해 다니게(숨었을 때 반경 −1 이라 막지 않음)
        slots.push({ x, z, y, h, yaw: r() * Math.PI * 2, col, tree: { x, z, r: 0.11 } });
      }
      B.forest = { trunks, crowns, slots, baseTrees: W.trees.slice(0, BASE_N), baseN: BASE_N, n: -1 };
    }

    // ④ 도시 굴뚝 옆 CCUS 설비 3기: 흡수탑(높이 6.5 m) + 압축기 + 굴뚝 쪽 배관 + 콘크리트 받침. 굴뚝 자리 (0.6, 0.55) 둘레.
    {
      // 굴뚝이 없는 해(그해 화석 배출 0 이하 — C.stackOn false)에는 굴뚝 쪽 배관 끝이 허공에 떠 보였다(T3 ⚠ 경미, 2026-11-21 사람 결정 '배관 숨기기').
      // 배관 있는 모양·없는 모양 두 지오메트리를 구워 두고 apply 가 그해 굴뚝에 맞춰 바꿔 끼운다 — 인스턴스 하나라 드로우콜은 그대로
      const body = () => [
        [roundedBox(0.075, 0.006, 0.055, 0.002), 0xa9a69e, [0.004, 0.003, 0]],                       // 받침판(접지)
        [new THREE.CylinderGeometry(0.012, 0.013, 0.13, 16), 0xc9ced3, [0.018, 0.071, 0]],           // 흡수탑
        [new THREE.TorusGeometry(0.0128, 0.0016, 6, 16), 0x7d858c, [0.018, 0.05, 0], [Math.PI / 2, 0, 0]],
        [new THREE.TorusGeometry(0.0125, 0.0016, 6, 16), 0x7d858c, [0.018, 0.10, 0], [Math.PI / 2, 0, 0]],
        [new THREE.SphereGeometry(0.012, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0xc9ced3, [0.018, 0.136, 0]], // 둥근 지붕
        [roundedBox(0.03, 0.026, 0.032, 0.004), 0x2f8f7a, [-0.012, 0.019, 0.006]],                    // 압축기(포집 타워와 같은 청록)
      ];
      const pipes = () => [
        [new THREE.CylinderGeometry(0.003, 0.003, 0.06, 8), 0x8b9196, [-0.012, 0.11, 0], [0, 0, Math.PI / 2]], // 굴뚝 쪽 배관
        [new THREE.CylinderGeometry(0.003, 0.003, 0.012, 8), 0x8b9196, [0.008, 0.11, 0], [0, 0, Math.PI / 2]],
      ];
      const g = bake(body().concat(pipes())), gBare = bake(body());
      const im = instanced(g, vmat(0.38, 0.45), 3, true);
      const spots = [[0.69, 0.55], [0.60, 0.67], [0.71, 0.70]];
      const list = spots.map(([lx, z]) => {
        const yaw = Math.atan2(-(0.55 - z), 0.6 - lx) + Math.PI;   // 로컬 −x(배관 끝)가 굴뚝을 보게
        const x = lx + Z;
        const b = { on: { minX: x - 0.03, maxX: x + 0.03, minZ: z - 0.03, maxZ: z + 0.03, top: GB + 0.14 } };
        boxOn(b, false); W.boxes.push(b);
        return { x, z, yaw, box: b };
      });
      B.ccus = { im, list, n: -1, geoPipe: g, geoBare: gBare };
    }

    // ⑤ 도시 DAC 팬 벽 3기: 길이 6.5 m · 높이 3.8 m 상자 앞면에 팬 2 × 4. 지금 포집 타워(−0.65, 0.15) 서쪽 줄.
    {
      const parts = [
        [roundedBox(0.05, 0.005, 0.14, 0.002), 0xa9a69e, [0, 0.0025, 0]],              // 받침판
        [roundedBox(0.036, 0.075, 0.13, 0.005), 0xd8dadc, [0, 0.043, 0]],              // 본체
      ];
      for (let row = 0; row < 2; row++) for (let k = 0; k < 4; k++) {
        const y = 0.025 + row * 0.034, z = -0.045 + k * 0.03;
        parts.push([new THREE.CylinderGeometry(0.0115, 0.0115, 0.002, 16), 0x30353a, [0.0185, y, z], [0, 0, Math.PI / 2]]);  // 팬 구멍
        parts.push([new THREE.TorusGeometry(0.0115, 0.0016, 6, 18), 0x2f8f7a, [0.019, y, z], [0, Math.PI / 2, 0]]);           // 팬 테두리
        parts.push([new THREE.BoxGeometry(0.001, 0.02, 0.003), 0x8b9196, [0.0195, y, z], [Math.PI / 4, 0, 0]]);              // 날개(정지)
        parts.push([new THREE.BoxGeometry(0.001, 0.02, 0.003), 0x8b9196, [0.0195, y, z], [-Math.PI / 4, 0, 0]]);
      }
      const im = instanced(bake(parts), vmat(0.42, 0.4), 3, true);
      const list = [0.27, 0.44, 0.61].map(z => {
        const x = -0.86 + Z;
        const b = { on: { minX: x - 0.025, maxX: x + 0.025, minZ: z - 0.068, maxZ: z + 0.068, top: GB + 0.08 } };
        boxOn(b, false); W.boxes.push(b);
        return { x, z, box: b };
      });
      B.dac = { im, list, n: -1 };
    }

    // ⑥ 도시 끝 SMR 모듈 건물 3동: 터빈동(5 × 4.5 m 바닥, 높이 2.5 m) + 둥근 격납 건물(지름 2.8 m). 남동쪽 끝 (0.78, −0.7 ~ −1.25).
    {
      const g = bake([
        [roundedBox(0.12, 0.005, 0.10, 0.002), 0xa9a69e, [0, 0.0025, 0]],
        [roundedBox(0.06, 0.05, 0.09, 0.006), 0xd9d6cf, [0.022, 0.03, 0]],                              // 터빈동
        [new THREE.CylinderGeometry(0.028, 0.028, 0.04, 24), 0xc8ccd0, [-0.03, 0.025, 0]],              // 격납 건물
        [new THREE.SphereGeometry(0.028, 24, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0xc8ccd0, [-0.03, 0.045, 0]],
        [roundedBox(0.002, 0.022, 0.016, 0.0008), 0x4b5a66, [0.053, 0.016, 0]],                         // 문
        [roundedBox(0.002, 0.008, 0.07, 0.0008), 0x2f8f7a, [0.053, 0.047, 0]],                          // 띠(기관 표시 대신 색 띠)
      ]);
      const im = instanced(g, vmat(0.7, 0.08), 3, true);
      const list = [-0.72, -0.98, -1.24].map(z => {
        const x = 0.80 + Z;
        const b = { on: { minX: x - 0.058, maxX: x + 0.052, minZ: z - 0.046, maxZ: z + 0.046, top: GB + 0.074 } };
        boxOn(b, false); W.boxes.push(b);
        return { x, z, box: b };
      });
      B.smr = { im, list, n: -1 };
    }

    // ⑦ 도시 전기차 충전소 4기: 큰길 북쪽 보도(높이 1.5 m). 교차로·건물과 겹치지 않는 자리.
    {
      const g = bake([
        [roundedBox(0.022, 0.002, 0.016, 0.0006), 0xa9a69e, [0, 0.001, 0]],
        [roundedBox(0.009, 0.03, 0.007, 0.0018), 0xf1f2ef, [0, 0.017, 0]],
        [roundedBox(0.0012, 0.008, 0.005, 0.0004), 0x1f8f6a, [-0.0046, 0.024, 0]],   // 화면(길 쪽)
        [new THREE.TorusGeometry(0.004, 0.0008, 6, 12, Math.PI), 0x30353a, [-0.0046, 0.012, 0], [0, Math.PI / 2, 0]], // 케이블
      ]);
      const im = instanced(g, vmat(0.35, 0.2), 4, false);
      const list = [-0.75, -0.30, 0.30, 0.78].map(lx => {
        const x = lx + Z, z = 0.085;
        const col = { x, z, r0: 0.007, top0: GB + 0.032, r: -1, top: -Infinity };
        W.cylinders.push(col);
        return { x, z, col };
      });
      B.chargers = { im, list, n: -1 };
    }

    // 고정 자리 인스턴스는 한 번만 놓아 둔다(apply 는 count 만 바꾼다) — 해상풍력 탑·CCUS·DAC·SMR·충전소
    const place = (im, list, yOf, yawOf) => {
      list.forEach((p, i) => {
        dummy.position.set(p.x, yOf(p), p.z);
        dummy.rotation.set(0, yawOf ? yawOf(p) : 0, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        im.setMatrixAt(i, dummy.matrix);
      });
      im.instanceMatrix.needsUpdate = true;
    };
    place(B.wind.im, B.wind.list, p => p.y, () => 0);
    place(B.ccus.im, B.ccus.list, () => GB, p => p.yaw);
    place(B.dac.im, B.dac.list, () => GB);
    place(B.smr.im, B.smr.list, () => GB);
    place(B.chargers.im, B.chargers.list, () => GB, () => -Math.PI / 2);   // 화면(로컬 −x)이 남쪽 큰길(−z)을 보게
    B.forest.slots.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z); dummy.rotation.set(0, t.yaw, 0);
      dummy.scale.set(1, t.h, 1); dummy.updateMatrix(); B.forest.trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.y = t.y + t.h * 0.82; dummy.scale.set(1, 1, 1); dummy.updateMatrix(); B.forest.crowns.setMatrixAt(i, dummy.matrix);
    });
    B.forest.trunks.instanceMatrix.needsUpdate = B.forest.crowns.instanceMatrix.needsUpdate = true;
    return B;
  }

  // 보이는 개수만 바꾼다. 경계 구(프러스텀 컬링)는 개수가 바뀔 때 다시 잰다.
  function setCount(im, n) {
    if (im.count === n && im.visible === n > 0) return;
    im.count = n;
    im.visible = n > 0;
    if (n > 0) im.computeBoundingSphere();
  }

  // ── 갱신: applyWorldState(s, soc) 끝에서 부른다 ──────────────────────────
  //   C = FPModel.cityState(그해 도시) — 지붕 태양광이 그해 서 있는 건물·높이를 따른다.
  function apply(s, soc, C) {
    if (!B) return;
    const st = FPModel.techState(s, soc);
    FPTechWorld.state = st;
    const dummy = new THREE.Object3D();

    // 해상풍력: 앞에서부터 n기. 날개는 update() 가 돌린다(멈춘 화면에서도 자리는 맞게 여기서 한 번 놓는다)
    const wd = B.wind;
    wd.n = st.turbines;
    setCount(wd.im, wd.n);
    wd.list.forEach((p, i) => colOn(p.col, i < wd.n));
    placeBlades();
    setCount(wd.blades, wd.n * 3);

    // 지붕 태양광: 서 있는 건물 중 round(개수 × 재생 비중)채의 지붕. 낮은 건물부터(높은 건물 꼭대기는 눈높이에서 안 보인다)
    {
      const blds = W.buildings.filter(b => b.mesh.visible);
      const roofs = Math.round(blds.length * st.solarFrac);
      let k = 0;
      for (let i = 0; i < roofs; i++) {
        const b = blds[i], w = b.w, top = b.mesh.position.y + (b.h * C.heightK) / 2;
        const cx = b.mesh.position.x + W.ZONE_W, cz = b.mesh.position.z;
        const cols = w >= 0.14 ? 2 : 1;
        for (let a = 0; a < cols; a++) for (let c = 0; c < 2; c++) {
          dummy.position.set(cx + (cols === 2 ? (a - 0.5) * 0.064 : 0), top + 0.009, cz + (c - 0.5) * 0.042);
          dummy.rotation.set(-25 * Math.PI / 180, 0, 0);   // 남쪽(−z)으로 기울임
          dummy.scale.set(Math.min(1, (w * 0.9) / (cols * 0.064)), 1, 1);
          dummy.updateMatrix();
          B.solar.im.setMatrixAt(k++, dummy.matrix);
        }
      }
      B.solar.im.instanceMatrix.needsUpdate = true;
      B.solar.im.count = -1;   // setCount 가 다시 재게
      setCount(B.solar.im, k);
    }

    // 숲: 지금 26그루 + round(26 × treePlus). 실측 도구(나무 밑 CO₂)·미니맵이 쓰는 FPWorld.trees 도 같이 — 배열은 그대로 두고 내용만 바꾼다
    {
      const fr = B.forest, n = Math.min(fr.slots.length, Math.round(fr.baseN * st.treePlus));
      if (n !== fr.n) {
        fr.n = n;
        setCount(fr.trunks, n); setCount(fr.crowns, n);
        fr.slots.forEach((t, i) => colOn(t.col, i < n));
        W.trees.length = 0;
        W.trees.push(...fr.baseTrees, ...fr.slots.slice(0, n).map(t => t.tree));
      }
    }

    // CCUS 배관: 그해 굴뚝이 서 있을 때만(C.stackOn — fp-world 굴뚝 메시와 같은 값)
    {
      const want = C && C.stackOn ? B.ccus.geoPipe : B.ccus.geoBare;
      if (B.ccus.im.geometry !== want) B.ccus.im.geometry = want;
    }
    // CCUS · DAC · SMR · 충전소
    for (const [key, n] of [['ccus', st.ccusUnits], ['dac', st.dacUnits], ['smr', st.smrUnits], ['chargers', st.chargers]]) {
      const o = B[key];
      if (o.n === n) continue;
      o.n = n;
      setCount(o.im, n);
      o.list.forEach((p, i) => { if (p.box) boxOn(p.box, i < n); if (p.col) colOn(p.col, i < n); });
    }
  }

  const _bd = new THREE.Object3D();
  function placeBlades() {
    const wd = B.wind;
    for (let i = 0; i < wd.n; i++) {
      const p = wd.list[i];
      for (let k = 0; k < 3; k++) {
        _bd.position.copy(p.hub);
        _bd.rotation.set(wd.angle + p.phase + k * Math.PI * 2 / 3, 0, 0);
        _bd.updateMatrix();
        wd.blades.setMatrixAt(i * 3 + k, _bd.matrix);
      }
    }
    wd.blades.instanceMatrix.needsUpdate = true;
  }
  // 프레임마다: 날개 회전(초당 1.15 rad ≈ 분당 11바퀴 — 연출). 지금 포집 타워 팬(fp-main)처럼 늘 돈다.
  function update(dt) {
    if (!B || B.wind.n === 0) return;
    B.wind.angle = (B.wind.angle + dt * 1.15) % (Math.PI * 2);
    placeBlades();
  }

  return { build, apply, update, state: null, get built() { return B; } };
})();
