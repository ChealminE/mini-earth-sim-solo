// ============================================================================
// 1인칭 타임라인 막대 (4차 E1) — 화면 위 가운데
// ----------------------------------------------------------------------------
// 왜: 3차 E4 의 연도 슬라이더는 설정창(뒤에 학습지 [과제]) 안에 숨어 있어, 학생이 '같은 자리를 다른 해에 다시 잰다'는
// 1인칭 요건 ②(과거·현재·미래 오가기)를 찾지 못했다. 그래서 화면의 주 조작으로 올린다.
//
// 구성 (마크업은 firstperson/index.html #timeline — 이 파일은 상태 표시와 입력만 맡는다)
//   - 정거장 6개: 1850 · 1950 · 2000 · 현재(NOW_YEAR) · 2050 · 2100. 지금 정거장은 눌림(.is-on, aria-pressed)
//   - 세밀 조정 슬라이더(1750~2200, 1년). 과거(≤ LAST_HIST_YEAR, 실제 배출) = 회색 채움, 그 뒤 = 파란 점선
//     — 조감 2차 F3 시간 막대(#tlScrub)와 같은 약속. 미래 쪽에 있으면 손잡이도 점선 테두리(.is-future)
//   - 갈래 [기준 미래 | 나의 미래]. '나의 미래'는 F3 전까지 비활성 + 안내(setMineEnabled 로 연다)
//   - 오른쪽: 지금 연도 큰 숫자 + 시대(과거·현재·미래) + 갈래 이름
//
// 연도를 실제로 바꾸는 일은 하지 않는다 — init 에 받은 onGo(year, branch, opt) 를 부를 뿐이다(슬라이더는 opt.instant).
// 세계 갱신의 한 통로는 fp-main.js goTo → applyWorldState(C5)이고, 그쪽이 다 바꾼 뒤 show() 로 이 막대를 맞춘다.
// 그래서 버튼을 눌러도 이 파일이 혼자 '눌림'을 바꾸지 않는다(표시와 실제 연도가 어긋날 길이 없게).
//
// 입력 (마스터 §6-5·§6-6)
//   - 포인터 잠금 중에는 [ · ] 키(fp-player.js, e.code BracketLeft/Right → step(-1/+1)). 한글 자판에서도 같은 키다.
//   - 마우스로 누르려면 F 로 학습지를 열어 잠금을 푼다. 학습지가 닫혀 있고 잠금이 풀린 동안은 시작 안내가 화면을 덮어 막대를 못 누른다
//     (그 클릭은 3D 로 돌아가는 클릭이어야 하므로 일부러 막대를 시작 안내 아래에 둔다 — z-index).
//   - 막대 안에 초점이 남은 채 탐험으로 돌아가면 Space(점프)가 정거장 버튼을 누르고 ←/→ 가 슬라이더를 민다 → 잠금이 걸릴 때·학습지를
//     닫을 때 초점을 뺀다(blur).
// ============================================================================
const FPTimeline = (() => {
  const $ = id => document.getElementById(id);
  const NOW = FPModel.NOW_YEAR;
  const LAST_HIST = EarthSystem.LAST_HIST_YEAR;
  const MIN = FPModel.YEAR_MIN, MAX = FPModel.YEAR_MAX;
  // 정거장: 산업화 전(1850, AR6 기준기) · 1950 · 2000 · 현재 · 2050(탄소중립 목표 해) · 2100(AR6 시나리오 끝)
  const STOPS = Object.freeze([1850, 1950, 2000, NOW, 2050, 2100]);

  let el = null, stopEls = [], slider = null, onGo = null;
  let year = NOW, branch = 'base', mineOn = false;

  // [ · ] 가 갈 정거장: 정거장 사이에 있으면 dir 쪽으로 가장 가까운 정거장(슬라이더로 옮긴 뒤에도 자연스럽게)
  function stopFrom(y, dir) {
    if (dir < 0) { for (let i = STOPS.length - 1; i >= 0; i--) if (STOPS[i] < y) return STOPS[i]; }
    else { for (const s of STOPS) if (s > y) return s; }
    return null;
  }
  function step(dir) {
    const to = stopFrom(year, dir);
    if (to != null && onGo) onGo(to, branch);
    return to;
  }

  // 막대 안에 남은 초점 빼기(머리 주석 — 탐험 키가 버튼·슬라이더를 건드리지 않게)
  function blur() {
    if (el && el.contains(document.activeElement)) document.activeElement.blur();
  }

  // 지금 상태를 그린다. info = { era: 'past'|'now'|'future', eraText, branchName } — 글은 fp-main 이 정한다
  // (나의 미래·우리 사회의 미래 이름은 F·T 가 fp-main 쪽 글 함수를 바꿔 끼운다)
  function show(y, br, info = {}) {
    year = y; branch = br || 'base';
    if (!el) return;
    for (const b of stopEls) {
      const on = Number(b.dataset.year) === y;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-pressed', String(on));
    }
    if (Number(slider.value) !== y) slider.value = y;
    slider.classList.toggle('is-future', y > LAST_HIST);
    slider.setAttribute('aria-valuetext', `${y}년 ${info.eraText || ''}`.trim());
    $('tlYearBig').textContent = y;
    $('tlEra').textContent = info.eraText || '';
    el.dataset.era = info.era || '';
    $('tlBranchName').textContent = info.branchName || '';
    const base = $('tlBase'), mine = $('tlMine');
    base.classList.toggle('is-on', branch === 'base'); base.setAttribute('aria-pressed', String(branch === 'base'));
    mine.classList.toggle('is-on', branch === 'mine'); mine.setAttribute('aria-pressed', String(branch === 'mine'));
  }

  // F3(나의 미래)가 행동이 하나라도 골라지면 연다. 닫을 때 '나의 미래'에 있었으면 기준 미래로 되돌린다
  function setMineEnabled(on) {
    mineOn = !!on;
    if (!el) return;
    $('tlMine').disabled = !mineOn;
    $('tlMineNote').hidden = mineOn;
    if (!mineOn && branch === 'mine' && onGo) onGo(year, 'base');
  }

  function init(opts = {}) {
    el = $('timeline');
    if (!el) return;
    onGo = opts.onGo || null;
    slider = $('tlYear');
    slider.min = MIN; slider.max = MAX;
    // 과거(실제 배출) 구간 끝 위치 — 슬라이더 바탕(CSS --p-obs)의 회색 채움이 여기까지
    slider.style.setProperty('--p-obs', `${((LAST_HIST - MIN) / (MAX - MIN) * 100).toFixed(2)}%`);
    stopEls = [...el.querySelectorAll('#tlStops [data-year]')];
    // '현재' 정거장은 NOW_YEAR 한 곳에서 — 마크업의 2026 은 JS 가 뜨기 전 모양일 뿐
    const nowBtn = el.querySelector('#tlStops .tl-now');
    if (nowBtn) { nowBtn.dataset.year = NOW; nowBtn.textContent = `현재 ${NOW}`; }
    stopEls.forEach(b => b.addEventListener('click', () => onGo && onGo(Number(b.dataset.year), branch)));
    // 끄는 동안은 덮개 없이 바로(instant) — 한 해마다 0.4초 덮개가 뜨면 끌 수가 없다(E2)
    slider.addEventListener('input', () => onGo && onGo(Number(slider.value), branch, { instant: true }));
    $('tlBase').addEventListener('click', () => onGo && onGo(year, 'base'));
    $('tlMine').addEventListener('click', () => { if (mineOn && onGo) onGo(year, 'mine'); });
    document.addEventListener('pointerlockchange', () => { if (document.pointerLockElement) blur(); });
    setMineEnabled(false);
  }

  return { STOPS, init, show, step, stopFrom, blur, setMineEnabled,
    get year() { return year; }, get branch() { return branch; }, get mineEnabled() { return mineOn; } };
})();
