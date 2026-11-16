// ============================================================================
// 미니게임 무대 틀 검사 (4차 M1) - firstperson/fp-stage-kit.js · firstperson/fp-stage.js
// ----------------------------------------------------------------------------
// M §1-3 품질 규칙을 코드에서 잴 수 있는 만큼 잰다(사진으로만 볼 수 있는 Q3·Q5·Q6 은 사람 확인 🧑):
//   Q1 둥근 상자(무대 파일에 BoxGeometry 0, 반경 ≥ 짧은 변 2 %, 법선·감김이 바깥) · Q2 회전체 seg ≥ 48·단면 24점 ·
//   관 반지름 분할 ≥ 12 · 이동 easing·착지 눌림 6 % → 복원 · 강조 2 cm 들림이 이동과 섞여도 제자리로 · 움직임 줄이기 0.1초 ·
//   김 ≤ 40개·가산 혼합 없음 · 점광 ≤ 3.
// 마스터 §6-14(렌더러는 하나): 저장 → 바꾸기 → 복원 뒤 항목 비교가 빈 목록인가(가짜 렌더러로).
// 로드 순서(index.html · 빌더 FP_JS), fp-main 의 무대 프레임 분기, fp-player·fp-sheet 의 무대 가드, CSS 의 세계 HUD 숨김.
// three.js 는 vendor/three.min.js(r160 UMD)를 vm 에 그대로 읽는다(브라우저와 같은 파일). 캔버스 텍스처는 DOM 이 없어 재지 않는다.
// 실행: node tools/test_fp_stage.js      (실패하면 종료 코드 1)
// ============================================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/<!--[\s\S]*?-->/g, '');

const ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error }, Math, Promise, setTimeout });
// three.min.js 는 r150+ 부터 '곧 사라질 빌드' 경고를 console.warn 으로 낸다 — 위 console 이 삼킨다
vm.runInContext(read('vendor/three.min.js'), ctx, { filename: 'three.min.js' });
vm.runInContext(read('firstperson/fp-stage-kit.js'), ctx, { filename: 'fp-stage-kit.js' });
vm.runInContext(read('firstperson/fp-stage.js'), ctx, { filename: 'fp-stage.js' });
const THREE = vm.runInContext('THREE', ctx);
const K = vm.runInContext('FPStageKit', ctx);
const S = vm.runInContext('FPStage', ctx);

let fails = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
}
const near = (a, b, e = 1e-6) => Math.abs(a - b) <= e;

(async () => {
  // ── 0. 모듈 모양 ─────────────────────────────────────────────────────────
  check('FPStage API: register · enter · exit · active · setQuality (M §1-2)',
    ['register', 'enter', 'exit', 'active', 'setQuality'].every(k => typeof S[k] === 'function'));
  check('FPStageKit.create → roundedBox · lathe · tube · canvasTex · noiseTex · mat · lightRig · groundShadow · highlight · tween · arc · steam · pourStream (M §1-3 표)', (() => {
    const kit = K.create(null);
    return ['roundedBox', 'lathe', 'tube', 'canvasTex', 'noiseTex', 'lightRig', 'groundShadow', 'highlight', 'tween', 'arc', 'steam', 'pourStream'].every(k => typeof kit[k] === 'function')
      && typeof kit.mat === 'object';
  })());
  {
    const kit = K.create(null);
    const want = ['wood', 'tile', 'concrete', 'brushedSteel', 'chrome', 'clearPET', 'glass', 'ceramic', 'paper', 'cardboard', 'rubber', 'plasticMatte', 'liquidCoffee', 'crema'];
    const keys = Object.keys(kit.mat);
    check('재질 묶음 14종 (M §1-3 mat.*)', want.every(k => keys.includes(k)), want.filter(k => !keys.includes(k)).join(', '));
    // 텍스처가 필요 없는 재질만 실제로 만들어 값을 본다(텍스처 재질은 캔버스 = DOM)
    const ch = kit.mat.chrome, pet = kit.mat.clearPET, gl = kit.mat.glass, pl = kit.mat.plasticMatte;
    check('금속 metalness 1 · 유리 transmission 1 ior 1.5 · 투명 PET transmission 1 ior 1.57 · 사출 플라스틱 거칠기 0.55',
      ch.metalness === 1 && gl.isMeshPhysicalMaterial && gl.transmission === 1 && gl.ior === 1.5 && gl.thickness > 0
      && pet.isMeshPhysicalMaterial && pet.transmission === 1 && near(pet.ior, 1.57) && pl.roughness === 0.55);
    const src = code('firstperson/fp-stage-kit.js');
    check('헤어라인 스테인리스 = metalness 1 + 거칠기 지도', /brushedSteel: o => new THREE\.MeshStandardMaterial\(\{ \.\.\.withMaps\('brushed'[^\n]*metalness: 1/.test(src));
    check('종이·골판지 거칠기 0.85~0.95 (소음 생성기 기본 거칠기)', (() => {
      const out = [0, 0, 0, 0], N = K._noise.NOISE; let lo = 1, hi = 0;
      for (const kind of ['paper', 'cardboard']) for (let i = 0; i < 400; i++) { N[kind]((i % 20) / 20 + 0.01, Math.floor(i / 20) / 20 + 0.01, 7, {}, out); lo = Math.min(lo, out[3]); hi = Math.max(hi, out[3]); }
      return lo >= 0.8 && hi <= 0.97 && (lo + hi) / 2 >= 0.85 && (lo + hi) / 2 <= 0.95;
    })());
  }

  // ── 1. Q1 둥근 상자 ──────────────────────────────────────────────────────
  {
    const stageFiles = fs.readdirSync(path.join(ROOT, 'firstperson')).filter(f => /^fp-stage.*\.js$/.test(f));
    const withBox = stageFiles.filter(f => /THREE\.BoxGeometry|new BoxGeometry/.test(code('firstperson/' + f)));
    check(`Q1 무대 파일에 BoxGeometry 0 (${stageFiles.join(', ')})`, withBox.length === 0, withBox.join(', '));
    const g = K.roundedBoxGeometry(0.6, 0.04, 0.3, 0.01, 4, 1);
    g.computeBoundingBox();
    const bb = g.boundingBox;
    check('둥근 상자 겉치수 = 요청 치수 (0.6 × 0.04 × 0.3 m)', near(bb.max.x, 0.3) && near(bb.min.y, -0.02) && near(bb.max.z, 0.15),
      `${(bb.max.x - bb.min.x).toFixed(4)} × ${(bb.max.y - bb.min.y).toFixed(4)} × ${(bb.max.z - bb.min.z).toFixed(4)}`);
    const tiny = K.roundedBoxGeometry(1, 1, 1, 0);
    check('반경 하한 = 짧은 변의 2 % (r 0 을 넣어도 0.02)', near(tiny.userData.kit.r, 0.02), `${tiny.userData.kit.r}`);
    // 법선이 단위 길이이고 바깥(중심 → 점 방향과 같은 쪽), 삼각형 감김이 법선과 같은 쪽
    const p = g.attributes.position.array, n = g.attributes.normal.array, idx = g.index.array;
    let unit = true, outward = true, wind = true;
    for (let i = 0; i < p.length; i += 3) {
      if (!near(Math.hypot(n[i], n[i + 1], n[i + 2]), 1, 1e-5)) unit = false;
      if (p[i] * n[i] + p[i + 1] * n[i + 1] + p[i + 2] * n[i + 2] <= 0) outward = false;
    }
    const v = k => new THREE.Vector3(p[k * 3], p[k * 3 + 1], p[k * 3 + 2]);
    for (let t = 0; t < idx.length; t += 3) {
      const a = v(idx[t]), b = v(idx[t + 1]), c = v(idx[t + 2]);
      const fn = b.clone().sub(a).cross(c.clone().sub(a));
      if (fn.lengthSq() < 1e-16) continue;   // 납작한 띠(안쪽 상자 두께 0 축)의 퇴화 삼각형
      const k = idx[t] * 3;
      if (fn.dot(new THREE.Vector3(n[k], n[k + 1], n[k + 2])) < 0) { wind = false; break; }
    }
    check('둥근 상자 법선 단위·바깥쪽, 모든 삼각형 감김 = 법선 쪽', unit && outward && wind, `unit ${unit} outward ${outward} wind ${wind}`);
    const uv = g.attributes.uv.array;
    check('둥근 상자 UV = 미터 단위 (0.6 m 면 → 0~0.6)', Math.max(...uv) <= 0.6 + 1e-6 && Math.max(...uv) > 0.59);
  }

  // ── 2. Q2 회전체 · 관 ────────────────────────────────────────────────────
  {
    const lg = K.latheGeometry([[0.03, 0], [0.035, 0.05], [0.045, 0.15]], 16);
    check('Q2 회전체 둘레 분할 ≥ 48 (16 을 넣어도 48), 단면 24점 이상', lg.userData.kit.seg >= 48 && lg.userData.kit.points >= 24,
      `seg ${lg.userData.kit.seg}, 점 ${lg.userData.kit.points}`);
    const sharp = K.latheGeometry([[0, 0], [0.04, 0], [0.04, 0.1]], 64, { sharp: true });
    check('꺾인 단면(sharp)도 24점 이상으로 다시 나눔', sharp.userData.kit.points >= 24);
    const tb = K.tubeGeometry([[0, 0, 0], [0.05, 0.05, 0], [0.1, 0.02, 0]], 0.004, { radial: 6 });
    check('관 반지름 방향 분할 ≥ 12 (6 을 넣어도 12)', tb.userData.kit.radial >= 12 && tb.parameters.radialSegments >= 12);
  }

  // ── 3. 움직임 (Q7) ───────────────────────────────────────────────────────
  {
    const E = K.EASE;
    check('easing 끝점 0 → 0, 1 → 1 (easeOutCubic 기본)', Object.values(E).every(f => near(f(0), 0) && near(f(1), 1)) && near(E.easeOutCubic(0.5), 0.875));
    const run = (kit, s, dt = 1 / 60) => { for (let t = 0; t < s; t += dt) kit.update(dt); };
    const flush = () => new Promise(r => setTimeout(r, 0));
    const kit = K.create(null);
    const o = new THREE.Object3D();
    let done = false;
    kit.tween(o, { position: [1, 0.5, 0] }, 400).then(() => { done = true; });
    run(kit, 0.2);
    const mid = o.position.x;
    run(kit, 0.3); await flush();
    check('tween 0.4초: 중간엔 easeOutCubic 만큼(> 절반), 끝엔 목표 + Promise 해결', mid > 0.5 && mid < 1 && near(o.position.x, 1) && near(o.position.y, 0.5) && done,
      `0.2초 x=${mid.toFixed(3)}`);
    // 강조 들림 2 cm → 그 사이 이동 → 강조 끔: 제자리(목표 높이)로
    const a = new THREE.Object3D();
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial());
    a.add(m);
    kit.highlight(a, true);
    run(kit, 0.3);
    const lifted = a.position.y;
    const ol = m.children.find(c => c.userData.kitHelper);
    kit.tween(a, { position: [0.3, 0.1, 0] }, 300);
    run(kit, 0.4);
    const during = a.position.y;
    kit.highlight(a, false);
    run(kit, 0.3); await flush();
    check('강조: 0.15초에 2 cm 들림 + 테두리(뒷면 메시) 보임', near(lifted, 0.02, 1e-6) && ol && ol.material.side === THREE.BackSide && ol.raycast && m.children.length === 1);
    check('강조 중 이동해도 들림이 꼬이지 않음 (이동 끝 = 목표 + 2 cm, 강조 끔 = 목표)', near(during, 0.12, 1e-6) && near(a.position.y, 0.1, 1e-6) && !ol.visible,
      `이동 끝 ${during.toFixed(4)} → 끔 ${a.position.y.toFixed(4)}`);
    // 포물선 + 착지 눌림
    const b = new THREE.Object3D();
    let peak = 0, minSy = 1;
    const pr = kit.arc(b, [0, 0, 0], [1, 0, 0], 0.25, 600);
    for (let t = 0; t < 0.8; t += 1 / 120) { kit.update(1 / 120); peak = Math.max(peak, b.position.y); minSy = Math.min(minSy, b.scale.y); }
    await pr;
    check('arc: 꼭대기 높이 h(0.25 m), 끝에 목표 도착', near(peak, 0.25, 0.005) && near(b.position.x, 1) && near(b.position.y, 0), `꼭대기 ${peak.toFixed(4)}`);
    check('착지 6 % 눌림 → 0.12초 안에 원래 크기', near(minSy, 0.94, 0.006) && near(b.scale.y, 1) && near(b.scale.x, 1), `최소 sy ${minSy.toFixed(3)}`);
    // 움직임 줄이기: 0.1초
    const kr = K.create(null, { reducedMotion: true });
    const c = new THREE.Object3D();
    kr.tween(c, { position: [2, 0, 0] }, 1200);
    run(kr, 0.12);
    check('움직임 줄이기: 1.2초 이동이 0.1초 안에 끝', near(c.position.x, 2));
  }

  // ── 4. 김 · 줄기 · 빛 ────────────────────────────────────────────────────
  {
    const kit = K.create(null);
    const st = kit.steam({ count: 99, origin: [0, 1, 0] });
    check('김 입자 ≤ 40 (99 를 넣어도 40), 가산 혼합 아님·depthWrite false', st.obj.geometry.attributes.position.count === 40
      && st.obj.material.blending === THREE.NormalBlending && st.obj.material.depthWrite === false && st.obj.material.transparent);
    kit.update(0.5);
    const al = st.obj.geometry.attributes.aAlpha.array;
    check('김 갱신: 투명도 0~0.32, 위로 흩어짐', Math.max(...al) <= 0.33 && Math.max(...al) > 0 && st.obj.geometry.attributes.position.array[1] >= 1);
    const ps = kit.pourStream({ from: [0, 0.3, 0], to: [0, 0.1, 0] });
    ps.start(250); kit.update(0.1);
    const h1 = ps.obj.material.uniforms.uHead.value;
    kit.update(0.3);
    check('음료 줄기: 위에서부터 이어짐(0.25초에 다 이어짐), 길이 = 두 점 거리', h1 > 0.3 && h1 < 0.5 && ps.obj.material.uniforms.uHead.value === 1 && near(ps.obj.scale.y, 0.2));
    ps.stop(300); kit.update(0.4);
    check('음료 줄기: 멈추면 위부터 끊겨 사라짐', ps.obj.visible === false);
    const src = code('firstperson/fp-stage-kit.js');
    check('가산 혼합(AdditiveBlending) 없음 — 흰 김이 하늘처럼 번지지 않게', !/AdditiveBlending/.test(src));
    check('점광 ≤ 3 (lightRig 이 잘라 냄), 주광 그림자 2048 · PCF 범위 = 무대 크기', /slice\(0, RULES\.POINT_LIGHTS_MAX\)/.test(src) && K.RULES.POINT_LIGHTS_MAX === 3
      && /shadow\.mapSize\.set\(2048, 2048\)/.test(src));
    check('접지 그림자 depthWrite false, 바닥 반경 그라데이션', /groundShadow = \(obj, size, opts = \{\}\)[\s\S]{0,400}depthWrite: false/.test(src) && /createRadialGradient/.test(src));
    {
      const kc = K.create(null);
      const g = new THREE.SphereGeometry(0.05, 8, 6);
      const glassM = kc.mesh(g, kc.mat.glass), steelM = kc.mesh(g, kc.mat.chrome);
      const root = new THREE.Group(), raw = new THREE.Mesh(g, kc.mat.clearPET);
      raw.castShadow = true; root.add(raw); kc.fixOrder(root);
      check('투명 재질(유리·PET)은 그림자를 던지지 않음 + renderOrder 투명(5) — 안의 음료에 통째 그림자 방지', !glassM.castShadow && steelM.castShadow && !raw.castShadow && raw.renderOrder === kc.ORDER.clear);
    }
    check('외부 파일·애드온 0 (import·examples/jsm·Loader 없음 — D11, 마스터 §6-11)', !/\bimport\b|examples\/jsm|GLTFLoader|TextureLoader/.test(src + code('firstperson/fp-stage.js')));
    const kq = K.create(null);
    const scene = new THREE.Scene(), L = new THREE.DirectionalLight();
    L.castShadow = true;
    // lightRig 은 PMREM(렌더러)이 필요해 node 에서 부르지 않는다 → 품질 단계는 그림자 빛 목록 대신 공개 규칙으로 본다
    check('품질 단계 high 2048·픽셀 비 2 / mid 1024·1.5 / low 그림자 끔·1 (M §1-5)',
      S.QUALITY.high.shadow === 2048 && S.QUALITY.high.pr === 2 && S.QUALITY.mid.shadow === 1024 && S.QUALITY.mid.pr === 1.5 && S.QUALITY.low.shadow === 0 && S.QUALITY.low.pr === 1
      && S.FPS_MIN === 40 && S.FPS_WINDOW === 3 && /L\.castShadow = q !== 'low'/.test(src) && kq && scene && L);
  }

  // ── 5. 렌더러는 하나 — 저장 → 바꾸기 → 복원 → 항목 비교 (마스터 §6-14) ──────
  {
    const fake = {
      toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.15, outputColorSpace: THREE.SRGBColorSpace, autoClear: true,
      shadowMap: { enabled: true, type: THREE.PCFSoftShadowMap, autoUpdate: true },
      _pr: 2, _cc: new THREE.Color(0x000000), _ca: 1,
      getPixelRatio() { return this._pr; }, setPixelRatio(v) { this._pr = v; },
      getClearColor(t) { return t.copy(this._cc); }, setClearColor(c, a) { this._cc.copy(c); this._ca = a; }, getClearAlpha() { return this._ca; },
    };
    const world = new THREE.Scene();
    world.environment = new THREE.Texture(); world.fog = new THREE.Fog(0xffffff, 1, 2);
    const before = S._snapshot(fake, world);
    fake.toneMappingExposure = 1.0; fake._pr = 1; fake.shadowMap.autoUpdate = false; fake.setClearColor(new THREE.Color(0x336699), 0.5);
    world.environment = null; world.fog = null;
    check('무대 값으로 바꾸면 항목 비교가 차이를 잡음', S._diff(before, S._snapshot(fake, world)).length >= 6, S._diff(before, S._snapshot(fake, world)).join(', '));
    S._restore(fake, before, world);
    const d = S._diff(before, S._snapshot(fake, world));
    check('복원 뒤 항목 비교 = 차이 0 (노출 1.15·픽셀 비·그림자·지우기 색·세계 environment·fog)', d.length === 0, d.join(', '));
    const st = code('firstperson/fp-stage.js');
    check('나올 때 lastRestoreDiff 를 남김(Playwright 확인용), renderer.shadowMap.enabled 를 무대가 끄지 않음',
      /lastRestore\.diff = diff\(saved, snapshot\(R, worldScene\)\)/.test(st) && !/shadowMap\.enabled = false/.test(st + code('firstperson/fp-stage-kit.js')));
    check('톤매핑 종류·그림자 방식 = 세계와 같은 ACESFilmic·PCFSoft, 노출만 무대 상수', /toneMapping = THREE\.ACESFilmicToneMapping/.test(st) && /shadowMap\.type = THREE\.PCFSoftShadowMap/.test(st)
      && /toneMappingExposure = def\.exposure == null \? 1 : def\.exposure/.test(st));
  }

  // ── 6. 화면 연결 ─────────────────────────────────────────────────────────
  {
    const html = read('firstperson/index.html');
    const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
    const iP = srcs.indexOf('fp-player.js'), iK = srcs.indexOf('fp-stage-kit.js'), iS = srcs.indexOf('fp-stage.js'), iM = srcs.indexOf('fp-main.js');
    check('index.html 로드 순서: fp-player → fp-stage-kit → fp-stage → fp-main', iP >= 0 && iP < iK && iK < iS && iS < iM, `${iP} ${iK} ${iS} ${iM}`);
    const b = (read('tools/build_single_html.py').match(/FP_JS = \[([\s\S]*?)\]/) || [, ''])[1];
    check('빌더 FP_JS 도 같은 순서', /fp-player\.js",\s*"firstperson\/fp-stage-kit\.js", "firstperson\/fp-stage\.js", "firstperson\/fp-main\.js"/.test(b));
    const main = code('firstperson/fp-main.js');
    const iFrame = main.indexOf('if (FPStage.active()) { FPStage.frame(dt); return; }'), iUpd = main.indexOf('FPPlayer.update(dt, t)');
    check('fp-main: 무대에 있으면 세계 갱신·렌더 전에 무대만 그리고 끝 (M §1-1)', iFrame > 0 && iFrame < iUpd);
    check('fp-main: FPStage.init(렌더러·세계 장면·fit) · 맨 끝 FPStage.boot() · fit 이 무대 화면비·픽셀 비를 맞춤',
      /FPStage\.init\(\{ renderer, camera, scene: FPWorld\.scene, canvas: glCanvas, fit \}\)/.test(main) && /FPStage\.boot\(\);\s*$/.test(main.trim() + '\n')
      && /FPStage\.resize\(w \/ h\)/.test(main) && /FPStage\.pixelRatio\(\)/.test(main));
    const pl = code('firstperson/fp-player.js');
    check('fp-player: 무대 중에는 걷기 키·잠금·시작 안내를 쓰지 않음 (F 학습지는 먼저 처리)', /if \(inStage\(\)\) return;/.test(pl)
      && pl.indexOf("e.code === 'KeyF'") < pl.indexOf('if (inStage()) return;') && /!P\.uiOpen && !inStage\(\)\) enterGame\(\)/.test(pl) && /!P\.uiOpen && !inStage\(\)\) overlay/.test(pl));
    check('fp-sheet: 무대 중 학습지를 닫아도 \'3D를 클릭해 계속\' 안 띄움', /FPStage\.busy/.test(code('firstperson/fp-sheet.js')));
    check('fp-onboard: 사진 자세 주소면 첫 안내를 건너뜀', /FPStage\.shotQuery\(\)/.test(code('firstperson/fp-onboard.js')));
    const css = read('firstperson/style.css');
    check('CSS: 무대 중 세계 HUD(십자선·HUD·타임라인·단축바·지도·기록 배지·행동 안내) 숨김', ['#crosshair', '#hud', '#timeline', '#hotbar', '#minimapBox', '#fieldBadge', '#actHint']
      .every(s => new RegExp(`body\\.in-stage ${s}[,\\s]`).test(css)));
    check('CSS: 진입 덮개 = 종이색(--paper, 검정 아님)', /#stageFade \{[^}]*background: var\(--paper\)/.test(css));
    check('마크업: 덮개·막대·초점 테두리·무대 겹침 자리·구석 알림·나가기 확인(Esc 문구)', ['stageFade', 'stageBar', 'stageFocus', 'stageUi', 'stageNote', 'stageExit'].every(id => html.includes(`id="${id}"`))
      && /나갈까요\? 진행 중인 게임은 저장되지 않아요/.test(html));
    check('학습지 [과제] \'미니게임 화질\' 수동 선택 (자동·높음·보통·낮음)', ['auto', 'high', 'mid', 'low'].every(q => html.includes(`data-stage-q="${q}"`)));
    const st = code('firstperson/fp-stage.js');
    check('사진 자세: ?stage=…&shot=… → 덮개 없이(instant), 자동 품질 낮추기 안 함', /enter\(id, shot \? \{ shot, instant: true \} : \{\}\)/.test(st) && /if \(!autoQ \|\| shotMode/.test(st));
    check('모듈을 읽을 때 DOM·THREE 를 건드리지 않음 (node 에서 읽힘 — TDZ 방지)', typeof S.register === 'function' && S.active() === null && S.registered.length === 0);
  }

  console.log(fails ? `\n${fails}개 실패` : '\n전부 통과');
  process.exit(fails ? 1 : 0);
})();
