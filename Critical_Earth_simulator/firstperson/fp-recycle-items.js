// ============================================================================
// 분리배출 품목 데이터 (4차 M3) — 선생님은 이 파일만 고치면 분리배출장 미니게임의 품목·정답·이유를 바꿀 수 있다
// ----------------------------------------------------------------------------
// 근거: docs/refs/4차_문헌값.md 5부 표(품목 규칙). src 는 출처 등록부(js/sources.js) 키 목록이다 — 화면의 ⓘ 가 이 키를 연다.
//   rec_portal = 탄소중립 실천포털 분리배출 방법(군위군청 재게재, 2차) · rec_kwa = 한국폐기물협회 『2026년도 내 손안의 분리배출 앱 Q&A 사례』(원문)
//   rec_seoul = 서울시 「탄소중립 라이프 #8 자원순환」(2024, 원문) · rec_can · rec_takeout = 원문 확인 필요(unverified, 문헌값 4부-12·13)
// 기준은 지자체 조례마다 다를 수 있다(한국폐기물협회 Q&A). 공통으로 확인된 규칙만 넣고, 지역 차이가 확인된 품목은 region: true(화면에 배지).
//
// 품목 한 줄의 칸
//   id     영어 이름(바꾸지 않는다 — 학습지 기록이 이 이름으로 남는다)
//   name   화면 이름          bin   정답 수거함(RECYCLE_BINS 중 하나)
//   prep   꼭 해야 하는 준비(RECYCLE_PREP 키). 수거함은 맞는데 준비가 빠지면 반점(0.5)
//   spawns 준비하면 새로 생기는 품목 { 준비 키: 품목 id } — 생수 페트병 라벨을 떼면 '떼어 낸 라벨'(비닐)이 작업대에 남는다
//   why    틀렸을 때 보여 줄 한 줄 이유(맞았을 때도 보여 준다)
//   src    근거 키 목록          model  3D 모양 이름(firstperson/fp-stage-recycle.js MODELS 에 있어야 한다)
//   trap   함정 품목(헷갈리기 쉬운 것) — 한 판에 최소 3개      region  지역마다 다를 수 있음(배지)
//   cant   이 품목에는 할 수 없는 준비(누르면 '이 품목은 할 수 없어요' 흔들림)
//   notes  준비를 했을 때 띄울 짧은 말 { 준비 키: 문장 }
//   fromCafe  카페에서 들고 나왔을 때만 나온다(첫 품목)      spawnOnly  다른 품목에서 생길 때만 나온다
//
// 모듈을 읽을 때는 DOM·THREE 를 건드리지 않는다(node 검사 — tools/test_recycle_items.js).
// ============================================================================
const RecycleItems = (() => {
  // 수거함 9개(왼쪽부터 = 숫자 키 1~9). 색만으로 구분하지 않는다 — 앞면 표지에 이름 + 그림 기호 + 숫자(M §3-2)
  const RECYCLE_BINS = ['pet', 'plastic', 'vinyl', 'can', 'glass', 'paper', 'carton', 'styro', 'general'];
  const BIN_INFO = {
    pet:     { name: '투명 페트병', icon: 'bottle', color: '#2f7fb8' },
    plastic: { name: '플라스틱',   icon: 'tub',    color: '#d98a2b' },
    vinyl:   { name: '비닐',       icon: 'bag',    color: '#8a6fb5' },
    can:     { name: '캔·고철',    icon: 'can',    color: '#c0473f' },
    glass:   { name: '유리병',     icon: 'glass',  color: '#3e8f6a' },
    paper:   { name: '종이',       icon: 'paper',  color: '#9c7a4e' },
    carton:  { name: '종이팩',     icon: 'carton', color: '#4f9fb0' },
    styro:   { name: '스티로폼',   icon: 'styro',  color: '#7d8a96' },
    general: { name: '일반쓰레기', icon: 'trash',  color: '#5b6b45', sub: '종량제 봉투' },
  };
  const RECYCLE_PREP = { empty: '비우기', rinse: '헹구기', label: '라벨 떼기', parts: '부속 떼기', flatten: '눌러 납작하게', tape: '송장·테이프 떼기' };
  const PREP_ORDER = ['empty', 'rinse', 'label', 'parts', 'flatten', 'tape'];
  const ROUND_SIZE = 10;     // 한 판 = 품목 10개(M §3-3)
  const TRAP_MIN = 3;        // 함정 품목 최소 3개

  const RECYCLE_ITEMS = [
    { id: 'water_pet', name: '생수 페트병 (라벨 붙음)', bin: 'pet', prep: ['empty', 'label', 'flatten'], spawns: { label: 'pet_label' },
      why: '먹는 샘물·음료 페트병만 투명 페트병으로. 라벨은 비닐로 따로, 납작하게 눌러 뚜껑을 닫아요.', src: ['rec_portal', 'rec_kwa'], model: 'waterPet' },
    { id: 'soy_pet', name: '간장 페트병', bin: 'plastic', prep: ['empty', 'rinse'], trap: true,
      why: '투명해도 간장 같은 양념류 페트병은 투명 페트병이 아니라 플라스틱으로 내요. 비우고 헹궈서요.', src: ['rec_kwa'], model: 'soyPet' },
    { id: 'oil_pet', name: '식용유 페트병', bin: 'plastic', prep: ['empty'], trap: true,
      why: '식용유 페트병도 투명 페트병이 아니라 플라스틱으로 내요. 내용물을 비워서요.', src: ['rec_kwa'], model: 'oilPet' },
    { id: 'yogurt', name: '요구르트 병 (은박 뚜껑)', bin: 'plastic', prep: ['empty', 'parts'],
      why: '요구르트 병은 내용물을 비우고 은박 뚜껑을 떼어 플라스틱으로 내요.', src: ['rec_portal'], model: 'yogurt' },
    { id: 'can', name: '음료 캔', bin: 'can', prep: ['empty'],
      why: '음료 캔은 내용물을 비우고 캔·고철로 내요.', src: ['rec_can'], model: 'can' },
    { id: 'glass_bottle', name: '음료 유리병', bin: 'glass', prep: ['empty', 'rinse'], cant: ['flatten'],
      why: '음료 유리병은 비우고 헹궈서 유리병으로 내요.', src: ['rec_kwa'], model: 'glassBottle' },
    { id: 'broken_glass', name: '깨진 유리컵', bin: 'general', prep: [], trap: true, region: true, cant: ['flatten'],
      why: '깨진 유리컵은 유리병 수거함이 아니라 일반쓰레기(종량제·불연성)로 내요. 불연성 전용 봉투는 지역마다 달라요.', src: ['rec_portal', 'rec_kwa'], model: 'brokenGlass' },
    { id: 'box', name: '택배 골판지 상자 (송장·테이프)', bin: 'paper', prep: ['tape', 'flatten'],
      why: '택배 상자는 송장과 테이프를 떼고 납작하게 접어 종이로 내요.', src: ['rec_portal', 'rec_seoul'], model: 'box' },
    { id: 'milk_carton', name: '우유 종이팩', bin: 'carton', prep: ['empty', 'rinse', 'flatten'],
      why: '우유 종이팩은 일반 종이와 따로, 비우고 헹궈 납작하게 해서 종이팩으로 내요.', src: ['rec_portal', 'rec_kwa'], model: 'milkCarton' },
    { id: 'aseptic', name: '멸균팩 두유 (빨대·비닐)', bin: 'carton', prep: ['empty', 'parts'],
      why: '두유 같은 멸균팩도 종이팩으로 내요. 빨대와 비닐을 떼고 비워서요(일반팩·멸균팩은 함께 내도 돼요).', src: ['rec_kwa'], model: 'aseptic' },
    { id: 'chicken_paper', name: '치킨 상자 속 기름종이', bin: 'general', prep: [], trap: true,
      why: '기름이 밴 종이는 종이로 재활용되지 않아요. 일반쓰레기로 내요.', src: ['rec_portal'], model: 'oilPaper' },
    { id: 'ramen_cup', name: '컵라면 용기 (국물 자국)', bin: 'general', prep: [], trap: true,
      why: '씻어도 국물 자국 같은 이물질이 지워지지 않는 용기는 일반쓰레기로 내요.', src: ['rec_portal'], model: 'ramenCup',
      notes: { rinse: '헹궈도 국물 자국이 지워지지 않아요' } },
    { id: 'styro', name: '흰 스티로폼 완충재', bin: 'styro', prep: [],
      why: '흰 스티로폼 완충재는 스티로폼으로 내요. 색이나 무늬가 있어도 스티로폼이에요.', src: ['rec_kwa'], model: 'styroBlock' },
    { id: 'sashimi_tray', name: '회 포장 스티로폼 트레이', bin: 'styro', prep: ['empty', 'rinse'],
      why: '회 포장 스티로폼 트레이는 비우고 헹궈서 스티로폼으로 내요.', src: ['rec_kwa'], model: 'sashimiTray' },
    { id: 'woodlock', name: '우드락', bin: 'general', prep: [], trap: true,
      why: '우드락은 스티로폼처럼 보여도 일반쓰레기로 내요.', src: ['rec_kwa'], model: 'woodlock' },
    { id: 'snack_bag', name: '과자 봉지', bin: 'vinyl', prep: ['empty'],
      why: '과자 봉지는 재질·색에 상관없이 비닐로 내요. 안을 비워서요.', src: ['rec_kwa'], model: 'snackBag' },
    { id: 'foil_bubble', name: '은박 에어캡', bin: 'general', prep: [], trap: true,
      why: '은박이 붙은 에어캡은 비닐이 아니라 일반쓰레기로 내요.', src: ['rec_kwa'], model: 'foilBubble' },
    { id: 'ice_pack', name: '고흡수성 수지 아이스팩', bin: 'general', prep: [], trap: true,
      why: '고흡수성 수지(젤) 아이스팩은 일반쓰레기로 내요.', src: ['rec_portal'], model: 'icePack' },
    { id: 'toothbrush', name: '칫솔', bin: 'general', prep: [], trap: true,
      why: '칫솔은 플라스틱처럼 보여도 일반쓰레기로 내요.', src: ['rec_portal'], model: 'toothbrush' },
    { id: 'mayo', name: '씻어지지 않는 마요네즈 통', bin: 'general', prep: [], trap: true,
      why: '씻어지지 않는 마요네즈 통은 일반쓰레기로 내요.', src: ['rec_portal'], model: 'mayo',
      notes: { rinse: '헹궈도 안쪽 기름기가 남아요' } },
    { id: 'dirty_vinyl', name: '이물질 묻은 비닐', bin: 'general', prep: [], region: true,
      why: '이물질이 묻어 씻기 어려운 비닐은 일반쓰레기로 내요. 지역마다 기준이 다를 수 있어요.', src: ['rec_portal'], model: 'dirtyVinyl' },
    { id: 'takeout_cup', name: '일회용 투명 컵 (카페에서 들고 나온 것)', bin: 'plastic', prep: ['empty', 'rinse', 'parts'], fromCafe: true,
      why: '일회용 투명 컵은 남은 음료를 비우고 헹군 뒤 빨대·뚜껑을 떼어 플라스틱으로 내요.', src: ['rec_takeout'], model: 'takeoutCup' },
    // 다른 품목에서 생기는 것(spawns)
    { id: 'pet_label', name: '떼어 낸 페트병 라벨', bin: 'vinyl', prep: [], spawnOnly: true,
      why: '떼어 낸 페트병 라벨은 비닐로 내요.', src: ['rec_portal', 'rec_kwa'], model: 'label' },
  ];

  // 지역 기준 (마스터 D14). 기본 'common'. 학습지 [과제] '분리배출 지역 기준'에서 고르면 해당 품목의 칸을 덮어쓴다
  const REGION_RULES = {
    common: {},
    seoul: { dirty_vinyl: { bin: 'vinyl', prep: ['empty'], why: '서울시는 이물질이 묻은 비닐도 내용물을 비우면 비닐로 배출해요(2024).', src: ['rec_seoul'] } },
  };
  const REGION_LABEL = { common: '공통 기준', seoul: '서울시 기준' };

  // ── 순수 계산 (DOM 없음 — node 검사) ─────────────────────────────────────
  const byId = Object.fromEntries(RECYCLE_ITEMS.map(it => [it.id, it]));
  // 지역 기준을 덮어쓴 품목 사본
  function itemFor(id, region = 'common') {
    const base = byId[id];
    if (!base) return null;
    const over = (REGION_RULES[region] || {})[id];
    return over ? { ...base, ...over, regionApplied: region } : { ...base };
  }
  // 결정적 난수(같은 seed = 같은 판 — 사진 자세·검사용). seed 가 없으면 Math.random
  function rngOf(seed) {
    if (seed == null) return Math.random;
    let s = (seed >>> 0) || 1;
    return () => { s = (Math.imul(s ^ (s >>> 15), 0x2c1b3c6d) + 0x6d2b79f5) >>> 0; s ^= s >>> 13; return (s >>> 0) / 4294967296; };
  }
  function shuffle(a, rnd) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  // 한 판 만들기: 품목 10개, 중복 없음, 함정 ≥ 3. 카페에서 일회용 컵을 들고 나왔으면(carry 에 'takeout_cup') 그 컵이 첫 품목
  function makeRound(opts = {}) {
    const rnd = typeof opts.rng === 'function' ? opts.rng : rngOf(opts.seed);
    const carry = (Array.isArray(opts.carry) ? opts.carry : []).filter(id => byId[id] && byId[id].fromCafe);
    const first = carry.length ? [carry[0]] : [];
    const pool = RECYCLE_ITEMS.filter(it => !it.spawnOnly && !it.fromCafe && !first.includes(it.id));
    const traps = shuffle(pool.filter(it => it.trap).map(it => it.id), rnd);
    const plain = shuffle(pool.filter(it => !it.trap).map(it => it.id), rnd);
    const n = ROUND_SIZE - first.length;
    const nTrap = Math.min(traps.length, TRAP_MIN + Math.floor(rnd() * 3));   // 3~5개 — 매번 섞이게
    const pick = traps.slice(0, nTrap).concat(plain.slice(0, n - nTrap));
    for (const id of traps.slice(nTrap)) if (pick.length < n) pick.push(id);   // 보통 품목이 모자라면 함정으로 채운다
    return first.concat(shuffle(pick, rnd)).slice(0, ROUND_SIZE);
  }
  // 판정: 수거함이 맞으면 1, 맞는데 준비가 빠지면 0.5, 틀리면 0 (M §3-4)
  function judge(item, bin, done = []) {
    const binOk = !!item && bin === item.bin;
    const missing = binOk ? (item.prep || []).filter(p => !done.includes(p)) : [];
    return { binOk, missing, score: binOk ? (missing.length ? 0.5 : 1) : 0 };
  }
  // 준비가 빠졌을 때의 한 줄. 라벨은 지시서 문장(M §3-4), 나머지는 문헌값 1-8 문장의 방향(선별 과정에서 잔재물)
  function missingText(missing) {
    if (!missing || !missing.length) return '';
    if (missing.includes('label')) return '라벨을 떼지 않았어요 — 선별장에서 골라내야 해요';
    return `'${missing.map(p => RECYCLE_PREP[p]).join(' · ')}' 단계를 빠뜨렸어요 — 제대로 준비하지 않은 재활용품은 선별 과정에서 잔재물로 분류될 수 있어요`;
  }
  // 정확도 = 첫 시도 점수 합 ÷ 10 (딸려 나온 품목 — 떼어 낸 라벨 — 은 표에는 남기되 나누기에는 넣지 않는다)
  function accuracy(rows) {
    const main = (rows || []).filter(r => !r.spawned);
    const sum = main.reduce((s, r) => s + (Number(r.score) || 0), 0);
    return Math.max(0, Math.min(1, sum / ROUND_SIZE));
  }
  // 분리배출 감축량 = 안내서 88 kg × 정확도(등록부 recycle_accuracy — 비례식은 연출). 88 은 ActionsCore 값 그대로
  function kgPerYear() {
    try { return ActionsCore.ACTIONS.find(a => a.id === 'recycle').kgPerYear; } catch (e) { return NaN; }
  }
  const kgFor = acc => kgPerYear() * Math.max(0, Math.min(1, Number(acc) || 0));

  return { RECYCLE_BINS, BIN_INFO, RECYCLE_PREP, PREP_ORDER, RECYCLE_ITEMS, REGION_RULES, REGION_LABEL, ROUND_SIZE, TRAP_MIN,
    itemFor, makeRound, judge, missingText, accuracy, kgPerYear, kgFor, rngOf };
})();
