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
    /fp-timeline\.js"><\/script>\s*(<!--[^]*?-->\s*)?<script src="fp-actions\.js"><\/script>\s*(<!--[^]*?-->\s*<script src="fp-society\.js"><\/script>\s*)?(<!--[^]*?-->\s*<script src="fp-export\.js"><\/script>\s*)?<script src="fp-tools\.js">/.test(fpHtml)   // 4차 T4: [우리 사회] 탭이 fp-actions 바로 뒤에, 4차 G1: 내보내기(fp-export)가 그 뒤에 올 수 있다
    && /"firstperson\/fp-timeline\.js",\s*"firstperson\/fp-actions\.js", ("firstperson\/fp-society\.js", )?("firstperson\/fp-export\.js", )?"firstperson\/fp-tools\.js"/.test(bld));
  check('F2 E 키는 e.code 로 받는다(한글 자판 ㄷ, 함정 5)', /e\.code === 'KeyE'/.test(read('firstperson/fp-player.js')));
  // F3: 사회의 선택 SSP 세 설명은 조감 미래 예측 PRESET_DESC 와 같은 글(F §3 '같은 이름·PRESET_DESC 문구')
  const tf = read('js/tab-future.js');
  const same = ['ssp245', 'ssp126', 'ssp119'].filter(k => {
    const m = new RegExp(k + ":\\s*'([^']+)'").exec(tf.slice(tf.indexOf('const PRESET_DESC')));
    return m && m[1] === FA.SOCIETY_DESC[k];
  });
  check('F3 사회의 선택 설명 = 조감 PRESET_DESC (SSP 세 경로)', same.length === 3, same.join(','));
  // F4: 재서 구분할 수 있나요? n = 2 × (2σ/|d|)², |d| < σ/20 이면 구분 불가 (fp_detect_n)
  const dA = FA.detectN(9.7, 8), dB = FA.detectN(0.3, 8), dC = FA.detectN(0.41, 8), dZ = FA.detectN(0, 8);
  check('F4 detectN: 도심 −9.7 ppm 은 6번씩, 0.3 ppm(< σ/20)·0 은 구분 불가, 0.41 ppm 은 2 × (16/0.41)² 올림', dA.n === 6 && dA.distinct
    && !dB.distinct && !dZ.distinct && dC.n === Math.ceil(2 * (16 / 0.41) ** 2), `${dA.n} · ${dC.n}`);
  // 계측기 σ 는 fp-tools.js TOOL_SPEC 과 같아야 한다(카드가 다른 σ 로 어림하면 학생이 잰 것과 어긋난다)
  const tools = read('firstperson/fp-tools.js');
  const sig = k => Number((new RegExp(k + ':\\s*\\{[^}]*sigma:\\s*([\\d.]+)').exec(tools) || [])[1]);
  const rows = Object.fromEntries(FA.CMP_ROWS.map(r => [r.key, r.sigma]));
  check('F4 미래 비교 σ = TOOL_SPEC (CO₂ 8 · 온도 0.15 · pH 0.02)', rows.ppm === sig('co2') && rows.T === sig('temp') && rows.sst === sig('temp') && rows.pH === sig('ph'),
    `${sig('co2')} · ${sig('temp')} · ${sig('ph')}`);
  // localCut: 현재는 바로, 미래는 나의 미래 갈래만, 과거는 0 — 상태 없이 확인하려고 ActionsCore 식과 함께 본다
  check('F4 우리 도시 단계 0·25·50·75·100 % → localCut 최대 0.42 (이동 행동만)', FA.CITY_STEPS.join() === '0,0.25,0.5,0.75,1'
    && AC.localCut({ ids: ['bike'] }, 1) === 0.42 && AC.localCut({ ids: ['flight'] }, 1) === 0);
  check('F4 도심 측정이 localCut 을 받는다 (fp-tools measureCO2 → FPActions.localCutFor)', /opt\.localCut = FPActions\.localCutFor\(FPScenario\.year, FPScenario\.branch\)/.test(tools)
    && /localCutFor = \(y, branch\) => \(y === NOW \|\| \(y > NOW && branch === 'mine'\)/.test(read('firstperson/fp-actions.js')));

  // ── M4: 미니게임 기록 → 행동 계산 · G1 시트 (firstperson/fp-actions.js) ──
  {
    const e1 = FA.cafeEntry({ at: 'A', drink: 'latte', drinkLabel: '카페라테', cup: 'pet', cupLabel: '일회용 컵', perWeek: null });
    let L = FA.appendLog({}, 'cafe', e1);
    for (let i = 0; i < FA.LOG_MAX + 5; i++) L = FA.appendLog(L, 'cafe', FA.cafeEntry({ at: 't' + i, drink: 'americano', cup: 'tumbler', perWeek: 3 }));
    check('M4 기록: 종류마다 최근 LOG_MAX 줄만 · 원래 묶음을 고치지 않음', L.cafe.length === FA.LOG_MAX && L.cafe[0].at === 't5' && FA.appendLog(L, 'recycle', {}).cafe === L.cafe);
    const r = { at: 'B', accuracy: 0.7, kg: 61.6, region: 'seoul', rows: [
      { id: 'water_pet', name: '생수 페트병', chosen: 'pet', tries: ['pet'], bin: 'pet', prep: ['empty', 'label'], done: ['empty'], missing: ['label'], score: 0.5, spawned: false },
      { id: 'soy_pet', name: '간장 페트병', chosen: 'pet', tries: ['pet', 'plastic'], bin: 'plastic', prep: ['empty'], done: [], missing: [], score: 0, retryOk: true, spawned: false },
      { id: 'pet_label', name: '라벨', chosen: 'vinyl', tries: ['vinyl'], bin: 'vinyl', prep: [], done: [], missing: [], score: 1, spawned: true }] };
    const e2 = FA.recycleEntry(r, 3, id => ({ pet: '투명 페트병', plastic: '플라스틱', vinyl: '비닐' }[id]));
    check('M4 분리배출 한 판 기록: 판 번호 · 정확도 · kg · 지역 · 품목 줄(이름 · 내가 고른 곳 · 정답 · 준비 · 점수 · 다시 넣기 · 딸린 품목)', e2.round === 3 && e2.accuracy === 0.7 && e2.kg === 61.6
      && e2.region === 'seoul' && e2.items.length === 3 && e2.items[1].chosenName === '투명 페트병' && e2.items[1].binName === '플라스틱' && e2.items[1].retryOk && e2.items[2].spawned);
    const T = FA.minigameTable({ cafe: [e1], recycle: [e2] }, p => ({ empty: '비우기', label: '라벨 떼기' }[p] || p));
    check('M4 G1 시트 표: 카페 = 날짜·음료·컵·주당 잔 수, 분리배출 = 판마다 품목별 줄 (TASK M §4)', T.cafe.head.join() === '날짜,음료,컵,주당 잔 수' && T.cafe.rows[0].join('|') === 'A|카페라테|일회용 컵|'
      && T.recycle.rows.length === 3 && T.recycle.rows[0][2] === '생수 페트병' && T.recycle.rows[0][5] === '비우기 · 라벨 떼기' && T.recycle.rows[0][7] === 0.5
      && T.recycle.rows[1][8] === '플라스틱 (맞음)' && T.recycle.rows[2][9] === '딸린 품목' && T.recycle.head.length === T.recycle.rows[0].length);
    // 분리배출 결과 → 행동 계산: 최근 판 정확도 × 88 kg (setMinigameResult 가 넣는 모양 그대로)
    const stM = { chosen: ['recycle', 'tumbler'], minigames: { tumbler: { done: true, cup: 'tumbler' }, recycle: { done: true, accuracy: e2.accuracy, kg: e2.kg, round: 3 } } };
    check('M4 분리배출 kg = 88 × 최근 판 정확도 = 끝 화면 kg, 텀블러는 카페 결과로 켜짐 (D13)', Math.abs(FA.cardKg('recycle', stM, false) - 61.6) < 1e-9
      && Math.abs(AC.personalKg(FA.chosenOf(stM, false)) - (61.6 + 3.5)) < 1e-9 && FA.canToggle('tumbler', stM, false));
    const src = read('firstperson/fp-actions.js');
    check('M4 입구: recordCafe(텀블러면 setMinigameResult) · recordRecycle(setMinigameResult recycle 정확도) · 기록은 minigameLog(save 가 덮지 않는 키)',
      /if \(e\.cup === 'tumbler'\) setMinigameResult\('tumbler'/.test(src) && /setMinigameResult\('recycle', \{ at: e\.at, accuracy: e\.accuracy/.test(src)
      && /a\.minigameLog = fn\(a\.minigameLog\)/.test(src) && !/fp\.actions\.minigameLog/.test(src.slice(src.indexOf('function save()'), src.indexOf('function changed()'))));
    check('M4 연결: 카페 결과 카드 → recordCafe · 주당 잔 수 → patchMinigameLog, 분리배출 onRound → recordRecycle, 카드 [해 보기] → minigameHook(미니맵 목표)',
      /FPActions\.recordCafe\(/.test(read('firstperson/fp-stage-cafe.js')) && /FPActions\.patchMinigameLog\('cafe'/.test(read('firstperson/fp-stage-cafe.js'))
      && /FPActions\.recordRecycle\(r\)/.test(read('firstperson/fp-stage-recycle.js')) && /FPActions\.minigameHook = id =>/.test(read('firstperson/fp-main.js'))
      && /FPMinimap\.setTarget\(stage\)/.test(read('firstperson/fp-main.js')) && /FPStage\.places/.test(read('firstperson/fp-minimap.js')));
  }
}

// ── F5: 행동 과제 ⑥~⑪ (firstperson/fp-field.js — 학습지 [과제] 탭 2장) ─────────────────
// 판정은 기록 수·글 유무·체험 여부로만(2차 이후 원칙) — 잰 값이 맞는지, 차이가 났는지는 보지 않는다(F §5).
// fp-field.js 맨 위 코드는 상수·함수 정의뿐이라 DOM 없이 불러 순수 함수(actionTaskProgress·meanGap)만 본다.
{
  let store = { tasks: {}, actions: {} };
  const fctx = vm.createContext({ FPModel: FM, console, Math, Map, Set, Object, Number, String, JSON, Array, isFinite,
    WorksheetStore: { readFp: () => store } });
  vm.runInContext(read('firstperson/fp-field.js'), fctx, { filename: 'firstperson/fp-field.js' });
  const F = vm.runInContext('FPField', fctx);
  const T = F.ACT_TASKS;
  const soc = read('firstperson/fp-society.js'), field = read('firstperson/fp-field.js'), html = read('firstperson/index.html');
  check('F5 과제 여섯 = act_size·act_future·act_city·act_society·act_cafe·act_recycle, 번호 ⑥~⑪ = 탐험 지도 2장 줄(FPSociety.CHAPTERS)',
    T.map(t => t.id).join() === 'act_size,act_future,act_city,act_society,act_cafe,act_recycle' && T.map(t => t.no).join('') === '⑥⑦⑧⑨⑩⑪'
    && T.every(t => t.title.startsWith(t.no + ' ')) && /role: '시민'[^\n]*nos: '⑥~⑪'/.test(soc), T.map(t => t.title).join(' · '));
  const P = (fp, rows, n) => Object.fromEntries(F.actionTaskProgress(fp, rows, n).map(p => [p.task.id, p]));
  const none = P({ tasks: {}, actions: {} }, [], 0);
  check('F5 아무것도 안 했으면 여섯 다 미완료 · 진행 0', Object.values(none).every(p => !p.done && p.frac === 0));
  // ⑥ 행동 3개 + 글 두 칸
  const tx = { act_size: { obs: { '가장 큰 행동 · 가장 작은 행동': '비행 · 텀블러' }, diff: '약 286배' } };
  check('F5 ⑥ 행동 2개면 글이 있어도 미완료, 3개 + 글 두 칸이면 완료',
    !P({ tasks: tx }, [], 2).act_size.done && P({ tasks: tx }, [], 3).act_size.done && !P({ tasks: { act_size: { obs: {}, diff: 'x' } } }, [], 4).act_size.done);
  // ⑦ 2100 · CO₂ · 같은 자리 · 같은 사회의 선택에서 기준 5 + 나의 5 + 글
  const rows = [];
  const add = (n, o) => { for (let i = 0; i < n; i++) rows.push({ kind: 'co2', spot: 'airCity', ...o, value: o.value != null ? o.value + (i % 2 ? 3 : -3) : 500 }); };
  const MINE = 'mine:ssp245:korea:bike+flight+transit';
  add(5, { year: 2100, branch: 'base', path: 'ssp245', value: 548 });
  add(4, { year: 2100, branch: 'mine', path: MINE, value: 548 });
  add(3, { year: 2100, branch: 'mine', path: 'mine:ssp245:world:bike+flight+transit', value: 543 });   // 다른 규모 = 다른 묶음
  add(5, { year: 2100, branch: 'mine', path: MINE, spot: 'airGreen', value: 540 });                    // 다른 자리
  add(5, { year: 2100, branch: 'mine', path: 'mine:ssp119:korea:bike', value: 400 });                  // 다른 사회의 선택
  const fd = { tasks: { act_future: { obs: {}, diff: '구분 안 됨' } } };
  let p7 = P(fd, rows, 3).act_future;
  check('F5 ⑦ 같은 자리·같은 경로·같은 나의 행동 묶음만 센다 — 기준 5 · 나의 4 면 미완료', !p7.done && p7.subs[0].n === 5 && p7.subs[1].n === 4,
    p7.subs.map(s => `${s.label} ${s.n == null ? (s.ok ? 'O' : 'X') : s.n}`).join(' · '));
  add(1, { year: 2100, branch: 'mine', path: MINE, value: 600 });
  p7 = P(fd, rows, 3).act_future;
  check('F5 ⑦ 나의 미래 다섯째 기록 + 글이면 완료 (값이 기준보다 커도 — 판정은 수·글만)', p7.done && p7.subs[1].n === 5, `평균 차이 ${p7.gap.d.toFixed(2)} ppm`);
  check('F5 ⑦ 글이 비면 미완료', !P({ tasks: {} }, rows, 3).act_future.done);
  // §6-4 정직한 체감: 평균 차이 vs 계측 오차(2 × √(s²/na + s²/nb), s = max(σ, 표본표준편차))
  const g0 = F.meanGap([548, 548, 548, 548, 548], [547.85, 547.85, 547.85, 547.85, 547.85], 8);
  const g1 = F.meanGap([548, 548, 548, 548, 548], [357, 357, 357, 357, 357], 8);
  check('F5 §6-4 대한민국 규모 차이(−0.15 ppm)는 5회씩이면 계측 오차(±10.1)보다 작아 "구분할 수 없어요", 사회의 선택(−191)은 구분됨',
    !g0.distinct && Math.abs(g0.err - 2 * Math.sqrt(2 * 64 / 5)) < 1e-9 && g1.distinct, `±${g0.err.toFixed(2)} ppm`);
  const g2 = F.meanGap([500, 520, 480], [500], 8);
  check('F5 §6-4 흩어짐이 σ보다 크면 표본표준편차를 쓴다(보수적), 한쪽이 비면 null',
    Math.abs(g2.err - 2 * Math.sqrt(400 / 3 + 64)) < 1e-9 && F.meanGap([], [1], 8) === null);
  // ⑧ 현재 도심 CO₂ 참여 전 5 · 후 5 (path 끝 ':cityNN'), 다른 해·다른 자리는 세지 않음
  const r8 = [];
  const add8 = (n, o) => { for (let i = 0; i < n; i++) r8.push({ kind: 'co2', spot: 'airCity', year: FM.NOW_YEAR, branch: 'now', path: 'ssp245', value: 445, ...o }); };
  add8(5, {}); add8(4, { path: 'ssp245:city42', value: 435 }); add8(3, { path: 'ssp245:city21', value: 440 });
  add8(5, { spot: 'airGreen', path: 'ssp245:city42' }); add8(5, { year: 2100, branch: 'base', path: 'ssp245:city42' });
  const f8 = { tasks: { act_city: { obs: {}, diff: '약 10 ppm' } } };
  const p8a = P(f8, r8, 0).act_city;
  add8(1, { path: 'ssp245:city42', value: 435 });
  const p8b = P(f8, r8, 0).act_city;
  check('F5 ⑧ 현재 도심 참여 전 5 · 후 5(같은 참여 비율) + 글 — 4/5 면 미완료, 녹지·2100 기록은 세지 않음',
    !p8a.done && p8a.subs[1].n === 4 && p8b.done && p8b.subs.map(s => s.n).slice(0, 2).join() === '5,5', `차이 ${p8b.gap.d.toFixed(1)} ppm ±${p8b.gap.err.toFixed(1)}`);
  // ⑨ 2100 기준 미래 · 같은 자리 · 현재 정책 1 + 1.5 °C 1 + 글
  const f9 = { tasks: { act_society: { obs: {}, diff: '사회의 선택이 훨씬 크다' } } };
  const r9 = [{ year: 2100, branch: 'base', path: 'ssp245', kind: 'co2', spot: 'airOcean', value: 548 },
    { year: 2100, branch: 'base', path: 'ssp119', kind: 'co2', spot: 'airGreen', value: 357 }];
  const p9a = P(f9, r9, 0).act_society;
  r9.push({ year: 2100, branch: 'base', path: 'ssp119', kind: 'co2', spot: 'airOcean', value: 357 });
  const p9b = P(f9, r9, 0).act_society;
  check('F5 ⑨ 2100 같은 자리에서 현재 정책·1.5 °C 각 한 번 이상 + 글 (다른 자리끼리는 짝이 안 됨)', !p9a.done && p9b.done && p9b.gap.distinct);
  // ⑩⑪ 체험 기록(minigameLog) + 글
  const f10 = { tasks: { act_cafe: { obs: {}, diff: '주 3회' }, act_recycle: { obs: { '틀린 품목': '종이컵' }, diff: '코팅' } }, actions: { minigameLog: {} } };
  const pa = P(f10, [], 0);
  f10.actions.minigameLog = { cafe: [{ at: 't', cup: 'disposable' }], recycle: [{ at: 't', round: 1, accuracy: 0.6, items: [] }] };
  const pb = P(f10, [], 0);
  check('F5 ⑩ 카페 1회(일회용 컵이어도) + 글, ⑪ 분리배출 한 판 + 글 두 칸 — 체험 전에는 미완료',
    !pa.act_cafe.done && !pa.act_recycle.done && pb.act_cafe.done && pb.act_recycle.done);
  // 탐험 지도 2장 입구 FPField.actionProgress() — [{ task: {title}, done, frac }]
  store = { tasks: tx, actions: { chosen: ['standby', 'bike', 'transit'] } };
  F.rows = [];
  const ap = F.actionProgress();
  check('F5 FPField.actionProgress() → 여섯 줄 { task.title, done, frac } (FPSociety.chapterItems 2장이 읽음), 저장값만으로 ⑥ 완료',
    ap.length === 6 && ap.every(p => typeof p.task.title === 'string' && typeof p.done === 'boolean' && p.frac >= 0 && p.frac <= 1) && ap[0].done
    && /FPField\.actionProgress\(\)\.map\(p => \(\{ title: p\.task\.title, done: p\.done, frac: p\.frac \}\)\)/.test(soc));
  check('F5 저장 모양 = 현장 과제와 같음 { id, title, link, obs, diff, scenario, time } (조감 renderFp, 함정 4)',
    /fp\.tasks\[id\] \|\| \{ id, title: t\.title, link: ACT_LINK, obs: \{\} \}/.test(field) && /link: ACT_LINK, scenario: typeof FPScenario/.test(field));
  const iF = html.indexOf('id="fieldTasks"'), iA = html.indexOf('id="actTasks"'), iS = html.indexOf('id="socTasks"');
  check('F5 [과제] 탭 자리: 현장 과제(1장) → 행동 과제 #actTasks(2장) → 사회 과제(3·4장)', iF > 0 && iA > iF && iS > iA);
  check('F5 배지·[과제] 탭 숫자 = 네 장 과제 전체(탐험 지도와 같은 목록) — 예전 ①②만 세던 것 고침',
    /FPSociety\.CHAPTERS\.flatMap\(c => FPSociety\.chapterItems\(c\.n, fp, this\.rows\)\)/.test(field) && !/과제 \$\{doneN\}\/\$\{INQUIRY\.length\}/.test(field)
    && /과제 0\/15/.test(html));
  // 문구 점검(F §5, 3차 D2 방식): 무력감·과장·CO₂를 조작 대상으로 쓰는 말 0건 — 1인칭 화면 글 전체(주석 제외)
  const fpFiles = fs.readdirSync(path.join(ROOT, 'firstperson')).filter(f => f.endsWith('.js')).map(f => 'firstperson/' + f);
  const strs = fpFiles.map(f => (read(f).replace(/\/\/.*$/gm, '').match(/'[^'\n]*'|`[^`]*`/g) || []).join('\n')).join('\n') + '\n' + html.replace(/<!--[\s\S]*?-->/g, '');
  const BAN = [/소용없|의미 없/, /지구를 구|해결된다|해결돼요/, /CO(₂|2)\s*(를|을|농도를)\s*(올리|올려|내리|내려|높이|높여|낮추|낮춰)/];
  check('F5 문구 점검: 1인칭 화면 글에 무력감·과장·\'CO₂를 올리면/내리면\' 0건 (과제 ② \'CO₂를 높여 보세요\' 고침)', !BAN.some(re => re.test(strs)), BAN.filter(re => re.test(strs)).map(String).join(', '));
}

console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
process.exit(fails ? 1 : 0);
