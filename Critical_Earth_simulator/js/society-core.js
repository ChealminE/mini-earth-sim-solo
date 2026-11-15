// ============================================================================
// 사회의 선택 계산 모듈 (4차 T1) - DOM·three.js 없음, 순수 계산
// ----------------------------------------------------------------------------
// 왜 따로 떼었나:
//   1인칭 3장 '결정자'(기후 정책 회의실 T2 · 세계 속 기후테크 T3 · 학습지 [우리 사회] T4·T5)와 F3의 '사회의 선택'
//   고르기가 모두 '카드 → 엔진 레버 → 배출 경로'를 쓴다. 화면마다 따로 계산하면 같은 설계가 곳곳에서 다른 숫자가 된다.
//   그래서 여기 한 곳에서만 내고, tools/test_society.js 가 docs/refs/4차_문헌값.md 6-3 표(엔진으로 미리 계산한 결과)를
//   ±1 % 안에서 재현하는지 node 로 검사한다(마스터 §5-13). 조감 미래 예측도 나중에 쓸 수 있게 js/ 에 둔다.
//
// 원칙(TASK_4차_T §0, 마스터 결정 10):
//   1. 엔진 레버(전력 구성·전기차·포집·기타 감축·산림)에 있는 것만 숫자로 바꾼다. 엔진 구조·PARAMS·레버 식은 그대로다.
//      레버가 없는 정책·기술(탄소 가격제·기후 금융·블루카본·대체육 …)은 숫자를 지어내지 않고 정책 카드·도감으로만 둔다.
//   2. 쟁점(원자력·포집·탄소 가격제·재생에너지 부지)은 찬성·우려를 같은 분량으로 싣는다(test_society 가 글자 수 비율을 잰다).
//   3. 포집 카드는 '줄이기 어려운 배출을 위한 것'임을 같이 보인다(엔진 결과: 포집 최대만으로 2100년 2.15 °C).
//   마스터 D15(고등학생 모드만): 카드 값은 슬라이더 연속값('value')이 기본이다. 중학생용 세 칸 판정·숫자 접기는 없다.
//
// 이 파일은 엔진을 돌리지 않는다 — 레버 객체와 배출 함수만 돌려준다. 엔진 궤적은 1인칭에서는 fp-model.js 에서만 만든다.
// 로드 순서: earth-system → earth-visual → society-core → actions-core → fp-model
//   (firstperson/index.html 과 tools/build_single_html.py FP_JS 를 같이 맞춘다)
// ============================================================================
const SocietyCore = (() => {
  const ES = EarthSystem;
  const NOW = ES.LEVER_NOW, RANGE = ES.LEVER_RANGE;

  // ── 2-1. 기술 카드 → 레버 ────────────────────────────────────────────────
  // levels = 카드의 1·2·3단계 값('2050년 목표' — 엔진 직접 설계와 같은 뜻: 2024년 현재값에서 2050년까지 선형, 이후 유지).
  //   단계 수치는 이 프로그램이 정한 연출값이다(등록부 society_card_levels, assumption).
  // range = 슬라이더 범위 = 엔진이 받는 범위(T §7-5). 전력 두 비중은 0~1(합이 1을 넘으면 아래 '전력 구성 정합'),
  //   포집 둘은 각각 0~3이고 합을 다시 LEVER_RANGE.ccs 로 자른다.
  // src = 현재값·범위의 등록부 키. T 지시서의 'ember_ger_2024'·'iea_gevo_2024' 대신 이미 있는 lever_* 키를 쓴다
  //   (같은 문헌을 두 번 등록하면 한쪽만 고쳐지는 일이 생긴다).
  // issue = 쟁점 카드 id(아래 ISSUES). 원자력·포집 카드를 놓으면 회의실 이젤에 그 쟁점이 펼쳐진다(T2).
  const TECH_CARDS = Object.freeze([
    { id: 'renew',    label: '태양광·풍력',                 lever: 'renewShare',   levels: [0.30, 0.55, 0.80], range: [0, 1], unit: '비중', src: 'lever_renew', issue: 'siting' },
    { id: 'nuclear',  label: '원자력·소형모듈원전(SMR)',    lever: 'nuclearShare', levels: [0.09, 0.15, 0.25], range: [0, 1], unit: '비중', src: 'lever_nuclear', issue: 'nuclear' },
    { id: 'ev',       label: '전기차·차세대 배터리',        lever: 'ev',           levels: [0.03, 0.50, 1.00], range: RANGE.ev, unit: '비율', src: 'lever_ev' },
    { id: 'ccus',     label: '공장 굴뚝 탄소 포집(CCUS)',   lever: 'ccs', part: 'ccus', levels: [0, 0.5, 1.5], range: RANGE.ccs, unit: 'GtC/년', src: 'lever_ccs', issue: 'capture' },
    { id: 'dac',      label: '직접공기포집(DAC)',           lever: 'ccs', part: 'dac',  levels: [0, 0.3, 1.5], range: RANGE.ccs, unit: 'GtC/년', src: 'lever_ccs', issue: 'capture' },
    // 하위 항목은 숫자로 나누지 않는다(T §2-1): otherCut 은 '전력·도로 밖 나머지 배출'을 한 덩어리로 줄이는 레버이고,
    //   확보한 부문 비중(OWID, 문헌값 6-2)은 온실가스 전체 기준 + 전력 사용분이 부문에 배분된 값이라 전력 레버와 이중 계산된다.
    //   share 는 '이 덩어리 안에 무엇이 있나'를 보이는 참고 막대 전용이다(계산에 쓰지 않는다). owid = 문헌값 6-2 의 항목 이름.
    { id: 'industry', label: '산업·항공·해운 전환',         lever: 'otherCut',     levels: [0, 0.4, 0.8], range: RANGE.otherCut, unit: '감축 비율', src: 'lever_other',
      sub: [
        { label: '수소환원제철',           owid: '철강', share: 7.2 },
        { label: '저탄소 시멘트',          owid: '시멘트', share: 3 },          // 공정 배출만(문헌값 6-2)
        { label: '지속가능항공유(SAF)',    owid: '항공', share: 1.9 },
        { label: '친환경 선박 연료',       owid: '해운', share: 1.7 },
        { label: '건물 효율',              owid: '건물 에너지 사용', share: 17.5 },
      ], subSrc: 'sector_share_owid' },
    // 산림은 '값이 작을수록' 강한 카드다: 1.30(벌채 지속) → 0(벌채 중단) → −1.0(대규모 조림)
    { id: 'forest',   label: '숲 되살리기(자연 기반 해법)', lever: 'forest',       levels: [NOW.forest, 0, -1.0], range: RANGE.forest, unit: 'GtC/년', src: 'lever_forest' },
  ].map(c => Object.freeze(c)));
  const LEVELS_SRC = 'society_card_levels';

  // ── 2-2. 정책 카드 (열쇠 — 마스터 D16) ───────────────────────────────────
  // opens = 이 카드가 최대 단계를 여는 기술 카드. 기술 카드는 opens 에 자기를 적은 정책 카드 중 '하나라도' 있으면 열린다.
  //   T §2-2 표: 탄소 가격제 → 산업 전환·CCUS, 탄소국경조정 → 산업 전환(탄소 가격제와 함께), 전력망 투자 → 태양광·풍력.
  //   '함께'를 '둘 다 있어야'로 읽으면 탄소 가격제 줄("산업 전환 최대 단계를 연다")이 혼자서는 거짓이 된다 —
  //   두 줄이 모두 참이 되도록 '어느 하나라도'로 읽었다(보고서 갈림길 기록).
  // 열쇠 규칙은 연출이다(등록부 policy_unlock). 실제 정책과 기술 보급의 관계는 훨씬 복잡하다 → UNLOCK_NOTE 를 카드 뒷면에.
  const POLICY_CARDS = Object.freeze([
    { id: 'carbon_price', label: '탄소 가격제(탄소세·배출권 거래)', opens: ['industry', 'ccus'], issue: 'carbon_price', src: 'society_policy_cards' },
    { id: 'border',       label: '탄소국경조정(CBAM) 같은 무역 규제', opens: ['industry'], src: 'society_policy_cards' },
    { id: 'grid',         label: '전력망·에너지 저장 투자(ESS·스마트그리드)', opens: ['renew'], src: 'society_policy_cards' },
    // 계산 변화 없음 — 원자력·재생 비중이 오르면 화석 비중이 저절로 내려가는 정합 규칙을 화면에서 강조만 한다
    { id: 'phaseout',     label: '석탄 발전 단계적 폐쇄', opens: [], src: 'society_policy_cards' },
    // 회의실 화면 목표선 + 비교 경로(ndcEmissions)
    { id: 'ndc',          label: '국제 협약·국가 감축목표(NDC)', opens: [], src: 'ndc_kr_2035' },
    { id: 'finance',      label: '기후 금융·국제 협력', opens: [], src: 'society_policy_cards' },
  ].map(p => Object.freeze(p)));
  const UNLOCK_NOTE = '이 규칙은 \'정책이 기술 보급의 조건이 된다\'는 생각을 단순하게 표현한 것이에요. 실제 정책과 기술 보급의 관계는 훨씬 복잡해요.';
  const UNLOCK_SRC = 'policy_unlock';

  // 화면 안내 문구(T §2-1·§0-3) — 문구 점검(test_society)이 이 글도 훑는다
  const NOTES = Object.freeze({
    baseline: '카드를 하나도 안 쓰면 = 지금(2023년) 배출 구조 그대로 계속되는 사회예요. 현재 정책 경로보다 2100년 CO₂가 높아요.',
    cleanPower: '전력의 100 %가 무탄소예요.',
    capture: '포집은 줄이기 어려운 배출을 위한 기술이에요. 포집이 있다고 해서 배출을 줄이지 않아도 된다는 뜻은 아니에요.',
    locked: '최대 단계를 쓰려면 정책 카드가 필요해요.',
  });

  const techById = Object.fromEntries(TECH_CARDS.map(c => [c.id, c]));
  const policyById = Object.fromEntries(POLICY_CARDS.map(p => [p.id, p]));
  const clamp = (v, [a, b]) => Math.min(Math.max(a, b), Math.max(Math.min(a, b), v));
  const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : null);   // 숫자가 아니면 '카드를 안 놓음'

  // 열린 최대 단계 {기술 카드 id: 2|3} (D16). 정책 카드가 아무것도 열지 않는 기술 카드는 언제나 3.
  // cards = 평평한 객체 { renew: 0.8, ev: 1, …, carbon_price: true, grid: true } — 저장값(D §worksheet society.cards) 그대로
  function unlocked(cards) {
    const c = cards || {};
    const out = {};
    for (const t of TECH_CARDS) {
      const keys = POLICY_CARDS.filter(p => p.opens.includes(t.id));
      out[t.id] = keys.length === 0 || keys.some(p => c[p.id] === true) ? 3 : 2;
    }
    return out;
  }
  // 슬라이더 끝값(잠겼으면 2단계 값까지). 산림은 값이 작을수록 강하므로 '끝'이 range 의 아래쪽이다.
  function capOf(t, maxLevel) {
    const strongLow = t.levels[2] < t.levels[0];
    const end = maxLevel >= 3 ? (strongLow ? t.range[0] : t.range[1]) : t.levels[1];
    return strongLow ? [end, t.range[1]] : [t.range[0], end];
  }

  // 카드 → 엔진 레버 + 화면용 설명. mode 'value'(기본, 고등학생 슬라이더) = 카드 값이 곧 레버 값,
  //   'level' = 카드 값이 1·2·3단계(회의실 키보드 고르기). 놓지 않은 카드는 LEVER_NOW 그대로.
  function design(cards, mode = 'value') {
    const c = cards || {};
    const max = unlocked(c);
    const val = {}, capped = [];
    for (const t of TECH_CARDS) {
      let v = num(c[t.id]);
      if (v == null) continue;
      if (mode === 'level') {
        const step = Math.min(max[t.id], Math.max(1, Math.round(v)));
        if (Math.round(v) > max[t.id]) capped.push(t.id);
        v = t.levels[step - 1];
      } else {
        const lim = capOf(t, max[t.id]);
        const w = clamp(v, lim);
        if (w !== clamp(v, t.range)) capped.push(t.id);   // 범위 안인데 열쇠 때문에 잘렸을 때만 '잠김'
        v = w;
      }
      val[t.id] = v;
    }
    const L = { ...NOW };
    // 전력 구성 정합: fossil = max(0, 1 − 원자력 − 재생). 합이 1을 넘으면 두 비중을 같은 비율로 줄여 합 = 1(화석 0).
    let n = val.nuclear != null ? val.nuclear : NOW.nuclearShare;
    let r = val.renew != null ? val.renew : NOW.renewShare;
    const over = n + r > 1;
    if (over) { const k = 1 / (n + r); n *= k; r *= k; }
    if (val.nuclear != null || val.renew != null) {
      // 1 − 0.09 − 0.30 = 0.6100000000000001 같은 부동소수 찌꺼기를 지운다(재생 카드만 0.30으로 놓아도 LEVER_NOW 와 같게)
      L.nuclearShare = n; L.renewShare = r;
      L.fossilShare = Math.max(0, Math.round((1 - n - r) * 1e12) / 1e12);
    }
    if (val.ev != null) L.ev = val.ev;
    // 포집 합 = CCUS + DAC, 엔진 범위 0~3 GtC/년으로 자른다
    const ccsRaw = (val.ccus || 0) + (val.dac || 0);
    if (val.ccus != null || val.dac != null) L.ccs = clamp(ccsRaw, RANGE.ccs);
    if (val.industry != null) L.otherCut = val.industry;
    if (val.forest != null) L.forest = val.forest;
    return {
      levers: L,
      values: val,                                   // 정합 전 카드 값(잘린 뒤) — 회의실 카드 표시용
      cleanPower100: L.fossilShare === 0,            // "전력의 100 %가 무탄소예요"
      powerScaled: over,                             // 원자력 + 재생 > 1 이라 비율대로 줄였다
      ccsClipped: ccsRaw > RANGE.ccs[1],
      capped,                                        // 열쇠가 없어 최대 단계에서 막힌 카드
      unlocked: max,
    };
  }
  const leversFrom = (cards, mode) => design(cards, mode).levers;

  // ── 2-4. 비교 경로 — "전 세계가 한국 NDC와 같은 비율로 줄인다면?" ──────────
  // 2023년 실제 화석 배출 → 2035년 = 2018년 화석 배출 × (1 − 감축률) 직선 → 2050년 0 직선(2050 탄소중립을 따른다고 가정)
  // → 이후 0. 토지이용 배출은 현재 정책(SSP2-4.5) 경로 그대로. 가정 세 가지는 등록부 ndc_global_path 에 밝힌다.
  // 감축률은 2035 NDC 범위의 두 끝(문헌값 6-4, 등록부 ndc_kr_2035).
  const NDC_KR = Object.freeze({
    base: 2018,
    y2030: 0.40,
    y2035: Object.freeze([0.53, 0.61]),
    // 부문별 2035 목표(2018 대비 감축 %) — 회의실 설명 카드 전용(엔진의 부문 구분과 맞지 않는다). 냉매는 '증가' 전망
    sectors2035: Object.freeze({ 전력: [68.8, 75.3], 수송: [60.2, 62.8], 산업: [24.3, 31], 건물: [53.6, 56.2], '냉매(증가)': [10.4, 18.6] }),
  });
  const NDC_Y1 = 2035, NDC_Y2 = 2050;
  function ndcEmissions(cut) {
    const k = num(cut);
    if (k == null || k < 0 || k > 1) throw new Error('NDC 감축률은 0~1: ' + cut);
    const E18 = ES.historicalEmissions(NDC_KR.base).fossil, E23 = ES.E2023, Y0 = ES.LAST_HIST_YEAR;
    const target = E18 * (1 - k);
    const luc = ES.presetEmissions('ssp245');
    return y => {
      if (y <= Y0) return ES.historicalEmissions(y);
      let f;
      if (y <= NDC_Y1) f = E23 + (target - E23) * (y - Y0) / (NDC_Y1 - Y0);
      else if (y <= NDC_Y2) f = target * (1 - (y - NDC_Y1) / (NDC_Y2 - NDC_Y1));
      else f = 0;
      return { fossil: f, luc: luc(y).luc };
    };
  }

  // ── 사회의 선택 선택지 (마스터 D18) ──────────────────────────────────────
  // SSP 세 경로의 이름은 엔진 PRESETS 에서 읽는다(조감 시나리오 버튼과 같은 이름).
  const CHOICES = Object.freeze([
    ...['ssp245', 'ssp126', 'ssp119'].map(id => Object.freeze({ id, label: ES.PRESETS[id].ko, src: 'scen_' + id })),
    Object.freeze({ id: 'ndc', label: '국가 목표(NDC)를 전 세계가 따른다면', cuts: NDC_KR.y2035, src: 'ndc_global_path' }),
    Object.freeze({ id: 'custom', label: '우리가 설계한 사회', src: LEVELS_SRC }),
  ]);

  // '현재까지는 하나의 역사'(마스터 D6, E2): 엔진의 레버·NDC 경로는 2024년부터 갈라지지만(LEVER_START, 6-3 표도 그렇게 계산),
  //   1인칭은 현재(NOW_YEAR = ActionsCore.START) 이하의 해에 언제나 기준 경로 궤적을 보인다. 엔진은 고치지 않는다.
  //   ActionsCore 는 이 파일 뒤에 로드되므로 부를 때 읽는다(정의는 actions-core.js 한 곳).
  function pickRun(year, baseRun, socRun) {
    return year <= ActionsCore.START ? baseRun : socRun;
  }

  // ── 쟁점 카드 (T §0-2) ───────────────────────────────────────────────────
  // 찬성·우려를 같은 분량으로(test_society: 글자 수 비율 0.67~1.5). 프로그램이 정답을 정하지 않는다.
  // 근거 문장의 공식 기관 자료는 아직 확보하지 못했다(문헌값 4부-18·20) → 등록부 issue_* 는 unverified.
  // 숫자는 이 프로그램 엔진 결과(문헌값 6-3)만 쓴다 — test_society 가 엔진으로 다시 계산해 문구의 숫자와 맞춰 본다.
  const ISSUES = Object.freeze({
    nuclear: Object.freeze({
      title: '원자력·소형모듈원전(SMR)을 늘릴까?',
      pro: [
        '발전할 때 CO₂를 거의 내지 않아요. 이 프로그램의 엔진도 원자력 발전을 재생에너지처럼 배출이 없는 것으로 계산해요.',
        '날씨와 상관없이 밤낮으로 일정하게 전기를 만들 수 있어 전력 공급이 안정적이라는 의견이 있어요.',
        '소형모듈원전은 공장에서 만든 모듈을 조립해 짓는 기간과 비용을 줄이려는 기술이에요.',
      ],
      con: [
        '사고가 나면 피해가 넓은 지역에 오래 남을 수 있다는 우려가 있어요.',
        '사용후핵연료(고준위 방사성 폐기물)를 아주 오랫동안 안전하게 보관할 처분장을 정하는 일이 아직 어려워요.',
        '짓는 데 시간과 비용이 많이 들고, 소형모듈원전은 아직 상업 운전 경험이 적어 비용을 예측하기 어려워요.',
      ],
      src: 'issue_nuclear',
    }),
    capture: Object.freeze({
      title: '탄소 포집(CCUS·DAC)에 기댈까?',
      pro: [
        '시멘트·철강처럼 공정에서 CO₂가 나와 다른 방법으로 줄이기 어려운 배출을 붙잡을 수 있어요.',
        '직접공기포집은 이미 공기 중에 있는 CO₂를 빼낼 수 있어 순배출 0을 맞추는 데 쓰일 수 있어요.',
        '엔진에서 포집 최대(3 GtC/년)를 쓰면 2100년 기온 편차가 2.47 °C에서 2.15 °C로 낮아져요.',
      ],
      con: [
        '엔진에서 포집 최대(3 GtC/년)만 쓰면 2100년 기온 편차는 2.15 °C로 2 °C 아래로 가지 못해요.',
        '붙잡고 묻는 데 에너지와 비용이 많이 들고, 지금 설치된 규모는 필요한 양에 비해 작다는 지적이 있어요.',
        '포집 기술을 믿고 배출 감축을 미루게 될 수 있다는 우려가 있어요.',
      ],
      note: NOTES.capture,
      src: 'issue_capture',
      related: ['model_temp'],
    }),
    carbon_price: Object.freeze({
      title: '탄소에 가격을 매길까?',
      pro: [
        '배출에 값을 매기면 배출을 줄이는 쪽이 이익이 되어, 기업과 가정이 각자 비용이 적게 드는 감축 방법을 찾게 돼요.',
        '걷은 돈을 기후 기술 투자나 부담이 큰 가계 지원에 다시 쓸 수 있어요.',
      ],
      con: [
        '에너지와 물건값이 올라 소득이 낮은 가계일수록 부담이 커질 수 있어요(역진성).',
        '가격이 낮으면 효과가 작고, 규제가 약한 나라로 공장이 옮겨 가 배출이 자리만 바뀔 수 있다는 우려가 있어요.',
      ],
      src: 'issue_carbon_price',
    }),
    siting: Object.freeze({
      title: '태양광·풍력 발전소를 어디에 지을까?',
      pro: [
        '연료를 태우지 않아 발전할 때 CO₂가 나오지 않고, 연료를 수입하지 않아도 돼요.',
        '지붕·주차장·바다처럼 이미 쓰는 공간 위에도 지을 수 있어요.',
      ],
      con: [
        '넓은 땅이나 바다가 필요해 숲·농지·어장과 겹치면 주민·어민과 갈등이 생길 수 있어요.',
        '햇빛과 바람에 따라 발전량이 달라져 전력망과 저장 장치를 함께 갖춰야 해요.',
      ],
      src: 'issue_siting',
    }),
  });

  // ── 2-3. 기후테크 도감 (숫자 없음) ───────────────────────────────────────
  // why = "이 프로그램의 엔진이 계산하지 않는 이유". 사실 문장의 공식 출처는 아직 없다 → 등록부 climatetech_guide(unverified).
  const GUIDE = Object.freeze([
    { id: 'altmeat',  label: '대체육·배양육',   what: '식물이나 배양한 세포로 고기와 비슷한 음식을 만드는 기술이에요.',
      cuts: '가축 사육에서 나오는 온실가스, 특히 메탄을 줄여요.', hard: '맛·값·생산 규모와 소비자의 선택이 과제예요.',
      why: '주로 메탄을 줄이는데, 이 프로그램의 엔진은 CO₂만 계산해요.' },
    { id: 'chemrecycle', label: '화학적(열분해) 재활용', what: '플라스틱을 열로 분해해 다시 원료로 되돌리는 기술이에요.',
      cuts: '태우거나 묻는 플라스틱과 새 원료 생산을 줄여요.', hard: '분해에 에너지가 들고 효과를 잰 근거가 아직 부족해요.',
      why: '감축량을 계산할 정량 근거를 확보하지 못했어요.' },
    { id: 'bluecarbon', label: '블루카본(잘피·갯벌·맹그로브)', what: '바닷가 생태계가 흡수해 쌓아 두는 탄소예요.',
      cuts: '바닷가 생태계를 지키고 넓히면 탄소를 더 오래 붙잡아 둘 수 있어요.', hard: '흡수량을 재기 어렵고 개발로 줄어들고 있어요.',
      why: '이 프로그램의 엔진에는 바다 생태계의 흡수가 따로 들어 있지 않아요.' },
    { id: 'finance',  label: '기후 금융',       what: '온실가스를 줄이고 기후 변화에 대비하는 일에 돈을 모아 쓰는 방법이에요.',
      cuts: '재생에너지·전력망 같은 전환에 필요한 투자를 앞당겨요.', hard: '누가 얼마를 낼지 나라 사이의 합의가 어려워요.',
      why: '이 프로그램의 엔진에는 경제(돈의 흐름)가 들어 있지 않아요.' },
    { id: 'h2',       label: '그린수소',        what: '재생에너지 전기로 물을 분해해 만든 수소예요.',
      cuts: '제철·화학처럼 전기로 바꾸기 어려운 공정의 화석 연료를 대신해요.', hard: '만드는 데 전기가 많이 들고 저장·운반이 어려워요.',
      why: '\'산업·항공·해운 전환\' 카드 안에 들어 있어요. 따로 나누어 계산하지 않아요.' },
    { id: 'battery',  label: '차세대 배터리',   what: '더 많이 저장하고 더 빨리 충전하는 배터리 기술이에요.',
      cuts: '전기차를 늘리고 재생에너지 전기를 저장하는 데 도움을 줘요.', hard: '원료 광물의 채굴과 폐배터리 처리가 과제예요.',
      why: '\'전기차·차세대 배터리\' 카드 안에 들어 있어요. 배터리 자체의 효과는 따로 계산하지 않아요.' },
  ].map(g => Object.freeze({ ...g, src: 'climatetech_guide' })));

  return {
    TECH_CARDS, POLICY_CARDS, LEVELS_SRC, UNLOCK_NOTE, UNLOCK_SRC, NOTES, NDC_KR, CHOICES, GUIDE,
    issues: ISSUES,
    unlocked, design, leversFrom, ndcEmissions, pickRun,
  };
})();
