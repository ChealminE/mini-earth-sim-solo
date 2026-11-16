// ============================================================================
// 행동 계산 검사 (4차 F1) - js/actions-core.js
// ----------------------------------------------------------------------------
// 마스터 §5-11 '행동 계산 재현': docs/refs/4차_문헌값.md 1-5 표(엔진으로 미리 계산한 2100년 차이)를
// ActionsCore 가 만든 배출 함수 + 엔진으로 ±1 % 안에서 재현하는가. 표는 문헌값 파일에서 직접 읽는다 —
// 숫자를 이 파일에 옮겨 적으면 문헌값이 고쳐졌을 때 검사가 모르고 지나간다.
// 그 밖에 TASK_4차_F §1 의 검사 ②~⑦(작은 규모는 0, 분리배출 정확도, 규모 단조성, 2026까지 하나의 역사,
// 화석 배출 하한, 도시 공기 상한)과 모듈 모양·로드 순서·등록부 키를 본다.
// 엔진 PARAMS·DT 는 그대로 쓴다(여기서는 배출 함수만 바꿔 EarthSystem.run 에 넣는다).
// 실행: node tools/test_actions.js      (실패하면 종료 코드 1)
// ============================================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 1인칭 index.html 과 같은 순서(fp-model 까지). fp-model 이 ActionsCore.START 를 읽는지도 같이 본다
const LOAD = ['js/earth-model.js', 'js/earth-data.js', 'js/earth-system.js', 'js/earth-visual.js',
  'js/actions-core.js', 'firstperson/fp-model.js'];
const ctx = vm.createContext({ console, Math });
for (const f of LOAD) vm.runInContext(read(f), ctx, { filename: f });
const ES = vm.runInContext('EarthSystem', ctx);
const AC = vm.runInContext('ActionsCore', ctx);
const FM = vm.runInContext('FPModel', ctx);
const { SOURCES } = require(path.join(ROOT, 'js', 'sources.js'));

let fails = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
}

const YEAR = 2100;
const at = (fn, y = YEAR) => ES.run({ fromYear: 1750, toYear: y, emissionsFn: fn }).find(o => o.year === y);
const ALL_IDS = AC.ACTIONS.map(a => a.id);
const FULL = { ids: ALL_IDS, recycleAccuracy: 1 };

// ── 0. 모듈 모양 · 로드 순서 · 등록부 ───────────────────────────────────────
check('START = 2026, RAMP_YEARS = 5 (마스터 D6, 문헌값 1-4-4)', AC.START === 2026 && AC.RAMP_YEARS === 5);
check('FPModel.NOW_YEAR = ActionsCore.START (정의는 한 곳)', FM.NOW_YEAR === AC.START
  && /NOW_YEAR\s*=\s*ActionsCore\.START/.test(read('firstperson/fp-model.js')), `${FM.NOW_YEAR}`);
check('FPModel.K.LOCAL_CUT_MAX = ActionsCore.LOCAL_CUT_MAX = 0.42', FM.K.LOCAL_CUT_MAX === AC.LOCAL_CUT_MAX && AC.LOCAL_CUT_MAX === 0.42);
check('행동 6개 · 참여 규모 5개 (F §1)', ALL_IDS.join() === 'tumbler,standby,recycle,bike,transit,flight'
  && AC.SCALES.map(s => s.id).join() === 'me,class,school,korea,world', `${ALL_IDS.join()} / ${AC.SCALES.map(s => s.id).join()}`);
{
  // 문헌값 1-1·1-2·1-4-5·1-4-6 값 그대로인가
  const want = { tumbler: 3.5, standby: 37, recycle: 88, bike: 147, transit: 285.4, flight: 1000 };
  const bad = AC.ACTIONS.filter(a => a.kgPerYear !== want[a.id] || a.co2Share !== 1).map(a => a.id);
  const ppl = Object.fromEntries(AC.SCALES.map(s => [s.id, s.people]));
  check('행동 kg/년 = 문헌값 1-1·1-2, co2Share 1 (식단처럼 메탄 위주인 행동 없음)', bad.length === 0, bad.join(', '));
  check('참여 규모 사람 수 = 문헌값 1-4-5, 비행 상한 3.3억 (1-4-6)',
    ppl.me === 1 && ppl.class === 30 && ppl.school === 800 && ppl.korea === 5.17e7 && ppl.world === 1e9
    && AC.ACTIONS.find(a => a.id === 'flight').capPeople === 3.3e8
    && AC.ACTIONS.filter(a => a.capPeople).length === 1);
}
{
  const code = read('js/actions-core.js').replace(/\/\/.*$/gm, '');
  check('actions-core.js 는 순수 계산 (DOM·three.js·엔진 실행 없음)',
    !/\b(document|window|THREE|FPWorld|FPModel)\b/.test(code) && !/EarthSystem\.(run|presetEmissions|leverEmissions)\s*\(/.test(code));
}
{
  const html = read('firstperson/index.html');
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1].split('?')[0].replace(/^\//, ''));
  const order = ['js/earth-visual.js', 'js/actions-core.js', 'fp-model.js'];
  const idx = order.map(s => srcs.indexOf(s));
  check('1인칭 index.html: earth-visual → actions-core → fp-model', idx.every(i => i >= 0) && idx[0] < idx[1] && idx[1] < idx[2], idx.join(' < '));
  const b = read('tools/build_single_html.py').match(/FP_JS = \[([\s\S]*?)\]/);
  const list = b ? [...b[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : [];
  const bi = ['js/earth-visual.js', 'js/actions-core.js', 'firstperson/fp-model.js'].map(s => list.indexOf(s));
  check('빌더 FP_JS 에도 같은 순서', bi.every(i => i >= 0) && bi[0] < bi[1] && bi[1] < bi[2], bi.join(' < '));
}
{
  // F §1 등록부 새 키 — 2차 값은 unverified + citeChecked false, 연출 키는 assumption
  const want = {
    act_tumbler: 'unverified', act_standby: 'unverified', act_recycle: 'unverified', act_bike: 'unverified',
    act_transit: 'unverified', act_flight: 'unverified', act_household: 'unverified', footprint_kr: 'unverified',
    wynes2017: 'unverified', gossling2020: 'unverified', ipcc_ar6_demand: 'unverified',
    action_scale: null, action_ramp: null, fp_local_cut: null,
  };
  const bad = [];
  for (const [k, st] of Object.entries(want)) {
    const s = SOURCES[k];
    if (!s) { bad.push(k + ' 없음'); continue; }
    if (st && (s.status !== st || s.citeChecked !== false)) bad.push(`${k} ${s.status}/${s.citeChecked}`);
    if (!st && s.kind !== 'assumption') bad.push(`${k} kind ${s.kind}`);
  }
  const srcBad = AC.ACTIONS.filter(a => !SOURCES[a.src]).map(a => a.src);
  check('등록부 키 14개 (act_* 2차 → unverified, 규모·퍼짐·도시 공기 = assumption)', bad.length === 0, bad.join(', '));
  check('ACTIONS 의 src 가 모두 등록부에 있다', srcBad.length === 0, srcBad.join(', '));
}

// ── ① 문헌값 1-5 표 재현 (±1 %) ─────────────────────────────────────────────
// 표 읽기: '### 1-5' ~ '### 1-6' 사이의 '| 행동 | kg | 대한민국 ppm / °C | 세계 ppm / °C |' 줄
const md = read('docs/refs/4차_문헌값.md');
const sec = (md.split('### 1-5')[1] || '').split('### 1-6')[0];
const num = t => parseFloat(t.replace(/−/g, '-').replace(/,/g, ''));
const decimals = t => ((t.replace(/−/g, '-').match(/\.(\d+)/) || [, ''])[1]).length;
const rows = [];
let societyRow = null;
for (const line of sec.split('\n')) {
  const c = line.split('|').slice(1, -1).map(x => x.trim());
  if (c.length !== 4 || /^-+$/.test(c[1]) || c[0] === '행동') continue;
  if (c[0].includes('사회의 선택')) { societyRow = c; continue; }
  const pair = t => t.split('/').map(x => x.trim());
  const [kp, kt] = pair(c[2]), [wp, wt] = pair(c[3]);
  rows.push({ label: c[0], kg: num(c[1]), cells: { korea: [kp, kt], world: [wp, wt] } });
}
check('문헌값 1-5 표 읽기: 행동 8줄 + 사회의 선택 1줄', rows.length === 8 && !!societyRow, `${rows.length}줄`);

// 표 줄 → ActionsCore 선택. '짧은 거리 걷기 31.5 kg'(학교편 도보 통학, CO₂eq)은 ACTIONS 의 bike(147)와 다른 행동이라
// 엔진 몫만 ActionsCore.gtcFromKg 로 더한다 — '여섯 가지 모두'(1,445.4 kg)도 bike 대신 이 31.5를 넣은 합이다.
const WALK_KG = 31.5;
const ROW_DEF = [
  [/^다회용 컵/, ['tumbler'], 0],
  [/^대기전력/, ['standby'], 0],
  [/^분리배출/, ['recycle'], 0],
  [/^짧은 거리 걷기/, [], WALK_KG],
  [/^승용차/, ['transit'], 0],
  [/^장거리 왕복 비행/, ['flight'], 0],
  [/^작은 행동 3종/, ['tumbler', 'standby', 'recycle'], 0],
  [/^여섯 가지 모두/, ['tumbler', 'standby', 'recycle', 'transit', 'flight'], WALK_KG],
];
const base = ES.presetEmissions('ssp245');
const b2100 = at(base);
{
  const m = sec.match(/기준 2100년 = ([\d.]+) ppm · 기온 편차 ([\d.]+) °C/);
  check('기준 2100년 (SSP2-4.5) = 표 머리 값', m && Math.abs(b2100.ppm - +m[1]) < 0.005 && Math.abs(b2100.T - +m[2]) < 0.0005,
    `엔진 ${b2100.ppm.toFixed(2)} ppm · ${b2100.T.toFixed(3)} °C / 표 ${m ? m[1] + ' · ' + m[2] : '못 찾음'}`);
}
// 허용: 표 칸은 반올림한 값이라 '참값'은 반올림 구간 [표 − 반 칸, 표 + 반 칸] 어딘가에 있다(예: −0.0030 → −0.00295~−0.00305).
// 그 구간에서 ±1 % 안이면 재현으로 본다: |계산 − 표| ≤ 반 칸 + 1 % × |표|. '−0.00'처럼 반올림이 값보다 큰 칸은
// 1 %만으로는 뜻이 없어서다. 세계 ppm 칸(유효 숫자가 가장 많은 칸)의 상대 오차를 같이 찍는다.
function near(calc, cell) {
  const ref = num(cell), half = 0.5 * 10 ** -decimals(cell);
  return { ok: Math.abs(calc - ref) <= half + 0.01 * Math.abs(ref), round: Math.abs(calc - ref) <= half * (1 + 1e-9) };
}
// 표를 만든 계산 방식(2026년부터 0.2씩 퍼짐)도 따로 돌려, 반올림 자릿수까지 같은지 본다 — ActionsCore 는 D6 때문에
// 2026년 몫을 0으로 두므로(2027부터 0.4) 두 방식의 차이가 바로 이 0.2~0.4 % 이고, 그 밖의 차이는 없어야 한다.
const tableRamp = (bf, cut) => y => {
  const e = bf(y);
  if (y < AC.START) return e;
  return { ...e, fossil: e.fossil - Math.min(cut * Math.min(1, (y - AC.START + 1) / AC.RAMP_YEARS), Math.max(0, e.fossil)) };
};
const SCALE_COL = { korea: 'korea', world: 'world' };
const deltas = {};
let tableSame = true, tableDiff = [];
for (const r of rows) {
  const def = ROW_DEF.find(([re]) => re.test(r.label));
  if (!def) { check(`1-5 줄 '${r.label}' 대응`, false, '대응 정의 없음'); continue; }
  const [, ids, extraKg] = def;
  const chosen = { ids, recycleAccuracy: 1 };
  const kgSum = AC.personalKg(chosen) + extraKg;
  check(`1-5 '${r.label}' 1인 kg = ${r.kg}`, Math.abs(kgSum - r.kg) < 1e-9, `${kgSum}`);
  const out = [];
  let ok = true, rel = 0;
  for (const [col, scaleId] of Object.entries(SCALE_COL)) {
    const people = AC.SCALES.find(s => s.id === scaleId).people;
    // 표의 비행 줄은 상한(3.3억) 적용 '전' 값이다(문헌값 1-5 첫 메모)
    const cut = AC.cutGtC(chosen, scaleId, { ignoreCap: true }) + AC.gtcFromKg(extraKg, people);
    const o = at(AC.rampCut(base, cut));
    const dp = o.ppm - b2100.ppm, dT = o.T - b2100.T;
    deltas[r.label + '/' + col] = dp;
    const a = near(dp, r.cells[col][0]), t = near(dT, r.cells[col][1]);
    ok = ok && a.ok && t.ok;
    if (col === 'world') rel = Math.abs(dp - num(r.cells[col][0])) / Math.abs(num(r.cells[col][0]));
    out.push(`${col} ${dp.toFixed(4)}${a.ok ? '' : '✗'}/${dT.toFixed(6)}${t.ok ? '' : '✗'} (표 ${r.cells[col].join('/')})`);
    const ot = at(tableRamp(base, cut));
    const ta = near(ot.ppm - b2100.ppm, r.cells[col][0]), tt = near(ot.T - b2100.T, r.cells[col][1]);
    if (!ta.round || !tt.round) { tableSame = false; tableDiff.push(`${r.label}/${col}`); }
  }
  check(`1-5 '${r.label}' 재현 (±1 %)`, ok, out.join(' · ') + ` · 세계 ppm 상대오차 ${(rel * 100).toFixed(2)} %`);
}
check('1-5 표 계산 방식(2026부터 퍼짐)으로는 16칸 × 2(ppm·°C) 모두 반올림 자릿수까지 같다', tableSame, tableDiff.join(', '));
{
  // 비행: 이번에는 상한을 적용(ActionsCore 기본) — 표 메모 '적용하면 세계 단계 비행 효과는 약 1/3'
  const fl = { ids: ['flight'] };
  const capped = at(AC.emissionsFn(base, fl, 'world')).ppm - b2100.ppm;
  const raw = at(AC.rampCut(base, AC.cutGtC(fl, 'world', { ignoreCap: true }))).ppm - b2100.ppm;
  const ratio = capped / raw;
  check('비행 세계 규모 상한 적용 = 상한 전 × 3.3억/10억 (±1 %)', Math.abs(ratio / 0.33 - 1) < 0.01,
    `상한 적용 ${capped.toFixed(3)} ppm · 상한 전 ${raw.toFixed(3)} ppm · 비율 ${ratio.toFixed(4)}`);
  const korea = at(AC.emissionsFn(base, fl, 'korea')).ppm - b2100.ppm;
  check('비행 대한민국 규모는 상한에 걸리지 않는다 (5,170만 < 3.3억)', Math.abs(korea - deltas[rows.find(r => /비행/.test(r.label)).label + '/korea']) < 1e-12);
}
{
  // 표 비교 줄: 사회의 선택 현재 정책 → 1.5 °C 경로
  const s = at(ES.presetEmissions('ssp119'));
  const [p0, p1, dp] = (societyRow[2].match(/([\d.]+) → ([\d.]+) ppm \(([−\-\d.]+)\)/) || []).slice(1).map(num);
  const [t0, t1, dt] = (societyRow[3].match(/([\d.]+) → ([\d.]+) °C \(([−\-\d.]+)\)/) || []).slice(1).map(num);
  const ok = Math.abs(s.ppm - b2100.ppm - dp) <= 0.01 * Math.abs(dp) && Math.abs(s.T - b2100.T - dt) <= 0.01 * Math.abs(dt)
    && Math.abs(s.ppm - p1) <= 0.01 * p1 && Math.abs(b2100.ppm - p0) <= 0.01 * p0 && Math.abs(s.T - t1) <= 0.01 * t1 && Math.abs(b2100.T - t0) <= 0.01 * t0;
  check('1-5 비교 줄: 현재 정책 → 1.5 °C 경로 재현', ok,
    `${b2100.ppm.toFixed(1)} → ${s.ppm.toFixed(1)} ppm (${(s.ppm - b2100.ppm).toFixed(1)}) · ${b2100.T.toFixed(3)} → ${s.T.toFixed(3)} °C (${(s.T - b2100.T).toFixed(3)})`);
}
{
  // 표 아래 메모: 텀블러 286년 = 장거리 왕복 1회(1 t), 457년 = 1.6 t CO₂eq · 9.46 t 대비 15.3 % / 1.4 %
  const tum = AC.ACTIONS.find(a => a.id === 'tumbler').kgPerYear, fl = AC.ACTIONS.find(a => a.id === 'flight').kgPerYear;
  const six = rows.find(r => /여섯/.test(r.label)).kg, small = AC.personalKg({ ids: ['tumbler', 'standby', 'recycle'], recycleAccuracy: 1 });
  check('메모: 텀블러로 비행 1회 메우기 286년(1 t) ~ 457년(1.6 t)', Math.round(fl / tum) === 286 && Math.round(1600 / tum) === 457,
    `${(fl / tum).toFixed(1)} · ${(1600 / tum).toFixed(1)}년`);
  check('메모: 한국인 생활 배출 9.46 t 대비 여섯 가지 15.3 % · 작은 3종 1.4 %',
    AC.FOOTPRINT_KR_KG === 9460 && (six / AC.FOOTPRINT_KR_KG * 100).toFixed(1) === '15.3' && (small / AC.FOOTPRINT_KR_KG * 100).toFixed(1) === '1.4',
    `${(six / AC.FOOTPRINT_KR_KG * 100).toFixed(2)} % · ${(small / AC.FOOTPRINT_KR_KG * 100).toFixed(2)} %`);
}

// ── ② 1명·30명은 2100년 |Δppm| < 0.001 (표시 자릿수에서 0 — 정직한 규모) ──────────
for (const p of ['ssp245', 'ssp126', 'ssp119']) {
  const bf = ES.presetEmissions(p), b0 = at(bf);
  const d = ['me', 'class'].map(sc => at(AC.emissionsFn(bf, FULL, sc)).ppm - b0.ppm);
  check(`② ${p} 행동 6개 전부 · 나/우리 반: |Δppm| < 0.001`, d.every(x => Math.abs(x) < 0.001),
    d.map(x => x.toExponential(2)).join(' · '));
}

// ── ⑦ 분리배출 정확도 ─────────────────────────────────────────────────────────
{
  const k07 = AC.personalKg({ ids: ['recycle'], recycleAccuracy: 0.7 });
  check('⑦ 분리배출 정확도 0.7 → 88 × 0.7 = 61.6 kg', Math.abs(k07 - 88 * 0.7) < 1e-9, `${k07}`);
  check('⑦ 정확도 없음 → 0 kg (아직 안 해 봄, 1로 보지 않음)', AC.personalKg({ ids: ['recycle'] }) === 0
    && AC.cutGtC({ ids: ['recycle'] }, 'world') === 0 && AC.personalKg(['recycle']) === 0);
  const c07 = AC.cutGtC({ ids: ['recycle'], recycleAccuracy: 0.7 }, 'korea'), c1 = AC.cutGtC({ ids: ['recycle'], recycleAccuracy: 1 }, 'korea');
  check('⑦ 엔진 감축도 정확도에 비례, 0~1 밖은 잘림', Math.abs(c07 / c1 - 0.7) < 1e-12
    && AC.personalKg({ ids: ['recycle'], recycleAccuracy: 1.5 }) === 88 && AC.personalKg({ ids: ['recycle'], recycleAccuracy: -1 }) === 0);
  check('⑦ 다른 행동은 정확도와 무관', AC.personalKg({ ids: ['tumbler', 'flight'], recycleAccuracy: 0 }) === 1003.5);
  check('모르는 id·중복은 무시', AC.personalKg({ ids: ['tumbler', 'tumbler', 'diet'] }) === 3.5);
}

// ── ③ 참여 규모가 클수록 Δ 단조 증가 ──────────────────────────────────────────
for (const [name, chosen] of [['텀블러', { ids: ['tumbler'] }], ['비행(상한)', { ids: ['flight'] }],
  ['이동 3종', { ids: ['bike', 'transit', 'flight'] }], ['6개 전부', FULL]]) {
  const d = AC.SCALES.map(s => b2100.ppm - at(AC.emissionsFn(base, chosen, s.id)).ppm);
  const cuts = AC.SCALES.map(s => AC.cutGtC(chosen, s.id));
  const mono = d.every((v, i) => i === 0 || v > d[i - 1]) && cuts.every((v, i) => i === 0 || v > cuts[i - 1]) && d[0] >= 0;
  check(`③ ${name}: 나 < 반 < 학교 < 대한민국 < 세계 (감축 GtC·2100 Δppm)`, mono,
    d.map(x => x.toPrecision(3)).join(' < '));
}

// ── ④ 2026년까지 배출 = 기준 배출 (D6 '2026까지 하나의 역사') ─────────────────
for (const p of ['ssp245', 'ssp126', 'ssp119']) {
  const bf = ES.presetEmissions(p), mf = AC.emissionsFn(bf, FULL, 'world');
  let same = true;
  for (let y = 1750; y <= AC.START; y++) {
    const a = bf(y), m = mf(y);
    if (a.fossil !== m.fossil || a.luc !== m.luc) { same = false; break; }
  }
  const rb = ES.run({ fromYear: 1750, toYear: 2030, emissionsFn: bf }), rm = ES.run({ fromYear: 1750, toYear: 2030, emissionsFn: mf });
  const y26 = rb.findIndex(o => o.year === AC.START);
  const sameRun = rb.slice(0, y26 + 1).every((o, i) => o.ppm === rm[i].ppm && o.T === rm[i].T);
  const e27 = mf(2027).fossil < bf(2027).fossil;
  check(`④ ${p} 세계·6개: 1750~2026 배출·궤적 같음, 2027부터 갈래`, same && sameRun && e27,
    `2026 ${rb[y26].ppm.toFixed(2)} ppm · 2027 화석 ${bf(2027).fossil.toFixed(3)} → ${mf(2027).fossil.toFixed(3)} GtC`);
}
check('④ 퍼짐 비율 2026 0 · 2027 0.4 · 2028 0.6 · 2029 0.8 · 2030 1 · 2100 1',
  [2026, 2027, 2028, 2029, 2030, 2100].map(AC.rampAt).map(v => +v.toFixed(6)).join() === '0,0.4,0.6,0.8,1,1',
  [2026, 2027, 2028, 2029, 2030, 2100].map(AC.rampAt).map(v => v.toFixed(2)).join(' · '));
check('④ 행동 없음 → 배출 함수가 기준과 모든 해에 같다', (() => {
  const mf = AC.emissionsFn(base, { ids: [] }, 'world');
  for (let y = 1750; y <= 2200; y++) if (mf(y).fossil !== base(y).fossil || mf(y).luc !== base(y).luc) return false;
  return true;
})());

// ── ⑤ 어떤 조합에서도 화석 배출 ≥ 0 (행동이 배출을 음수로 만들지 않는다) ────────
{
  // 기준 경로가 이미 음수인 해(SSP1-1.9 2060~, SSP1-2.6 2079~)는 손대지 않는다 — 그해 화석 배출이 하한(문헌값 1-4-3)
  const small = y => ({ fossil: y > AC.START ? 0.05 : 9, luc: 0.5 });   // 감축(세계·6개 ≈ 0.43 GtC)보다 작은 기준
  const bases = { ssp245: base, ssp126: ES.presetEmissions('ssp126'), ssp119: ES.presetEmissions('ssp119'), 작은기준: small };
  let n = 0, bad = [];
  for (const [bn, bf] of Object.entries(bases)) {
    for (let mask = 0; mask < 1 << ALL_IDS.length; mask++) {
      const chosen = { ids: ALL_IDS.filter((_, i) => mask >> i & 1), recycleAccuracy: 1 };
      for (const s of AC.SCALES) {
        const mf = AC.emissionsFn(bf, chosen, s.id);
        for (let y = 2020; y <= 2200; y += 1) {
          const a = bf(y), m = mf(y); n++;
          const okv = (a.fossil >= 0 ? m.fossil >= 0 && m.fossil <= a.fossil : m.fossil === a.fossil) && m.luc === a.luc;
          if (!okv && bad.length < 3) bad.push(`${bn} ${chosen.ids.join('+')} ${s.id} ${y}: ${a.fossil} → ${m.fossil}`);
        }
      }
    }
  }
  check('⑤ 64조합 × 5규모 × 4기준 × 2020~2200: 화석 ≥ 0(기준이 음수면 그대로)·기준 이하·토지이용 불변', bad.length === 0,
    `${n.toLocaleString()}개 해 검사 ${bad.join(' / ')}`);
  const mf = AC.emissionsFn(small, FULL, 'world');
  check('⑤ 감축이 기준보다 크면 0에서 멈춘다', mf(2040).fossil === 0 && mf(2027).fossil === 0, `${mf(2027).fossil} · ${mf(2040).fossil}`);
}

// ── ⑥ localCut ≤ 0.42 ─────────────────────────────────────────────────────────
{
  let max = 0, okAll = true;
  for (let mask = 0; mask < 1 << ALL_IDS.length; mask++) {
    const chosen = { ids: ALL_IDS.filter((_, i) => mask >> i & 1) };
    const move = chosen.ids.includes('bike') || chosen.ids.includes('transit');
    for (const ad of [-1, 0, 0.25, 0.5, 1, 2, NaN, undefined]) {
      const v = AC.localCut(chosen, ad);
      max = Math.max(max, v);
      const want = move ? 0.42 * Math.min(1, Math.max(0, Number(ad) || 0)) : 0;
      if (!(v >= 0 && v <= 0.42) || Math.abs(v - want) > 1e-12) okAll = false;
    }
  }
  check('⑥ localCut ≤ 0.42, 0 이상, 이동 행동(걷기·자전거·대중교통)을 고른 경우만 = 0.42 × 참여 비율', okAll && max === 0.42, `최대 ${max}`);
  check('⑥ 비행·작은 행동만으로는 도시 공기 0', AC.localCut({ ids: ['flight', 'tumbler', 'standby', 'recycle'], recycleAccuracy: 1 }, 1) === 0);
  // F4 연결: FPModel.zoneCO2 가 이 값을 받아 도시 증가분에 (1 − localCut)을 곱한다 — 현재(2026) 최대 몇 ppm 낮아지나
  const s26 = FM.sample(AC.START, FM.pathRun('ssp245'));
  const before = FM.zoneCO2('city', s26), after = FM.zoneCO2('city', s26, { localCut: AC.localCut({ ids: ['transit'] }, 1) });
  check('⑥ 현재(2026) 도심: 우리 도시 모두 대중교통이면 증가분 × 0.58 (문헌값 1-6 최대 약 10 ppm)',
    before - after > 8 && before - after < 12, `${before.toFixed(1)} → ${after.toFixed(1)} ppm (−${(before - after).toFixed(1)})`);
}

// ── F2: 행동 카드·지점의 순수 계산 (firstperson/fp-actions.js) ─────────────────────
// fp-actions.js 는 읽는 순간 DOM·three.js 를 건드리지 않는다(함정 10) — 그래서 DOM 없이 불러와 계산 부분만 본다.
// 카드·지점이 ActionsCore 와 다른 숫자를 내면 '같은 행동이 곳곳에서 다른 숫자'가 된다(F §2 '같은 함수만').
{
  const actx = vm.createContext({ console, Math, ActionsCore: AC, URLSearchParams, location: { search: '' }, window: {} });
  vm.runInContext(read('firstperson/fp-actions.js'), actx, { filename: 'firstperson/fp-actions.js' });
  const FA = vm.runInContext('FPActions', actx);
  check('F2 지점 4개 → 행동 standby·bike·transit·flight (카페·분리배출장은 M)', FA.POINTS.map(p => p.action).join() === 'standby,bike,transit,flight');
  check('F2 텀블러 약 286년 = 장거리 왕복 비행 1번 (문헌값 1-5 아래 286년)', Math.round(FA.tumblerYearsPerFlight()) === 286, FA.tumblerYearsPerFlight().toFixed(1));
  // D13: 미니게임 행동은 체험해야(또는 ?free=1) 켜진다
  const st0 = { chosen: [], minigames: {} };
  check('F2 D13 텀블러·분리배출은 체험 전 카드에서 못 켠다, 나머지 넷은 켠다',
    !FA.canToggle('tumbler', st0, false) && !FA.canToggle('recycle', st0, false)
    && ['standby', 'bike', 'transit', 'flight'].every(id => FA.canToggle(id, st0, false)));
  check('F2 D13 ?free=1 이면 카드에서 바로 켠다, 체험하면 켠다',
    FA.canToggle('tumbler', st0, true) && FA.canToggle('recycle', { minigames: { recycle: { done: true, accuracy: 0.7 } } }, false));
  // 분리배출 정확도: 해 본 값 그대로 · 안 해 봤으면 0 · 교사용으로 켰으면 1(안내서 88 kg)
  const stR = { chosen: ['recycle'], minigames: { recycle: { done: true, accuracy: 0.7 } } };
  check('F2 분리배출 정확도 0.7 → 카드 88 × 0.7 kg = personalKg', Math.abs(FA.cardKg('recycle', stR, false) - 61.6) < 1e-9
    && Math.abs(AC.personalKg(FA.chosenOf(stR, false)) - 61.6) < 1e-9, `${FA.cardKg('recycle', stR, false)}`);
  check('F2 분리배출 안 해 봄: 정확도 0(합계에 0), 카드 막대는 안내서 88 kg', FA.recycleAccuracy(st0, false) === 0
    && FA.cardKg('recycle', st0, false) === 88 && FA.recycleAccuracy(st0, true) === 1);
  // 비교 줄·참여 규모 합계가 ActionsCore 와 같은 식인가
  const c3 = FA.chosenOf({ chosen: ['standby', 'bike', 'transit', 'nope', 'bike'] }, false);
  check('F2 chosenOf: 모르는 id·중복 제거', c3.ids.join() === 'standby,bike,transit', c3.ids.join());
  const pct = FA.footprintPct(c3);
  check('F2 합계 % = personalKg ÷ 9,460 kg (footprint_kr)', Math.abs(pct - (37 + 147 + 285.4) / 9460 * 100) < 1e-9, `${pct.toFixed(2)} %`);
  const tK = FA.scaleTonnes(c3, 'korea');
  check('F2 참여 규모 합계 t/년 = cutGtC × 3.664 × 10⁹ (대한민국 = 469.4 kg × 5,170만)',
    Math.abs(tK - 469.4 * 5.17e7 / 1000) / tK < 1e-9, FA.fmtTonnes(tK));
  check('F2 세계 규모 비행은 3.3억 명으로 자른다(카드 합계도)', Math.abs(FA.scaleTonnes({ ids: ['flight'] }, 'world') - 1000 * 3.3e8 / 1000) < 1);
  check('F2 숫자 글: 1명 37 kg · 30명 1.1 t · 5,170만 명', FA.fmtTonnes(FA.scaleTonnes({ ids: ['standby'] }, 'me')) === '37 kg'
    && FA.fmtTonnes(FA.scaleTonnes({ ids: ['standby'] }, 'class')) === '1.1 t' && FA.fmtPeople(5.17e7) === '5,170만 명',
    `${FA.fmtTonnes(FA.scaleTonnes({ ids: ['standby'] }, 'class'))} · ${FA.fmtPeople(5.17e7)}`);
  // 문구 점검(F §0·§5): 무력감 · 과장 · CO₂를 조작 대상으로 쓰는 말 0건. 문헌값 1-5 표의 '여섯 가지 모두 1,445.4 kg'(걷기 31.5 kg 기준)을
  // 앱 행동 목록(자전거 147 kg) 화면에 섞지 않는다(F1 메모)
  const texts = read('firstperson/fp-actions.js') + read('firstperson/index.html');
  const banned = ['소용없', '소용 없', '의미 없', '의미없', '지구를 구', '해결된다', 'CO₂를 올리', 'CO₂를 내리', '1,445', '1445'].filter(w => texts.includes(w));
  check('F2 문구 점검: 무력감·과장·CO₂ 조작·표 합계 섞기 0건', banned.length === 0, banned.join(', '));
  check('F2 등록부 fp_action_points (assumption)', SOURCES.fp_action_points && SOURCES.fp_action_points.kind === 'assumption');
  // 로드 순서: fp-timeline 뒤, fp-tools 앞 — HTML 과 빌더 목록이 같은가
  const fpHtml = read('firstperson/index.html'), bld = read('tools/build_single_html.py');
  check('F2 로드 순서: fp-timeline → fp-actions → fp-tools (HTML · 빌더 FP_JS)',
    /fp-timeline\.js"><\/script>\s*(<!--[^]*?-->\s*)?<script src="fp-actions\.js"><\/script>\s*<script src="fp-tools\.js">/.test(fpHtml)
    && /"firstperson\/fp-timeline\.js",\s*"firstperson\/fp-actions\.js", "firstperson\/fp-tools\.js"/.test(bld));
  check('F2 E 키는 e.code 로 받는다(한글 자판 ㄷ, 함정 5)', /e\.code === 'KeyE'/.test(read('firstperson/fp-player.js')));
}

console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
process.exit(fails ? 1 : 0);
