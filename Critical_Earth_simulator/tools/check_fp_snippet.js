// ============================================================================
// 1인칭 화면 검사 스니펫 (4차 B1, 사람 확인용)
// ----------------------------------------------------------------------------
// 왜 스니펫인가: 드로우콜·FPS는 실제 GPU에서 잰 값이 기준이다(헤드리스 swiftshader 값은 참고만, 마스터 §6-9).
// 사람이 실제 브라우저로 http://127.0.0.1:8000/firstperson/ 을 열고, 개발자 도구 콘솔에 이 파일 내용을
// 통째로 붙여 넣으면 지금 보고 있는 시점을 잰다. 결과 표를 그대로 복사해 보내면 된다.
//
// 붙여 넣은 뒤에는 checkFp(…) 를 다시 불러 같은 시점을 언제든 다시 잴 수 있다(B 끝에서 전후 비교용).
//   checkFp()            지금 시점 그대로
//   checkFp('start')     ① 출발점 (R 키와 같은 자리·같은 방향)
//   checkFp('cityWest')  ② 도심 교차로에서 서쪽(바다 쪽)을 본 시점 — 생물 컬링 전 887 드로우콜이 나왔던 시점
//   checkFp('underwater')③ 수중 (개방 해역 한가운데, 해저와 수면 사이)
//   checkFp('all')       ①②③을 차례로 재고 표 하나로
// 시점을 숫자로 고정한 까닭: 손으로 걸어가 맞추면 B 전후로 같은 화면이 안 나와 비교가 흔들린다.
// 4차 M1: 무대(미니게임) 모드 — 무대 안(FPStage.active())에서 붙여 넣으면 무대를 잰다. 시점 이름 대신 그 무대의 사진 자세 이름:
//   /firstperson/?stage=cafe&shot=wide 로 열고 붙여 넣기 → checkFp() 지금 자세 · checkFp('machine') 그 자세 · checkFp('all') 모든 자세.
//   무대는 한 프레임에 render() 를 한 번 부른다 → '무대' 칸이 드로우콜 전부다(수용 12: ≤ 120, 삼각형 ≤ 300k, FPS ≥ 55).
//
// 재는 것:
//   - 드로우콜·삼각형(한 프레임): 1인칭은 한 프레임에 render()를 두 번 부른다(세계 → 손·도구 덧그림, fp-main.js animate).
//     renderer.info 는 render() 마다 0으로 돌아가서(autoReset) 그냥 읽으면 '손·도구' 몫만 보인다.
//     그래서 잠시 renderer.render 를 감싸 한 프레임 안의 호출을 합친다. 끝나면 원래 함수로 되돌린다.
//   - 5초 평균 FPS(rAF 간격)와 가장 긴 프레임(ms).
//   - 보이는 글자 font-size 최솟값과 그 요소, 문서 넘침(px).
// 1인칭 코드는 renderer·camera·FPPlayer·FPWorld 를 최상위 const 로 둔다(fp-main.js·fp-player.js·fp-world.js) —
// 콘솔에서 이름으로 읽힌다. 이름이 바뀌면 이 스니펫도 고친다.
// 앱 코드가 아니다 - firstperson/index.html에 넣지 말 것(빌더 FP_JS 목록에도 넣지 않는다).
// ============================================================================
(() => {
  const W = FPWorld;
  // ── 고정 시점 ─────────────────────────────────────────────────────────────
  // 좌표는 세계 유닛(1유닛 = 50 m). forward = (sin yaw, 0, cos yaw) 라 서쪽(−x)은 yaw = −π/2.
  // 도심 교차로 = cityGroup(+ZONE_W) 안의 십자 도로 교점(CROSS_ROAD_X 0.09, MAIN_ROAD_Z −0.01, fp-world.js 도로 절).
  // 수중 = oceanGroup(−ZONE_W) 가운데. 발을 해저와 기준 수면의 가운데에 둔다(부력 < 중력이라 천천히 가라앉지만 측정 5초 안에는 물속).
  const POSES = {
    start:      { label: '① 출발점', set: P => P.respawn() },
    cityWest:   { label: '② 도심 교차로 → 서쪽', set: P => place(P, W.ZONE_W + 0.09, W.GROUND_BASE + 0.05, -0.01, -Math.PI / 2, -0.05) },
    underwater: { label: '③ 수중', set: P => place(P, -W.ZONE_W, (W.OCEAN_BASE + W.waveBaseY) / 2, 0, Math.PI, -0.1) },
  };
  function place(P, x, y, z, yaw, pitch) {
    P.pos.set(x, y, z);
    P.vel.set(0, 0, 0);
    P.yaw = yaw; P.pitch = pitch;
    P.flying = false;
  }

  const wait = ms => new Promise(r => setTimeout(r, ms));

  // ── 드로우콜·FPS: 5초 동안 프레임마다 모은다 ─────────────────────────────
  function sampleFrames(ms) {
    return new Promise(resolve => {
      const info = renderer.info;
      const orig = renderer.render;
      const frames = [];
      let cur = null;
      // 한 프레임 안의 render() 호출은 animate() 안에서 동기적으로 이어진다 → 첫 호출 때 마이크로태스크를 걸어
      // animate()가 끝나면 그 프레임을 닫는다. rAF 콜백 순서에 기대지 않는 방법이다.
      renderer.render = function (scene, cam) {
        const before = { calls: info.render.calls, tris: info.render.triangles };
        orig.call(this, scene, cam);
        const calls = info.autoReset ? info.render.calls : info.render.calls - before.calls;
        const tris = info.autoReset ? info.render.triangles : info.render.triangles - before.tris;
        if (!cur) {
          cur = { world: 0, overlay: 0, stage: 0, tris: 0, passes: 0 };
          queueMicrotask(() => { frames.push(cur); cur = null; });
        }
        if (scene === W.scene) cur.world += calls;
        else if (typeof FPStage !== 'undefined' && FPStage.current && scene === FPStage.current.scene) cur.stage += calls;
        else cur.overlay += calls;
        cur.tris += tris;
        cur.passes++;
      };
      const gaps = [];
      let last = null;
      const t0 = performance.now();
      function tick(now) {
        if (last !== null) gaps.push(now - last);
        last = now;
        if (now - t0 < ms) requestAnimationFrame(tick);
        else { renderer.render = orig; resolve({ frames, gaps }); }
      }
      requestAnimationFrame(tick);
    });
  }
  const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

  // ── 보이는 글자 최솟값 · 문서 넘침 (조감 check_layout_snippet.js 와 같은 규칙) ──
  function textCheck() {
    const de = document.documentElement, vw = innerWidth, vh = innerHeight;
    let minFs = Infinity, minEl = null;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: n => n.textContent.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT,
    });
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const el = n.parentElement;
      if (!el || el.closest('[hidden], [aria-hidden="true"]')) continue;
      // 접힌 details·display:none 조상까지 걸러야 한다 — 설정창 안 글자가 '보이는 글자'로 잡히지 않게
      if (el.checkVisibility && !el.checkVisibility({ opacityProperty: true, visibilityProperty: true })) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || r.bottom < 0 || r.top > vh || r.right < 0 || r.left > vw) continue;
      const fs = parseFloat(cs.fontSize);
      if (fs < minFs) { minFs = fs; minEl = el; }
    }
    const name = minEl ? (minEl.id ? '#' + minEl.id : (typeof minEl.className === 'string' && minEl.className ? '.' + minEl.className.trim().split(/\s+/).join('.') : minEl.tagName.toLowerCase())) : '-';
    return {
      minFs: Number.isFinite(minFs) ? minFs : '없음',
      minEl: name,
      minText: minEl ? minEl.textContent.trim().slice(0, 20) : '',
      overY: de.scrollHeight - vh,
      overX: de.scrollWidth - vw,
    };
  }

  const stageOn = () => typeof FPStage !== 'undefined' && FPStage.active();
  async function measure(key) {
    const st = stageOn() ? FPStage.current : null;
    const pose = key && !st ? POSES[key] : null;
    if (st && key && !st.shots[key]) throw new Error(`이 무대의 사진 자세: ${Object.keys(st.shots).join(' / ')} / all`);
    if (!st && key && !pose) throw new Error('시점 이름은 start / cityWest / underwater / all 중 하나');
    if (st && key) { FPStage.shot(key); await wait(1500); }
    if (pose) { pose.set(FPPlayer); await wait(1500); }   // 컬링·HUD·카메라가 새 자리에 자리 잡을 시간
    const { frames, gaps } = await sampleFrames(5000);
    const avgGap = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
    const t = textCheck();
    const m = renderer.info.memory;
    const p = FPPlayer.pos;
    return {
      '시점': st ? `무대 ${FPStage.active()} · ${key || '지금 자세'}` : pose ? pose.label : '지금 시점',
      '무대 화질': st ? FPStage.quality : '-',
      '창': `${innerWidth}×${innerHeight} @${devicePixelRatio}x`,
      '위치(x,y,z)': `${p.x.toFixed(2)}, ${p.y.toFixed(3)}, ${p.z.toFixed(2)}`,
      '수중': FPPlayer.underwater,
      '드로우콜(한 프레임, 중앙값)': median(frames.map(f => f.world + f.overlay)),
      '  세계': median(frames.map(f => f.world)),
      '  손·도구': median(frames.map(f => f.overlay)),
      '  무대(≤120)': median(frames.map(f => f.stage)),
      '드로우콜 최대': frames.length ? Math.max(...frames.map(f => f.world + f.overlay)) : null,
      '삼각형(중앙값)': median(frames.map(f => f.tris)),
      'FPS(5초 평균)': gaps.length ? +(1000 / avgGap).toFixed(1) : null,
      '가장 긴 프레임(ms)': gaps.length ? +Math.max(...gaps).toFixed(1) : null,
      '지오메트리/텍스처/셰이더': `${m.geometries}/${m.textures}/${renderer.info.programs ? renderer.info.programs.length : '-'}`,
      '최소 글자(px, ≥13)': t.minFs,
      '최소 글자 요소': `${t.minEl} "${t.minText}"`,
      '세로 넘침(px, 0)': t.overY,
      '가로 넘침(px, 0)': t.overX,
    };
  }

  window.checkFp = async function (key) {
    const keys = key === 'all' ? Object.keys(stageOn() ? FPStage.current.shots : POSES) : [key];
    const rows = [];
    for (const k of keys) rows.push(await measure(k));
    console.table(rows);
    console.log('결과 표를 복사해 보내 주세요. 콘솔에 빨간 오류가 있으면 그것도 함께. 다른 시점: checkFp(\'all\')');
    return rows;
  };
  console.log('1인칭 검사: 5초 동안 잽니다. 마우스를 움직이지 마세요.');
  return window.checkFp();
})();
