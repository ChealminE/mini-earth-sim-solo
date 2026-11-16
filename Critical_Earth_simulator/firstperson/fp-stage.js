// ============================================================================
// 1인칭 무대 관리자 (4차 M1-2) — 카페·분리배출장·회의실처럼 '미터 축척의 별도 장면'에 들어가고 나오는 공통 틀
// ----------------------------------------------------------------------------
// 왜 별도 무대인가(M §1-1): 세계는 1유닛 = 50 m(눈높이 0.032, near 0.002)라 컵(15 cm = 0.003유닛)을 정밀하게 그리면
//   깊이 정밀도·그림자 해상도·조명 범위가 모자란다. 그래서 미니게임은 미터 축척의 THREE.Scene 으로 따로 만들고,
//   들어가 있는 동안 세계 갱신·렌더를 멈추고 무대만 그린다(fp-main.js animate 가 FPStage.frame 으로 넘긴다).
//
// 쓰는 법
//   FPStage.register('cafe', { title: '초록잔 카페', exposure: 1.0,
//     build(kit, ctx) → { scene, camera?, update(dt, t), shots: { wide: { pos, target, fov, t?, freeze? }, … }, enterShot?,
//                         onEnter(info), onExit(), onShot(name, shot), pick(obj, info), hover(obj, on), key(e) → true(썼음) } })
//   FPStage.enter('cafe', { from: { x, y, z, yaw } })  ·  FPStage.exit()  ·  FPStage.active() → 지금 무대 id 또는 null
//   FPStage.setQuality('high' | 'mid' | 'low')
//   build 는 처음 들어갈 때 한 번만 부른다(늦은 생성). 나와도 지우지 않는다 — 다시 들어갈 때 기다리지 않게.
//
// 렌더러는 하나다(마스터 §6-14) — fp-main.js 의 renderer 를 같이 쓴다. 들어갈 때 바꾸는 것: 톤매핑 노출(무대마다 상수),
//   픽셀 비(품질 단계). 그림자 방식·톤매핑 종류는 세계와 같은 값(PCFSoft·ACESFilmic)을 다시 확인해 세운다.
//   scene.environment 는 무대 장면 자기 것이라 세계 장면 값은 건드리지 않는다. 그래도 '들어가기 전 값 저장 → 나올 때 복원 →
//   항목 비교'를 한다: FPStage.lastRestoreDiff 가 [] 가 아니면 무엇이 안 돌아왔는지 이름이 남는다(검사·Playwright 가 읽는다).
//
// 조작(M §1-2)
//   - 진입·퇴장: 0.5초 종이색 덮개(--paper, 검정 아님) + 무대 이름. 움직임 줄이기면 0.1초. 포인터 잠금은 진입 때 풀고,
//     퇴장하면 문 앞 세계로 돌아가 '3D를 클릭해 계속'(마스터 §6-6 — 잠금은 사용자의 클릭에서만 다시 걸린다).
//   - 무대 안: 마우스 커서가 보인다. 고를 수 있는 물체(userData.pick)만 레이캐스트로 판정 — 올리면 강조(kit.highlight), 누르면 pick().
//     Tab / Shift+Tab 으로 고를 수 있는 물체 사이를 돌고 Enter·Space 로 누른다(초점 테두리 = HTML 겹침 #stageFocus).
//     userData.pick = true 또는 { label: '키오스크', order: 1, enabled: true | () => bool }.
//   - Esc: '나갈까요? 진행 중인 게임은 저장되지 않아요' 확인. 학습지(F)는 무대 중에도 열린다(오른쪽 40 % → 무대 카메라 화면비 다시 맞춤).
//   - 무대 HTML 겹침(주문 화면·결과 카드)은 #stageUi 안에 넣는다(ctx.ui). 그 안에 초점이 있으면 Tab 은 브라우저 기본(버튼 사이 이동).
// 사진 자세(shot): /firstperson/?stage=cafe&shot=wide — 무대와 카메라 자세를 바로 연다. 진입 덮개·첫 안내를 건너뛰고,
//   품질 자동 낮추기도 하지 않는다(같은 주소면 같은 화면 — 품질 점검(M §6)·사람 확인이 같은 화면을 보게). &quality=mid 로 단계를 고정할 수 있다.
//   shot.t = 그 시간(초)까지 무대를 미리 돌린다 · shot.freeze = 그 뒤 멈춘 채(추출 중 1.2초 같은 '시간 고정' 자세).
// 품질(M §1-5): 3초 평균 FPS < 40 이면 한 단계 낮춘다 — high(그림자 2048·픽셀 비 ≤ 2) → mid(1024·1.5) → low(그림자 끔·접지 그림자만·1).
//   학습지 [과제] '미니게임 화질'에서 고르면 그 값으로 고정(자동 낮추기 끔). 고른 값은 학습지 공용 저장소 fp.ui.stageQuality.
// 모듈을 읽을 때는 DOM·THREE 를 건드리지 않는다(TDZ·node 검사 — 마스터 §6-10). 화면 연결은 init() 에서.
// ============================================================================
const FPStage = (() => {
  const defs = Object.create(null), live = Object.create(null);
  const QUALITY = { high: { pr: 2, shadow: 2048, label: '높음' }, mid: { pr: 1.5, shadow: 1024, label: '보통' }, low: { pr: 1, shadow: 0, label: '낮음' } };
  const STEPS = ['high', 'mid', 'low'];
  const FPS_WINDOW = 3, FPS_MIN = 40, SETTLE_S = 1;   // 3초 평균, 40 미만이면 한 단계. 들어온 직후 1초는 재지 않는다(빌드·셰이더 컴파일)
  const FADE_MS = 250, FADE_MS_REDUCED = 50;           // 덮기 + 걷기 = 0.5초 (움직임 줄이기 0.1초)

  let R = null, worldScene = null, worldCam = null, canvas = null, refit = null, el = null;
  let cur = null, curId = null, busy = false, fromPose = null, saved = null;
  let quality = 'high', autoQ = true, shotMode = false, frozen = false;
  let hover = null, focus = null, picks = [], pointer = null, pointerDirty = false, lastHit = null;
  let fpsT = 0, fpsN = 0, settle = 0, clock = 0;
  let raycaster = null, ndc = null;
  const lastRestore = { diff: [] };

  const query = () => new URLSearchParams(window.__FP_QUERY__ || location.search);
  const reducedMotion = () => !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const fadeMs = () => (reducedMotion() ? FADE_MS_REDUCED : FADE_MS);
  const prFor = q => (q === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, QUALITY[q].pr));

  // ── 렌더러 상태: 저장 · 복원 · 항목 비교 (마스터 §6-14) ─────────────────────
  // 무대가 바꿀 수 있는 것 + 세계 장면의 environment·background·fog. 값 비교는 === (참조 포함)
  function snapshot(r, scene) {
    const c = { r: 0, g: 0, b: 0 };
    if (r.getClearColor) { const col = r.getClearColor(new THREE.Color()); c.r = col.r; c.g = col.g; c.b = col.b; }
    return {
      toneMapping: r.toneMapping, toneMappingExposure: r.toneMappingExposure, outputColorSpace: r.outputColorSpace,
      shadowEnabled: r.shadowMap.enabled, shadowType: r.shadowMap.type, shadowAuto: r.shadowMap.autoUpdate,
      pixelRatio: r.getPixelRatio(), clearR: c.r, clearG: c.g, clearB: c.b, clearAlpha: r.getClearAlpha ? r.getClearAlpha() : 1, autoClear: r.autoClear,
      sceneEnv: scene ? scene.environment : null, sceneBg: scene ? scene.background : null, sceneFog: scene ? scene.fog : null,
    };
  }
  function restore(r, s, scene) {
    r.toneMapping = s.toneMapping;
    r.toneMappingExposure = s.toneMappingExposure;
    r.outputColorSpace = s.outputColorSpace;
    r.shadowMap.enabled = s.shadowEnabled;
    r.shadowMap.type = s.shadowType;
    r.shadowMap.autoUpdate = s.shadowAuto;
    if (r.getPixelRatio() !== s.pixelRatio) r.setPixelRatio(s.pixelRatio);
    if (r.setClearColor) r.setClearColor(new THREE.Color(s.clearR, s.clearG, s.clearB), s.clearAlpha);
    r.autoClear = s.autoClear;
    if (scene) { scene.environment = s.sceneEnv; scene.background = s.sceneBg; scene.fog = s.sceneFog; }
  }
  const diff = (a, b) => Object.keys(a).filter(k => a[k] !== b[k]);

  // 무대 쪽 렌더러 값. 그림자 방식·톤매핑 종류는 세계와 같다(M §1-3) — 노출만 무대 상수
  function applyStage(def) {
    R.toneMapping = THREE.ACESFilmicToneMapping;
    R.toneMappingExposure = def.exposure == null ? 1 : def.exposure;
    R.outputColorSpace = THREE.SRGBColorSpace;
    R.shadowMap.enabled = true;
    R.shadowMap.type = THREE.PCFSoftShadowMap;
    R.shadowMap.autoUpdate = true;
    R.autoClear = true;
    R.setPixelRatio(prFor(quality));
  }

  // ── 등록 · 생성 ────────────────────────────────────────────────────────────
  function register(id, def) { defs[id] = def; }
  function makeCtx(id) {
    return {
      id, get ui() { return el && el.ui; },
      get reducedMotion() { return reducedMotion(); },
      get shotMode() { return shotMode; },
      toast: (m, ms) => { if (typeof FPField !== 'undefined') FPField.toast(m, ms); },
      exit: () => askExit(), exitNow: () => exit(),
      refreshPicks, setFocus: o => setFocus(o, true), shot: name => setShot(name),
      get quality() { return quality; },
    };
  }
  function build(id) {
    if (live[id]) return live[id];
    const def = defs[id];
    const kit = FPStageKit.create(R, { viewColor: el ? el.viewColor : undefined, reducedMotion: reducedMotion() });
    kit.applyQuality(quality);
    const ctx = makeCtx(id);
    const b = def.build(kit, ctx) || {};
    const st = { id, def, kit, ctx, ...b, entered: false };
    if (!st.scene) st.scene = new THREE.Scene();
    if (!st.camera) st.camera = new THREE.PerspectiveCamera(50, 1, 0.03, 40);
    st.shots = st.shots || {};
    kit.fixOrder(st.scene);
    kit.applyQuality(quality);   // lightRig 이 build 안에서 빛을 만든 뒤 한 번 더(그림자 지도 크기)
    live[id] = st;
    return st;
  }

  // ── 고를 수 있는 물체 ──────────────────────────────────────────────────────
  // 맨 위 pick 만 모은다(pick 안의 pick 은 바깥 것이 대표). 무대가 물체를 더하거나 빼면 ctx.refreshPicks()
  function refreshPicks() {
    picks = [];
    if (!cur) return;
    const walk = o => { if (o.userData && o.userData.pick) { picks.push(o); return; } for (const c of o.children) walk(c); };
    walk(cur.scene);
    if (focus && !picks.includes(focus)) setFocus(null);
  }
  const pickInfo = o => (o && typeof o.userData.pick === 'object' ? o.userData.pick : {});
  function visibleChain(o) { for (let p = o; p; p = p.parent) if (p.visible === false) return false; return true; }
  function enabled(o) {
    if (!o || !visibleChain(o)) return false;
    const e = pickInfo(o).enabled;
    return e === undefined ? true : typeof e === 'function' ? !!e() : !!e;
  }
  const pickOf = o => { for (let p = o; p; p = p.parent) if (p.userData && p.userData.pick) return p; return null; };
  function raycast() {
    if (!pointer || !cur) return null;
    if (!raycaster) { raycaster = new THREE.Raycaster(); ndc = new THREE.Vector2(); }
    ndc.set(pointer.x, pointer.y);
    raycaster.setFromCamera(ndc, cur.camera);
    const hits = raycaster.intersectObject(cur.scene, true);
    for (const h of hits) {
      if (h.object.userData.pickThrough || !visibleChain(h.object)) continue;
      const p = pickOf(h.object);
      return p && enabled(p) ? { obj: p, hit: h } : null;   // 가장 앞 물체가 고를 수 없는 것이면 뒤를 고르지 않는다(가려진 것)
    }
    return null;
  }
  function setHover(o) {
    if (o === hover) return;
    if (hover && hover !== focus) { cur.kit.highlight(hover, false); }
    if (hover && cur.hover) cur.hover(hover, false);
    hover = o;
    if (o) { cur.kit.highlight(o, true); if (cur.hover) cur.hover(o, true); }
    if (canvas) canvas.classList.toggle('is-pick', !!o);
  }
  function setFocus(o, announce) {
    if (o === focus) return;
    if (focus && focus !== hover && cur) cur.kit.highlight(focus, false);
    focus = o;
    if (o && cur) cur.kit.highlight(o, true);
    if (el) {
      el.focus.hidden = !o;
      if (o) el.focusLabel.textContent = pickInfo(o).label || '';
      if (o && announce !== false) el.live.textContent = `${pickInfo(o).label || '물체'} — Enter 로 누르기`;
    }
  }
  function doPick(o, info) {
    if (!o || !cur || busy !== 'in') return;
    const pi = pickInfo(o);
    if (typeof pi.onPick === 'function') pi.onPick(info);
    if (cur.pick) cur.pick(o, info);
  }
  // Tab 순서: pick.order(작을수록 앞) → 화면 왼쪽부터. 화면 밖(카메라가 다른 곳을 볼 때)의 물체는 건너뛴다 — 안 보이는 것에 초점이 가면 안 된다
  function tabOrder() {
    const v = new THREE.Vector3();
    return picks.filter(enabled).map(o => {
      o.getWorldPosition(v).project(cur.camera);
      return { o, ord: pickInfo(o).order == null ? 100 : pickInfo(o).order, x: v.x, on: v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1 };
    }).filter(e => e.on).sort((a, b) => a.ord - b.ord || a.x - b.x).map(e => e.o);
  }
  function cycleFocus(dir) {
    const list = tabOrder();
    if (!list.length) { setFocus(null); return; }
    const i = list.indexOf(focus);
    setFocus(list[i < 0 ? (dir > 0 ? 0 : list.length - 1) : (i + dir + list.length) % list.length]);
  }
  // 초점 테두리: 물체 상자 8 꼭짓점을 화면에 투영한 사각형
  const _box = { b: null, v: null };
  function placeFocusRing() {
    if (!el || !focus || !cur) return;
    if (!_box.b) { _box.b = new THREE.Box3(); _box.v = new THREE.Vector3(); }
    if (!enabled(focus)) { setFocus(null); return; }
    const b = _box.b.setFromObject(focus), v = _box.v, rc = canvas.getBoundingClientRect();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, behind = false;
    for (let i = 0; i < 8; i++) {
      v.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).project(cur.camera);
      if (v.z > 1) behind = true;
      const sx = rc.left + (v.x + 1) / 2 * rc.width, sy = rc.top + (1 - v.y) / 2 * rc.height;
      x0 = Math.min(x0, sx); y0 = Math.min(y0, sy); x1 = Math.max(x1, sx); y1 = Math.max(y1, sy);
    }
    if (behind || x1 < rc.left || x0 > rc.right || y1 < rc.top || y0 > rc.bottom) { el.focus.style.visibility = 'hidden'; return; }
    const pad = 6;
    x0 = Math.max(rc.left + 2, x0 - pad); y0 = Math.max(rc.top + 2, y0 - pad);
    x1 = Math.min(rc.right - 2, x1 + pad); y1 = Math.min(rc.bottom - 2, y1 + pad);
    const s = el.focus.style;
    s.visibility = 'visible';
    s.left = `${x0}px`; s.top = `${y0}px`; s.width = `${Math.max(0, x1 - x0)}px`; s.height = `${Math.max(0, y1 - y0)}px`;
  }

  // ── 사진 자세 ──────────────────────────────────────────────────────────────
  function setShot(name) {
    if (!cur) return false;
    const sh = cur.shots[name];
    if (!sh) return false;
    const c = cur.camera;
    if (sh.fov) c.fov = sh.fov;
    c.position.set(sh.pos[0], sh.pos[1], sh.pos[2]);
    c.lookAt(sh.target[0], sh.target[1], sh.target[2]);
    c.updateProjectionMatrix();
    frozen = false;
    if (cur.onShot) cur.onShot(name, sh);
    // shot.t 초까지 무대를 미리 돌린다(시간 고정 자세) — 1/60초 걸음으로
    if (sh.t) for (let s = 0; s < sh.t; s += 1 / 60) step(1 / 60);
    frozen = !!sh.freeze;
    return true;
  }

  // ── 들어가기 · 나오기 ──────────────────────────────────────────────────────
  // 덮개를 덮고(0.25초) → 바꾸고 → 걷는다(0.25초). instant(사진 자세)면 덮개 없이 바로
  function cover(on, title) {
    if (!el) return;
    if (title != null) el.fadeTitle.textContent = title;
    el.fade.style.transitionDuration = `${fadeMs()}ms`;
    el.fade.classList.toggle('on', on);
  }
  function enter(id, opts = {}) {
    if (!defs[id] || cur || busy || !R) return false;
    busy = 'entering';
    fromPose = opts.from || null;
    shotMode = !!opts.shot;
    if (typeof FPTools !== 'undefined' && FPTools.cancelReadings) FPTools.cancelReadings();
    if (typeof FPPlayer !== 'undefined') FPPlayer.keys = Object.create(null);
    if (document.pointerLockElement) document.exitPointerLock();   // busy 를 먼저 세웠으므로 '클릭해서 시작' 안내가 뜨지 않는다(fp-player)
    if (el) el.start.classList.add('hidden');
    const title = defs[id].title || '';
    const go = () => {
      const st = build(id);
      saved = snapshot(R, worldScene);
      applyStage(st.def);
      cur = st; curId = id; busy = 'in';
      document.body.classList.add('in-stage');
      if (el) { el.title.textContent = title; el.bar.setAttribute('aria-label', `${title} — 무대`); }
      if (refit) refit();
      refreshPicks();
      const shot = opts.shot && st.shots[opts.shot] ? opts.shot : (st.enterShot || Object.keys(st.shots)[0]);
      if (shot) setShot(shot);
      if (st.onEnter) st.onEnter({ first: !st.entered, shot: opts.shot || null, shotMode });
      st.entered = true;
      fpsT = 0; fpsN = 0; settle = SETTLE_S;
      if (el) el.live.textContent = `${title}에 들어왔습니다. Tab 으로 고르고 Enter 로 누릅니다. Esc 나가기.`;
    };
    if (opts.instant || opts.shot || !el) { go(); return true; }
    cover(true, title);
    setTimeout(() => { go(); cover(false); }, fadeMs());
    return true;
  }
  function exit() {
    if (!cur || busy !== 'in') return false;
    closeConfirm(false);
    busy = 'leaving';
    const go = () => {
      const st = cur;
      if (st.onExit) st.onExit();
      setHover(null); setFocus(null, false);
      if (el) el.focus.hidden = true;
      restore(R, saved, worldScene);
      lastRestore.diff = diff(saved, snapshot(R, worldScene));
      saved = null;
      cur = null; curId = null; busy = false; frozen = false; shotMode = false;
      pointer = null; lastHit = null;
      document.body.classList.remove('in-stage');
      if (canvas) canvas.classList.remove('is-pick');
      if (fromPose && typeof FPPlayer !== 'undefined') {
        FPPlayer.pos.set(fromPose.x, fromPose.y, fromPose.z);
        FPPlayer.vel.set(0, 0, 0);
        if (fromPose.yaw != null) FPPlayer.yaw = fromPose.yaw;
        if (fromPose.pitch != null) FPPlayer.pitch = fromPose.pitch;
      }
      if (refit) refit();
      // 문 앞 세계로 — 잠금은 클릭에서만 다시 걸린다(마스터 §6-6). 학습지가 열려 있으면 학습지를 닫을 때 안내가 뜬다
      if (el && !(typeof FPSheet !== 'undefined' && FPSheet.isOpen)) { el.start.dataset.mode = 'resume'; el.start.classList.remove('hidden'); }
    };
    if (!el) { go(); return true; }
    cover(true);
    setTimeout(() => { go(); cover(false); }, fadeMs());
    return true;
  }

  // Esc · [나가기] → 확인
  function askExit() {
    if (!cur || busy !== 'in' || !el) return;
    el.confirm.hidden = false;
    el.confirmNo.focus();
  }
  function closeConfirm(refocus = true) {
    if (!el || el.confirm.hidden) return;
    el.confirm.hidden = true;
    if (refocus && document.activeElement && el.confirm.contains(document.activeElement)) document.activeElement.blur();
  }

  // ── 품질 ───────────────────────────────────────────────────────────────────
  function setQuality(q, opts = {}) {
    if (q === 'auto') { autoQ = true; q = 'high'; }
    else if (!QUALITY[q]) return false;
    else if (opts.manual) autoQ = false;
    quality = q;
    for (const id in live) live[id].kit.applyQuality(q);
    if (cur && R) { R.setPixelRatio(prFor(q)); if (refit) refit(); }
    fpsT = 0; fpsN = 0; settle = SETTLE_S;
    if (opts.manual) {
      try { WorksheetStore.updateFp(fp => { fp.ui.stageQuality = autoQ ? 'auto' : q; }); } catch (e) { /* 저장 못 해도 이번 화면에서는 쓴다 */ }
    }
    syncQualityButtons();
    return true;
  }
  function note(msg) {
    if (!el) return;
    el.note.textContent = msg;
    el.note.classList.add('on');
    clearTimeout(el.noteTimer);
    el.noteTimer = setTimeout(() => el.note.classList.remove('on'), 2000);
  }
  function sampleFps(dt) {
    if (!autoQ || shotMode || busy !== 'in' || document.hidden) return;
    if (settle > 0) { settle -= dt; return; }
    fpsT += dt; fpsN++;
    if (fpsT < FPS_WINDOW) return;
    const fps = fpsN / fpsT;
    fpsT = 0; fpsN = 0;
    if (fps < FPS_MIN && quality !== 'low') {
      const next = STEPS[STEPS.indexOf(quality) + 1];
      setQuality(next);
      note(`화면이 느려 화질을 '${QUALITY[next].label}'(으)로 낮췄어요 (초당 ${Math.round(fps)}장)`);
    }
  }
  function syncQualityButtons() {
    if (!el || !el.qBtns) return;
    const sel = autoQ ? 'auto' : quality;
    el.qBtns.forEach(b => b.setAttribute('aria-pressed', String(b.dataset.stageQ === sel)));
    if (el.qNow) el.qNow.textContent = `지금 ${QUALITY[quality].label}`;
  }

  // ── 프레임 (fp-main.js animate 가 무대에 있는 동안 부른다) ──────────────────
  function step(dt) {
    clock += dt;
    cur.kit.update(dt);
    if (cur.update) cur.update(dt, clock);
  }
  function frame(dt) {
    if (!cur) return;
    if (pointerDirty && busy === 'in') {
      pointerDirty = false;
      lastHit = raycast();
      setHover(lastHit ? lastHit.obj : null);
    }
    if (!frozen) step(dt);
    sampleFps(dt);
    placeFocusRing();
    R.render(cur.scene, cur.camera);
  }
  function resize(aspect) {
    for (const id in live) { const c = live[id].camera; if (c && c.isPerspectiveCamera) { c.aspect = aspect; c.updateProjectionMatrix(); } }
  }

  // ── 화면 연결 ──────────────────────────────────────────────────────────────
  function init(o) {
    R = o.renderer; worldCam = o.camera; worldScene = o.scene; canvas = o.canvas; refit = o.fit;
    // 세계 쪽 외관(카페 정면 등)을 만든다 — 세계 축척 소품용 도구(무대 도구와 같은 함수, 세계 재질 규칙은 정의가 정한다)
    buildWorlds(typeof FPStageKit !== 'undefined' && R ? FPStageKit.create(R, { reducedMotion: reducedMotion() }) : null);
    const $ = id => document.getElementById(id);
    if (!$('stageBar')) return;   // 무대 마크업이 없는 화면(검사 등)
    const css = getComputedStyle(document.documentElement);
    el = {
      fade: $('stageFade'), fadeTitle: $('stageFadeTitle'), bar: $('stageBar'), title: $('stageTitle'), exitBtn: $('stageExitBtn'),
      focus: $('stageFocus'), focusLabel: $('stageFocusLabel'), live: $('stageLive'), ui: $('stageUi'), note: $('stageNote'),
      confirm: $('stageExit'), confirmYes: $('stageExitYes'), confirmNo: $('stageExitNo'), start: $('startOverlay'),
      qBtns: [...document.querySelectorAll('[data-stage-q]')], qNow: $('stageQNow'),
      viewColor: (css.getPropertyValue('--ctl-view') || '').trim() || undefined, noteTimer: 0,
    };
    el.exitBtn.addEventListener('click', askExit);
    el.confirmYes.addEventListener('click', () => exit());
    el.confirmNo.addEventListener('click', () => closeConfirm());
    el.qBtns.forEach(b => b.addEventListener('click', () => setQuality(b.dataset.stageQ, { manual: true })));
    // 저장된 화질 → 주소 &quality= 가 있으면 그 값이 먼저(사진 자세 고정용)
    let q = 'auto';
    try { q = WorksheetStore.readFp().ui.stageQuality || 'auto'; } catch (e) { /* 기본 자동 */ }
    const uq = query().get('quality');
    if (uq && QUALITY[uq]) { quality = uq; autoQ = false; }
    else if (q !== 'auto' && QUALITY[q]) { quality = q; autoQ = false; }
    syncQualityButtons();

    // 포인터: 캔버스 위 좌표 → NDC. 레이캐스트는 프레임에서 한 번만(마우스 이벤트가 프레임보다 잦다)
    canvas.addEventListener('pointermove', e => {
      if (!cur) return;
      const rc = canvas.getBoundingClientRect();
      pointer = { x: ((e.clientX - rc.left) / rc.width) * 2 - 1, y: -((e.clientY - rc.top) / rc.height) * 2 + 1 };
      pointerDirty = true;
    });
    canvas.addEventListener('pointerleave', () => { if (!cur) return; pointer = null; pointerDirty = true; });
    canvas.addEventListener('click', e => {
      if (!cur || busy !== 'in' || !el.confirm.hidden) return;
      const rc = canvas.getBoundingClientRect();
      pointer = { x: ((e.clientX - rc.left) / rc.width) * 2 - 1, y: -((e.clientY - rc.top) / rc.height) * 2 + 1 };
      const h = raycast();
      if (h) { setFocus(null, false); doPick(h.obj, { via: 'mouse', uv: h.hit.uv || null, point: h.hit.point, object: h.hit.object }); }
    });

    // 키보드. fp-player 의 키 처리가 먼저 돈다(F = 학습지는 거기서). 무대 중에는 fp-player 가 나머지 키를 쓰지 않는다(FPStage.busy).
    window.addEventListener('keydown', e => {
      if (!cur || busy !== 'in' || e.defaultPrevented) return;
      const ae = document.activeElement;
      // 확인 상자: Esc = 계속하기, Tab 은 두 단추 사이만
      if (!el.confirm.hidden) {
        if (e.key === 'Escape') { e.preventDefault(); closeConfirm(); }
        else if (e.key === 'Tab') { e.preventDefault(); (ae === el.confirmNo ? el.confirmYes : el.confirmNo).focus(); }
        return;
      }
      if (ae && ae.closest && ae.closest('input, textarea, select')) return;
      if (typeof FPOnboard !== 'undefined' && FPOnboard.isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); askExit(); return; }
      const inSheet = ae && ae.closest && ae.closest('#sheet');
      if (inSheet) return;                                   // 학습지 안 초점 이동·버튼은 학습지 몫
      if (cur.key && cur.key(e) === true) { e.preventDefault(); return; }
      const inUi = ae && el.ui.contains(ae);
      if (e.key === 'Tab') {
        if (inUi || (ae && el.bar.contains(ae))) return;      // 무대 HTML 겹침(결과 카드 등) 안은 브라우저 기본
        e.preventDefault();
        cycleFocus(e.shiftKey ? -1 : 1);
        return;
      }
      if ((e.key === 'Enter' || e.key === ' ') && focus && !(ae && ae !== document.body && ae !== canvas && ae.closest && ae.closest('button, a, [tabindex]'))) {
        e.preventDefault();
        doPick(focus, { via: 'key', uv: null });
      }
    });
  }

  // ── 세계 속 입구 (M2 카페 · M3 분리배출장 · T2 회의실) ─────────────────────
  // 무대 정의의 world(wctx) 가 세계 쪽 외관을 만들고 wctx.addDoor 로 입구를 단다. 입구 = 겨눌 점(세계 좌표) + 반경.
  //   d = { id, stage, label: '카페에 들어가기', pos: Vector3(세계), radius(유닛), visible: () => bool,
  //         canEnter: () => true | '안 되는 까닭', from: () => { x, y, z, yaw }(나올 때 설 자리) }
  // 가까이(반경 안) 가서 겨누면 십자선 아래 'E 카페에 들어가기'(#doorHint — 행동 지점 안내 #actHint 와 같은 모양, 따로 둔 까닭은
  //   FPActions.update 가 자기 안내를 초당 10번 숨기기 때문). E 는 fp-player 가 행동 지점 → 입구 순서로 넘긴다.
  // 세계의 연도가 바뀌면 fp-main applyScenarioYear 가 FPStage.onYear(year, city) 로 알린다 → 정의의 onWorldYear(year, city).
  const doors = [];
  let doorFocus = null, doorTick = 0, doorHintEl = null, doorHintText = '', lastYear = null, lastCity = null;
  const _dv = { a: null, b: null };
  function addDoor(d) { doors.push(d); return d; }
  function onYear(year, city) {
    lastYear = year; lastCity = city;
    for (const id in defs) if (defs[id].onWorldYear && defs[id]._world) defs[id].onWorldYear(year, city);
  }
  function updateDoors(dt, cam) {
    doorTick += dt;
    if (doorTick < 0.1) return;
    doorTick = 0;
    if (!doorHintEl) doorHintEl = document.getElementById('doorHint');
    let best = null, bestD = Infinity;
    const sheet = typeof FPSheet !== 'undefined' && FPSheet.isOpen;
    if (!busy && !sheet && cam && doors.length) {
      if (!_dv.a) { _dv.a = new THREE.Vector3(); _dv.b = new THREE.Vector3(); }
      cam.getWorldDirection(_dv.a);
      for (const d of doors) {
        if (d.visible && !d.visible()) continue;
        const dx = d.pos.x - cam.position.x, dz = d.pos.z - cam.position.z, hd = Math.hypot(dx, dz);
        if (hd > d.radius) continue;
        _dv.b.subVectors(d.pos, cam.position).normalize();
        if (_dv.a.dot(_dv.b) < 0.82) continue;   // 대략 35° 안을 겨눴을 때만
        if (hd < bestD) { best = d; bestD = hd; }
      }
    }
    doorFocus = best;
    if (!doorHintEl) return;
    if (!best) { if (!doorHintEl.hidden) doorHintEl.hidden = true; doorHintText = ''; return; }
    const ok = best.canEnter ? best.canEnter() : true;
    const html = ok === true ? `<span class="key">E</span>${best.label}` : `<span class="key">E</span>${ok}`;
    if (html !== doorHintText) { doorHintEl.innerHTML = html; doorHintText = html; doorHintEl.classList.toggle('is-locked', ok !== true); }
    if (doorHintEl.hidden) doorHintEl.hidden = false;
  }
  // E 키(fp-player.js — 행동 지점이 먼저). 겨눈 입구가 없으면 false
  function interactDoor() {
    const d = doorFocus;
    if (!d || busy) return false;
    const ok = d.canEnter ? d.canEnter() : true;
    if (ok !== true) { if (typeof FPField !== 'undefined') FPField.toast(ok, 3200); return true; }
    if (doorHintEl) doorHintEl.hidden = true;
    doorFocus = null; doorHintText = '';
    enter(d.stage, { from: d.from ? d.from() : null });
    return true;
  }
  function buildWorlds(kitWorld) {
    for (const id in defs) {
      const def = defs[id];
      if (!def.world || def._world) continue;
      def._world = def.world({ scene: worldScene, kit: kitWorld, addDoor, renderer: R }) || {};
      if (lastYear != null && def.onWorldYear) def.onWorldYear(lastYear, lastCity);
    }
  }

  // 주소 ?stage=…&shot=… 로 바로 열기 (fp-main.js 가 화면 준비가 끝난 뒤 부른다)
  function boot() {
    const q = query(), id = q.get('stage');
    if (!id) return false;
    if (!defs[id]) {
      if (typeof FPField !== 'undefined') FPField.toast(`'${id}' 무대는 아직 준비 중이에요`, 2800);
      return false;
    }
    const shot = q.get('shot');
    return enter(id, shot ? { shot, instant: true } : {});
  }
  const shotQuery = () => { const q = query(); return !!(q.get('stage') && q.get('shot') && defs[q.get('stage')]); };

  return {
    register, enter, exit, active: () => curId, addDoor, updateDoors, interactDoor, onYear,
    // 4차 M4: 미니맵이 입구 자리(카페·분리배출장)를 그린다 — 세계 좌표 x·z, 지금 보이는지(shown), 무대 이름(title)
    places: () => doors.map(d => ({ id: d.id, stage: d.stage, title: defs[d.stage] ? defs[d.stage].title || d.id : d.id, x: d.pos.x, z: d.pos.z,
      shown: d.visible ? !!d.visible() : true })),
    get doorFocus() { return doorFocus ? doorFocus.id : null; },
    // 4차 T2: Tab 초점이 가 있는 물체(회의실이 숫자키 1·2·3 으로 그 카드의 단계를 정한다). 읽기만
    get focused() { return focus; }, setQuality, init, boot, frame, resize, shotQuery,
    shot: setShot, askExit,
    pixelRatio: () => prFor(quality),
    get busy() { return !!busy; },
    get quality() { return quality; },
    get autoQuality() { return autoQ; },
    get current() { return cur; },
    get lastRestoreDiff() { return lastRestore.diff.slice(); },
    get registered() { return Object.keys(defs); },
    // node 검사용(DOM 없음)
    _snapshot: snapshot, _restore: restore, _diff: diff, QUALITY, FPS_MIN, FPS_WINDOW,
  };
})();
