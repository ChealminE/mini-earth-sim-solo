// ============================================================================
// 1인칭 학습지 패널 (4차 D3) — 화면 오른쪽 40 %, 3D 는 왼쪽 60 %
// ----------------------------------------------------------------------------
// 10.27 랩미팅 배치 원칙(조감과 같음): 왼쪽 = 정보(3D), 오른쪽 = 학습지. 탭 4개 [과제] [기록] [나의 행동] [우리 사회].
// 이 파일은 껍데기만 맡는다: 열고 닫기, 탭 전환(WAI-ARIA 탭 패턴 — 조감 js/worksheet.js 와 같은 조작), 탭 상태 저장.
// 탭 내용은 다른 파일이 id 로 채운다 — [과제]·[기록] = fp-field.js, [나의 행동] = F·M, [우리 사회] = T5, 내보내기 = G.
//
// 열고 닫기 (마스터 §6-5·§6-6, D §3-2)
//   - F 로 열고 닫는다(e.code — 한글 자판 ㄹ 이어도 같다. 글 칸에 쓰는 중이면 fp-player 키 처리가 무시한다).
//     열린 상태에서는 Esc 로도 닫는다. 잠금 중의 Esc 는 브라우저가 먼저 가져가 포인터 잠금만 푼다(패널은 그때 닫혀 있다).
//     ⓘ 출처 상자가 열려 있으면 Esc 는 상자만 닫는다(js/source-tip.js) — 그래서 이 처리는 캡처 단계에서 상자 상태를 먼저 본다.
//   - Tab 키는 단축키로 쓰지 않는다 — 패널 안 초점 이동(키보드 접근성)에 쓰여야 한다.
//   - 열면 포인터 잠금을 풀고 첫(고른) 탭에 초점을 준다. 닫으면 3D 가 다시 화면 전체가 되고 '3D를 클릭해 계속' 안내를 띄운다
//     — 브라우저는 사용자의 클릭에서만 포인터 잠금을 다시 걸어 준다(자동으로 잠그지 않는다).
//   - 3D 캔버스 크기는 CSS(body.sheet-open)가 바꾸고, fp-main.js fit() 이 캔버스 칸 크기를 따라 렌더러를 맞춘다(ResizeObserver).
// 저장: 고른 탭·열림 상태는 학습지 공용 저장소 fp.ui(js/worksheet-store.js). 새로 고쳐도 같은 탭으로 연다(열림 자체는 되살리지 않는다 —
//   처음 화면은 '클릭해서 시작' 안내여야 하므로).
// ============================================================================
const FPSheet = (() => {
  const $ = id => document.getElementById(id);
  const TABS = { tasks: 'shTabTasks', records: 'shTabRecords', actions: 'shTabActions', society: 'shTabSociety' };
  let el = null, tabEls = [], tab = 'tasks', isOpen = false;
  const nameOf = t => Object.keys(TABS).find(k => TABS[k] === t.id);

  function show(name, focus = false) {
    if (!TABS[name]) name = 'tasks';
    tab = name;
    for (const [k, id] of Object.entries(TABS)) {
      const t = $(id), on = k === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    }
    // 숨어 있던 캔버스는 폭이 0 이라 그리지 못했다 → 보일 때 다시 그린다
    if (name === 'records' && typeof FPField !== 'undefined') FPField.drawTransect();
    WorksheetStore.updateFp(fp => { fp.ui.tab = name; });
  }

  function open(name) {
    if (!el) return;
    if (!isOpen) {
      isOpen = true;
      el.hidden = false;
      document.body.classList.add('sheet-open');
      $('startOverlay').classList.add('hidden');
      FPPlayer.uiOpen = true;                       // 걷기·도구 조작 차단 (fp-player.js)
      FPPlayer.keys = Object.create(null);          // 누르고 있던 이동 키 정리
      if (document.pointerLockElement) document.exitPointerLock();
      if (typeof FPField !== 'undefined') FPField.refresh();
      WorksheetStore.updateFp(fp => { fp.ui.sheetOpen = true; });
    }
    show(name || tab, true);                        // 고른 탭에 초점 — 키보드로 바로 탭·내용을 오갈 수 있게
  }

  function close() {
    if (!el || !isOpen) return;
    isOpen = false;
    // 패널 안에 초점이 남아 있으면 숨긴 요소에 글이 들어가거나 Space 가 버튼을 누른다
    if (el.contains(document.activeElement)) document.activeElement.blur();
    if (typeof SourceTip !== 'undefined') SourceTip.close();
    el.hidden = true;
    document.body.classList.remove('sheet-open');
    FPPlayer.uiOpen = false;
    // 포인터 잠금은 클릭에서만 다시 걸린다(마스터 §6-6) → '3D를 클릭해 계속' 안내
    const ov = $('startOverlay');
    ov.dataset.mode = 'resume';
    ov.classList.remove('hidden');
    WorksheetStore.updateFp(fp => { fp.ui.sheetOpen = false; });
  }

  const toggle = name => (isOpen ? close() : open(name));

  function init() {
    el = $('sheet');
    if (!el) return;
    tabEls = Object.values(TABS).map($);
    tabEls.forEach(t => t.addEventListener('click', () => show(nameOf(t))));
    // 탭 사이는 화살표·Home·End (고른 탭만 Tab 순서에 들어간다 — roving tabindex)
    el.querySelector('[role="tablist"]').addEventListener('keydown', e => {
      const i = tabEls.indexOf(document.activeElement);
      if (i < 0) return;
      const to = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabEls.length - 1 }[e.key];
      if (to === undefined) return;
      e.preventDefault();
      show(nameOf(tabEls[(to + tabEls.length) % tabEls.length]), true);
    });
    $('sheetClose').addEventListener('click', close);
    // Esc 로 닫기. 캡처 단계라 ⓘ 상자의 Esc 처리(문서 단계)보다 먼저 온다 — 상자가 열려 있으면 상자만 닫히게 양보한다
    window.addEventListener('keydown', e => {
      if (e.key !== 'Escape' || !isOpen) return;
      if (typeof SourceTip !== 'undefined' && SourceTip.current) return;
      e.preventDefault();
      close();
    }, true);
    let saved = 'tasks';
    try { saved = WorksheetStore.readFp().ui.tab || 'tasks'; } catch (e) { /* 기본 탭 */ }
    tab = TABS[saved] ? saved : 'tasks';
    // 처음에는 닫힌 상태(저장값 sheetOpen 은 되살리지 않는다 — 위 머리 주석)
    for (const [k, id] of Object.entries(TABS)) {
      const t = $(id), on = k === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute('aria-controls')).hidden = !on;
    }
  }

  return { init, open, close, toggle, show, get isOpen() { return isOpen; }, get tab() { return tab; } };
})();
