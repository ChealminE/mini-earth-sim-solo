// ============================================================================
// 1인칭 값 계산 모듈 (4차 C1) - DOM·three.js 없음, 순수 계산
// ----------------------------------------------------------------------------
// 왜 따로 떼었나:
//   1인칭의 측정값 계산이 렌더 코드(fp-world.js·fp-tools.js·fp-main.js) 사이에 흩어져 있으면
//   "같은 해·같은 경로면 조감 미래 예측과 같은 전 지구 값인가"(마스터 §5-10)를 node에서 확인할 수 없다.
//   EarthVisual(js/earth-visual.js)과 같은 이유로, 값은 여기서만 내고 렌더 코드는 이 모듈을 부르기만 한다.
//   tools/test_fp_model.js 가 이 파일을 엔진과 함께 vm으로 불러 숫자로 검사한다.
//
// 지금(C1) 들어 있는 것: 연도·경로 → 엔진 표본(runFor·pathRun·sample)과 '현재' 연도(NOW_YEAR).
// 단계별로 여기에 더한다(TASK_4차_C_모델정렬.md):
//   C2 airTemp(zone, s) · seaTemp(prox, s) · iceSurfaceTemp(s)   — 기온·해수온 (연평균)
//   C3 zoneCO2(zone, s, opt)                                       — 구역 대기 CO₂
//   C4 seaState(prox, s)                                           — 바다 = 엔진의 그해 표층 상태
//   상수는 맨 위 K 한 곳에 모으고, 각 줄에 등록부(js/sources.js) 키를 주석으로 단다.
//
// 로드 순서: earth-model → earth-data → earth-system → earth-visual → fp-model → fp-world …
//   (firstperson/index.html 과 tools/build_single_html.py FP_JS 를 같이 맞춘다)
// 엔진 PARAMS·DT·해수 화학은 건드리지 않는다 — 여기서는 EarthSystem.run 결과를 그대로 꺼내 쓴다.
// ============================================================================
const FPModel = (() => {
  // 마스터 D6. E·F가 이 값 하나만 쓴다(F1에서 ActionsCore.START 로 옮기고 여기서는 그것을 읽는다).
  const NOW_YEAR = 2026;
  // 시간축은 조감 미래 예측과 같다(마스터 결정 11: 1750~2200).
  const YEAR_MIN = 1750, YEAR_MAX = 2200;

  // 측정 지점 상수 — C2~C4에서 채운다(각 줄에 등록부 키). 지금은 비어 있다.
  const K = Object.freeze({});

  // ── 연도·경로 → 엔진 궤적 ────────────────────────────────────────────────
  // 경로마다 한 번만 굴린다(1750~2200년 451개 × 4 소단계 — 연도를 옮길 때마다 다시 굴리면 E의 시간 이동이 끊긴다).
  // key 가 없으면 캐시하지 않는다(한 번 쓰고 버리는 검사용 경로).
  const cache = new Map();
  function runFor(emissionsFn, key) {
    if (key != null && cache.has(key)) return cache.get(key);
    // cumFossilMax(누적 화석의 '지금까지 최댓값')는 조감이 도시·건물 규모에 쓰는 값이다. 1인칭도 같은 값을 써야
    // 같은 해에 같은 도시가 선다(C5) — 그래서 궤적을 만들 때 바로 붙인다.
    const run = EarthVisual.annotateCumFossil(
      EarthSystem.run({ fromYear: YEAR_MIN, toYear: YEAR_MAX, emissionsFn }));
    if (key != null) cache.set(key, run);
    return run;
  }

  // 조감 미래 예측과 같은 경로 정의: 프리셋(SSP)은 presetEmissions, 직접 설계는 leverEmissions(2050 목표 레버).
  // 경로 이름 → 배출 함수를 여기 한 곳에서만 만든다(fp-main.js 가 엔진을 직접 부르지 않게).
  function emissionsFor(preset, levers) {
    if (preset === 'custom') {
      if (!levers) throw new Error('직접 설계 경로에는 레버 값이 필요합니다');
      return EarthSystem.leverEmissions(levers);
    }
    return EarthSystem.presetEmissions(preset);
  }
  function pathRun(preset, levers) {
    const key = preset === 'custom' ? 'custom:' + JSON.stringify(levers) : preset;
    return runFor(emissionsFor(preset, levers), key);
  }

  // ── 그해 표본 ────────────────────────────────────────────────────────────
  // 엔진 궤적의 그해 항목을 '그대로' 돌려준다(복사·가공 없음) — 그래야 배경 CO₂·기온 편차·개방 해역 수온·pH·Ω가
  // 조감과 차이 0으로 같다(test_fp_model §6-1). 항목: year·ppm·T·sst·pH·omega·dic·fossil·cumFossilMax …
  // 연도는 정수로 반올림하고 시간축 끝에서 자른다(주소 ?year= 에 이상한 값이 와도 멈추지 않게).
  function sample(year, run) {
    const y = Math.max(YEAR_MIN, Math.min(YEAR_MAX, Math.round(Number(year) || 0)));
    return run[y - run[0].year];
  }

  return { NOW_YEAR, YEAR_MIN, YEAR_MAX, K, runFor, emissionsFor, pathRun, sample };
})();
