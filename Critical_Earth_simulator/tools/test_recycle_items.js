// ============================================================================
// 분리배출 품목 검사 (4차 M3) - firstperson/fp-recycle-items.js · firstperson/fp-stage-recycle.js
// ----------------------------------------------------------------------------
// M §5-2: 모든 품목의 bin·prep·spawns 가 정의된 값인가, src 가 등록부에 있는가, why 가 비어 있지 않은가,
//   판 만들기 1,000번에서 함정 품목 ≥ 3·중복 없음, 정확도 → kg 계산.
// 그 밖에: 문헌값 5부 표(docs/refs/4차_문헌값.md)의 품목·수거함·함정·지역 표시와 데이터가 같은가(표에서 직접 읽는다 —
//   숫자를 이 파일에 옮겨 적으면 문헌값이 고쳐졌을 때 모르고 지나간다), 카페에서 들고 나온 컵이 첫 품목인가,
//   지역 기준(서울)이 덮어쓰는가, 모든 품목 모양이 무대 파일에 있는가·꼭 해야 하는 준비를 그 모양으로 할 수 있는가,
//   로드 순서(index.html · 빌더 FP_JS), 실존 브랜드·효과음 없음, 행동 kg 숫자를 직접 적지 않음.
// 실행: node tools/test_recycle_items.js      (실패하면 종료 코드 1)
// ============================================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

const ctx = vm.createContext({ console: { log() {}, warn() {}, error: console.error }, Math, Promise, setTimeout });
for (const f of ['vendor/three.min.js', 'js/actions-core.js', 'firstperson/fp-stage-kit.js', 'firstperson/fp-stage.js',
  'firstperson/fp-recycle-items.js', 'firstperson/fp-stage-recycle.js']) vm.runInContext(read(f), ctx, { filename: f });
const RI = vm.runInContext('RecycleItems', ctx);
const SR = vm.runInContext('FPStageRecycle', ctx);
const S = vm.runInContext('FPStage', ctx);
const AC = vm.runInContext('ActionsCore', ctx);
const { SOURCES } = require(path.join(ROOT, 'js', 'sources.js'));

let fails = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
}
const items = RI.RECYCLE_ITEMS;
const bad = (list, f) => list.filter(f).map(it => it.id).join(', ');

// ── 1. 품목 데이터 모양 (M §5-2) ────────────────────────────────────────────
check('수거함 9개 (M §3-2 순서: 투명 페트병 · 플라스틱 · 비닐 · 캔·고철 · 유리병 · 종이 · 종이팩 · 스티로폼 · 일반)',
  JSON.stringify(RI.RECYCLE_BINS) === JSON.stringify(['pet', 'plastic', 'vinyl', 'can', 'glass', 'paper', 'carton', 'styro', 'general']));
check('수거함마다 이름·그림 기호·색 (색만으로 구분하지 않음)', RI.RECYCLE_BINS.every(b => RI.BIN_INFO[b] && RI.BIN_INFO[b].name && RI.BIN_INFO[b].icon && /^#[0-9a-f]{6}$/i.test(RI.BIN_INFO[b].color)));
check('준비 6가지 (비우기 · 헹구기 · 라벨 떼기 · 부속 떼기 · 눌러 납작하게 · 송장·테이프 떼기)',
  JSON.stringify(RI.PREP_ORDER) === JSON.stringify(['empty', 'rinse', 'label', 'parts', 'flatten', 'tape']) && RI.PREP_ORDER.every(k => RI.RECYCLE_PREP[k]));
check('id 가 겹치지 않음', new Set(items.map(it => it.id)).size === items.length);
check('모든 품목의 bin 이 정의된 수거함', items.every(it => RI.RECYCLE_BINS.includes(it.bin)), bad(items, it => !RI.RECYCLE_BINS.includes(it.bin)));
check('모든 품목의 prep 이 정의된 준비(배열, 중복 없음)', items.every(it => Array.isArray(it.prep) && it.prep.every(p => RI.RECYCLE_PREP[p]) && new Set(it.prep).size === it.prep.length),
  bad(items, it => !Array.isArray(it.prep) || !it.prep.every(p => RI.RECYCLE_PREP[p])));
check('spawns: 키는 준비, 값은 있는 품목(spawnOnly)', items.every(it => !it.spawns || Object.entries(it.spawns).every(([k, v]) => RI.RECYCLE_PREP[k] && items.some(x => x.id === v && x.spawnOnly))),
  bad(items, it => it.spawns && !Object.entries(it.spawns).every(([k, v]) => RI.RECYCLE_PREP[k] && items.some(x => x.id === v))));
check('spawns 의 준비는 그 품목이 꼭 해야 하는 준비(라벨 떼기 → 떼어 낸 라벨)', items.every(it => !it.spawns || Object.keys(it.spawns).every(k => it.prep.includes(k))));
check('cant(할 수 없는 준비)는 정의된 준비이고 꼭 해야 하는 준비와 겹치지 않음', items.every(it => !it.cant || it.cant.every(p => RI.RECYCLE_PREP[p] && !it.prep.includes(p))));
check('notes 키는 정의된 준비', items.every(it => !it.notes || Object.keys(it.notes).every(p => RI.RECYCLE_PREP[p])));
check('why 가 비어 있지 않음 (8자 이상)', items.every(it => typeof it.why === 'string' && it.why.trim().length >= 8), bad(items, it => !it.why || it.why.trim().length < 8));
check('name 이 비어 있지 않음', items.every(it => typeof it.name === 'string' && it.name.trim()));
check('src 가 등록부에 있음 (키 목록, 1개 이상)', items.every(it => Array.isArray(it.src) && it.src.length && it.src.every(k => k in SOURCES)),
  bad(items, it => !Array.isArray(it.src) || !it.src.every(k => k in SOURCES)));
check('원문 확인 필요 품목(can · takeout_cup)은 unverified 출처(문헌값 4부-12·13)', ['can', 'takeout_cup'].every(id => items.find(x => x.id === id).src.every(k => SOURCES[k].status === 'unverified')));
check('등록부: rec_kwa·rec_seoul 원문(verified), rec_portal 2차(unverified), recycle_accuracy 연출(assumption), 4원칙 rec_rules4 unverified',
  SOURCES.rec_kwa.status === 'verified' && SOURCES.rec_seoul.status === 'verified' && SOURCES.rec_portal.status === 'unverified'
  && SOURCES.recycle_accuracy.kind === 'assumption' && SOURCES.rec_rules4.status === 'unverified');

// ── 2. 문헌값 5부 표와 같은가 ──────────────────────────────────────────────
{
  const lit = read('docs/refs/4차_문헌값.md');
  const part = lit.slice(lit.indexOf('## 5부'), lit.indexOf('## 6부'));
  const BIN_WORD = { '투명 페트병': 'pet', '플라스틱': 'plastic', '비닐': 'vinyl', '캔·고철': 'can', '유리병': 'glass', '종이': 'paper', '종이팩': 'carton', '스티로폼': 'styro', '일반': 'general' };
  const rows = [...part.matchAll(/^\| `(\w+)` \| ([^|]+)\| ([^|]+)\| ([^|]+)\| ([^|]+)\| ([^|]*)\|$/gm)].map(m => ({
    id: m[1], bin: m[3].replace(/\*/g, '').trim(), prep: m[4].trim(), memo: m[6].trim() }));
  const binOf = s => { const w = s.split('/')[0].replace(/\(.*\)/, '').trim(); return BIN_WORD[w] || BIN_WORD[w.replace(/\s.*$/, '')]; };
  check(`문헌값 5부 표 품목 ${rows.length}개가 데이터에 모두 있음`, rows.length >= 20 && rows.every(r => items.some(it => it.id === r.id)), rows.filter(r => !items.some(it => it.id === r.id)).map(r => r.id).join(', '));
  const mism = rows.filter(r => { const it = items.find(x => x.id === r.id); return !it || it.bin !== binOf(r.bin); });
  check('수거함(공통 기준)이 표와 같음', mism.length === 0, mism.map(r => `${r.id}: 표 ${r.bin} / 데이터 ${(items.find(x => x.id === r.id) || {}).bin}`).join('; '));
  const PW = { '비우기': 'empty', '헹구기': 'rinse', '라벨 떼기': 'label', '부속 떼기': 'parts', '납작하게': 'flatten', '송장·테이프 떼기': 'tape' };
  const prepOf = s => (s === '—' || /^\(/.test(s) ? [] : s.replace('송장·테이프', '송장/테이프').split('·').map(x => x.replace('송장/테이프', '송장·테이프')).map(x => x.replace(/\(.*?\)/g, '').trim()).map(w => PW[w] || PW[Object.keys(PW).find(k => w.startsWith(k))]).filter(Boolean));
  const pm = rows.filter(r => { const it = items.find(x => x.id === r.id); return it && JSON.stringify(prepOf(r.prep).sort()) !== JSON.stringify(it.prep.slice().sort()); });
  check('준비(공통 기준)가 표와 같음', pm.length === 0, pm.map(r => `${r.id}: 표 ${prepOf(r.prep)} / 데이터 ${items.find(x => x.id === r.id).prep}`).join('; '));
  const trapIds = rows.filter(r => /함정/.test(r.memo)).map(r => r.id);
  check(`함정 표시가 표와 같음 (${trapIds.length}개)`, trapIds.length >= 6 && items.filter(it => it.trap).map(it => it.id).sort().join() === trapIds.sort().join(),
    `표 ${trapIds.join(',')} / 데이터 ${items.filter(it => it.trap).map(it => it.id).join(',')}`);
  const regIds = rows.filter(r => /region: true/.test(r.memo)).map(r => r.id);
  check('지역 배지(region: true)가 표와 같음 (broken_glass · dirty_vinyl)', items.filter(it => it.region).map(it => it.id).sort().join() === regIds.sort().join(), regIds.join(','));
  check('함정 품목에 지시서 예시 6개(간장 페트·기름종이·컵라면·아이스팩·은박 에어캡·깨진 유리컵) 포함', ['soy_pet', 'chicken_paper', 'ramen_cup', 'ice_pack', 'foil_bubble', 'broken_glass'].every(id => items.find(x => x.id === id).trap));
}

// ── 3. 지역 기준 (마스터 D14) ───────────────────────────────────────────────
{
  check('REGION_RULES: common = 빈 덮어쓰기, 모든 지역 키가 품목·수거함·준비·출처로 유효', Object.keys(RI.REGION_RULES.common).length === 0
    && Object.values(RI.REGION_RULES).every(rules => Object.entries(rules).every(([id, o]) => items.some(it => it.id === id)
      && (!o.bin || RI.RECYCLE_BINS.includes(o.bin)) && (!o.prep || o.prep.every(p => RI.RECYCLE_PREP[p])) && (!o.src || o.src.every(k => k in SOURCES)) && (!o.why || o.why.trim()))));
  const c = RI.itemFor('dirty_vinyl', 'common'), s = RI.itemFor('dirty_vinyl', 'seoul');
  check('이물질 묻은 비닐: 공통 = 일반, 서울 = 비우면 비닐(rec_seoul)', c.bin === 'general' && c.prep.length === 0 && s.bin === 'vinyl' && s.prep.join() === 'empty' && s.src.join() === 'rec_seoul' && s.region === true);
  check('덮어쓰기는 사본 — 원래 데이터는 그대로', RI.RECYCLE_ITEMS.find(it => it.id === 'dirty_vinyl').bin === 'general' && RI.itemFor('water_pet', 'seoul').bin === 'pet');
  check('지역 이름표', RI.REGION_LABEL.common && RI.REGION_LABEL.seoul && Object.keys(RI.REGION_RULES).every(k => RI.REGION_LABEL[k]));
}

// ── 4. 판 만들기 1,000번 ──────────────────────────────────────────────────
{
  let minTrap = 99, dup = 0, size = 0, noSpawn = 0, noCafe = 0, varied = new Set(), firstCup = 0;
  const trap = new Set(items.filter(it => it.trap).map(it => it.id));
  for (let i = 0; i < 1000; i++) {
    const withCup = i % 2 === 1;
    const r = RI.makeRound({ seed: i + 1, carry: withCup ? ['takeout_cup'] : [] });
    if (r.length !== RI.ROUND_SIZE) size++;
    if (new Set(r).size !== r.length) dup++;
    minTrap = Math.min(minTrap, r.filter(id => trap.has(id)).length);
    if (r.some(id => items.find(x => x.id === id).spawnOnly)) noSpawn++;
    if (!withCup && r.includes('takeout_cup')) noCafe++;
    if (withCup && r[0] === 'takeout_cup' && r.indexOf('takeout_cup', 1) < 0) firstCup++;
    varied.add(r.join());
  }
  check('1,000판: 모두 10개', size === 0, `${size}판 어긋남`);
  check('1,000판: 중복 품목 없음', dup === 0, `${dup}판`);
  check(`1,000판: 함정 품목 ≥ ${RI.TRAP_MIN} (최소 ${minTrap})`, minTrap >= 3);
  check('1,000판: 딸린 품목(떼어 낸 라벨)은 판에 직접 나오지 않음', noSpawn === 0);
  check('카페 컵(fromCafe)은 들고 나왔을 때만 — 그때는 첫 품목', noCafe === 0 && firstCup === 500, `없을 때 나옴 ${noCafe} · 첫 품목 ${firstCup}/500`);
  check('판마다 섞임 (1,000판 중 서로 다른 판 ≥ 990)', varied.size >= 990, `${varied.size}`);
  check('같은 seed = 같은 판 (사진 자세가 같은 화면)', RI.makeRound({ seed: 7 }).join() === RI.makeRound({ seed: 7 }).join());
  check('carry 에 다른 것이 있어도 무시(카페 컵만)', RI.makeRound({ seed: 3, carry: ['water_pet', 'nope'] }).length === 10 && !RI.makeRound({ seed: 3, carry: ['nope'] }).includes('nope'));
}

// ── 5. 판정 · 정확도 → kg ─────────────────────────────────────────────────
{
  const w = RI.itemFor('water_pet');
  const j1 = RI.judge(w, 'pet', ['empty', 'label', 'flatten']), j2 = RI.judge(w, 'pet', ['empty', 'flatten']), j3 = RI.judge(w, 'plastic', ['empty', 'label', 'flatten']);
  check('판정: 수거함 + 준비 다 = 1 · 준비 빠짐 = 0.5 · 수거함 틀림 = 0', j1.score === 1 && j2.score === 0.5 && j2.missing.join() === 'label' && j3.score === 0 && !j3.binOk);
  check('준비가 없는 품목은 넣기만 맞으면 1 (필요 없는 준비를 해도 감점 없음)', RI.judge(RI.itemFor('toothbrush'), 'general', ['rinse', 'flatten']).score === 1);
  check('라벨을 안 떼면 지시서 문장 "라벨을 떼지 않았어요 — 선별장에서 골라내야 해요"', RI.missingText(['label']) === '라벨을 떼지 않았어요 — 선별장에서 골라내야 해요' && RI.missingText(['rinse']).includes('헹구기'));
  const rows = [1, 1, 0.5, 0, 1, 1, 0.5, 1, 0, 1].map((s, i) => ({ score: s, spawned: false, id: 'x' + i }));
  const acc = RI.accuracy(rows);
  check('정확도 = 첫 시도 점수 합 ÷ 10 (7 / 10 = 0.7)', Math.abs(acc - 0.7) < 1e-12, String(acc));
  check('딸린 품목(떼어 낸 라벨)은 정확도에 넣지 않음', Math.abs(RI.accuracy([...rows, { score: 1, spawned: true }]) - 0.7) < 1e-12);
  check('덜 끝난 판은 남은 것을 0 으로 (÷ 10 고정)', Math.abs(RI.accuracy(rows.slice(0, 5)) - 0.35) < 1e-12);
  const K = AC.ACTIONS.find(a => a.id === 'recycle').kgPerYear;
  check('kg = ActionsCore 분리배출 88 kg × 정확도 (0.7 → 61.6 kg, 1 → 88, 0 → 0, 범위 밖은 자름)', K === 88 && Math.abs(RI.kgFor(0.7) - 61.6) < 1e-9 && RI.kgFor(1) === 88 && RI.kgFor(0) === 0 && RI.kgFor(1.5) === 88 && RI.kgFor(-1) === 0 && RI.kgPerYear() === K,
    `${RI.kgFor(0.7)}`);
  check('FPActions 정확도 규칙과 같은 식 (88 × 정확도) — fp-actions recycleAccuracy 와 같은 이름 accuracy', /accuracy/.test(code('firstperson/fp-actions.js')) && /kgPerYear \* recycleAccuracy/.test(code('firstperson/fp-actions.js')));
  check('품목 파일·무대 파일에 88 을 직접 적지 않음 (ActionsCore 에서만)', !/(?<![\d.#x])88(?![\d])/.test(code('firstperson/fp-recycle-items.js')) && !/(?<![\d.#x])88(?![\d])/.test(code('firstperson/fp-stage-recycle.js')));
}

// ── 6. 무대: 모양 · 할 수 있는 준비 ───────────────────────────────────────
{
  const src = code('firstperson/fp-stage-recycle.js'), raw = read('firstperson/fp-stage-recycle.js');
  const modelsBlock = (src.match(/const MODELS = \{([\s\S]*?)\n    \};/) || [, ''])[1];
  const defined = [...modelsBlock.matchAll(/^      (\w+)\(o\) \{/gm)].map(m => m[1]);
  check('모든 품목의 model 이 무대 MODELS 에 있음', items.every(it => defined.includes(it.model)), items.filter(it => !defined.includes(it.model)).map(it => it.model).join(', '));
  check('MODEL_HAS(준비 가능 부속) 목록 = MODELS 목록', SR.MODEL_NAMES.slice().sort().join() === defined.slice().sort().join(), `${SR.MODEL_NAMES.length} / ${defined.length}`);
  const cannot = [];
  for (const it of items) for (const p of it.prep) if (!SR.canDo(it, p)) cannot.push(`${it.id}:${p}`);
  check('꼭 해야 하는 준비는 그 모양으로 할 수 있음 (라벨 → 라벨 띠, 부속 → 부속, 송장 → 테이프)', cannot.length === 0, cannot.join(', '));
  check('할 수 없는 준비 → \'이 품목은 할 수 없어요\' (유리병 납작하게)', !SR.canDo(RI.itemFor('glass_bottle'), 'flatten') && /^이 품목은 할 수 없어요/.test(SR.cantText('flatten')) && !SR.canDo(RI.itemFor('soy_pet'), 'label'));
  check('준비 단추 6개는 늘 다 보임 (정답을 알려 주지 않게) — PREP_ORDER 로 그림', /RI\.PREP_ORDER\.map\(k => `<button[^`]*data-prep=/.test(src));
  check('무대 등록 \'recycle\' · 이름 \'분리배출장\' · 노출 1.1 (M §1-3)', S.registered.includes('recycle') && SR.TITLE === '분리배출장' && /title: TITLE, exposure: 1\.1/.test(src));
  check('사진 자세 5개: wide · bench · label(시간 고정) · throw(시간 고정) · summary (M §3-6)', ['wide', 'bench', 'label', 'throw', 'summary'].every(k => new RegExp(`\\b${k}: \\{ pos:`).test(src))
    && /label: \{[^}]*freeze: true/.test(src) && /throw: \{[^}]*freeze: true/.test(src));
  check('사진 자세 판은 고정 판(함정 ≥ 3, 10개, 중복 없음)', SR.FIXED_ROUND.length === 10 && new Set(SR.FIXED_ROUND).size === 10 && SR.FIXED_ROUND.filter(id => RI.itemFor(id).trap).length >= 3
    && SR.FIXED_ROUND.every(id => RI.itemFor(id)));
  check('판정 피드백: 색 + 기호(✔ ✕) + 움직임(튕겨 나옴·흔들림·뚜껑) + 문구(맞아요·이유) (Q8)', /'✕' : '✔'/.test(src) && /'맞아요'/.test(src) && /flashRing\(bin/.test(src) && /rotation: \[0, 0, a\]/.test(src) && /bin\.lidTo = 0/.test(src));
  check('틀리면 [다시 넣기], 점수는 첫 시도 기준 (다시 넣기는 기록만)', /data-again>다시 넣기/.test(src) && /if \(first\) \{/.test(src) && /row\.tries\.push\(binId\)/.test(src));
  check('지역 품목 배지 문구 (M §3-4-5)', raw.includes('지역마다 기준이 다를 수 있어요 — 우리 동네 기준 확인하기(내 손안의 분리배출 앱)'));
  check('끝 화면: 표(품목 · 내가 고른 곳 · 정답 · 준비 · 맞음 · 이유) · 틀린 것만 보기 · [한 판 더] [나가기] 1.5초 뒤 활성 (M §0-1·§3-5)',
    ['품목', '내가 고른 곳', '정답', '준비', '맞음', '이유'].every(h => raw.includes(`<th scope="col">${h}</th>`)) && raw.includes('틀린 것만 보기') && /data-again disabled>한 판 더/.test(raw)
    && /data-leave disabled>나가기/.test(raw) && /\}, 1500\)/.test(src));
  const rows = SR.compareRows(44), A = id => AC.ACTIONS.find(a => a.id === id).kgPerYear;
  check('크기 막대: 이번 판 kg · 대중교통 285.4 · 비행 1,000 (ActionsCore 값 그대로)', rows.length === 3 && rows[0].kg === 44 && rows[1].kg === A('transit') && rows[2].kg === A('flight') && rows[0].src === 'recycle_accuracy');
  check('끝 화면 ⓘ: recycle_accuracy · act_recycle, 판정 ⓘ = 품목 src', /srcButton\('recycle_accuracy'\)/.test(src) && /srcButton\('act_recycle'\)/.test(src) && /srcs\(it\.src\)/.test(src));
  check('벽 안내판 4원칙 문구 + ⓘ rec_rules4 (환경부 원문 표기 확인 중)', /'비우기', '헹구기', '분리하기', '섞지 않기'/.test(src) && /srcButton\('rec_rules4'\)/.test(src));
  check('카페 컵 연결: fp.actions.carry 의 takeout_cup 을 첫 품목으로 쓰고 지움 (카페 쪽 키와 같음)', /'takeout_cup'/.test(code('firstperson/fp-stage-cafe.js')) && /a\.carry = \(Array\.isArray\(a\.carry\) \? a\.carry : \[\]\)\.filter\(x => x !== 'takeout_cup'\)/.test(src));
  check('키보드: 숫자 1~9(e.code) · 수거함 Tab+Enter(pick) · 화살표로 돌려 보기', /\(\?:Digit\|Numpad\)\(\[1-9\]\)/.test(src) && /userData\.pick = \{ label: `\$\{i \+ 1\} \$\{info\.name\}`/.test(src) && /ArrowLeft/.test(src));
  check('끌어서 넣기: 수거함 위면 뚜껑이 살짝(0.35), 넣을 때 활짝 · 끈 뒤 click 이 또 누르지 않게', /over\.lidTo = 0\.35/.test(src) && /bin\.lidTo = 1\.25/.test(src) && /noClickUntil = performance\.now\(\) \+ 250/.test(src));
  check('움직임 줄이기: 시간표 0.1초 (kit 이동은 kit 이 0.1초로)', /const D = s => \(ctx\.reducedMotion \? Math\.min\(s, 0\.1\) : s\)/.test(src));
  check('M4 연결: lastResult · onRound, 판이 끝나면 FPActions.recordRecycle (사진 자세에서는 안 부름)', /get lastResult\(\)/.test(src) && /onRound: fn =>/.test(src)
    && /roundListeners\.push\(r => \{ if \(typeof FPActions !== 'undefined' && FPActions\.recordRecycle\) FPActions\.recordRecycle\(r\); \}\)/.test(src) && /if \(!ctx\.shotMode\) for \(const fn of listeners\)/.test(src));
  check('세계 쪽: 입구 addDoor(현재만) · 2000년 도시 규모부터 · 지붕은 transmission 아님', /FPStage\.addDoor\(\{\s*id: 'recycle'/.test(src) && /FPScenario\.year === NOW\(\) \? true : `현재\(\$\{NOW\(\)\}\)로 가야 들어갈 수 있어요`/.test(src)
    && /cityState\.level >= LEVEL_2000/.test(src) && !/transmission/.test(src.slice(src.indexOf('function world'), src.indexOf('PRINT = {'))));
  {
    // 세계 자리: 큰길·교차로·건물·행동 지점·충전소·카페 화분과 겹치지 않음
    const P = SR.SPOT, x0 = P.x - P.dep / 2, x1 = P.x + P.dep / 2, z0 = P.z - P.len / 2, z1 = P.z + P.len / 2;
    const defs = (read('firstperson/fp-world.js').match(/const bldDefs = \[([\s\S]*?)\n  \];/) || [, ''])[1].match(/\[[^\[\]]+\]/g).map(t => JSON.parse(t));
    const hitB = defs.filter(([bx, bz, w]) => x0 < bx + w / 2 && x1 > bx - w / 2 && z0 < bz + w / 2 && z1 > bz - w / 2);
    const road = (z0 < -0.01 + 0.06 && z1 > -0.01 - 0.06) || (x0 < 0.09 + 0.06 && x1 > 0.09 - 0.06);
    const pts = [[-0.52, 0.105], [-0.80, -0.115], [-0.32, -0.112], [0.30, -0.125], [-0.75, 0.085], [-0.30, 0.085], [0.30, 0.085], [0.78, 0.085]];
    const nearPt = pts.filter(([x, z]) => x > x0 - 0.03 && x < x1 + 0.03 && z > z0 - 0.03 && z < z1 + 0.03);
    check('세계 자리: 건물·큰길·교차로·행동 지점·충전소와 겹치지 않음', !hitB.length && !road && !nearPt.length, `${hitB.length} ${road} ${nearPt.length}`);
  }
  check('Q1: 무대 파일에 BoxGeometry 0', !/BoxGeometry/.test(src));
  check('실존 브랜드 이름 없음 (M §0-2)', !/삼다수|아이시스|백산수|코카|펩시|칠성|오뚜기|농심|신라면|빙그레|매일|서울우유|베지밀|포카칩|새우깡|해표|샘표|몽고|요플레|야쿠르트|하이트|카스|참이슬/i.test(raw));
  check('효과음 없음 (D12)', !/\bAudio\b|AudioContext/.test(src));
}

// ── 7. 화면 연결 · 로드 순서 ──────────────────────────────────────────────
{
  const html = read('firstperson/index.html');
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
  const iC = srcs.indexOf('fp-stage-cafe.js'), iI = srcs.indexOf('fp-recycle-items.js'), iR = srcs.indexOf('fp-stage-recycle.js'), iM = srcs.indexOf('fp-main.js');
  check('index.html: fp-stage-cafe → fp-recycle-items → fp-stage-recycle → fp-main', iC >= 0 && iI === iC + 1 && iR === iI + 1 && iM === iR + 1, `${iC} ${iI} ${iR} ${iM}`);
  const b = (read('tools/build_single_html.py').match(/FP_JS = \[([\s\S]*?)\]/) || [, ''])[1];
  check('빌더 FP_JS 같은 순서', /"firstperson\/fp-stage-cafe\.js",\s*"firstperson\/fp-recycle-items\.js", "firstperson\/fp-stage-recycle\.js", "firstperson\/fp-main\.js"/.test(b));
  check('학습지 [과제] 분리배출 지역 기준(공통 · 서울) 단추', html.includes('data-recycle-region="common"') && html.includes('data-recycle-region="seoul"'));
  check('CSS: 분리배출 겹침(.rc-panel · .rc-feed 맞음/반점/틀림 · .rc-card)', ['.rc-panel', '.rc-feed.is-ok', '.rc-feed.is-half', '.rc-feed.is-bad', '.rc-card', '.rc-table'].every(s => read('firstperson/style.css').includes(s)));
  check('check_sources 가 품목 파일의 src 목록을 훑음', /ITEMS_FILE/.test(read('tools/check_sources.js')));
  check('모듈을 읽을 때 DOM·THREE 를 건드리지 않음 (node 에서 읽힘)', typeof RI.makeRound === 'function' && SR.live === null);
}

console.log(fails ? `\n${fails}개 실패` : '\n전부 통과');
process.exit(fails ? 1 : 0);
