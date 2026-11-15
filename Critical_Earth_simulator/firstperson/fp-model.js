// ============================================================================
// 1인칭 값 계산 모듈 (4차 C1) - DOM·three.js 없음, 순수 계산
// ----------------------------------------------------------------------------
// 왜 따로 떼었나:
//   1인칭의 측정값 계산이 렌더 코드(fp-world.js·fp-tools.js·fp-main.js) 사이에 흩어져 있으면
//   "같은 해·같은 경로면 조감 미래 예측과 같은 전 지구 값인가"(마스터 §5-10)를 node에서 확인할 수 없다.
//   EarthVisual(js/earth-visual.js)과 같은 이유로, 값은 여기서만 내고 렌더 코드는 이 모듈을 부르기만 한다.
//   tools/test_fp_model.js 가 이 파일을 엔진과 함께 vm으로 불러 숫자로 검사한다.
//
// 들어 있는 것: C1 연도·경로 → 엔진 표본(runFor·pathRun·sample)과 '현재' 연도(NOW_YEAR)
//              C2 airTemp(zone, s) · seaTemp(prox, s) · iceSurfaceTemp(s) · tempJitter — 기온·해수온 (연평균)
// 단계별로 여기에 더한다(TASK_4차_C_모델정렬.md):
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

  // 측정 지점 상수 — 숫자는 docs/refs/4차_문헌값.md 2부에서만 온다. 각 줄 끝에 등록부(js/sources.js) 키.
  // 모든 값은 '그해 연평균(하루 평균)'이다(마스터 D2). 화면이 낮이어도 일교차·계절 항은 없다.
  const K = Object.freeze({
    // ── C2 기온·해수온 ──
    // AR6 WG1 SPM A.1.2: 2011~2020년이 1850~1900년보다 전 지구 1.09 °C, 육지 1.59 °C, 해양 0.88 °C 높다(문헌값 2-2).
    // 전 지구 편차 T에 곱하는 육지·해양 비율로 쓴다(나눗셈을 그대로 둬 근거 숫자가 코드에 보이게).
    LAND_AMP: 1.59 / 1.09,      // ≈ 1.46 · fp_land_amp (param, 발췌본)
    OCEAN_AMP: 0.88 / 1.09,     // ≈ 0.81 · fp_ocean_amp (param, 발췌본)
    // 도심 열섬: 연평균 대기 기준 도심 − 녹지 2 °C(범위 1~4, 서울 사례에서 잡은 값 — 연평균 강도 문헌은 미확보, 문헌값 2-6).
    // 2020년 도시 규모에서 2 °C, 도시 규모(EarthVisual.cityLevel)에 비례 — 도시가 작던 1750년 ≈ 0.
    UHI: 2.0,                   // fp_uhi (calibrated, unverified)
    UHI_REF_YEAR: 2020,         // fp_uhi — 위 2 °C가 맞춰진 해(서울 관측 시기)
    // 냉수대·빙하 표면 (연출, 문헌값 2-7). 냉수대 폭·반경은 3차 값 그대로.
    COLD_POOL_DT: 12,           // 유빙 바로 옆에서 개방 해역보다 낮아지는 폭 [°C] · fp_cold_pool (assumption)
    SEA_FREEZE_T: -1.9,         // 염분 35 해수의 어는점 [°C] — 이보다 차가워질 수 없다 · fp_cold_pool
    ICE_T0: -6,                 // 산업화 이전 빙하 표면 연평균 [°C] (3차 값) · fp_ice_surface (assumption)
    ICE_CAP: 0,                 // 융해 잠열로 얼음 표면은 0 °C 위로 못 오른다 · fp_ice_surface
    // 같은 구역 안 지점마다 조금씩 다른 값(측정하는 맛). 구역 차이(열섬 2 °C)보다 충분히 작게 ±0.3 °C 안.
    JITTER: 0.3,                // fp_jitter (assumption)
  });

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

  // ── C2 기온 · 해수온 (연평균) ─────────────────────────────────────────────
  // 열섬 기준: 2020년 도시 규모. 2020년은 역사 배출 구간(≤ LAST_HIST_YEAR)이라 경로와 상관없이 같은 값이다.
  let cityRef = null;
  function cityRef2020() {
    if (cityRef == null) cityRef = EarthVisual.cityLevel(sample(K.UHI_REF_YEAR, pathRun('ssp245')).cumFossilMax);
    return cityRef;
  }
  // 도심 − 녹지 기온차 [°C]. 도시 규모는 누적 화석의 '지금까지 최댓값'을 따르므로(조감 건물과 같은 값) 배출이 줄어도
  // 도시는 남고 열섬도 남는다. 2020년 이후 도시가 더 크면 2 °C보다 조금 커진다.
  function urbanHeat(s) {
    return K.UHI * EarthVisual.cityLevel(s.cumFossilMax) / cityRef2020();
  }
  // 구역 대기 기온 [°C]. 'ocean' | 'green' | 'city'.
  //   녹지 = AIR_T0 + 1.46 T (육지 증폭) · 해양 = AIR_T0 + 0.81 T (해양 증폭) · 도심 = 녹지 + 열섬
  // AIR_T0(14 °C, js/earth-model.js, 등록부 model_air_temp)는 조감 기록 표 air_temp 와 같은 기준이다.
  function airTemp(zone, s) {
    const land = AIR_T0 + K.LAND_AMP * s.T;
    if (zone === 'green') return land;
    if (zone === 'city') return land + urbanHeat(s);
    if (zone === 'ocean') return AIR_T0 + K.OCEAN_AMP * s.T;
    throw new Error('알 수 없는 구역: ' + zone);
  }
  // 해수 표층 수온 [°C]. prox 0 = 개방 해역(= 엔진 o.sst, 조감 기록 표 water_temp 와 같은 값) … 1 = 유빙 바로 옆.
  function seaTemp(prox, s) {
    return Math.max(K.SEA_FREEZE_T, s.sst - K.COLD_POOL_DT * (prox || 0));
  }
  // 빙하 표면 [°C]. 얼음 위 공기는 바다 쪽이라 해양 증폭을 쓰고, 0 °C에서 멈춘다.
  function iceSurfaceTemp(s) {
    return Math.min(K.ICE_CAP, K.ICE_T0 + K.OCEAN_AMP * s.T);
  }
  // 지점 흔들림 [°C] — 위치만의 함수(같은 자리를 다시 재면 같은 몫). |값| ≤ K.JITTER.
  // 두 사인의 진폭 비(0.6 : 0.4)는 3차의 0.5 : 0.35 모양을 그대로 두고 합이 JITTER가 되게 줄인 것이다.
  function tempJitter(x, z) {
    return K.JITTER * (0.6 * Math.sin(x * 37.1 + z * 21.7) + 0.4 * Math.sin(x * 11.3 - z * 53.9));
  }

  return { NOW_YEAR, YEAR_MIN, YEAR_MAX, K, runFor, emissionsFor, pathRun, sample,
    airTemp, urbanHeat, seaTemp, iceSurfaceTemp, tempJitter };
})();
