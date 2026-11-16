// ============================================================================
// 1인칭 첫 진입 안내 3장 (4차 D4) — 이동 → 측정 → 시간·행동
// ----------------------------------------------------------------------------
// 왜: 1인칭에 처음 들어온 학생은 무엇을 눌러야 하는지 몰라 화면만 돌렸다(H 도움말은 눌러야만 보였다).
// 처음 한 번만 세 장으로 보여 주고, 본 뒤에는 학습지 공용 저장소 fp.ui.onboarded 로 다시 띄우지 않는다.
// 건너뛸 수 있고, 학습지 [과제] '조작법'의 [첫 안내 다시 보기]로 다시 연다.
// 포인터 잠금(마스터 §6-6): 마지막 장의 [시작하기]는 사용자의 클릭이라 그 자리에서 잠금을 걸 수 있다(FPPlayer.enterGame).
// [건너뛰기]·Esc 로 닫으면 뒤의 '클릭해서 시작' 안내가 그대로 남는다.
// 열린 동안은 fp-player 의 단축키를 막는다(FPOnboard.isOpen) — 안내 버튼을 Space·Enter 로 누를 수 있어야 한다.
// ============================================================================
const FPOnboard = (() => {
  const $ = id => document.getElementById(id);
  const N = 3;
  let el = null, cards = [], i = 0, isOpen = false;

  function render() {
    cards.forEach((c, k) => { c.hidden = k !== i; });
    $('obStep').textContent = `${i + 1} / ${N}`;
    $('obPrev').disabled = i === 0;
    $('obNext').textContent = i === N - 1 ? '시작하기' : '다음';
  }
  function open() {
    if (!el) return;
    i = 0;
    isOpen = true;
    el.hidden = false;
    render();
    $('obNext').focus();
  }
  // enter = 마지막 장에서 [시작하기]를 눌렀는가 → 그 클릭으로 3D 에 들어간다
  function close(enter = false) {
    if (!el || !isOpen) return;
    isOpen = false;
    el.hidden = true;
    WorksheetStore.updateFp(fp => { fp.ui.onboarded = true; });
    if (enter && typeof FPPlayer !== 'undefined' && FPPlayer.enterGame) FPPlayer.enterGame();
  }
  function init() {
    el = $('onboard');
    if (!el) return;
    cards = [...el.querySelectorAll('.ob-card')];
    $('obPrev').addEventListener('click', () => { if (i > 0) { i--; render(); } });
    $('obNext').addEventListener('click', () => { if (i < N - 1) { i++; render(); } else close(true); });
    $('obSkip').addEventListener('click', () => close(false));
    // 키보드: ←/→ 로 장 넘기기, Esc 건너뛰기. 캡처 단계에서 받아 fp-player·학습지 키 처리보다 먼저(열린 동안만)
    window.addEventListener('keydown', e => {
      if (!isOpen) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false); return; }
      if (e.key === 'ArrowRight' && i < N - 1) { e.preventDefault(); i++; render(); }
      else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); i--; render(); }
    }, true);
    const again = $('onboardAgain');
    if (again) again.addEventListener('click', () => { if (typeof FPSheet !== 'undefined') FPSheet.close(); open(); });
    let seen = false;
    try { seen = !!WorksheetStore.readFp().ui.onboarded; } catch (e) { /* 못 읽으면 보여 준다 */ }
    // 4차 M1: 사진 자세 주소(?stage=…&shot=…)는 첫 안내를 건너뛴다 — 본 것으로 저장하지는 않는다
    const shot = typeof FPStage !== 'undefined' && FPStage.shotQuery();
    if (!seen && !shot) open();
  }
  return { init, open, close, get isOpen() { return isOpen; } };
})();
