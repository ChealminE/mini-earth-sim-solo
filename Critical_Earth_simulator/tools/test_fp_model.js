// ============================================================================
// 1인칭 값 계산 검사 (4차 C) - firstperson/fp-model.js
// ----------------------------------------------------------------------------
// 마스터 §5-10 '같은 해 같은 값': 1인칭의 배경 CO₂·기온 편차·개방 해역 수온·pH·Ω가
// 같은 연도·같은 경로의 조감 엔진 값과 같아야 한다. 화면(헤드리스 rAF 4 FPS)으로는 믿고 잴 수 없어서
// 엔진과 FPModel 을 브라우저와 같은 순서로 vm 에 불러 숫자로 비교한다.
// 조감 쪽 값은 tab-future.js computeHuman() 과 같은 방식(1750~2200, annotateCumFossil)으로 따로 굴린다.
// C2~C4에서 지점 값(airTemp·seaTemp·zoneCO2·seaState) 검사를 이 파일에 더한다(TASK_4차_C_모델정렬.md §6).
// 실행: node tools/test_fp_model.js      (실패하면 종료 코드 1)
// ============================================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 1인칭 index.html 과 같은 순서(fp-world 앞까지). module 이 없는 컨텍스트라 브라우저처럼 전역으로만 남는다.
const LOAD = ['js/earth-model.js', 'js/earth-data.js', 'js/earth-system.js', 'js/earth-visual.js', 'firstperson/fp-model.js'];
const ctx = vm.createContext({ console, Math });
for (const f of LOAD) vm.runInContext(read(f), ctx, { filename: f });
const ES = vm.runInContext('EarthSystem', ctx);
const V = vm.runInContext('EarthVisual', ctx);
const FM = vm.runInContext('FPModel', ctx);

let fails = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
}

// ── 0. 모듈 모양 · 로드 순서 · 계산은 한 곳 ──────────────────────────────────
check('NOW_YEAR = 2026 (마스터 D6)', FM.NOW_YEAR === 2026, `${FM.NOW_YEAR}`);
{
  // 조감 미래 예측의 시간축과 같아야 같은 해를 비교할 수 있다
  const src = read('js/tab-future.js');
  const m = src.match(/const TL_START = (\d+), TL_END = (\d+);/);
  check('시간축 = 조감 미래 예측 TL_START~TL_END', m && +m[1] === FM.YEAR_MIN && +m[2] === FM.YEAR_MAX,
    m ? `조감 ${m[1]}~${m[2]} · 1인칭 ${FM.YEAR_MIN}~${FM.YEAR_MAX}` : 'tab-future.js 에서 TL_START 를 못 찾음');
}
{
  // DOM·three.js 없음 — node에서 검사할 수 있어야 한다(주석은 빼고 코드만 본다)
  const code = read('firstperson/fp-model.js').replace(/\/\/.*$/gm, '');
  check('fp-model.js 는 순수 계산 (document·window·THREE·FPWorld 없음)', !/\b(document|window|THREE|FPWorld|FPTools|FPAir)\b/.test(code));
}
{
  // 1인칭 다른 파일이 엔진 궤적을 직접 만들면 두 곳에서 값이 갈라질 수 있다
  const dir = path.join(ROOT, 'firstperson');
  const bad = fs.readdirSync(dir).filter(f => f.endsWith('.js') && f !== 'fp-model.js')
    .filter(f => /EarthSystem\.(run|presetEmissions|leverEmissions)\s*\(/.test(fs.readFileSync(path.join(dir, f), 'utf8')));
  check('엔진 궤적은 fp-model.js 에서만 만든다', bad.length === 0, bad.join(', '));
}
{
  const html = read('firstperson/index.html');
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1].split('?')[0].replace(/^\//, ''));
  const order = ['js/earth-model.js', 'js/earth-data.js', 'js/earth-system.js', 'js/earth-visual.js', 'fp-model.js', 'fp-world.js'];
  const idx = order.map(s => srcs.indexOf(s));
  check('1인칭 index.html 로드 순서: earth-system → earth-visual → fp-model → fp-world',
    idx.every(i => i >= 0) && idx.every((v, i) => i === 0 || v > idx[i - 1]), idx.join(' < '));
  const b = read('tools/build_single_html.py').match(/FP_JS = \[([\s\S]*?)\]/);
  const list = b ? [...b[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : [];
  const bi = ['js/earth-system.js', 'js/earth-visual.js', 'firstperson/fp-model.js', 'firstperson/fp-world.js'].map(s => list.indexOf(s));
  check('빌더 FP_JS 에도 같은 순서', bi.every(i => i >= 0) && bi.every((v, i) => i === 0 || v > bi[i - 1]), bi.join(' < '));
}

// ── 1. 같은 해 같은 값 (§6-1) ──────────────────────────────────────────────
// 조감 쪽: tab-future.js computeHuman() 과 같은 호출을 FPModel 을 거치지 않고 따로 한다
const aerial = fn => V.annotateCumFossil(ES.run({ fromYear: 1750, toYear: 2200, emissionsFn: fn }));
const YEARS = [1750, 1850, 1950, 2023, 2026, 2050, 2100];
const PATHS = ['ssp245', 'ssp126', 'ssp119'];
const FIELDS = ['ppm', 'T', 'sst', 'pH', 'omega', 'dic', 'fossil', 'cumFossilMax'];
for (const p of PATHS) {
  const ref = aerial(ES.presetEmissions(p)), run = FM.pathRun(p);
  let maxDiff = 0, bad = [];
  for (const y of YEARS) {
    const s = FM.sample(y, run), r = ref[y - 1750];
    if (s.year !== y) bad.push(`${y}: year ${s.year}`);
    for (const k of FIELDS) {
      const d = Math.abs(s[k] - r[k]);
      if (!(d === 0)) bad.push(`${y} ${k} ${d}`);
      maxDiff = Math.max(maxDiff, d || 0);
    }
  }
  check(`같은 해 같은 값 ${p} (${YEARS.join('·')}) ppm·T·sst·pH·Ω·DIC·화석·누적최대 차이 0`, bad.length === 0,
    bad.length ? bad.slice(0, 4).join(' | ') : `최대 차이 ${maxDiff}`);
}
{
  // 직접 설계(조감 FUT.levers 의 2050 목표) — 주소 ?scenario=custom&levers= 로 넘어오는 경로
  const levers = { ...ES.LEVER_NOW, fossilShare: 0.2, nuclearShare: 0.2, renewShare: 0.6, ev: 0.8, ccs: 1, otherCut: 0.5, forest: -0.5 };
  const ref = aerial(ES.leverEmissions(levers)), run = FM.pathRun('custom', levers);
  const bad = YEARS.filter(y => FIELDS.some(k => FM.sample(y, run)[k] !== ref[y - 1750][k]));
  check('같은 해 같은 값 직접 설계 경로 (레버 2050 목표)', bad.length === 0, bad.join(','));
  const other = FM.pathRun('custom', { ...levers, ev: 0.1 });
  check('레버가 다르면 다른 궤적 (캐시가 섞이지 않음)', other !== run && FM.sample(2100, other).ppm !== FM.sample(2100, run).ppm);
}
{
  // 같은 경로는 한 번만 굴린다 — E의 시간 이동에서 연도를 옮길 때마다 451년을 다시 굴리지 않게
  check('경로 캐시: 같은 경로 → 같은 궤적 객체', FM.pathRun('ssp245') === FM.pathRun('ssp245') && FM.pathRun('ssp245') !== FM.pathRun('ssp126'));
  const r = FM.pathRun('ssp245');
  check('1750~2200년 451개 항목, 첫해 1750', r.length === 451 && r[0].year === 1750 && r[450].year === 2200);
  check('2023년까지는 세 경로가 같은 역사 (같은 배출)', PATHS.every(p => FM.sample(2023, FM.pathRun(p)).ppm === FM.sample(2023, r).ppm));
}
{
  // 주소 ?year= 에 이상한 값이 와도 멈추지 않는다
  const r = FM.pathRun('ssp245');
  check('연도 자르기: 1700→1750, 2300→2200, 2023.4→2023, NaN→1750',
    FM.sample(1700, r).year === 1750 && FM.sample(2300, r).year === 2200 && FM.sample(2023.4, r).year === 2023 && FM.sample('x', r).year === 1750);
  check('알 수 없는 경로는 엔진과 같이 오류 (조용히 다른 값을 내지 않음)', (() => { try { FM.pathRun('nope'); return false; } catch (e) { return true; } })());
}

// ── 2. 해수 화학 수치 불변 확인용 (엔진 o.pH = pco2FromDic 결과) ─────────────────
{
  const pco2FromDic = vm.runInContext('pco2FromDic', ctx);
  const s = FM.sample(2023, FM.pathRun('ssp245'));
  const sw = pco2FromDic(s.dic, s.sst);
  check('표본 pH·Ω = pco2FromDic(o.dic, o.sst) (C4 seaState 의 기준)', sw.pH === s.pH && sw.omega === s.omega,
    `pH ${s.pH.toFixed(4)} Ω ${s.omega.toFixed(3)}`);
}

// ── 표 (세이브포인트에 붙인다) ───────────────────────────────────────────────
console.log('\n      경로     연도   CO₂ppm   T°C    sst°C   pH      Ω      화석GtC  누적최대GtC');
for (const p of PATHS) {
  for (const y of [1750, 2023, 2026, 2100]) {
    const s = FM.sample(y, FM.pathRun(p));
    console.log(`      ${p}  ${y}  ${s.ppm.toFixed(1).padStart(7)}  ${s.T.toFixed(3).padStart(6)}  ${s.sst.toFixed(3)}  ${s.pH.toFixed(4)}  ${s.omega.toFixed(3)}  ${s.fossil.toFixed(2).padStart(7)}  ${s.cumFossilMax.toFixed(1).padStart(7)}`);
  }
}

console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
process.exit(fails ? 1 : 0);
