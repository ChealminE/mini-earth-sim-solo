// ============================================================================
// 1인칭 무대 소품 도구 (4차 M1-3) — 미터 축척 무대의 고품질 소품을 만드는 함수 모음. HTML 겹침 없음(DOM 은 캔버스 텍스처만)
// ----------------------------------------------------------------------------
// 왜 따로 두나: 카페·분리배출장·회의실 무대가 저마다 new THREE.BoxGeometry 로 소품을 쌓으면 모서리가 날카롭고(Q1)
//   회전체가 각지고(Q2) 재질이 플라스틱 한 가지로 보인다(Q3). 품질 규칙(M §1-3 표)을 이 파일의 함수 안에 묶어 두면
//   무대 코드는 '무엇을 놓을지'만 쓰고 규칙은 저절로 지켜진다. 무대 파일에서 BoxGeometry 를 grep 하면 0 이어야 한다(Q1).
// 축척: 1 = 1 m. 세계(1유닛 = 50 m)와 섞지 않는다(마스터 §6-13).
// 쓰는 법: const kit = FPStageKit.create(renderer, { viewColor, reducedMotion }) — 무대마다 하나(FPStage 가 만들어 build(kit) 에 넘긴다).
//   kit.update(dt) 는 FPStage 가 무대 프레임마다 부른다(이동·강조·접지 그림자 따라가기·김·음료 줄기).
// three.js 는 vendor/three.min.js(r160 UMD) 코어만 쓴다 — examples/jsm 애드온(RoundedBoxGeometry 등)은 쓰지 않는다(마스터 §6-11).
//   그래서 둥근 상자·소음 텍스처를 여기서 직접 만든다.
// 후처리(블룸·SSAO) 없음(마스터 결정 11) — 부드러움은 재질·환경맵·접지 그림자·조명 배치로 만든다.
// ============================================================================
const FPStageKit = (() => {
  // ── 움직임 곡선 (M §1-3: 기본 easeOutCubic) ───────────────────────────────
  const EASE = {
    linear: t => t,
    easeOutCubic: t => 1 - Math.pow(1 - t, 3),
    easeInCubic: t => t * t * t,
    easeInOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    easeOutBack: t => { const c = 1.70158, u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; },
    easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  };
  const easeOf = e => (typeof e === 'function' ? e : EASE[e] || EASE.easeOutCubic);

  // 품질 규칙 숫자 — 검사(tools/test_fp_stage.js)가 이 값을 읽는다
  const RULES = {
    ROUND_MIN: 0.02,      // 둥근 상자 반경 ≥ 짧은 변의 2 %
    LATHE_SEG_MIN: 48,    // 가까운 회전체 둘레 분할 ≥ 48
    LATHE_PTS_MIN: 24,    // 단면 곡선 보간 뒤 점 ≥ 24
    TUBE_RADIAL_MIN: 12,  // 관 반지름 방향 분할 ≥ 12
    STEAM_MAX: 40,        // 김 입자 ≤ 40
    POINT_LIGHTS_MAX: 3,  // 실내 점광 ≤ 3
    HL_LIFT: 0.02,        // 강조 때 2 cm 들림
    HL_MS: 150,           // 0.15초
    LAND_SQUASH: 0.06,    // 착지 6 % 눌림
    LAND_MS: 120,         // → 0.12초에 복원
  };

  // ── 결정적 소음 (같은 무대는 늘 같은 무늬 — 사진 자세 비교가 흔들리지 않게) ──────
  function hash3(x, y, s) {
    let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  const wrap = (i, p) => ((i % p) + p) % p;
  const sstep = t => t * t * (3 - 2 * t);
  // 주기 px·py 로 되풀이되는 값 소음 — 텍스처를 타일로 반복해도 이음매가 안 보이게
  function vnoise(x, y, px, py, seed) {
    const ix = Math.floor(x), iy = Math.floor(y), fx = sstep(x - ix), fy = sstep(y - iy);
    const x0 = wrap(ix, px), x1 = wrap(ix + 1, px), y0 = wrap(iy, py), y1 = wrap(iy + 1, py);
    const a = hash3(x0, y0, seed), b = hash3(x1, y0, seed), c = hash3(x0, y1, seed), d = hash3(x1, y1, seed);
    return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
  }
  // u,v ∈ [0,1) 에서 기본 주기 (fx, fy), 옥타브마다 두 배
  function fbm(u, v, fx, fy, oct, seed) {
    let s = 0, amp = 0.5, norm = 0;
    for (let o = 0; o < oct; o++) {
      const k = 1 << o;
      s += amp * vnoise(u * fx * k, v * fy * k, fx * k, fy * k, seed + o * 17);
      norm += amp; amp *= 0.5;
    }
    return s / norm;
  }
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp01 = t => (t < 0 ? 0 : t > 1 ? 1 : t);
  const hexRGB = h => { const c = new THREE.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; };   // sRGB 0~255 (캔버스는 sRGB)

  // ── 둥근 상자 지오메트리 ─────────────────────────────────────────────────
  // 여섯 면을 격자로 만들고 각 점을 '안쪽 상자(반 치수 − r)'에 가장 가까운 점 + 법선 × r 로 옮긴다.
  // 둥근 띠의 점은 면 법선에서 0~45° 를 고르게 나누도록 u = (h − r) + r·tanθ 로 놓는다(옆 면이 나머지 45° 를 맡는다).
  // 법선은 '안쪽 점 → 표면 점' 방향이라 모서리가 정확히 매끈하다. UV 는 미터 단위(uvMeters 마다 텍스처 한 번) —
  // 긴 판재에 나무결이 늘어나 보이지 않게. 3 m 카운터와 30 cm 상자가 같은 결 밀도가 된다.
  function roundedBoxGeometry(w, h, d, r, seg = 3, uvMeters = 1) {   // 모서리 분할 3(=모서리마다 6 띠) — 4 는 상자 수십 개에서 삼각형이 넘쳤다
    const minSide = Math.min(w, h, d);
    r = Math.min(Math.max(r || 0, minSide * RULES.ROUND_MIN), minSide / 2 - 1e-6);
    seg = Math.max(2, seg | 0);
    const half = [w / 2, h / 2, d / 2], inner = half.map(x => Math.max(x - r, 0));
    // 한 축의 좌표 목록: [-half … -inner](둥근 띠) · 가운데 한 칸 · [inner … half]
    const axis = k => {
      const out = [];
      for (let i = seg; i >= 1; i--) out.push(-(inner[k] + r * Math.tan((i / seg) * Math.PI / 4)));
      out.push(-inner[k]);
      out.push(inner[k]);
      for (let i = 1; i <= seg; i++) out.push(inner[k] + r * Math.tan((i / seg) * Math.PI / 4));
      return out;
    };
    const pos = [], nor = [], uv = [], idx = [];
    const p = new THREE.Vector3(), q = new THREE.Vector3(), n = new THREE.Vector3();
    // 면: 법선 축 a, 부호 s, 면 위 두 축 (u, v)
    const faces = [[0, 1, 2, 1], [0, -1, 1, 2], [1, 1, 2, 0], [1, -1, 0, 2], [2, 1, 0, 1], [2, -1, 1, 0]];
    for (const [a, s, ua, va] of faces) {
      const us = axis(ua), vs = axis(va), base = pos.length / 3;
      for (let j = 0; j < vs.length; j++) {
        for (let i = 0; i < us.length; i++) {
          const c = [0, 0, 0];
          c[a] = s * half[a]; c[ua] = us[i]; c[va] = vs[j];
          p.set(c[0], c[1], c[2]);
          q.set(Math.max(-inner[0], Math.min(inner[0], p.x)), Math.max(-inner[1], Math.min(inner[1], p.y)), Math.max(-inner[2], Math.min(inner[2], p.z)));
          n.subVectors(p, q);
          if (n.lengthSq() < 1e-12) { n.set(0, 0, 0); n.setComponent(a, s); } else n.normalize();
          p.copy(q).addScaledVector(n, r);
          pos.push(p.x, p.y, p.z);
          nor.push(n.x, n.y, n.z);
          uv.push((p.getComponent(ua) + half[ua]) / uvMeters, (p.getComponent(va) + half[va]) / uvMeters);
        }
      }
      // 감김: (u 축 × v 축) 이 면 법선과 같은 쪽이면 (k, k+1, k+W), 반대면 뒤집는다 — 면마다 따로 정한다
      const eu = [0, 0, 0], ev = [0, 0, 0];
      eu[ua] = 1; ev[va] = 1;
      const cr = [eu[1] * ev[2] - eu[2] * ev[1], eu[2] * ev[0] - eu[0] * ev[2], eu[0] * ev[1] - eu[1] * ev[0]];
      const ccw = cr[a] * s > 0;
      const W = us.length;
      for (let j = 0; j < vs.length - 1; j++) {
        for (let i = 0; i < W - 1; i++) {
          const k = base + j * W + i;
          if (ccw) idx.push(k, k + 1, k + W, k + 1, k + W + 1, k + W);
          else idx.push(k, k + W, k + 1, k + 1, k + W, k + W + 1);
        }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.userData.kit = { kind: 'roundedBox', r, minSide };
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }

  // ── 회전체 · 관 ──────────────────────────────────────────────────────────
  // profile: [[반지름, 높이], …] (아래 → 위). Catmull-Rom 으로 이어 24점 이상으로 다시 뽑는다.
  // opts.sharp: 곡선 보간 없이 꺾인 단면 그대로(컵 바닥 모서리처럼 꺾여야 하는 곳) — 그래도 점 수는 규칙대로 늘린다
  // opts.far: 화면 가까이 오지 않는 회전체(벽 선반의 컵·병, 천장 등 갓, 작은 추출구) — Q2 규칙은 '가까운 회전체'라 절반(24 분할·12점)까지 허용.
  //   무대 하나에 회전체가 50개를 넘으면 규칙 그대로는 삼각형 예산(한 프레임 30만, 그림자·투명 패스 포함)을 넘는다
  function latheGeometry(profile, seg = 64, opts = {}) {
    const far = !!opts.far;
    seg = Math.max(far ? RULES.LATHE_SEG_MIN / 2 : RULES.LATHE_SEG_MIN, seg | 0);
    const pts = profile.map(p => (p.isVector2 ? p.clone() : new THREE.Vector2(p[0], p[1])));
    const n = Math.max(far ? RULES.LATHE_PTS_MIN / 2 : RULES.LATHE_PTS_MIN, opts.points || pts.length * (far ? 2 : 4));   // 점 4배(24 이상) — 6배는 소품 수십 개에서 삼각형 예산(30만)을 넘겼다
    let out;
    if (opts.sharp || pts.length < 3) {
      // 꺾인 선을 길이 비례로 n 점에 다시 나눈다
      const path = new THREE.Path(); path.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
      out = path.getSpacedPoints(n - 1);
    } else {
      out = new THREE.SplineCurve(pts).getSpacedPoints(n - 1);
    }
    out.forEach(v => { if (v.x < 0) v.x = 0; });
    const g = new THREE.LatheGeometry(out, seg, opts.phiStart || 0, opts.phiLength || Math.PI * 2);
    g.userData.kit = { kind: 'lathe', seg, points: out.length, far };
    g.computeBoundingSphere();
    return g;
  }
  function tubeGeometry(curve, r, opts = {}) {
    const c = Array.isArray(curve) ? new THREE.CatmullRomCurve3(curve.map(p => (p.isVector3 ? p : new THREE.Vector3(p[0], p[1], p[2])))) : curve;
    const radial = Math.max(RULES.TUBE_RADIAL_MIN, opts.radial || 16);
    const g = new THREE.TubeGeometry(c, opts.tubular || 64, r, radial, !!opts.closed);
    g.userData.kit = { kind: 'tube', radial };
    return g;
  }

  // ── 하나의 무대용 도구 묶음 ───────────────────────────────────────────────
  function create(renderer, cfg = {}) {
    const maxAniso = renderer && renderer.capabilities ? renderer.capabilities.getMaxAnisotropy() : 1;
    const kit = {
      RULES, EASE, scene: null, renderer,
      reducedMotion: !!cfg.reducedMotion,
      viewColor: cfg.viewColor || '#6a2ea6',   // 강조 테두리 = 테마 --ctl-view (FPStage 가 CSS 에서 읽어 넘긴다)
      quality: 'high',
      stats: { roundedBox: 0, lathe: 0, tube: 0, canvasTex: 0, noiseTex: 0 },
    };
    const anims = [];        // 이동·포물선·착지 눌림
    const hls = new Map();   // 강조 상태 (obj → { lift, from, to, t, outlines })
    const shadows = [];      // 접지 그림자 (obj 를 따라간다)
    const fx = [];           // 김·음료 줄기 (update(dt) 를 가진 것)
    const shadowLights = []; // 그림자를 던지는 빛 (품질 단계로 지도 크기를 바꾼다)
    let clock = 0;

    // ── 지오메트리 ──
    kit.roundedBox = (w, h, d, r, seg, uvMeters) => { kit.stats.roundedBox++; return roundedBoxGeometry(w, h, d, r, seg, uvMeters); };
    kit.lathe = (profile, seg = 64, opts) => { kit.stats.lathe++; return latheGeometry(profile, seg, opts); };
    kit.tube = (curve, r, opts) => { kit.stats.tube++; return tubeGeometry(curve, r, opts); };
    // 메시 하나 + 그림자 설정을 한 번에 (소품은 대부분 그림자를 던지고 받는다)
    // 투명 재질(유리·PET)은 기본으로 그림자를 던지지 않는다 — 그림자 맵에는 '투명'이 없어 안의 음료에 통째로 검은 그림자가 졌다
    const isClear = mat => (Array.isArray(mat) ? mat : [mat]).some(x => x && x.transmission > 0);
    kit.mesh = (geo, mat, opts = {}) => {
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = opts.cast != null ? !!opts.cast : !isClear(mat);
      m.receiveShadow = opts.receive !== false;
      if (opts.pos) m.position.set(opts.pos[0], opts.pos[1], opts.pos[2]);
      if (opts.rot) m.rotation.set(opts.rot[0], opts.rot[1], opts.rot[2]);
      if (opts.parent) opts.parent.add(m);
      return m;
    };

    // ── 캔버스 텍스처 ──
    // 글자·무늬. sRGB · 최대 비등방 · 밉맵(멀리서 글자가 지글거리지 않게). tex.redraw(fn) 으로 다시 그린다(키오스크 화면)
    kit.canvasTex = (draw, w = 2048, h = w, opts = {}) => {
      kit.stats.canvasTex++;
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = h;
      const ctx = cv.getContext('2d');
      const tex = new THREE.CanvasTexture(cv);
      tex.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
      tex.anisotropy = maxAniso;
      tex.generateMipmaps = true;
      tex.minFilter = THREE.LinearMipmapLinearFilter;
      tex.magFilter = THREE.LinearFilter;
      if (opts.repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
      tex.redraw = fn => { (fn || draw)(ctx, w, h); tex.needsUpdate = true; };
      tex.userData.canvas = cv;
      tex.userData.ctx = ctx;
      draw(ctx, w, h);
      return tex;
    };

    // ── 소음 텍스처: 색 지도 + 거칠기 지도 (외부 그림 0) ──
    // kind: wood · tile · concrete · plaster · brushed · paper · cardboard · rubber
    // 거칠기 지도는 three 가 초록 채널을 읽는다 — 회색으로 쓰면 된다. 선형(NoColorSpace)으로 둔다(감마가 끼면 거칠기가 틀어진다).
    // 같은 kind·opts 는 한 번만 만든다(캐시). 반환: { map, roughnessMap, bumpMap? }
    const noiseCache = new Map();
    kit.noiseTex = (kind, opts = {}) => {
      const key = kind + JSON.stringify(opts);
      if (noiseCache.has(key)) return noiseCache.get(key);
      kit.stats.noiseTex++;
      const S = opts.size || (kind === 'wood' || kind === 'tile' ? 1024 : 512);
      const seed = opts.seed || 7;
      const col = new Uint8ClampedArray(S * S * 4), rgh = new Uint8ClampedArray(S * S * 4);
      const gen = NOISE[kind] || NOISE.concrete;
      const out = [0, 0, 0, 0.5];   // r g b(0~255) · 거칠기(0~1)
      for (let y = 0; y < S; y++) {
        for (let x = 0; x < S; x++) {
          gen((x + 0.5) / S, (y + 0.5) / S, seed, opts, out);
          const i = (y * S + x) * 4;
          col[i] = out[0]; col[i + 1] = out[1]; col[i + 2] = out[2]; col[i + 3] = 255;
          const g = clamp01(out[3]) * 255;
          rgh[i] = g; rgh[i + 1] = g; rgh[i + 2] = g; rgh[i + 3] = 255;
        }
      }
      const toTex = (data, linear) => kit.canvasTex(ctx => ctx.putImageData(new ImageData(data, S, S), 0, 0), S, S, { linear, repeat: true });
      const res = { map: toTex(col, false), roughnessMap: toTex(rgh, true) };
      noiseCache.set(key, res);
      return res;
    };

    // ── 재질 묶음 ──
    // 금속 = metalness 1 + 거칠기 지도 · 유리/투명 PET = MeshPhysicalMaterial transmission 1 (PET ior 1.57) · 종이·골판지 = 거칠기 0.85~0.95.
    // 투명 재질(transmission)은 그 뒤를 한 번 더 그리므로 꼭 필요한 소품에만(마스터 §6-15). 정렬이 깨지지 않게 renderOrder 를 정해 둔다:
    //   불투명 0 · 접지 그림자 1 · 투명(유리·PET) 5 · 김 8 — kit.ORDER.
    kit.ORDER = { opaque: 0, groundShadow: 1, clear: 5, steam: 8 };
    const repeatOf = (tex, rep) => { if (!rep) return tex; const t = tex.clone(); t.repeat.set(rep[0], rep[1]); t.needsUpdate = true; return t; };
    const withMaps = (kind, nopts, rep) => { const t = kit.noiseTex(kind, nopts); return { map: repeatOf(t.map, rep), roughnessMap: repeatOf(t.roughnessMap, rep) }; };
    const MAT = {
      wood: o => new THREE.MeshStandardMaterial({ ...withMaps('wood', o.noise, o.repeat), color: o.color || 0xffffff, roughness: 1, metalness: 0 }),
      tile: o => new THREE.MeshStandardMaterial({ ...withMaps('tile', o.noise, o.repeat), color: o.color || 0xffffff, roughness: 1, metalness: 0 }),
      concrete: o => new THREE.MeshStandardMaterial({ ...withMaps('concrete', o.noise, o.repeat), color: o.color || 0xffffff, roughness: 1, metalness: 0 }),
      plaster: o => new THREE.MeshStandardMaterial({ ...withMaps('plaster', o.noise, o.repeat), color: o.color || 0xffffff, roughness: 1, metalness: 0 }),
      // 헤어라인 스테인리스: 색 지도는 아주 옅은 결(금속의 색 = 반사색), 거칠기 지도가 결을 만든다(환경 반사가 결 방향으로 번진다)
      brushedSteel: o => new THREE.MeshStandardMaterial({ ...withMaps('brushed', o.noise, o.repeat), color: o.color || 0xe4e6e8, roughness: o.roughness || 1, metalness: 1 }),
      chrome: o => new THREE.MeshStandardMaterial({ color: o.color || 0xf2f4f6, roughness: o.roughness || 0.06, metalness: 1 }),
      // tint(선택): 두께를 지나며 아주 옅은 빛깔 — 빈 컵이 밝은 나무 카운터 위에서 통째로 사라져 보여서(2026-11-19 사람 확인) 유리처럼 줄 수 있게 했다
      clearPET: o => new THREE.MeshPhysicalMaterial({ color: o.color || 0xffffff, roughness: o.roughness || 0.06, metalness: 0,
        transmission: 1, thickness: o.thickness || 0.0015, ior: 1.57, specularIntensity: 1, envMapIntensity: o.envMapIntensity || 1.2,
        ...(o.tint ? { attenuationColor: new THREE.Color(o.tint), attenuationDistance: o.tintDistance || 0.02 } : {}) }),
      // 유리: 두께를 지나며 아주 옅은 초록(소다석회 유리) — 완전 무색이면 배경에 묻혀 윤곽만 남았다
      glass: o => new THREE.MeshPhysicalMaterial({ color: o.color || 0xffffff, roughness: o.roughness || 0.02, metalness: 0,
        transmission: 1, thickness: o.thickness || 0.004, ior: 1.5, specularIntensity: 1, envMapIntensity: 1.4,
        attenuationColor: new THREE.Color(o.tint || 0xd6eee2), attenuationDistance: o.tintDistance || 0.02 }),
      ceramic: o => new THREE.MeshPhysicalMaterial({ color: o.color || 0xf4f1ea, roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.12 }),
      paper: o => new THREE.MeshStandardMaterial({ ...withMaps('paper', o.noise, o.repeat), color: o.color || 0xffffff, roughness: 1, metalness: 0 }),
      cardboard: o => new THREE.MeshStandardMaterial({ ...withMaps('cardboard', o.noise, o.repeat), color: o.color || 0xffffff, roughness: 1, metalness: 0 }),
      rubber: o => new THREE.MeshStandardMaterial({ ...withMaps('rubber', o.noise, o.repeat), color: o.color || 0x3a3d40, roughness: 1, metalness: 0 }),
      // 사출 플라스틱(수거함 몸체 거칠기 0.55, M §3-2)
      plasticMatte: o => new THREE.MeshStandardMaterial({ color: o.color || 0x6f8f7a, roughness: o.roughness || 0.55, metalness: 0 }),
      liquidCoffee: o => new THREE.MeshPhysicalMaterial({ color: o.color || 0x2a1208, roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }),
      crema: o => new THREE.MeshStandardMaterial({ ...withMaps('crema', o.noise, o.repeat), color: o.color || 0xffffff, roughness: 0.55, metalness: 0 }),
    };
    const matCache = new Map();
    // kit.mat.wood — 공용(같은 무대 안에서 나눠 쓴다). kit.matOf('wood', { repeat: [2, 1], color }) — 따로 고친 사본
    kit.mat = {};
    for (const name of Object.keys(MAT)) {
      Object.defineProperty(kit.mat, name, { enumerable: true, get() {
        if (!matCache.has(name)) { const m = MAT[name]({}); m.name = name; tagMat(m, name); matCache.set(name, m); }
        return matCache.get(name);
      } });
    }
    kit.matOf = (name, o = {}) => { const m = MAT[name](o); m.name = name; tagMat(m, name); return m; };
    function tagMat(m) { if (m.transmission > 0) m.userData.clear = true; }
    // 투명 재질을 쓴 메시는 renderOrder 를 '투명' 으로 — 무대 코드가 잊어도 여기서 맞춘다(kit.update 첫 프레임 전에 한 번)
    kit.fixOrder = root => root.traverse(o => {
      if (!o.isMesh || o.userData.kitHelper) return;
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      if (ms.some(m => m && m.userData && m.userData.clear)) {
        if (o.renderOrder === 0) o.renderOrder = kit.ORDER.clear;
        o.castShadow = false;   // 무대 코드가 직접 new THREE.Mesh 로 만든 투명 메시도 같은 규칙(kit.mesh 참고)
      }
    });

    // ── 조명 + 환경맵 ──
    // 주광(방향광, PCF 부드러운 그림자 2048) + 반구광(어두운 구석이 새까맣지 않게) + 실내 점광 ≤ 3(그림자 없음) + PMREM 환경맵.
    // 환경맵은 세계 쪽(fp-world.js PMREM 절)과 같은 방식: 작은 방(안쪽 면) + 밝은 판(창·천장 조명)을 fromScene 으로 굽는다.
    // 금속·유리의 하이라이트는 이 밝은 판이 맺힌 것이다(Q5). 판 밝기는 1 을 넘겨도 된다(굽는 동안 톤매핑이 꺼져 HDR 로 담긴다).
    // opts: { size: [폭 x, 깊이 z](그림자 범위, m), center: [x, z], sun: { dir, color, intensity }, hemi: { sky, ground, intensity },
    //         points: [{ pos, color, intensity, distance }], env: { wall, floor, ceiling, panels: [{ pos, size, color, intensity, look }] } }
    kit.lightRig = (scene, opts = {}) => {
      kit.scene = scene;
      const size = opts.size || [6, 4], ctr = opts.center || [0, 0];
      const so = opts.sun || {};
      const sun = new THREE.DirectionalLight(so.color || 0xfff4e6, so.intensity == null ? 2.2 : so.intensity);
      const dir = new THREE.Vector3(...(so.dir || [-0.45, 1, 0.6])).normalize();
      const span = Math.hypot(size[0], size[1]);
      sun.position.set(ctr[0] + dir.x * span, dir.y * span, ctr[1] + dir.z * span);
      sun.target.position.set(ctr[0], 0, ctr[1]);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      // 그림자 카메라 = 무대 크기에 딱 맞게(카페 약 6 × 4 m) — 넓으면 그림자가 흐릿하게 뭉개진다
      const sc = sun.shadow.camera, ext = span / 2 + 0.3;
      sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext;
      sc.near = 0.1; sc.far = span * 2.2;
      sun.shadow.bias = -0.0003;
      sun.shadow.normalBias = 0.012;
      scene.add(sun, sun.target);
      shadowLights.push(sun);
      const ho = opts.hemi || {};
      const hemi = new THREE.HemisphereLight(ho.sky || 0xf3efe6, ho.ground || 0x8a7a66, ho.intensity == null ? 0.65 : ho.intensity);
      scene.add(hemi);
      const points = (opts.points || []).slice(0, RULES.POINT_LIGHTS_MAX).map(p => {
        const L = new THREE.PointLight(p.color || 0xffd9a8, p.intensity == null ? 3 : p.intensity, p.distance || 4, 2);
        L.position.set(p.pos[0], p.pos[1], p.pos[2]);
        L.castShadow = false;
        scene.add(L);
        return L;
      });
      // 환경맵: 반경 8 m 안쪽 구(벽) + 아래 뚜껑(바닥) + 위 뚜껑(천장) + 밝은 판.
      // 바닥 뚜껑은 아래쪽 45° 만 — 반구 전체를 어둡게 하면 눈높이 근처 반사(세운 원통의 옆면)가 절반 어두워져 금속이 탁해 보였다
      const eo = opts.env || {};
      const env = new THREE.Scene();
      const room = new THREE.Mesh(new THREE.SphereGeometry(8, 32, 16), new THREE.MeshBasicMaterial({ color: eo.wall || 0xe2dacb, side: THREE.BackSide }));
      env.add(room);
      const floor = new THREE.Mesh(new THREE.SphereGeometry(7.9, 32, 8, 0, Math.PI * 2, Math.PI * 0.72, Math.PI * 0.28),
        new THREE.MeshBasicMaterial({ color: eo.floor || 0x7a6c5c, side: THREE.BackSide }));
      env.add(floor);
      const ceil = new THREE.Mesh(new THREE.SphereGeometry(7.85, 32, 8, 0, Math.PI * 2, 0, Math.PI / 3),
        new THREE.MeshBasicMaterial({ color: eo.ceiling || 0xf4f0e8, side: THREE.BackSide }));
      env.add(ceil);
      // 눈높이 아래 어두운 띠(가구·카운터) — 거울 금속(크롬)이 흰 벽만 비추면 도자기처럼 하얗게 보였다(Q3). 명암이 있어야 금속으로 읽힌다
      const band = new THREE.Mesh(new THREE.CylinderGeometry(7.7, 7.7, 1.6, 48, 1, true),
        new THREE.MeshBasicMaterial({ color: eo.band || 0x4a3f36, side: THREE.BackSide }));
      band.position.y = -0.9;
      env.add(band);
      // 판: 천장 긴 조명 · 창 두 개(눈높이 — 세운 금속·유리 옆면에 세로 하이라이트) · 따뜻한 실내등
      const panels = eo.panels || [
        { pos: [0, 6, 0], size: [5, 1.2], color: 0xffffff, intensity: 5 },
        { pos: [-6.5, 1.5, 1], size: [2.2, 3], color: 0xf4f8ff, intensity: 4 },
        { pos: [3, 1.6, 6.8], size: [3, 2.2], color: 0xf4f8ff, intensity: 3 },
        { pos: [5, 2.5, -4.5], size: [1.6, 1.6], color: 0xffe4c0, intensity: 3 },
      ];
      for (const pn of panels) {
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(pn.color || 0xffffff).multiplyScalar(pn.intensity || 3), side: THREE.DoubleSide });
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(pn.size[0], pn.size[1]), m);
        pl.position.set(pn.pos[0], pn.pos[1], pn.pos[2]);
        pl.lookAt(...(pn.look || [0, 1, 0]));
        env.add(pl);
      }
      let envTex = null;
      if (renderer && THREE.PMREMGenerator) {
        const pm = new THREE.PMREMGenerator(renderer);
        const rt = pm.fromScene(env, 0.03);
        pm.dispose();
        envTex = rt.texture;
        scene.environment = envTex;
      }
      env.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      if (opts.background !== undefined) scene.background = opts.background === null ? null : new THREE.Color(opts.background);
      kit.applyQuality(kit.quality);
      return { sun, hemi, points, envMap: envTex };
    };

    // 품질 단계(M §1-5): high = 그림자 2048 · mid = 1024 · low = 그림자 끔(접지 그림자만).
    // renderer.shadowMap.enabled 는 건드리지 않는다 — 렌더러는 세계와 하나라서(마스터 §6-14). 무대 빛의 castShadow 만 바꾼다.
    kit.applyQuality = q => {
      kit.quality = q;
      const size = q === 'high' ? 2048 : 1024;
      for (const L of shadowLights) {
        L.castShadow = q !== 'low';
        if (L.shadow.mapSize.x !== size) {
          L.shadow.mapSize.set(size, size);
          if (L.shadow.map) { L.shadow.map.dispose(); L.shadow.map = null; }   // 다음 그림 때 새 크기로 다시 만든다
        }
      }
      // 접지 그림자는 low 에서 조금 짙게 — 그림자 맵이 없어도 소품이 떠 보이지 않게(Q4)
      for (const s of shadows) s.mesh.material.opacity = s.opacity * (q === 'low' ? 1.25 : 1);
    };

    // ── 접지 그림자 ──
    // 방사형 그라데이션 판(depthWrite false). 그림자 맵이 닿지 않거나 아주 작은 소품도 떠 보이지 않게 모든 소품 아래에 둔다(Q4).
    // 판은 소품의 형제(무대 장면 바로 아래)로 두고 소품의 x·z 를 따라간다 — 소품이 들리면(강조·포물선) 판은 바닥에 남아 옅어지고 커진다.
    // size: 지름(m) 또는 [폭, 깊이]. opts: { opacity(기본 0.5), y(바닥 높이 — 기본 소품의 지금 바닥), parent }
    let shadowTex = null;
    const shadowTexture = () => shadowTex || (shadowTex = kit.canvasTex((c, w, h) => {
      const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.35, 'rgba(0,0,0,0.72)'); g.addColorStop(0.7, 'rgba(0,0,0,0.22)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }, 256, 256));
    const _v = new THREE.Vector3(), _b = new THREE.Box3();
    kit.groundShadow = (obj, size, opts = {}) => {
      const sz = Array.isArray(size) ? size : [size, size];
      const mat = new THREE.MeshBasicMaterial({ map: shadowTexture(), color: 0x000000, transparent: true, opacity: opts.opacity == null ? 0.5 : opts.opacity,
        depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
      m.rotation.x = -Math.PI / 2;
      m.scale.set(sz[0] * 1.25, sz[1] * 1.25, 1);
      m.renderOrder = kit.ORDER.groundShadow;
      m.userData.kitHelper = true; m.userData.pickThrough = true;
      m.raycast = () => {};
      obj.updateWorldMatrix(true, true);
      _b.setFromObject(obj);
      const y = opts.y != null ? opts.y : (isFinite(_b.min.y) ? _b.min.y : obj.getWorldPosition(_v).y);
      const parent = opts.parent || kit.scene || obj.parent;
      if (parent) parent.add(m);
      obj.getWorldPosition(_v);
      const entry = { obj, mesh: m, y, baseY: _v.y, opacity: mat.opacity, sx: m.scale.x, sz: m.scale.y };
      m.position.set(_v.x, y + 0.0015, _v.z);
      shadows.push(entry);
      obj.userData.groundShadow = entry;
      return m;
    };
    // 소품을 다른 면 위로 옮겼을 때(컵이 머신 받침 위로) 그림자의 바닥 높이를 바꾼다
    kit.setShadowSurface = (obj, y) => {
      const e = obj.userData.groundShadow;
      if (!e) return;
      obj.getWorldPosition(_v);
      e.y = y; e.baseY = _v.y;
    };

    // ── 강조 (고를 수 있는 물체) ──
    // 0.15초 동안 2 cm 들림 + 테두리 빛(같은 지오메트리를 조금 키운 뒷면 메시, 발광색 --ctl-view). 색만으로 알리지 않는다(움직임 + 테두리).
    // 들림은 '위치에 더한 값'으로 따로 들고 있다 — 이동(tween·arc)이 위치를 덮어써도 들림이 꼬이지 않게(이동도 이 값을 더해 쓴다).
    let outlineMat = null;
    const outlineMaterial = () => outlineMat || (outlineMat = new THREE.MeshBasicMaterial({ color: kit.viewColor, side: THREE.BackSide, toneMapped: false }));
    const OUTLINE_T = 0.004;   // 테두리 두께 약 4 mm
    function makeOutlines(obj) {
      const list = [];
      let hasClear = false;
      obj.traverse(o => {
        if (!o.isMesh || o.userData.kitHelper || !o.geometry) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        if (ms.some(m => m && m.transmission > 0)) { hasClear = true; return; }
        const g = o.geometry;
        if (!g.boundingSphere) g.computeBoundingSphere();
        const bs = g.boundingSphere, wr = bs.radius * Math.max(o.getWorldScale(_v).x, _v.y, _v.z);
        if (!(wr > 0)) return;
        const s = 1 + OUTLINE_T / wr;
        const ol = new THREE.Mesh(g, outlineMaterial());
        ol.scale.setScalar(s);
        ol.position.copy(bs.center).multiplyScalar(1 - s);   // 지오메트리 중심을 기준으로 키운다(원점이 바닥인 회전체도 고르게)
        ol.userData.kitHelper = true; ol.userData.pickThrough = true;
        ol.raycast = () => {};
        ol.castShadow = false; ol.receiveShadow = false;
        ol.visible = false;
        ol.renderOrder = o.renderOrder;
        list.push([o, ol]);
      });
      for (const [o, ol] of list) o.add(ol);
      // 투명 재질(transmission) 메시에는 뒷면 테두리를 달지 않았다 — 불투명한 보라 껍데기가 투명 컵 안으로 비쳐 컵이 보라로 찬다.
      //   그런 물체만 남으면 바닥에 테두리 고리(같은 색)를 둔다 — 움직임(들림) + 고리로 알린다(색만으로 알리지 않음)
      if (!list.length || hasClear) {
        _b.setFromObject(obj);
        const r = Math.max(_b.max.x - _b.min.x, _b.max.z - _b.min.z) / 2 + 0.008;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.0025, 8, 64), outlineMaterial());
        ring.rotation.x = Math.PI / 2;
        obj.updateWorldMatrix(true, false);
        ring.position.y = (_b.min.y - obj.getWorldPosition(_v).y) / (obj.getWorldScale(new THREE.Vector3()).y || 1) + 0.002;
        ring.userData.kitHelper = true; ring.userData.pickThrough = true; ring.raycast = () => {};
        ring.visible = false;
        obj.add(ring);
        return [...list.map(x => x[1]), ring];
      }
      return list.map(x => x[1]);
    }
    kit.highlight = (obj, on) => {
      if (!obj) return;
      let h = hls.get(obj);
      if (!h) { h = { lift: 0, from: 0, to: 0, t: 1, outlines: makeOutlines(obj) }; hls.set(obj, h); }
      const to = on ? RULES.HL_LIFT : 0;
      for (const ol of h.outlines) ol.visible = !!on;
      if (h.to === to) return;
      h.from = h.lift; h.to = to; h.t = 0;
    };
    kit.isHighlighted = obj => { const h = hls.get(obj); return !!(h && h.to > 0); };
    const liftOf = obj => { const h = hls.get(obj); return h ? h.lift : 0; };

    // ── 이동 · 포물선 ──
    // tween(obj, { position, rotation, scale }, ms, ease) → Promise. 같은 물체의 이전 이동은 멈추고 새 이동이 이어받는다.
    // 움직임 줄이기(prefers-reduced-motion)면 0.1초로 줄인다(M §0-5).
    const durOf = ms => (kit.reducedMotion ? Math.min(ms, 100) : ms);
    const vec = v => (v == null ? null : v.isVector3 || v.isEuler ? new THREE.Vector3(v.x, v.y, v.z) : Array.isArray(v) ? new THREE.Vector3(v[0], v[1], v[2])
      : typeof v === 'number' ? new THREE.Vector3(v, v, v) : new THREE.Vector3(v.x, v.y, v.z));
    function stopAnims(obj) {
      for (let i = anims.length - 1; i >= 0; i--) if (anims[i].obj === obj && anims[i].kind !== 'squash') { anims[i].resolve(false); anims.splice(i, 1); }
    }
    kit.tween = (obj, to, ms = 400, ease) => new Promise(resolve => {
      stopAnims(obj);
      const lift = liftOf(obj);
      const a = { kind: 'tween', obj, t: 0, ms: durOf(ms), ease: easeOf(ease), resolve,
        p0: obj.position.clone().setY(obj.position.y - lift), p1: vec(to.position),
        r0: new THREE.Vector3(obj.rotation.x, obj.rotation.y, obj.rotation.z), r1: vec(to.rotation),
        s0: obj.scale.clone(), s1: vec(to.scale) };
      anims.push(a);
    });
    // arc(obj, from, to, h, ms): 포물선 던지기. 가로는 곡선(ease)을 따라, 높이는 4h·s(1−s). 착지 때 6 % 눌림 → 0.12초에 복원
    kit.arc = (obj, from, to, h = 0.25, ms = 600, opts = {}) => new Promise(resolve => {
      stopAnims(obj);
      const a = { kind: 'arc', obj, t: 0, ms: durOf(ms), ease: easeOf(opts.ease || 'easeInOutSine'), resolve,
        p0: vec(from || obj.position.clone().setY(obj.position.y - liftOf(obj))), p1: vec(to), h: kit.reducedMotion ? 0 : h, squash: opts.squash !== false };
      anims.push(a);
    });
    kit.squash = (obj, amount = RULES.LAND_SQUASH, ms = RULES.LAND_MS) => new Promise(resolve => {
      if (kit.reducedMotion) { resolve(true); return; }
      anims.push({ kind: 'squash', obj, t: 0, ms, resolve, base: obj.scale.clone(), amt: amount });
    });
    kit.wait = ms => new Promise(r => anims.push({ kind: 'wait', obj: null, t: 0, ms, resolve: r }));
    kit.stop = obj => stopAnims(obj);   // 무대를 나갈 때 진행 중이던 이동을 버린다(다시 들어오면 처음부터)
    kit.isMoving = obj => anims.some(a => a.obj === obj && (a.kind === 'tween' || a.kind === 'arc'));

    // ── 김 (부드러운 점 스프라이트 ≤ 40개) ──
    // 가산 혼합 금지(흰 김이 하늘처럼 번진다) — 일반 알파 + depthWrite false. 입자마다 크기·투명도가 달라야 해서 작은 셰이더를 쓴다.
    // opts: { origin: [x,y,z], count(≤40), spread(m), height(m), size(m), life(s), color, opacity }
    const STEAM_VS = `
      attribute float aAlpha; attribute float aSize; varying float vAlpha; uniform float uScale;
      void main() { vAlpha = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale * projectionMatrix[1][1] / max(-mv.z, 0.05); gl_Position = projectionMatrix * mv; }`;
    const STEAM_FS = `
      uniform vec3 uColor; varying float vAlpha;
      void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c) * 2.0; if (d > 1.0) discard;
        float a = (1.0 - d * d) * (1.0 - d * d) * vAlpha; gl_FragColor = vec4(uColor, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`;
    kit.steam = (opts = {}) => {
      const N = Math.min(RULES.STEAM_MAX, opts.count || 24);
      const o = vec(opts.origin || [0, 0, 0]);
      const spread = opts.spread || 0.03, height = opts.height || 0.22, size = opts.size || 0.05, life = opts.life || 2.4;
      const geo = new THREE.BufferGeometry();
      const pos = new Float32Array(N * 3), al = new Float32Array(N), sz = new Float32Array(N);
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('aAlpha', new THREE.BufferAttribute(al, 1));
      geo.setAttribute('aSize', new THREE.BufferAttribute(sz, 1));
      const mat = new THREE.ShaderMaterial({ vertexShader: STEAM_VS, fragmentShader: STEAM_FS, transparent: true, depthWrite: false,
        uniforms: { uColor: { value: new THREE.Color(opts.color || 0xffffff) }, uScale: { value: 400 } } });
      const pts = new THREE.Points(geo, mat);
      pts.frustumCulled = false;
      pts.renderOrder = kit.ORDER.steam;
      pts.userData.kitHelper = true; pts.userData.pickThrough = true;
      pts.raycast = () => {};
      const ph = Array.from({ length: N }, (_, i) => ({ t: i / N, sx: hash3(i, 1, 3) - 0.5, sz: hash3(i, 2, 3) - 0.5, w: 0.6 + hash3(i, 3, 3) * 0.8 }));
      let on = opts.autostart !== false, level = on ? 1 : 0;
      const maxA = opts.opacity == null ? 0.32 : opts.opacity;
      const fxo = {
        obj: pts, origin: o,
        start() { on = true; }, stop() { on = false; },
        get running() { return on || level > 0.001; },
        update(dt) {
          level += ((on ? 1 : 0) - level) * Math.min(1, dt * 2.5);
          mat.uniforms.uScale.value = kit._viewH * 0.5;
          for (let i = 0; i < N; i++) {
            const p = ph[i];
            p.t += dt / (life * p.w);
            if (p.t > 1) p.t -= 1;
            const t = p.t, k = i * 3;
            const sway = Math.sin(clock * 1.3 + i * 1.7) * spread * 0.6 * t;
            pos[k] = o.x + p.sx * spread * (0.4 + t) + sway;
            pos[k + 1] = o.y + t * height;
            pos[k + 2] = o.z + p.sz * spread * (0.4 + t) + Math.cos(clock * 1.1 + i) * spread * 0.4 * t;
            al[i] = Math.sin(Math.PI * t) * maxA * level * (kit.reducedMotion ? 0.6 : 1);
            sz[i] = size * (0.5 + t * 1.6);
          }
          geo.attributes.position.needsUpdate = true;
          geo.attributes.aAlpha.needsUpdate = true;
          geo.attributes.aSize.needsUpdate = true;
        },
      };
      fx.push(fxo);
      return fxo;
    };

    // ── 음료·물 줄기 (가는 원통 + UV 가 흐르는 셰이더) ──
    // opts: { from: [x,y,z](위), to: [x,y,z](아래), r(m), color, opacity(물 0.55 · 커피 1) }
    // start(ms) = 위에서부터 줄기가 내려와 이어짐 · stop(ms) = 위부터 끊겨 마저 떨어짐. 조명은 가짜(시선과 법선으로 가장자리 어둡게 + 흐르는 띠)
    const POUR_VS = `
      varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() { vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`;
    const POUR_FS = `
      uniform vec3 uColor; uniform float uTime, uHead, uTail, uOpacity; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
      void main() {
        float y = 1.0 - vUv.y;                       // 0 = 위, 1 = 아래
        if (y > uHead || y < uTail) discard;
        float facing = clamp(dot(normalize(vN), normalize(vV)), 0.0, 1.0);
        float flow = 0.5 + 0.5 * sin((vUv.y * 38.0 + uTime * 14.0) + sin(vUv.x * 25.13) * 0.8);
        vec3 c = uColor * (0.55 + 0.45 * facing) * (0.9 + 0.18 * flow);
        c += vec3(1.0) * pow(facing, 18.0) * 0.35;   // 가운데 얇은 반사 줄
        float a = uOpacity * (0.75 + 0.25 * facing);
        gl_FragColor = vec4(c, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`;
    kit.pourStream = (opts = {}) => {
      const r = opts.r || 0.0025;
      const geo = new THREE.CylinderGeometry(r, r * 0.85, 1, 16, 32, true);
      geo.translate(0, -0.5, 0);                      // 윗변이 원점, 아래로 1 m
      const opacity = opts.opacity == null ? 1 : opts.opacity;
      const mat = new THREE.ShaderMaterial({ vertexShader: POUR_VS, fragmentShader: POUR_FS, transparent: opacity < 1, depthWrite: opacity >= 1,
        uniforms: { uColor: { value: new THREE.Color(opts.color || 0x3a1a0a) }, uTime: { value: 0 }, uHead: { value: 0 }, uTail: { value: 0 }, uOpacity: { value: opacity } } });
      const m = new THREE.Mesh(geo, mat);
      m.userData.kitHelper = true; m.userData.pickThrough = true;
      m.raycast = () => {};
      m.renderOrder = opacity < 1 ? kit.ORDER.clear + 1 : 0;
      m.visible = false;
      const setEnds = (a, b) => {
        const A = vec(a), B = vec(b), d = new THREE.Vector3().subVectors(B, A);
        m.position.copy(A);
        m.scale.set(1, Math.max(d.length(), 1e-4), 1);
        m.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), d.normalize());
      };
      setEnds(opts.from || [0, 0.3, 0], opts.to || [0, 0, 0]);
      let head = 0, tail = 0, headV = 0, tailV = 0;
      const fxo = {
        obj: m, setEnds,
        start(ms = 250) { head = 0; tail = 0; headV = 1000 / durOf(ms); tailV = 0; m.visible = true; },
        stop(ms = 300) { tailV = 1000 / durOf(ms); },
        // 시간 고정 사진 자세용: 줄기가 다 이어진 상태로 바로
        full() { head = 1; tail = 0; headV = 0; tailV = 0; m.visible = true; mat.uniforms.uHead.value = 1; mat.uniforms.uTail.value = 0; },
        get running() { return m.visible; },
        update(dt) {
          mat.uniforms.uTime.value = clock;
          if (!m.visible) return;
          head = Math.min(1, head + headV * dt);
          tail = Math.min(1, tail + tailV * dt);
          mat.uniforms.uHead.value = head;
          mat.uniforms.uTail.value = tail;
          if (tail >= 1) { m.visible = false; tailV = 0; }
        },
      };
      fx.push(fxo);
      return fxo;
    };

    // ── 프레임 갱신 (FPStage 가 무대 프레임마다 부른다) ──
    kit._viewH = 800;
    kit.update = dt => {
      clock += dt;
      if (renderer && renderer.getDrawingBufferSize) kit._viewH = renderer.getDrawingBufferSize(_v2).y || kit._viewH;
      // 강조 들림 — 위치에 '바뀐 만큼'만 더한다
      for (const [obj, h] of hls) {
        if (h.t >= 1 && h.lift === h.to) continue;
        h.t = Math.min(1, h.t + dt * 1000 / durOf(RULES.HL_MS));
        const nl = h.from + (h.to - h.from) * EASE.easeOutCubic(h.t);
        if (!kit.isMoving(obj)) obj.position.y += nl - h.lift;
        h.lift = nl;
      }
      for (let i = anims.length - 1; i >= 0; i--) {
        const a = anims[i];
        a.t = Math.min(1, a.t + (a.ms > 0 ? dt * 1000 / a.ms : 1));
        const done = a.t >= 1;
        if (a.kind === 'tween') {
          const e = a.ease(a.t), lift = liftOf(a.obj);
          if (a.p1) a.obj.position.lerpVectors(a.p0, a.p1, e).y += lift;
          if (a.r1) a.obj.rotation.set(mix(a.r0.x, a.r1.x, e), mix(a.r0.y, a.r1.y, e), mix(a.r0.z, a.r1.z, e));
          if (a.s1) a.obj.scale.lerpVectors(a.s0, a.s1, e);
        } else if (a.kind === 'arc') {
          const s = a.ease(a.t);
          a.obj.position.lerpVectors(a.p0, a.p1, s).y += 4 * a.h * s * (1 - s) + liftOf(a.obj);
        } else if (a.kind === 'squash') {
          // 0~40 % 눌림, 40~100 % 복원 (easeOutCubic)
          const k = a.t < 0.4 ? EASE.easeOutCubic(a.t / 0.4) : 1 - EASE.easeOutCubic((a.t - 0.4) / 0.6);
          a.obj.scale.set(a.base.x * (1 + a.amt * 0.5 * k), a.base.y * (1 - a.amt * k), a.base.z * (1 + a.amt * 0.5 * k));
          if (done) a.obj.scale.copy(a.base);
        }
        if (done) {
          anims.splice(i, 1);
          if (a.kind === 'arc' && a.squash) kit.squash(a.obj).then(() => a.resolve(true));
          else a.resolve(true);
        }
      }
      // 접지 그림자: 소품 x·z 따라가기, 들린 만큼 옅고 크게
      for (const s of shadows) {
        s.obj.getWorldPosition(_v);
        const up = Math.max(0, _v.y - s.baseY);
        const k = 1 / (1 + up * 6);
        s.mesh.position.set(_v.x, s.y + 0.0015, _v.z);
        s.mesh.scale.set(s.sx * (1 + up * 1.5), s.sz * (1 + up * 1.5), 1);
        s.mesh.material.opacity = s.opacity * k * (kit.quality === 'low' ? 1.25 : 1);
        s.mesh.visible = s.obj.visible !== false;
      }
      for (const f of fx) f.update(dt);
    };
    const _v2 = new THREE.Vector2();
    // 굽기(bake): 움직이지 않는 소품 묶음을 '재질 + 그림자 설정'이 같은 것끼리 메시 하나로 합친다 — 드로우콜 예산(무대 ≤ 120, 수용 12).
    //   그림자 패스·투명(transmission) 패스가 불투명 메시를 한 번씩 더 그리므로, 합치지 않으면 소품 60개가 드로우콜 180이 된다.
    //   root 아래 메시 중 userData.keep(움직이거나 고르는 것)·kitHelper 는 그대로 두고, 나머지를 합친 메시를 root 에 다시 단다.
    kit.bake = root => {
      root.updateMatrixWorld(true);
      const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
      const groups = new Map(), victims = [];
      root.traverse(o => {
        if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || o.userData.kitHelper || Array.isArray(o.material)) return;
        for (let p = o; p && p !== root; p = p.parent) if (p.userData.keep) return;
        const key = `${o.material.uuid}|${o.castShadow ? 1 : 0}${o.receiveShadow ? 1 : 0}|${o.renderOrder}`;
        if (!groups.has(key)) groups.set(key, { mat: o.material, cast: o.castShadow, recv: o.receiveShadow, order: o.renderOrder, list: [] });
        groups.get(key).list.push(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
        groups.get(key).list[groups.get(key).list.length - 1].geo = o.geometry;
        victims.push(o);
      });
      for (const o of victims) o.parent.remove(o);
      let n = 0;
      for (const g of groups.values()) {
        const geo = mergeGeometries(g.list.map(m => m.geo.clone().applyMatrix4(m)));
        const m = new THREE.Mesh(geo, g.mat);
        m.castShadow = g.cast; m.receiveShadow = g.recv; m.renderOrder = g.order;
        m.name = 'baked:' + (g.mat.name || g.mat.type);
        root.add(m);
        n++;
      }
      return { meshes: victims.length, merged: n };
    };
    kit.counts = () => ({ anims: anims.length, highlights: hls.size, shadows: shadows.length, fx: fx.length, shadowLights: shadowLights.length });
    return kit;
  }

  // ── 소음 무늬 생성기 (u, v ∈ [0,1), out = [r, g, b, 거칠기]) ───────────────────
  const NOISE = {
    // 나무결: 결 방향 = u. 나이테 띠(v 방향 반복) + 결을 휘게 하는 저주파 소음 + 가는 섬유. opts.planks = 판재 수(v 방향 이음매)
    wood(u, v, seed, o, out) {
      const light = o.light ? hexRGB(o.light) : [196, 150, 104], dark = o.dark ? hexRGB(o.dark) : [128, 86, 52];
      const planks = o.planks || 4;
      const pv = v * planks, pi = Math.floor(pv), pf = pv - pi;
      const tone = (hash3(pi, 9, seed) - 0.5) * 0.18;
      const warp = fbm(u, v, 2, 8, 3, seed + pi) * 2.2;
      const g = (pf * 6 + warp + hash3(pi, 3, seed) * 4);
      const ring = Math.pow(Math.abs(Math.sin(g * Math.PI)), 0.55);
      const fiber = vnoise(u * 6, v * 512, 6, 512, seed + 31) * 0.5 + vnoise(u * 3, v * 256, 3, 256, seed + 41) * 0.5;
      let t = clamp01(0.25 + ring * 0.55 + (fiber - 0.5) * 0.35 + tone);
      // 판재 이음매: 가는 어두운 줄
      const seam = Math.min(pf, 1 - pf) / planks < 0.0016 ? 0.55 : 1;   // 1024 px 기준 이음매 약 3 px
      out[0] = mix(dark[0], light[0], t) * seam; out[1] = mix(dark[1], light[1], t) * seam; out[2] = mix(dark[2], light[2], t) * seam;
      out[3] = 0.5 + (1 - ring) * 0.18 + (fiber - 0.5) * 0.12 + (seam < 1 ? 0.3 : 0);
    },
    // 타일: square(정사각) · herringbone(헤링본, 1 × 2 판). 줄눈은 거칠고 어둡게, 판은 판마다 색이 조금 다르고 가장자리가 살짝 어둡다
    tile(u, v, seed, o, out) {
      const N = o.count || 8, gw = o.grout || 0.035;
      const base = o.color1 ? hexRGB(o.color1) : [226, 220, 208], alt = o.color2 ? hexRGB(o.color2) : base, grout = o.groutColor ? hexRGB(o.groutColor) : [150, 142, 130];
      let id = 0, edge = 1;
      if (o.pattern === 'herringbone') {
        // 4 × 4 칸마다 되풀이 (칸 = 판의 짧은 변). 대각선 띠 하나 = 가로판 H_n [n,n+2]×[n,n+1] + 세로판 V_n [n,n+1]×[n+1,n+3]
        const M = Math.max(4, Math.round(N / 4) * 4);
        const px = u * M, py = v * M, cx = Math.floor(px), cy = Math.floor(py);
        const d = cx - cy, k = Math.floor((d + 2) / 4), dd = d - 4 * k, X = px - 4 * k;
        let lx, ly, wdt, hgt, n;
        if (dd >= 0) { n = cy; lx = X - n; ly = py - n; wdt = 2; hgt = 1; id = hash3(n, k, seed); }
        else { n = Math.floor(X); lx = X - n; ly = py - (n + 1); wdt = 1; hgt = 2; id = hash3(n, k + 101, seed); }
        edge = Math.min(lx, wdt - lx, ly, hgt - ly);
        edge = edge / (gw * 2.2);
      } else {
        const x = u * N, y = v * N, ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
        id = hash3(ix, iy, seed);
        edge = Math.min(fx, 1 - fx, fy, 1 - fy) / gw;
      }
      const n2 = fbm(u, v, 16, 16, 3, seed + 5);
      if (edge < 1) {
        const gn = vnoise(u * 256, v * 256, 256, 256, seed + 9);
        out[0] = grout[0] * (0.92 + gn * 0.12); out[1] = grout[1] * (0.92 + gn * 0.12); out[2] = grout[2] * (0.92 + gn * 0.12);
        out[3] = 0.92;
      } else {
        const c = id < (o.altShare || 0) ? alt : base;
        const j = (id - 0.5) * 0.08 + (n2 - 0.5) * 0.06, bev = Math.min(1, (edge - 1) / 1.5) * 0.08 + 0.92;
        out[0] = c[0] * (1 + j) * bev; out[1] = c[1] * (1 + j) * bev; out[2] = c[2] * (1 + j) * bev;
        out[3] = (o.gloss == null ? 0.32 : o.gloss) + (n2 - 0.5) * 0.12 + (1 - bev) * 1.5;
      }
    },
    concrete(u, v, seed, o, out) {
      const c = o.color ? hexRGB(o.color) : [168, 166, 160];
      const big = fbm(u, v, 4, 4, 4, seed), fine = vnoise(u * 384, v * 384, 384, 384, seed + 3);
      const pit = hash3(Math.floor(u * 512), Math.floor(v * 512), seed + 7) > 0.985 ? 0.7 : 1;
      const t = (0.82 + (big - 0.5) * 0.3 + (fine - 0.5) * 0.12) * pit;
      out[0] = c[0] * t; out[1] = c[1] * t; out[2] = c[2] * t;
      out[3] = 0.82 + (fine - 0.5) * 0.15 + (pit < 1 ? 0.1 : 0);
    },
    // 회반죽 벽: 큰 얼룩 + 흙손 자국(비스듬한 저주파)
    plaster(u, v, seed, o, out) {
      const c = o.color ? hexRGB(o.color) : [234, 228, 216];
      const big = fbm(u, v, 3, 3, 4, seed), trowel = fbm(u * 0.7 + v * 0.3, v, 6, 2, 3, seed + 13), fine = vnoise(u * 256, v * 256, 256, 256, seed + 2);
      const t = 0.93 + (big - 0.5) * 0.08 + (trowel - 0.5) * 0.06 + (fine - 0.5) * 0.04;
      out[0] = c[0] * t; out[1] = c[1] * t; out[2] = c[2] * t;
      out[3] = 0.78 + (trowel - 0.5) * 0.25;
    },
    // 헤어라인 금속: 결 방향 = u. 줄마다 다른 값을 u 방향으로 길게 끈다(고주파 v · 저주파 u)
    // 줄 주기는 텍스처 크기의 절반 이하(512 px 에 256 줄) — 더 촘촘하면 겹침 무늬(에일리어싱)가 나뭇결처럼 굵게 보였다
    brushed(u, v, seed, o, out) {
      const line = vnoise(u * 3, v * 256, 3, 256, seed) * 0.6 + vnoise(u * 8, v * 128, 8, 128, seed + 1) * 0.4;
      const smudge = fbm(u, v, 3, 3, 3, seed + 4);
      const t = 0.92 + (line - 0.5) * 0.08;
      out[0] = 255 * t; out[1] = 255 * t; out[2] = 255 * t * 1.01;
      out[3] = (o.rough == null ? 0.26 : o.rough) + (line - 0.5) * 0.1 + (smudge - 0.5) * 0.06;   // 거칠기 결은 옅게 — 넓은 면에서 줄무늬로 보였다(M2 머신)
    },
    // 종이: 고운 섬유 + 짧은 결. 골판지(cardboard)는 갈색 + 골 그림자 줄(옅게)
    paper(u, v, seed, o, out) {
      const c = o.color ? hexRGB(o.color) : [244, 240, 230];
      const f1 = vnoise(u * 320, v * 320, 320, 320, seed), f2 = vnoise(u * 40, v * 900, 40, 900, seed + 1), big = fbm(u, v, 4, 4, 3, seed + 2);
      const t = 0.95 + (f1 - 0.5) * 0.05 + (f2 - 0.5) * 0.05 + (big - 0.5) * 0.04;
      out[0] = c[0] * t; out[1] = c[1] * t; out[2] = c[2] * t;
      out[3] = 0.88 + (f1 - 0.5) * 0.08;
    },
    cardboard(u, v, seed, o, out) {
      const c = o.color ? hexRGB(o.color) : [184, 142, 96];
      const f1 = vnoise(u * 256, v * 256, 256, 256, seed), flute = 0.5 + 0.5 * Math.sin(v * Math.PI * 2 * (o.flutes || 48)), big = fbm(u, v, 4, 4, 3, seed + 2);
      const t = 0.92 + (f1 - 0.5) * 0.08 + (flute - 0.5) * 0.035 + (big - 0.5) * 0.08;
      out[0] = c[0] * t; out[1] = c[1] * t; out[2] = c[2] * t;
      out[3] = 0.9 + (f1 - 0.5) * 0.06;
    },
    rubber(u, v, seed, o, out) {
      const f = vnoise(u * 200, v * 200, 200, 200, seed), big = fbm(u, v, 6, 6, 3, seed + 1);
      const t = 0.9 + (f - 0.5) * 0.1 + (big - 0.5) * 0.08;
      out[0] = 255 * t; out[1] = 255 * t; out[2] = 255 * t;
      out[3] = 0.82 + (f - 0.5) * 0.12;
    },
    // 크레마: 갈색 얼룩 무늬(호랑이 줄무늬처럼 번진 저주파)
    crema(u, v, seed, o, out) {
      const a = [196, 136, 78], b = [138, 82, 40];
      const n = fbm(u, v, 5, 5, 4, seed), s = 0.5 + 0.5 * Math.sin((n * 6 + u * 3) * Math.PI);
      const t = clamp01(n * 0.6 + s * 0.4);
      out[0] = mix(b[0], a[0], t); out[1] = mix(b[1], a[1], t); out[2] = mix(b[2], a[2], t);
      out[3] = 0.5 + (1 - t) * 0.15;
    },
  };

  // 지오메트리 합치기 (examples 의 BufferGeometryUtils 대신 — 애드온 금지, 마스터 §6-11). position·normal·uv 만 쓴다(없는 uv 는 0)
  function mergeGeometries(geos) {
    let nv = 0, ni = 0;
    const parts = geos.map(g => {
      const n = g.attributes.position.count;
      const idx = g.index ? g.index.array : Array.from({ length: n }, (_, i) => i);
      if (!g.attributes.normal) g.computeVertexNormals();
      const p = { g, n, idx, v0: nv };
      nv += n; ni += idx.length;
      return p;
    });
    const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2);
    // 정점 색(빵 크러스트 등)은 모두가 가졌을 때만 합친다 — 하나라도 없으면 vertexColors 재질이 검게 나온다(굽기 쪽에서 재질별로 묶이므로 대개 다 같다)
    const withColor = parts.every(({ g }) => g.attributes.color && g.attributes.color.itemSize === 3);
    const col = withColor ? new Float32Array(nv * 3) : null;
    const index = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ii = 0;
    for (const { g, n, idx, v0 } of parts) {
      pos.set(g.attributes.position.array.subarray(0, n * 3), v0 * 3);
      nor.set(g.attributes.normal.array.subarray(0, n * 3), v0 * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array.subarray(0, n * 2), v0 * 2);
      if (col) col.set(g.attributes.color.array.subarray(0, n * 3), v0 * 3);
      for (let k = 0; k < idx.length; k++) index[ii++] = idx[k] + v0;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) out.setAttribute('color', new THREE.BufferAttribute(col, 3));
    out.setIndex(new THREE.BufferAttribute(index, 1));
    out.computeBoundingBox();
    out.computeBoundingSphere();
    return out;
  }

  return { create, EASE, RULES, roundedBoxGeometry, latheGeometry, tubeGeometry, mergeGeometries, _noise: { vnoise, fbm, hash3, NOISE } };
})();
