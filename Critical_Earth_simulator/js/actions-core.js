// ============================================================================
// 행동 계산 모듈 (4차 F1) - DOM·three.js 없음, 순수 계산
// ----------------------------------------------------------------------------
// 왜 따로 떼었나:
//   '현재(2026)에서 고른 탄소중립 행동 → 배출 경로 → 미래'를 1인칭 학습지 카드(F2)·세계 속 행동 지점(F2)·
//   두 갈래 미래(F3)·미니게임 결과(M4)가 모두 쓴다. 계산이 화면마다 흩어지면 같은 행동이 곳곳에서
//   다른 숫자가 된다. 그래서 여기 한 곳에서만 내고, tools/test_actions.js 가 docs/refs/4차_문헌값.md
//   1-5 표(엔진으로 미리 계산한 결과)를 ±1 % 안에서 재현하는지 node 로 검사한다(마스터 §5-11).
//   나중에 조감 미래 예측도 쓸 수 있게 firstperson/ 이 아니라 js/ 에 둔다.
//
// 정직한 규모(TASK_4차_F §0): 효과를 부풀리는 배율을 쓰지 않는다. 한 사람·한 반의 행동이 2100년 값을
//   표시 자릿수에서 바꾸지 못하는 것은 버그가 아니라 내용이다. 큰 변화는 '사회의 선택'(배출 경로)에서 나온다.
//
// 이 파일은 엔진을 돌리지 않는다 — 기준 배출 함수(baseFn)를 받아 '행동을 뺀 배출 함수'를 돌려줄 뿐이다.
//   엔진 궤적은 1인칭에서는 fp-model.js 에서만 만든다(test_fp_model '엔진 궤적은 한 곳').
//
// 로드 순서: earth-visual → actions-core → fp-model (fp-model 이 NOW_YEAR·LOCAL_CUT_MAX 를 여기서 읽는다)
//   firstperson/index.html 과 tools/build_single_html.py FP_JS 를 같이 맞춘다.
// ============================================================================
const ActionsCore = (() => {
  // 행동 목록 — 숫자는 문헌값 1-1(환경부 『탄소중립 생활 실천 안내서』, 2차 확인)·1-2(비행)에서만.
  //   kgPerYear = 1인 기준 감축량 [kg CO₂/년], co2Share = 엔진에 넣는 CO₂ 몫(0~1), src = 등록부(js/sources.js) 키
  //   식단처럼 CO₂eq 대부분이 메탄인 행동은 넣지 않는다(문헌값 1-4-2). 넣더라도 크기 막대 전용(co2Share 0).
  const ACTIONS = Object.freeze([
    { id: 'tumbler', label: '카페에서 텀블러 쓰기',      kgPerYear: 3.5,   co2Share: 1, src: 'act_tumbler', group: 'small' },
    // 원 자료는 1가구 81.5 kg — 가구원 2.2명으로 나눈 1인 몫(act_household, unverified)
    { id: 'standby', label: '안 쓰는 플러그 뽑기',        kgPerYear: 37,    co2Share: 1, src: 'act_standby', group: 'small' },
    // 분리배출은 미니게임(M3) 정확도(0~1)를 곱한다 — 잘못 버린 재활용품은 소각·매립된다(문헌값 1-8, 비례식은 연출)
    { id: 'recycle', label: '분리배출 제대로 하기',        kgPerYear: 88,    co2Share: 1, src: 'act_recycle', group: 'small', scaleBy: 'recycleAccuracy' },
    { id: 'bike',    label: '가까운 거리는 걷기·자전거',   kgPerYear: 147,   co2Share: 1, src: 'act_bike',    group: 'move' },
    // 안내서 285.4 kg(실천포털 '친환경 교통' 쪽은 242 — 두 판이 다름, 발췌 추가 필요 2). 안내서 한 판으로 통일
    { id: 'transit', label: '자가용 대신 대중교통',        kgPerYear: 285.4, co2Share: 1, src: 'act_transit', group: 'move' },
    // 장거리 왕복 1회 = 1.0 t CO₂(ICAO식 이코노미 어림). 세계 규모에서는 국제선 이용 인구 상한으로 자른다(문헌값 1-4-6)
    { id: 'flight',  label: '장거리 왕복 비행 1번 줄이기', kgPerYear: 1000,  co2Share: 1, src: 'act_flight',  group: 'move', capPeople: 3.3e8 },
  ].map(a => Object.freeze(a)));

  // 참여 규모 — 문헌값 1-4-5 (등록부 action_scale, assumption). '우리 도시'는 도시 공기 전용이라 여기 없다(localCut).
  const SCALES = Object.freeze([
    { id: 'me',     label: '나',                              people: 1 },
    { id: 'class',  label: '우리 반',                         people: 30 },
    { id: 'school', label: '우리 학교',                       people: 800 },
    { id: 'korea',  label: '대한민국',                        people: 5.17e7 },   // 통계청 추계 확인 필요(발췌 4)
    { id: 'world',  label: '세계 — 비슷한 생활을 하는 사람', people: 1e9 },      // 고소득층 생활 수준 인구의 어림(가정)
  ].map(s => Object.freeze(s)));

  // 마스터 D6: '현재' = 2026. 1인칭의 NOW_YEAR 는 이 값 하나다(FPModel.NOW_YEAR = ActionsCore.START).
  // 행동은 2026년에 고르고, 2027년부터 배출이 달라진다 — 2026년까지는 기준 경로 하나의 역사.
  const START = 2026;
  const RAMP_YEARS = 5;            // 5년에 걸쳐 다 퍼진다(문헌값 1-4-4, 등록부 action_ramp, assumption)
  const C_TO_CO2 = 3.664;          // CO₂ ÷ C 질량비(44.01 ÷ 12.011) — GtC = kg CO₂ ÷ 10¹² ÷ 3.664 (문헌값 1-4-1)
  const LOCAL_CUT_MAX = 0.42;      // 도심 증가분 감소 상한(서울 거리두기 −42 %, 문헌값 1-6) · fp_local_cut
  const LOCAL_IDS = Object.freeze(['bike', 'transit']);   // 도시 공기를 바로 바꾸는 이동 행동(비행은 도시 공기와 무관)
  const FOOTPRINT_KR_KG = 9460;    // 한국인 1인 생활 배출 9.46 tCO₂eq/년(녹색전환연구소 2025, 문헌값 3부) · footprint_kr

  const byId = Object.fromEntries(ACTIONS.map(a => [a.id, a]));
  const scaleById = Object.fromEntries(SCALES.map(s => [s.id, s]));
  const clamp01 = v => Math.min(1, Math.max(0, Number(v) || 0));

  // chosen = { ids: [...], recycleAccuracy: 0~1 } — 미니게임(M4)이 정확도를 채운다.
  // 정확도가 없으면 1(만점)로 보지 않고 0(아직 안 해 봄)으로 본다: 해 보지 않은 분리배출을 다 맞힌 것으로 셀 수 없다.
  function idsOf(chosen) {
    const ids = Array.isArray(chosen) ? chosen : (chosen && chosen.ids) || [];
    return [...new Set(ids)].filter(id => byId[id]);      // 모르는 id·중복은 조용히 뺀다(저장값이 낡았을 때)
  }
  // 그 행동의 1인 감축량 [kg/년] — scaleBy 가 있으면 그 값(0~1)을 곱한다
  function actionKg(a, chosen) {
    if (!a.scaleBy) return a.kgPerYear;
    return a.kgPerYear * clamp01(chosen && !Array.isArray(chosen) ? chosen[a.scaleBy] : 0);
  }

  // 나의 탄소(① 층): 1인 합계 [kg/년]. 크기 막대와 같은 값이라 co2Share 를 곱하지 않는다(CO₂eq 크기 그대로).
  function personalKg(chosen) {
    return idsOf(chosen).reduce((sum, id) => sum + actionKg(byId[id], chosen), 0);
  }

  // kg CO₂/년(1인) × 사람 수 → GtC/년
  const gtcFromKg = (kgPerPerson, people) => kgPerPerson * people / 1e12 / C_TO_CO2;

  // 모두의 선택(② 층): 참여 규모 scaleId 로 함께 했을 때 엔진에서 빼는 화석 배출 [GtC/년, 다 퍼진 뒤]
  //   Σ kg × co2Share × min(people, capPeople) ÷ 10¹² ÷ 3.664
  //   opt.ignoreCap: 비행 상한 없이 계산(문헌값 1-5 표 비행 줄이 상한 적용 전 값이라 검사에서 쓴다)
  function cutGtC(chosen, scaleId, opt = {}) {
    const sc = scaleById[scaleId];
    if (!sc) throw new Error('알 수 없는 참여 규모: ' + scaleId);
    let kg = 0;
    for (const id of idsOf(chosen)) {
      const a = byId[id];
      const people = a.capPeople && !opt.ignoreCap ? Math.min(sc.people, a.capPeople) : sc.people;
      kg += actionKg(a, chosen) * a.co2Share * people;
    }
    return gtcFromKg(kg, 1);
  }

  // 퍼짐 비율: START 이하 0, 그 뒤 (y − START + 1) ÷ RAMP_YEARS 로 늘어 1에서 멈춘다 → 2027 0.4 … 2030 1.0
  //   (문헌값 1-5 표는 2026년부터 0.2씩 퍼진 계산이다 — D6 '2026까지 하나의 역사'를 지키려고 2026년 몫은 0으로 둔다.
  //    두 방식의 2100년 차이는 0.4 % 이하라 ±1 % 재현 조건 안이다: test_actions 가 확인)
  const rampAt = y => (y <= START ? 0 : Math.min(1, (y - START + 1) / RAMP_YEARS));

  // 기준 배출 함수에서 감축 cut [GtC/년]을 퍼짐 비율대로 뺀 배출 함수.
  //   화석 배출에서만 뺀다(토지이용 그대로, 문헌값 1-4-3). 그해 화석 배출보다 많이 빼지 않는다 —
  //   행동이 배출을 음수(제거)로 만들 수는 없다. 기준 경로가 이미 음수인 해(SSP1-1.9 2060~)는 손대지 않는다.
  function rampCut(baseFn, cut) {
    return y => {
      const e = baseFn(y), k = rampAt(y);
      if (k === 0 || !(cut > 0)) return e;
      const room = Math.max(0, e.fossil);
      return { ...e, fossil: e.fossil - Math.min(cut * k, room) };
    };
  }

  // '나의 미래' 배출 함수 = 기준 경로 − 나의 행동 × 참여 규모 (F3)
  function emissionsFn(baseFn, chosen, scaleId) {
    return rampCut(baseFn, cutGtC(chosen, scaleId));
  }

  // 도시 공기 즉시 효과(F4): 이동 행동(걷기·자전거, 대중교통)을 고른 경우만 0.42 × '우리 도시' 참여 비율(0~1).
  //   FPModel.zoneCO2('city', s, { localCut }) 가 도시 증가분에 (1 − localCut)을 곱한다.
  function localCut(chosen, cityAdoption) {
    const ids = idsOf(chosen);
    if (!LOCAL_IDS.some(id => ids.includes(id))) return 0;
    return LOCAL_CUT_MAX * clamp01(cityAdoption);
  }

  return {
    ACTIONS, SCALES, START, RAMP_YEARS, C_TO_CO2, LOCAL_CUT_MAX, LOCAL_IDS, FOOTPRINT_KR_KG,
    cutGtC, emissionsFn, personalKg, localCut,
    gtcFromKg, rampAt, rampCut,
  };
})();
