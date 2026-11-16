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
//              C3 zoneCO2(zone, s, opt) · urbanCO2(s, localCut)                    — 구역 대기 CO₂ (연평균)
//              C4 seaState(prox, s) · coralState · oceanHealth                     — 바다 = 엔진의 그해 표층 상태
//              C5 society(s, preset, levers) · cityState(s, soc, n)               — 도시·차·굴뚝 (연출, EarthVisual 규칙)
//              T3 techState(s, soc)                                             — 해상풍력·지붕 태양광·숲·포집·SMR·충전소 (연출)
//   상수는 맨 위 K 한 곳에 모으고, 각 줄에 등록부(js/sources.js) 키를 주석으로 단다.
//
// 로드 순서: earth-model → earth-data → earth-system → earth-visual → actions-core → fp-model → fp-world …
//   (firstperson/index.html 과 tools/build_single_html.py FP_JS 를 같이 맞춘다)
// 엔진 PARAMS·DT·해수 화학은 건드리지 않는다 — 여기서는 EarthSystem.run 결과를 그대로 꺼내 쓴다.
// ============================================================================
const FPModel = (() => {
  // 마스터 D6 '현재' 연도. 정의는 js/actions-core.js(ActionsCore.START) 한 곳 — 행동이 퍼지기 시작하는 해와
  // 1인칭의 '현재'가 갈라지면 '2026까지 하나의 역사'가 깨진다. 그래서 여기서는 읽기만 한다(F1).
  const NOW_YEAR = ActionsCore.START;
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
    // ── C3 구역 대기 CO₂ ──
    // 해양 대기 = 배경 그대로: NOAA 지구 평균 자체가 바다 위 관측소 평균이다(문헌값 2-4, 등록부 co2_noaa_gl).
    // 도심 '도시 증가분': 서울 20~27 ppm(여름 27·겨울 20)의 가운데 23 ppm을 2020년 값으로 둔다(문헌값 2-3).
    URBAN_CO2: 23,              // fp_urban_co2 (calibrated, unverified — 원 자료 대조 필요, 발췌 9)
    URBAN_REF_YEAR: 2020,       // fp_urban_co2 — 서울 관측(2020 발표) 시기. 다른 해는 그해 화석 배출 ÷ 2020년 화석 배출 비율
    LOCAL_CUT_MAX: ActionsCore.LOCAL_CUT_MAX,  // 0.42 — 도시 증가분을 줄일 수 있는 상한(코로나19 거리두기 −42 %, 문헌값 1-6) · fp_local_cut. 정의는 actions-core.js, 값은 F4가 채운다
    // 녹지·나무 밑: 정량 문헌 미확보(문헌값 2-5) → 3차 모형의 낮 정상 상태값을 그대로 두고 assumption + unverified 로 밝힌다.
    // 오프셋 = OFF + RISE × k, k = (배경 − CO2_MIN) ÷ (CO2_MAX − CO2_MIN) — 3차의 co2k 와 같은 식(earth-model.js 상수 불변)
    GREEN_OFF: -30, GREEN_RISE: -40,   // 녹지 대기 [ppm] · fp_green_co2 (assumption, unverified — 발췌 6)
    TREE_OFF: -55, TREE_RISE: -60,     // 나무 수관 바로 밑 추가 몫(낮 광합성 흡수) [ppm] · fp_tree_co2 (assumption, unverified — 발췌 6)
    // 굴뚝·배기구 바로 옆 국소 효과 (3차 값 그대로, 연출)
    STACK_PEAK: 260,            // 공장 굴뚝 바로 옆 최대 증가 [ppm] × stackLevel(그해 화석 배출) · fp_local_source (assumption)
    EXHAUST_PEAK: 110,          // 내연기관차 배기구 바로 옆 최대 증가 [ppm] · fp_local_source (assumption)
    CO2_FLOOR: 150,             // 측정값 하한 [ppm] — 국소 흡수 항이 겹쳐도 비현실적으로 내려가지 않게 (3차 값)
    // ── C4 바다 ──
    // 석회화 서식지: Ω 1 아래면 골격이 녹고(열역학 경계, 등록부 shell_omega) 3.4 이상이면 온전하다고 둔 3차 연출 구간.
    HAB_OMEGA_LO: 1.0,          // shell_omega (Ω = 1 경계)
    HAB_OMEGA_HI: 3.4,          // fp_habitat (assumption — 3차 값, 산업화 이전 표층 Ω 3.66 조금 아래)
    BLEACH_FISH_W: 0.5,         // 백화가 어류·수초 건강에 얹히는 비중 (3차 값) · fp_habitat (assumption)
    // ── C5 시각 언어 (연출 — 조감 EarthVisual 규칙: 도시·차·굴뚝은 배출 역사, CO₂는 보이지 않음) ──
    CARS: 10,                   // 1인칭 도로의 자동차 최대 대수(3차 모형 그대로) · city_scale
    BLD_MIN_N: 1,               // 도시 규모 0(1750년)에도 서 있는 건물 수 — 마을 한 채 · fp_city (assumption)
    BLD_H_MIN: 0.4,             // 도시 규모 0일 때 건물 높이 배율(낮은 집) → 1에서 3차 높이 그대로 · fp_city (assumption)
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

  // ── E2 '현재까지는 하나의 역사' (마스터 D6, 등록부 fp_now_join — assumption) ─────────────
  // 프리셋 경로들은 엔진 조화 규칙(LAST_HIST_YEAR 2023 → HARMONIZE_END) 때문에 2024년부터 조금씩 갈라진다
  // (2026년 CO₂ 425.3 / 424.6 / 423.7 ppm — 현재 정책 / 파리협약 / 1.5 °C). '현재'가 고른 미래에 따라 달라지면
  // 학생이 같은 해(현재)를 두 번 재고 다른 값을 얻는다 → NOW_YEAR 까지는 언제나 기준 경로 실행의 값을 보여 준다.
  // 엔진(PARAMS·경로 정의)은 그대로 두는 1인칭 표시 규칙이다 — SocietyCore.pickRun(year, baseRun, socRun)과 같은 규칙
  // (test_fp_model 이 둘이 같은지 본다. 이 파일은 society-core 없이도 node 에서 돌아야 해서 따로 둔다).
  // 갈림이 2027년으로 미뤄지며 2026 → 2027 사이에 작은 이음(1.5 °C 경로 약 −1.6 ppm)이 생긴다 — fp_now_join 에 밝힌다.
  const BASE_PRESET = 'ssp245';
  const shownRun = (year, run) => (Math.round(Number(year)) <= NOW_YEAR ? pathRun(BASE_PRESET) : run);
  // 그해 사회 모습(전기차·재생 비중 등)도 같은 규칙 — 현재까지는 기준 경로의 사회
  const shownSociety = (s, preset, levers, capture) => (s.year <= NOW_YEAR ? society(s, BASE_PRESET) : society(s, preset, levers, capture));

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

  // ── C3 구역 대기 CO₂ ─────────────────────────────────────────────────────
  // 도시 증가분 기준: 2020년 화석 배출. 2020년은 역사 구간이라 경로와 상관없이 같은 값이다.
  let fossilRef = null;
  function fossil2020() {
    if (fossilRef == null) fossilRef = sample(K.URBAN_REF_YEAR, pathRun('ssp245')).fossil;
    return fossilRef;
  }
  // 배경 CO₂를 0(280 ppm) ~ 1(1000 ppm)로 — 녹지·나무 밑 3차 모형이 이 비율로 흡수 폭을 키웠다(CO₂ 시비 효과).
  const co2Frac = ppm => Math.min(1, Math.max(0, (ppm - CO2_MIN) / (CO2_MAX - CO2_MIN)));
  // 도심 '도시 증가분' [ppm] = 23 × 그해 화석 배출 ÷ 2020년 화석 배출 × (1 − localCut), 0 이상.
  // 도시 공기는 그 도시가 '지금' 내는 배출에 바로 반응한다(전 지구 CO₂와 다르다, 문헌값 1-6) — 그래서 누적이 아니라 그해 배출.
  function urbanCO2(s, localCut) {
    const cut = Math.min(K.LOCAL_CUT_MAX, Math.max(0, localCut || 0));
    return K.URBAN_CO2 * Math.max(0, s.fossil / fossil2020()) * (1 - cut);
  }
  // 구역 대기 CO₂ [ppm] (연평균). zone = 'ocean' | 'green' | 'city'.
  //   opt.treeShade  0(수관 밖) ~ 1(줄기 바로 옆) — 녹지 나무 밑 흡수
  //   opt.localCut   0 ~ 0.42 — 우리 도시 교통 행동(F4)
  //   opt.stackNear  0 ~ 1 — 공장 굴뚝까지의 근접도 (fp-tools 가 세계 좌표로 잰다)
  //   opt.exhaustNear 0 ~ (차 수) — 내연기관차 배기구 근접도의 합 (전기차는 호출부에서 뺀다)
  function zoneCO2(zone, s, opt = {}) {
    const bg = s.ppm, k = co2Frac(bg);
    let v;
    if (zone === 'ocean') v = bg;
    else if (zone === 'city') v = bg + urbanCO2(s, opt.localCut);
    else if (zone === 'green') v = bg + K.GREEN_OFF + K.GREEN_RISE * k + (opt.treeShade || 0) * (K.TREE_OFF + K.TREE_RISE * k);
    else throw new Error('알 수 없는 구역: ' + zone);
    // 국소 배출원: 굴뚝은 그해 화석 배출(stackLevel — 조감 굴뚝 연기와 같은 값, 0 이하 배출이면 굴뚝이 꺼진다)
    v += (opt.stackNear || 0) * K.STACK_PEAK * EarthVisual.stackLevel(s.fossil);
    v += (opt.exhaustNear || 0) * K.EXHAUST_PEAK;
    return Math.max(K.CO2_FLOOR, v);
  }

  // ── C4 바다 = 엔진의 그해 표층 상태 ──────────────────────────────────────────
  // 예전에는 해수 pCO₂가 해양 대기를 2게임일로 따라갔다(stepSeaCO2). 시간 여행에서는 엔진이 이미 그해 표층 해양(DIC)을
  // 계산하므로 그 값을 그대로 쓴다: 해수 pCO₂ = pco2FromDic(o.dic, o.sst) — 엔진이 pH·Ω를 낼 때 쓰는 함수 그대로(earth-model.js).
  // 해수 pCO₂는 바다 전체가 한 값이고(냉수대도 같은 물), 지점 차이는 수온이 만든다: 지점 상태 = seawaterState(pCO₂, 그 지점 수온).
  // seawaterState 와 pco2FromDic 는 같은 탄산 평형(TA 일정)의 정·역 풀이라, 개방 해역(수온 = o.sst)에서는 엔진 o.pH·o.omega 로 돌아온다.
  const swCache = new WeakMap();   // 표본마다 한 번만 (산호 수백 개가 같은 표본을 읽는다)
  function seaPCO2(s) {
    let v = swCache.get(s);
    if (v == null) { v = pco2FromDic(s.dic, s.sst).pco2; swCache.set(s, v); }
    return v;
  }
  // 지점 해수 상태: seawaterState 결과(mol/kg, pH, omega …) + temp(°C) + pco2(µatm). prox 는 seaTemp 와 같다.
  function seaState(prox, s) {
    const temp = seaTemp(prox, s), pco2 = seaPCO2(s);
    const st = seawaterState(pco2, temp);
    st.temp = temp;
    st.pco2 = pco2;
    return st;
  }
  // 석회화 서식지 0~1 (Ω가 낮을수록 골격을 못 만든다)
  function habitatFromOmega(om) {
    return Math.min(1, Math.max(0, (om - K.HAB_OMEGA_LO) / (K.HAB_OMEGA_HI - K.HAB_OMEGA_LO)));
  }
  // 산호 한 자리의 상태. 원인이 다른 두 가지를 따로 낸다(오개념 '산성화 = 백화' 교정 — 과제 ③).
  //   백화(열 스트레스) = 1 − coralHealthy(T) — 조감 3D 산호와 같은 식(등록부 coral_sr15). 개방 해역(prox 0)에서 그대로,
  //     유빙 옆 냉수대로 갈수록 줄어 prox 1에서 0 — 12 °C 찬 물에는 열 스트레스가 없다(연출, fp_cold_pool).
  //   석회화 서식지 = habitatFromOmega(그 자리 Ω) — 냉수대가 Ω가 낮아 먼저 위험하다.
  function coralState(prox, s) {
    const st = seaState(prox, s);
    return {
      bleach: (1 - EarthVisual.coralHealthy(s.T)) * (1 - (prox || 0)),
      habitat: habitatFromOmega(st.omega),
      omega: st.omega, temp: st.temp,
    };
  }
  // 어류·수초 건강 0~1 — 바다 전체를 돌아다니므로 개방 해역 값. 서식지(Ω)가 주된 요인, 백화는 얹히는 스트레스.
  function oceanHealth(s) {
    const c = coralState(0, s);
    return c.habitat * (1 - K.BLEACH_FISH_W * c.bleach);
  }

  // ── C5 시각 언어 = 조감 EarthVisual 규칙 ─────────────────────────────────────
  // 그해 사회 모습 { ev, renew, nuclear, removal, ccus, dac, forest } — 조감 tab-future.js applyLevers3D 와 같은 규칙:
  //   직접 설계(레버 시작 해 이후) = 그해 레버 값, 그 밖 = EarthVisual.presetSociety(그해 화석 배출).
  // 4차 T3: 세계 속 기후테크(fp-tech-world.js)가 쓰는 세 값을 더 붙인다(앞의 네 값은 C5 그대로).
  //   ccus·dac [GtC/년] — 엔진 레버는 포집 합(ccs) 하나라 둘로 나누는 비율은 회의실 카드(capture = {ccus, dac}, 2050 목표값)에서만 온다.
  //     카드가 없으면(주소 levers 만, SSP 경로) 전부 DAC 로 본다: 지금까지의 포집 타워(대기에서 거둠, removal)와 같은 뜻이라
  //     C5 화면이 그대로다. removal 도 DAC 몫만 따른다(포집 타워 = DAC 장치).
  //   forest [GtC/년] — 토지이용 배출. 직접 설계 = 산림 레버, SSP = 그해 엔진 표본의 토지이용 배출(역사 구간은 L2023 = 지금 숲).
  function society(s, preset, levers, capture) {
    const ES = EarthSystem;
    if (preset === 'custom' && levers && s.year >= ES.LEVER_START) {
      const l = ES.leversAt(levers, s.year);
      const cu = capture && capture.ccus > 0 ? capture.ccus : 0, da = capture && capture.dac > 0 ? capture.dac : 0;
      const dacFrac = cu + da > 0 ? da / (cu + da) : 1;
      const dac = l.ccs * dacFrac;
      return { ev: l.ev, renew: l.renewShare, nuclear: l.nuclearShare, removal: dac / ES.LEVER_RANGE.ccs[1],
        ccus: l.ccs - dac, dac, forest: l.forest };
    }
    const p = EarthVisual.presetSociety(s.fossil || 0, s.year, ES.LEVER_NOW, ES.E2023, ES.LAST_HIST_YEAR);
    return { ...p, ccus: 0, dac: p.removal * ES.LEVER_RANGE.ccs[1],
      forest: s.year > ES.LAST_HIST_YEAR && Number.isFinite(s.luc) ? s.luc : ES.L2023 };
  }

  // ── T3 세계 속 기후테크 (연출, 등록부 fp_tech_visual — assumption) ──────────────────
  // 그해 사회 모습 → 구역별 소품 수. 숫자로 재는 값이 아니라 '설계가 세계에 보이게' 하는 대응이다(T §4 표).
  //   해상풍력 0~6기  = 재생 비중 '증가분' (LEVER_NOW 30 % → 0기, 100 % → 6기)
  //   지붕 태양광      = 재생 비중 그대로(서 있는 건물 중 그 비율의 지붕) — 2000년 전 0(presetSociety)
  //   숲 추가 비율     = 토지이용 배출 1.30(벌채 지속) → 0, 0(벌채 중단) → +20 %, −1.0(대규모 조림) → +50 % (사이는 직선)
  //   CCUS 설비 0~3   = CCUS GtC/년 ÷ (카드 3단계 값 ÷ 3), 올림. 굴뚝(C5 stackLevel)은 '포집 뒤' 순배출을 따르므로 포집이 크면
//                     굴뚝이 먼저 사라진다 — 그래도 설계한 포집 설비는 굴뚝 자리 옆에 그대로 보인다(설계가 보여야 한다)
  //   DAC 팬 벽 0~3   = DAC GtC/년 ÷ (카드 3단계 값 ÷ 3), 올림
  //   SMR 모듈 0~3    = 원자력 비중 증가분 ÷ (카드 3단계 − 현재) × 3, 반올림(조금이라도 늘면 1)
  //   충전소 0~4      = 전기차 비율 × 4, 반올림
  // 기준 값(카드 3단계)은 SocietyCore.TECH_CARDS 에서 부를 때 읽는다(정의는 한 곳 — test_fp_model 은 society-core 없이 이 파일을 부른다).
  const TECH = Object.freeze({ TURBINES: 6, UNITS: 3, CHARGERS: 4, TREE_PLUS_STOP: 0.2, TREE_PLUS_MAX: 0.5 });
  function techState(s, soc) {
    const ES = EarthSystem, N0 = ES.LEVER_NOW;
    const card = id => SocietyCore.TECH_CARDS.find(c => c.id === id).levels[2];
    const c01 = v => Math.min(1, Math.max(0, Number(v) || 0));
    const renew = c01(soc.renew), nuclear = c01(soc.nuclear);
    const units = (v, ref) => (v > 1e-6 ? Math.min(TECH.UNITS, Math.max(1, Math.ceil(v / (ref / TECH.UNITS) - 1e-9))) : 0);
    const f = Number.isFinite(soc.forest) ? soc.forest : ES.L2023;
    const treePlus = f >= ES.L2023 ? 0
      : f >= 0 ? TECH.TREE_PLUS_STOP * (ES.L2023 - f) / ES.L2023
      : TECH.TREE_PLUS_STOP + (TECH.TREE_PLUS_MAX - TECH.TREE_PLUS_STOP) * Math.min(1, -f / -ES.LEVER_RANGE.forest[0]);
    const dn = nuclear - N0.nuclearShare;
    return {
      turbines: Math.round(TECH.TURBINES * c01((renew - N0.renewShare) / (1 - N0.renewShare))),
      solarFrac: renew,
      treePlus,
      ccusUnits: units(soc.ccus || 0, card('ccus')),
      dacUnits: units(soc.dac || 0, card('dac')),
      smrUnits: dn > 0.005 ? Math.min(TECH.UNITS, Math.max(1, Math.round(dn / (card('nuclear') - N0.nuclearShare) * TECH.UNITS))) : 0,
      chargers: Math.round(TECH.CHARGERS * c01(soc.ev)),
    };
  }
  // 1인칭 도시 모습(연출, 등록부 city_scale · fp_city). CO₂ 농도는 하나도 쓰지 않는다 — CO₂는 무색이고(2차 D2),
  // 도시·차·굴뚝은 배출의 역사(누적 최댓값·그해 배출)를 따른다(2차 D3). 조감 3D 도시와 같은 함수다.
  //   건물: 개수 1 + round((N − 1) × level), 높이 배율 BLD_H_MIN + (1 − BLD_H_MIN) × level   (level = cityLevel(cumFossilMax))
  //   자동차: 대수 round(CARS × carFrac(level)), 그중 전기차 round(대수 × soc.ev)
  //   굴뚝·연기: stackLevel(그해 화석 배출) — 0 이하 배출이면 굴뚝도 연기도 없다
  //   포집 타워: soc.removal > 0 일 때만
  function cityState(s, soc, nBuildings) {
    const level = EarthVisual.cityLevel(s.cumFossilMax || 0);
    const cars = Math.round(K.CARS * EarthVisual.carFrac(level));
    const ev = Math.round(cars * Math.min(1, Math.max(0, soc.ev)));
    const stack = EarthVisual.stackLevel(s.fossil || 0);
    return {
      level,
      buildings: Math.min(nBuildings, K.BLD_MIN_N + Math.round((nBuildings - K.BLD_MIN_N) * level)),
      heightK: K.BLD_H_MIN + (1 - K.BLD_H_MIN) * level,
      cars, evCars: ev, gasCars: cars - ev,
      stack, stackOn: EarthVisual.stackCount(s.fossil || 0) > 0,
      removal: soc.removal, nuclear: soc.nuclear, renew: soc.renew,
    };
  }

  return { NOW_YEAR, YEAR_MIN, YEAR_MAX, K, runFor, emissionsFor, pathRun, sample,
    BASE_PRESET, shownRun, shownSociety,
    society, cityState, techState, TECH,
    airTemp, urbanHeat, seaTemp, iceSurfaceTemp, tempJitter,
    co2Frac, urbanCO2, zoneCO2,
    seaPCO2, seaState, habitatFromOmega, coralState, oceanHealth };
})();
