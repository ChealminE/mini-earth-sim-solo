// ============================================================================
// 사회의 선택 계산 검사 (4차 T1) - js/society-core.js
// ----------------------------------------------------------------------------
// 마스터 §5-13: docs/refs/4차_문헌값.md 6-3 표(엔진으로 미리 계산한 2050·2100년 CO₂·기온 편차, 2050년 화석 배출)를
// SocietyCore 가 만든 레버·배출 함수 + 엔진으로 ±1 % 안에서 재현하는가. 표는 문헌값 파일에서 직접 읽는다 —
// 숫자를 이 파일에 옮겨 적으면 문헌값이 고쳐졌을 때 검사가 모르고 지나간다.
// 그 밖에 TASK_4차_T §2-5 의 ②~⑥(레버 범위·전력 합 1, 카드 없음 = LEVER_NOW, 2026까지 하나의 역사,
// 쟁점 찬성·우려 분량, 등록부 키)과 §7-4 문구 점검, 열쇠 규칙(D16), NDC 비교 경로 정의를 본다.
// 엔진 PARAMS·DT 는 그대로 쓴다(레버·배출 함수만 바꿔 EarthSystem.run 에 넣는다).
// 실행: node tools/test_society.js      (실패하면 종료 코드 1)
// ============================================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 1인칭 index.html 과 같은 순서(fp-model 까지)
const LOAD = ['js/earth-model.js', 'js/earth-data.js', 'js/earth-system.js', 'js/earth-visual.js',
  'js/society-core.js', 'js/actions-core.js', 'firstperson/fp-model.js'];
const ctx = vm.createContext({ console, Math });
for (const f of LOAD) vm.runInContext(read(f), ctx, { filename: f });
const ES = vm.runInContext('EarthSystem', ctx);
const SC = vm.runInContext('SocietyCore', ctx);
const AC = vm.runInContext('ActionsCore', ctx);
const FM = vm.runInContext('FPModel', ctx);
const { SOURCES } = require(path.join(ROOT, 'js', 'sources.js'));

let fails = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
}
const runTo = (fn, y = 2100) => ES.run({ fromYear: 1750, toYear: y, emissionsFn: fn });
const N = ES.LEVER_NOW, R = ES.LEVER_RANGE;
const ALL_POLICY = Object.fromEntries(SC.POLICY_CARDS.map(p => [p.id, true]));

// ── 0. 모듈 모양 · 로드 순서 ────────────────────────────────────────────────
check('기술 카드 7장 · 정책 카드 6장 (T §2-1·§2-2)',
  SC.TECH_CARDS.map(c => c.id).join() === 'renew,nuclear,ev,ccus,dac,industry,forest'
  && SC.POLICY_CARDS.map(p => p.id).join() === 'carbon_price,border,grid,phaseout,ndc,finance',
  `${SC.TECH_CARDS.length} · ${SC.POLICY_CARDS.length}`);
{
  // T §2-1 단계 값 그대로인가(연출값, society_card_levels)
  const want = { renew: [0.30, 0.55, 0.80], nuclear: [0.09, 0.15, 0.25], ev: [0.03, 0.50, 1.00], ccus: [0, 0.5, 1.5],
    dac: [0, 0.3, 1.5], industry: [0, 0.4, 0.8], forest: [N.forest, 0, -1.0] };
  const bad = SC.TECH_CARDS.filter(c => c.levels.join() !== want[c.id].join()).map(c => c.id);
  check('기술 카드 단계 값 = T §2-1 (숲 1단계 = L2023)', bad.length === 0, bad.join(', '));
  const lv = { renew: 'renewShare', nuclear: 'nuclearShare', ev: 'ev', ccus: 'ccs', dac: 'ccs', industry: 'otherCut', forest: 'forest' };
  check('카드 → 엔진 레버 이름 (T §2-1)', SC.TECH_CARDS.every(c => c.lever === lv[c.id] && c.lever in N));
  // 1단계 ≈ 현재값(전력·전기차·포집·숲) — '카드를 놓아도 1단계면 지금 그대로'
  const nowOk = ['renew', 'nuclear', 'ev', 'forest'].every(id => {
    const c = SC.TECH_CARDS.find(t => t.id === id);
    return c.levels[0] === N[c.lever];
  });
  check('1단계 = 현재값 (태양광·풍력 0.30 · 원자력 0.09 · 전기차 0.03 · 숲 L2023)', nowOk);
}
{
  const code = read('js/society-core.js').replace(/\/\/.*$/gm, '');
  check('society-core.js 는 순수 계산 (DOM·three.js·엔진 실행 없음)',
    !/\b(document|window|THREE|FPWorld|FPModel)\b/.test(code) && !/EarthSystem\.run\s*\(|\bES\.run\s*\(/.test(code));
  check('엔진 PARAMS·LEVER_K·LEVER_RANGE 를 고치지 않는다 (대입 없음)', !/\b(PARAMS|LEVER_K|LEVER_RANGE|LEVER_NOW)\s*(\.\w+)?\s*=[^=]/.test(code));
}
{
  const html = read('firstperson/index.html');
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1].split('?')[0].replace(/^\//, ''));
  const order = ['js/earth-system.js', 'js/earth-visual.js', 'js/society-core.js', 'js/actions-core.js', 'fp-model.js'];
  const idx = order.map(s => srcs.indexOf(s));
  check('1인칭 index.html: earth-system → earth-visual → society-core → actions-core → fp-model',
    idx.every(i => i >= 0) && idx.every((v, i) => i === 0 || v > idx[i - 1]), idx.join(' < '));
  const b = read('tools/build_single_html.py').match(/FP_JS = \[([\s\S]*?)\]/);
  const list = b ? [...b[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : [];
  const bi = ['js/earth-system.js', 'js/earth-visual.js', 'js/society-core.js', 'js/actions-core.js', 'firstperson/fp-model.js'].map(s => list.indexOf(s));
  check('빌더 FP_JS 에도 같은 순서', bi.every(i => i >= 0) && bi.every((v, i) => i === 0 || v > bi[i - 1]), bi.join(' < '));
}

// ── ① 문헌값 6-3 표 재현 (±1 %) ─────────────────────────────────────────────
// 표 읽기: '### 6-3' ~ '### 6-4' 사이의 '| 설계 | 2050 | 2100 | E2050 |' 줄 — '486 / 1.69' 꼴
const md = read('docs/refs/4차_문헌값.md');
const sec = (md.split('### 6-3')[1] || '').split('### 6-4')[0];
const num = t => parseFloat(String(t).replace(/−/g, '-').replace(/,/g, ''));
const decimals = t => ((String(t).replace(/−/g, '-').match(/\.(\d+)/) || [, ''])[1]).length;
const rows = [];
for (const line of sec.split('\n')) {
  const c = line.split('|').slice(1, -1).map(x => x.trim());
  if (c.length !== 4 || /^-+$/.test(c[1]) || c[0] === '설계') continue;
  const pair = t => t.split('/').map(x => x.trim());
  rows.push({ label: c[0].replace(/\*\*/g, ''), y2050: pair(c[1]), y2100: pair(c[2].replace(/\*\*/g, '')), e2050: c[3] });
}
check('문헌값 6-3 표 읽기: 15줄 (참고 SSP 3 · 카드 설계 10 · NDC 2)', rows.length === 15, `${rows.length}줄`);

// 표 줄 → 경로. 카드 설계 줄은 SocietyCore.leversFrom(카드, 'value') 로 만든다(슬라이더 값 그대로, 열쇠는 모두 놓음).
const P = ALL_POLICY;
const cardsFn = cards => ES.leverEmissions(SC.leversFrom({ ...P, ...cards }, 'value'));
const ROW_DEF = [
  [/SSP2-4\.5/, () => ES.presetEmissions('ssp245')],
  [/SSP1-2\.6/, () => ES.presetEmissions('ssp126')],
  [/SSP1-1\.9/, () => ES.presetEmissions('ssp119')],
  [/^카드 없음/, () => ES.leverEmissions(SC.leversFrom({}))],
  [/^재생 80 %/, () => cardsFn({ renew: 0.80 })],
  [/^원자력 30 %/, () => cardsFn({ nuclear: 0.30 })],
  [/^전기차 100 % \+ 재생 80 %/, () => cardsFn({ ev: 1, renew: 0.80 })],
  [/^전기차 100 %$/, () => cardsFn({ ev: 1 })],
  [/^포집 3 GtC/, () => cardsFn({ ccus: 1.5, dac: 1.5 })],
  [/^기타 감축 100 %/, () => cardsFn({ industry: 1 })],
  [/^숲 −1\.0/, () => cardsFn({ forest: -1.0 })],
  [/^설계 예/, () => cardsFn({ nuclear: 0.15, renew: 0.65, ev: 0.7, ccus: 0.5, dac: 0.5, industry: 0.5, forest: -0.3 })],
  // '모든 레버 최대'는 표 이름만으로는 정의가 하나로 정해지지 않는다. 화석 0 %(원자력 + 재생 = 100 %)로 읽으면
  // 2100년 325 ppm · 0.70 °C · E2050 −3.00 으로 표(331 · 0.76 · −2.60)와 맞지 않고, 화석 5 %(재생 80 % — 표 '재생 80 %'
  // 줄과 같은 값 — + 원자력 15 %)로 읽으면 네 칸이 모두 맞는다. 표를 만든 계산이 이쪽이라고 보고 재현하되,
  // 화석 0 % 값도 아래에 찍어 둔다(문헌값 6-3 줄 정의 보강 필요 — 보고서).
  [/^모든 레버 최대/, () => cardsFn({ renew: 0.80, nuclear: 0.15, ev: 1, ccus: 1.5, dac: 1.5, industry: 1, forest: -1.0 })],
  [/^NDC식 세계 53 %/, () => SC.ndcEmissions(0.53)],
  [/^NDC식 세계 61 %/, () => SC.ndcEmissions(0.61)],
];
// 허용(test_actions 와 같은 규칙): 표 칸은 반올림한 값이라 |계산 − 표| ≤ 반 칸 + 1 % × |표|.
// E2050 '0' 칸은 1 %가 뜻이 없어 반 칸(0.5)이 아니라 0.005 GtC/년 안을 요구한다(NDC 경로는 2050년에 정확히 0).
function near(calc, cell) {
  const ref = num(cell);
  const half = ref === 0 && decimals(cell) === 0 ? 0.005 : 0.5 * 10 ** -decimals(cell);
  return Math.abs(calc - ref) <= half + 0.01 * Math.abs(ref);
}
const results = {};
for (const r of rows) {
  const def = ROW_DEF.find(([re]) => re.test(r.label));
  if (!def) { check(`6-3 줄 '${r.label}' 대응`, false, '대응 정의 없음'); continue; }
  const fn = def[1]();
  const run = runTo(fn);
  const a = run.find(o => o.year === 2050), b = run.find(o => o.year === 2100);
  const e = fn(2050).fossil;
  results[r.label] = { a, b, e };
  const cells = [[a.ppm, r.y2050[0]], [a.T, r.y2050[1]], [b.ppm, r.y2100[0]], [b.T, r.y2100[1]], [e, r.e2050]];
  const ok = cells.every(([v, c]) => near(v, c));
  check(`6-3 '${r.label}' 재현 (±1 %)`, ok,
    `엔진 ${a.ppm.toFixed(1)} / ${a.T.toFixed(3)} · ${b.ppm.toFixed(1)} / ${b.T.toFixed(3)} · E ${e.toFixed(3)}`
    + ` (표 ${r.y2050.join(' / ')} · ${r.y2100.join(' / ')} · ${r.e2050})`);
}
{
  // 참고: '모든 레버 최대'를 화석 0 %로 읽었을 때(통과·실패에 넣지 않는다)
  const fn = cardsFn({ renew: 0.85, nuclear: 0.15, ev: 1, ccus: 1.5, dac: 1.5, industry: 1, forest: -1.0 });
  const run = runTo(fn), a = run.find(o => o.year === 2050), b = run.find(o => o.year === 2100);
  console.log(`INFO  '모든 레버 최대'를 화석 0 %로 읽으면: ${a.ppm.toFixed(1)} / ${a.T.toFixed(3)} · ${b.ppm.toFixed(1)} / ${b.T.toFixed(3)} · E ${fn(2050).fossil.toFixed(3)}`);
}
{
  // 표 아래 '읽는 법'의 학습 내용이 엔진에서도 성립하는가
  const T = k => results[Object.keys(results).find(l => l.startsWith(k))].b.T;
  // '어떤 카드 하나로도 2 °C 아래로 가지 않는다'는 카드 최대 단계(3단계, 열쇠 모두)에서는 성립한다. 그러나 표의
  // '기타 감축 100 %' 줄(슬라이더 끝, 1.98 °C)은 2 °C 아래라 표 아래 문장과 표가 서로 맞지 않는다 — 억지로 맞추지 않고
  // 카드 3단계 기준으로 검사하고, 슬라이더 끝 값은 INFO 로 찍는다(문헌값 6-3 '읽는 법' 문장 보강 필요 — 보고서).
  const lv3 = SC.TECH_CARDS.map(c => {
    const r = runTo(ES.leverEmissions(SC.leversFrom({ ...P, [c.id]: 3 }, 'level')));
    return [c.id, r[r.length - 1].T];
  });
  check('읽는 법: 어떤 카드 하나로도(3단계) 2100년 2 °C 아래로 가지 않는다', lv3.every(([, t]) => t >= 2),
    lv3.map(([id, t]) => `${id} ${t.toFixed(2)}`).join(' · '));
  const single = ['재생 80 %', '원자력 30 %', '전기차 100 %', '포집 3 GtC', '기타 감축 100 %', '숲 −1.0'].map(T);
  console.log(`INFO  표의 한 카드 줄 2100년 °C: ${single.map(t => t.toFixed(2)).join(' · ')} — '기타 감축 100 %'(슬라이더 끝)는 2 °C 아래`);
  check('읽는 법: 전기차 + 재생이 서로 키운다 (2.38 · 2.11 → 1.94, 둘 다보다 낮음)',
    T('전기차 100 % +') < T('재생 80 %') && T('전기차 100 % +') < T('전기차 100 %') && T('전기차 100 % +') < 2,
    `${T('전기차 100 %').toFixed(3)} · ${T('재생 80 %').toFixed(3)} → ${T('전기차 100 % +').toFixed(3)}`);
  check('읽는 법: 카드 없음(2023년 구조) 2100년 CO₂ > SSP2-4.5', results[Object.keys(results).find(l => l.startsWith('카드 없음'))].b.ppm
    > results[Object.keys(results).find(l => /SSP2-4\.5/.test(l))].b.ppm);
  // 쟁점 카드(포집)의 문구 숫자 '2.47 °C에서 2.15 °C' = 엔진(소수 둘째 자리)
  const txt = [...SC.issues.capture.pro, ...SC.issues.capture.con].join(' ');
  const t0 = T('카드 없음').toFixed(2), t1 = T('포집 3 GtC').toFixed(2);
  check('포집 쟁점 문구의 숫자 = 엔진 (카드 없음 → 포집 최대 2100년 기온 편차)', txt.includes(`${t0} °C에서 ${t1} °C`) && txt.includes(`${t1} °C로 2 °C 아래로 가지 못해요`),
    `${t0} → ${t1} °C`);
}

// ── NDC 비교 경로 정의 (T §2-4) ─────────────────────────────────────────────
{
  const f = SC.ndcEmissions(0.53), base = ES.presetEmissions('ssp245');
  const E18 = ES.historicalEmissions(2018).fossil;
  const md64 = (md.split('### 6-4')[1] || '').split('### 6-5')[0];
  check('엔진 2018년 화석 배출 = 문헌값 6-4 "10.03 GtC/년"', E18.toFixed(2) === '10.03' && md64.includes('10.03 GtC/년'), E18.toFixed(4));
  let hist = true, luc = true;
  for (let y = 1750; y <= 2023; y++) { const h = ES.historicalEmissions(y), e = f(y); if (h.fossil !== e.fossil || h.luc !== e.luc) hist = false; }
  for (let y = 2024; y <= 2200; y++) if (f(y).luc !== base(y).luc) luc = false;
  check('NDC 경로: 2023년까지 역사 배출, 토지이용은 SSP2-4.5 그대로', hist && luc);
  check('NDC 경로: 2035 = 2018 화석 × (1 − 0.53), 2050 = 0, 2051~2200 = 0, 그 사이 직선',
    Math.abs(f(2035).fossil - E18 * 0.47) < 1e-12 && f(2050).fossil === 0 && [2051, 2100, 2200].every(y => f(y).fossil === 0)
    && Math.abs(f(2029).fossil - (ES.E2023 + (E18 * 0.47 - ES.E2023) * 6 / 12)) < 1e-12
    && Math.abs(f(2042.5 | 0).fossil - E18 * 0.47 * (1 - 7 / 15)) < 1e-12,
    `2035 ${f(2035).fossil.toFixed(3)} · 2042 ${f(2042).fossil.toFixed(3)} GtC/년`);
  // 6-4 표의 2035 NDC 53~61 % · 2030 40 % 와 SocietyCore.NDC_KR 이 같은가
  check('NDC_KR = 문헌값 6-4 (2030 40 % · 2035 53~61 % · 부문별)',
    SC.NDC_KR.y2030 === 0.40 && SC.NDC_KR.y2035.join() === '0.53,0.61' && /40 % 감축/.test(md64) && /\*\*53~61 %\*\*/.test(md64)
    && Object.values(SC.NDC_KR.sectors2035).every(([a, b]) => md64.includes(`${a}~${b} %`)));
  let threw = 0;
  for (const bad of [-0.1, 1.2, NaN, '0.5', null]) { try { SC.ndcEmissions(bad); } catch (e) { threw++; } }
  check('NDC 감축률이 0~1 밖·숫자 아님이면 멈춘다(조용히 이상한 경로를 만들지 않게)', threw === 5);
}

// ── ② 어떤 카드 조합에서도 레버가 엔진 범위 안 · 전력 세 비중의 합 = 1 ────────────
{
  // 결정적 난수(재현 가능) — 범위 밖·숫자 아님·잠김을 섞는다
  let seed = 20261115;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const pickVal = c => {
    const u = rnd();
    if (u < 0.1) return undefined;
    if (u < 0.15) return 'x';
    if (u < 0.2) return NaN;
    const [a, b] = [Math.min(...c.range), Math.max(...c.range)];
    return a - 0.5 + (b - a + 1) * rnd();       // 범위보다 조금 넓게
  };
  let n = 0;
  const bad = [];
  const inR = (v, [a, b]) => v >= Math.min(a, b) - 1e-12 && v <= Math.max(a, b) + 1e-12;
  for (let i = 0; i < 20000; i++) {
    const cards = {};
    for (const c of SC.TECH_CARDS) { const v = pickVal(c); if (v !== undefined) cards[c.id] = v; }
    for (const p of SC.POLICY_CARDS) if (rnd() < 0.5) cards[p.id] = true;
    for (const mode of ['value', 'level']) {
      const cc = mode === 'level' ? Object.fromEntries(Object.entries(cards).map(([k, v]) => [k, typeof v === 'number' ? Math.round(v * 3) : v])) : cards;
      const L = SC.leversFrom(cc, mode); n++;
      const sum = L.fossilShare + L.nuclearShare + L.renewShare;
      const ok = Math.abs(sum - 1) < 1e-9 && [L.fossilShare, L.nuclearShare, L.renewShare].every(v => v >= 0 && v <= 1)
        && inR(L.ev, R.ev) && inR(L.ccs, R.ccs) && inR(L.otherCut, R.otherCut) && inR(L.forest, R.forest)
        && Object.keys(L).sort().join() === Object.keys(N).sort().join() && Object.values(L).every(Number.isFinite);
      if (!ok && bad.length < 3) bad.push(`${mode} ${JSON.stringify(cc)} → ${JSON.stringify(L)}`);
    }
  }
  check('② 무작위 카드 4만 조합(값·단계 두 방식): 레버 ∈ LEVER_RANGE, 전력 세 비중 0~1 · 합 1', bad.length === 0, `${n}개 ${bad.join(' / ')}`);
  // 정합 규칙 하나하나
  const d1 = SC.design({ ...P, renew: 0.8, nuclear: 0.4 });
  check('② 원자력 + 재생 > 1 → 같은 비율로 줄여 합 1, 화석 0, "전력의 100 %가 무탄소" 표시',
    d1.powerScaled && d1.cleanPower100 && d1.levers.fossilShare === 0 && Math.abs(d1.levers.renewShare / d1.levers.nuclearShare - 2) < 1e-12,
    `원자력 ${d1.levers.nuclearShare.toFixed(4)} · 재생 ${d1.levers.renewShare.toFixed(4)}`);
  const d2 = SC.design({ ...P, ccus: 2.5, dac: 2.0 });
  check('② 포집 합 = CCUS + DAC, 3 GtC/년에서 자른다', d2.levers.ccs === 3 && d2.ccsClipped && SC.leversFrom({ ...P, ccus: 1, dac: 0.4 }).ccs === 1.4);
  check('② 원자력·재생만 놓아도 화석 = 1 − 원자력 − 재생 (재생 80 % → 화석 11 %)', SC.leversFrom({ ...P, renew: 0.8 }).fossilShare === 0.11
    && SC.leversFrom({ nuclear: 0.3 }).fossilShare === 0.4 && SC.design({ ...P, renew: 0.8 }).cleanPower100 === false);
  // 고등학생 슬라이더 범위 = 엔진 범위(T §7-5): 열쇠가 다 있으면 각 카드 끝까지 간다
  const ends = SC.leversFrom({ ...P, ev: 9, industry: 9, forest: -9, ccus: 9 });
  check('② 슬라이더 끝 = 엔진 범위 끝 (전기차 1 · 기타 감축 1 · 숲 −1.0 · 포집 3)', ends.ev === R.ev[1] && ends.otherCut === R.otherCut[1]
    && ends.forest === R.forest[0] && ends.ccs === R.ccs[1]);
}

// ── 열쇠 규칙 (마스터 D16, 등록부 policy_unlock) ──────────────────────────────
{
  const u0 = SC.unlocked({});
  check('열쇠: 정책 없음 → 태양광·풍력·CCUS·산업 전환은 2단계까지, 나머지는 3단계',
    u0.renew === 2 && u0.ccus === 2 && u0.industry === 2 && u0.nuclear === 3 && u0.ev === 3 && u0.dac === 3 && u0.forest === 3, JSON.stringify(u0));
  const u1 = SC.unlocked({ carbon_price: true }), u2 = SC.unlocked({ border: true }), u3 = SC.unlocked({ grid: true });
  check('열쇠: 탄소 가격제 → 산업 전환·CCUS / 탄소국경조정 → 산업 전환 / 전력망 → 태양광·풍력',
    u1.industry === 3 && u1.ccus === 3 && u1.renew === 2 && u2.industry === 3 && u2.ccus === 2 && u3.renew === 3 && u3.industry === 2);
  check('열쇠: true 만 인정 (문자열·1 은 놓지 않은 것)', SC.unlocked({ grid: 'true', carbon_price: 1 }).renew === 2 && SC.unlocked({ carbon_price: 1 }).ccus === 2);
  const lk = SC.design({ renew: 0.8, ccus: 1.5, industry: 1, nuclear: 0.25 });
  check('열쇠 없음 → 값 모드에서 2단계 값까지 잘림, 잘린 카드 표시',
    lk.levers.renewShare === 0.55 && lk.levers.ccs === 0.5 && lk.levers.otherCut === 0.4 && lk.levers.nuclearShare === 0.25
    && lk.capped.sort().join() === 'ccus,industry,renew', `capped ${lk.capped.join(',')}`);
  const lv = SC.design({ renew: 3, industry: 3, ev: 2, forest: 3 }, 'level');
  check('열쇠 없음 → 단계 모드에서 3단계를 누르면 2단계, 열린 카드는 3단계',
    lv.levers.renewShare === 0.55 && lv.levers.otherCut === 0.4 && lv.levers.ev === 0.5 && lv.levers.forest === -1.0
    && lv.capped.sort().join() === 'industry,renew');
  const lv2 = SC.design({ ...P, renew: 3, nuclear: 3, ev: 3, ccus: 3, dac: 3, industry: 3, forest: 3 }, 'level');
  check('모든 카드 3단계 + 열쇠: 재생 0.80 + 원자력 0.25 > 1 → 비율대로 줄임, 포집 3, 기타 감축 0.8',
    lv2.powerScaled && lv2.levers.fossilShare === 0 && lv2.levers.ccs === 3 && lv2.levers.otherCut === 0.8 && lv2.capped.length === 0);
  check('열쇠 규칙 설명(카드 뒷면) + 등록부 policy_unlock', /단순하게 표현한 것/.test(SC.UNLOCK_NOTE) && SC.UNLOCK_SRC === 'policy_unlock');
}

// ── ③ 카드 없음 = LEVER_NOW ───────────────────────────────────────────────────
{
  const same = L => Object.keys(N).every(k => L[k] === N[k]) && Object.keys(L).length === Object.keys(N).length;
  check('③ 카드 없음 = LEVER_NOW (값·단계 모드, 정책 카드만 놓아도)',
    same(SC.leversFrom({})) && same(SC.leversFrom()) && same(SC.leversFrom({}, 'level')) && same(SC.leversFrom(ALL_POLICY)));
  // 1단계 = 현재값이므로 전력·전기차·숲 카드를 1단계에 놓아도 LEVER_NOW
  check('③ 태양광·풍력·원자력·전기차·숲 1단계 = LEVER_NOW (부동소수 찌꺼기 없음)',
    same(SC.leversFrom({ renew: 1, nuclear: 1, ev: 1, forest: 1 }, 'level')) && same(SC.leversFrom({ renew: 0.30 })));
  check('③ 화면 안내: "카드를 하나도 안 쓰면 = 지금 그대로 계속"', /카드를 하나도 안 쓰면/.test(SC.NOTES.baseline) && /그대로/.test(SC.NOTES.baseline));
}

// ── ④ 2026년까지는 기준 경로와 같다 (마스터 D6 — 1인칭 표시 규칙, E2) ─────────────
{
  const base = FM.pathRun('ssp245');
  const designs = {
    '우리 사회(모든 카드)': FM.runFor(ES.leverEmissions(SC.leversFrom({ ...P, renew: 0.8, nuclear: 0.15, ev: 1, ccus: 1.5, dac: 1.5, industry: 1, forest: -1 }))),
    'NDC 53 %': FM.runFor(SC.ndcEmissions(0.53)),
    'NDC 61 %': FM.runFor(SC.ndcEmissions(0.61)),
    '파리협약 2 °C': FM.pathRun('ssp126'),
  };
  for (const [name, soc] of Object.entries(designs)) {
    let same = true, diff2024 = false;
    for (let y = FM.YEAR_MIN; y <= FM.NOW_YEAR; y++) {
      const s = FM.sample(y, SC.pickRun(y, base, soc)), b = FM.sample(y, base);
      if (s !== b) same = false;
      if (y >= 2024 && FM.sample(y, soc).ppm !== b.ppm) diff2024 = true;
    }
    const after = FM.sample(2027, SC.pickRun(2027, base, soc)) === FM.sample(2027, soc);
    // 엔진 배출은 2023년까지 언제나 역사 배출
    check(`④ ${name}: 1750~2026 표시 = 기준 경로 궤적, 2027부터 갈래 (엔진은 2024부터 갈라짐: ${diff2024 ? '예' : '아니오'})`, same && after,
      `2026 ${FM.sample(2026, base).ppm.toFixed(2)} ppm (엔진 그대로면 ${FM.sample(2026, soc).ppm.toFixed(2)})`);
  }
  check('④ pickRun 의 현재 = ActionsCore.START = FPModel.NOW_YEAR = 2026', AC.START === 2026 && FM.NOW_YEAR === AC.START
    && /ActionsCore\.START/.test(read('js/society-core.js')));
  const lf = ES.leverEmissions(SC.leversFrom({ ...P, renew: 1, ev: 1, ccus: 3 }));
  let hist = true;
  for (let y = 1750; y <= ES.LAST_HIST_YEAR; y++) { const h = ES.historicalEmissions(y), e = lf(y); if (h.fossil !== e.fossil || h.luc !== e.luc) hist = false; }
  check('④ 카드 설계 배출: 2023년까지 역사 배출 그대로', hist);
}

// ── 사회의 선택 선택지 (마스터 D18) ─────────────────────────────────────────
check('선택지 5개: 현재 정책 · 파리협약 2 °C · 1.5 °C 탄소중립 · NDC를 전 세계가 따른다면 · 우리가 설계한 사회',
  SC.CHOICES.map(c => c.id).join() === 'ssp245,ssp126,ssp119,ndc,custom'
  && SC.CHOICES.slice(0, 3).every(c => c.label === ES.PRESETS[c.id].ko)
  && /NDC/.test(SC.CHOICES[3].label) && SC.CHOICES[4].label === '우리가 설계한 사회',
  SC.CHOICES.map(c => c.label).join(' · '));

// ── ⑤ 쟁점 카드: 찬성·우려 분량 비율 0.67~1.5 ────────────────────────────────────
{
  const len = a => a.join('').replace(/\s/g, '').length;
  const ids = Object.keys(SC.issues);
  check('쟁점 카드 4장 (원자력·포집·탄소 가격제·재생에너지 부지 — T §0-2)', ids.join() === 'nuclear,capture,carbon_price,siting', ids.join());
  for (const [id, is] of Object.entries(SC.issues)) {
    const p = len(is.pro), c = len(is.con), r = p / c;
    check(`⑤ 쟁점 '${id}' 찬성 ${p}자 · 우려 ${c}자 · 비율 ${r.toFixed(2)} (0.67~1.5), 항목 수 같음`,
      r >= 0.67 && r <= 1.5 && is.pro.length === is.con.length && is.pro.length >= 2);
  }
  // 카드가 가리키는 쟁점이 있는가
  const refs = [...SC.TECH_CARDS, ...SC.POLICY_CARDS].filter(c => c.issue).map(c => c.issue);
  check('카드의 issue 키가 모두 쟁점 카드에 있다 (원자력 → nuclear, CCUS·DAC → capture, 탄소 가격제 → carbon_price)',
    refs.every(k => SC.issues[k]) && SC.TECH_CARDS.find(c => c.id === 'nuclear').issue === 'nuclear'
    && ['ccus', 'dac'].every(id => SC.TECH_CARDS.find(c => c.id === id).issue === 'capture'));
  check('포집 쟁점에 기술 만능 경계 문구 (T §0-3)', SC.issues.capture.note === SC.NOTES.capture && /줄이기 어려운 배출/.test(SC.NOTES.capture));
}

// ── 문구 점검 (T §7-4 — 3차 D2 방식) ─────────────────────────────────────────
{
  // 화면에 나갈 모든 글: 카드 이름·하위 항목·정책·안내·쟁점·도감·선택지
  const texts = [];
  const walk = (v, where) => {
    if (typeof v === 'string') texts.push([where, v]);
    else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${where}[${i}]`));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!['id', 'src', 'lever', 'part', 'issue', 'unit', 'subSrc', 'related'].includes(k)) walk(x, `${where}.${k}`);
  };
  walk({ TECH: SC.TECH_CARDS, POLICY: SC.POLICY_CARDS, NOTES: SC.NOTES, UNLOCK: SC.UNLOCK_NOTE, issues: SC.issues, GUIDE: SC.GUIDE, CHOICES: SC.CHOICES }, 'SC');
  const BANNED = [
    [/완벽한/, '한쪽만 좋게("완벽한 해결책")'], [/반드시/, '단정("반드시")'], [/무조건/, '단정("무조건")'],
    [/최고의|가장 좋은|유일한 (해결|방법)/, '한쪽만 좋게'], [/위험하다/, '"위험하다" 단독'],
    [/포집하면.{0,15}배출|배출해도\s*(된|돼|괜찮)/, '"포집하면 배출해도 된다"류'],
    [/소용없|의미 없/, 'F5 무력감'], [/지구를 구|해결된다|해결돼요|해결됩니다/, 'F5 과장'],
    [/CO₂를\s*(올리|내리)면/, 'CO₂를 조작 대상으로(3차 결정 9)'],
  ];
  const hits = [];
  for (const [where, t] of texts) for (const [re, why] of BANNED) if (re.test(t)) hits.push(`${where}: ${why} — "${t}"`);
  check(`문구 점검: 금지 표현 0건 (${texts.length}개 문장 검사)`, hits.length === 0, hits.slice(0, 3).join(' / '));
  // 도감은 숫자를 쓰지 않는다(T §2-3)
  const guideNum = SC.GUIDE.filter(g => /\d/.test([g.what, g.cuts, g.hard, g.why].join(''))).map(g => g.id);
  check('도감 카드에 숫자 없음 (6개: 대체육·화학적 재활용·블루카본·기후 금융·그린수소·차세대 배터리)',
    guideNum.length === 0 && SC.GUIDE.length === 6 && SC.GUIDE.every(g => g.what && g.cuts && g.hard && g.why), guideNum.join(', '));
  // 쟁점 카드 문장의 숫자는 포집 카드(엔진 결과)에만
  const issueNum = Object.entries(SC.issues).filter(([id, is]) => id !== 'capture' && /\d/.test([...is.pro, ...is.con].join(''))).map(([id]) => id);
  check('쟁점 카드 숫자는 엔진 결과(포집)에만 — 근거 없는 숫자 0', issueNum.length === 0, issueNum.join(', '));
}

// ── 하위 항목 참고 막대 = 문헌값 6-2 (계산에 쓰지 않음) ──────────────────────────
{
  const md62 = (md.split('### 6-2')[1] || '').split('### 6-3')[0];
  const ind = SC.TECH_CARDS.find(c => c.id === 'industry');
  const bad = ind.sub.filter(s => !md62.includes(`${s.owid} ${s.share} %`)).map(s => s.label);
  check('산업 전환 하위 항목 비중 = 문헌값 6-2 (철강 7.2 · 시멘트 3 · 항공 1.9 · 해운 1.7 · 건물 17.5 %)', bad.length === 0 && ind.sub.length === 5, bad.join(', '));
  // 하위 항목은 레버를 바꾸지 않는다 — leversFrom 은 industry 값 하나만 본다
  check('하위 항목은 계산에 쓰이지 않는다 (산업 카드 값 하나 → otherCut)', SC.leversFrom({ ...P, industry: 0.5 }).otherCut === 0.5
    && !/\.sub\b/.test(read('js/society-core.js').replace(/\/\/.*$/gm, '').split('function unlocked')[1] || ''));
}

// ── ⑥ 모든 카드의 src 키가 등록부에 있다 ─────────────────────────────────────
{
  const keys = new Set([SC.LEVELS_SRC, SC.UNLOCK_SRC]);
  for (const c of SC.TECH_CARDS) { keys.add(c.src); if (c.subSrc) keys.add(c.subSrc); }
  for (const p of SC.POLICY_CARDS) keys.add(p.src);
  for (const is of Object.values(SC.issues)) { keys.add(is.src); (is.related || []).forEach(k => keys.add(k)); }
  for (const g of SC.GUIDE) keys.add(g.src);
  for (const c of SC.CHOICES) keys.add(c.src);
  const missing = [...keys].filter(k => !SOURCES[k]);
  check(`⑥ 카드·정책·쟁점·도감·선택지의 src 키 ${keys.size}개가 모두 등록부에 있다`, missing.length === 0, missing.join(', '));
  // T 새 키: 연출 규칙 = assumption, 2차·근거 문장 미확보 = unverified + citeChecked false
  const want = {
    society_card_levels: ['assumption', 'verified'], policy_unlock: ['assumption', 'verified'],
    ndc_global_path: ['assumption', 'unverified'], ndc_kr_2035: ['obs', 'unverified'], sector_share_owid: ['obs', 'unverified'],
    society_policy_cards: ['assumption', 'unverified'], climatetech_guide: ['assumption', 'unverified'],
    issue_nuclear: ['assumption', 'unverified'], issue_capture: ['assumption', 'unverified'],
    issue_carbon_price: ['assumption', 'unverified'], issue_siting: ['assumption', 'unverified'],
  };
  const bad = Object.entries(want).filter(([k, [kind, st]]) => !SOURCES[k] || SOURCES[k].kind !== kind || SOURCES[k].status !== st
    || (st === 'unverified' && SOURCES[k].citeChecked !== false && kind !== 'assumption')).map(([k]) => k);
  check('T 등록부 새 키 11개 (kind·status)', bad.length === 0, bad.join(', '));
}

// ── T3 세계 속 기후테크 (T §4) — 값은 FPModel.society·techState, 그리기는 fp-tech-world.js ───────────
{
  const L23 = ES.L2023;
  // 사회 모습: C5 네 값 그대로 + ccus·dac·forest
  const sh = FM.sample(2100, FM.pathRun('ssp119')), soc119 = FM.society(sh, 'ssp119');
  const pre = vm.runInContext('EarthVisual', ctx).presetSociety(sh.fossil, 2100, N, ES.E2023, ES.LAST_HIST_YEAR);
  check('T3 SSP 사회 모습: C5 네 값 그대로, 포집은 전부 DAC(= removal × 3), 숲 = 그해 토지이용 배출',
    ['ev', 'renew', 'nuclear', 'removal'].every(k => soc119[k] === pre[k]) && soc119.ccus === 0 && soc119.dac === pre.removal * 3 && soc119.forest === sh.luc,
    `2100 1.5 °C: DAC ${soc119.dac.toFixed(2)} GtC · 토지이용 ${sh.luc.toFixed(2)}`);
  check('T3 역사 구간(≤ 2023) 숲 = L2023 (지금 숲)', [1850, 2000, 2023].every(y => FM.society(FM.sample(y, FM.pathRun('ssp245')), 'ssp245').forest === L23));
  const lev = SC.leversFrom({ ...P, ccus: 1.5, dac: 0.5, forest: -0.5 });
  const sc50 = FM.sample(2050, FM.pathRun('custom', lev));
  const split = FM.society(sc50, 'custom', lev, { ccus: 1.5, dac: 0.5 }), nosplit = FM.society(sc50, 'custom', lev);
  check('T3 직접 설계: 포집 합을 카드 비율(CCUS 1.5 : DAC 0.5)로 나눔, 포집 타워(removal)는 DAC 몫만',
    Math.abs(split.ccus - 1.5) < 1e-12 && Math.abs(split.dac - 0.5) < 1e-12 && Math.abs(split.removal - 0.5 / 3) < 1e-12 && split.forest === -0.5,
    `ccus ${split.ccus} · dac ${split.dac} · removal ${split.removal.toFixed(3)}`);
  check('T3 카드 비율이 없으면 전부 DAC — C5 포집 타워 규칙(removal = ccs ÷ 3) 그대로', nosplit.ccus === 0 && nosplit.dac === lev.ccs && nosplit.removal === lev.ccs / 3);

  const T0 = FM.techState(sc50, { ...N, renew: N.renewShare, nuclear: N.nuclearShare, ev: N.ev, ccus: 0, dac: 0, forest: L23 });
  check('T3 지금 사회(LEVER_NOW) = 기후테크 소품 0 (지붕 태양광만 재생 30 %)', T0.turbines === 0 && T0.treePlus === 0 && T0.ccusUnits === 0
    && T0.dacUnits === 0 && T0.smrUnits === 0 && T0.chargers === 0 && T0.solarFrac === 0.3, JSON.stringify(T0));
  const ts = soc => FM.techState(sc50, { ev: 0.03, renew: 0.3, nuclear: 0.09, ccus: 0, dac: 0, forest: L23, ...soc });
  check('T3 숲: 1.30 → +0 · 0 → +20 % · −1.0 → +50 % (T §4 표), 사이는 직선', ts({ forest: L23 }).treePlus === 0
    && Math.abs(ts({ forest: 0 }).treePlus - 0.2) < 1e-12 && Math.abs(ts({ forest: -1 }).treePlus - 0.5) < 1e-12
    && Math.abs(ts({ forest: -0.5 }).treePlus - 0.35) < 1e-12 && Math.abs(ts({ forest: L23 / 2 }).treePlus - 0.1) < 1e-12);
  check('T3 해상풍력: 재생 30 % → 0기, 55 % → 2기, 80 % → 4기, 100 % → 6기 (증가분)',
    [0.3, 0.55, 0.8, 1].map(r => ts({ renew: r }).turbines).join() === '0,2,4,6', [0.3, 0.55, 0.8, 1].map(r => ts({ renew: r }).turbines).join());
  check('T3 포집: 카드 1·2·3단계(CCUS 0/0.5/1.5, DAC 0/0.3/1.5) → 설비 0/1/3기, 3 GtC 도 3기에서 멈춤',
    [0, 0.5, 1.5, 3].map(v => ts({ ccus: v }).ccusUnits).join() === '0,1,3,3' && [0, 0.3, 1.5].map(v => ts({ dac: v }).dacUnits).join() === '0,1,3');
  check('T3 SMR: 원자력 9 % → 0동, 15 % → 1동, 25 % → 3동 / 충전소 전기차 3 % → 0, 50 % → 2, 100 % → 4',
    [0.09, 0.15, 0.25, 0.6].map(v => ts({ nuclear: v }).smrUnits).join() === '0,1,3,3' && [0.03, 0.5, 1].map(v => ts({ ev: v }).chargers).join() === '0,2,4');
  // 모든 경로 · 모든 해: 범위 안, 역사 구간은 소품 없음(그 시대에 없던 기술을 세우지 않는다)
  let bad = [], hist = true;
  const paths = [['ssp245'], ['ssp126'], ['ssp119'], ['custom', SC.leversFrom({ ...P, renew: 1, nuclear: 0.25, ev: 1, ccus: 1.5, dac: 1.5, industry: 1, forest: -1 })]];
  for (const [p, lv] of paths) for (const o of FM.pathRun(p, lv)) {
    const t = FM.techState(o, FM.society(o, p, lv, { ccus: 1.5, dac: 1.5 }));
    const ok = t.turbines >= 0 && t.turbines <= 6 && [t.ccusUnits, t.dacUnits, t.smrUnits].every(u => u >= 0 && u <= 3)
      && t.chargers >= 0 && t.chargers <= 4 && t.treePlus >= 0 && t.treePlus <= 0.5 && t.solarFrac >= 0 && t.solarFrac <= 1;
    if (!ok && bad.length < 2) bad.push(`${p} ${o.year} ${JSON.stringify(t)}`);
    if (o.year <= ES.LAST_HIST_YEAR && (t.turbines || t.treePlus || t.ccusUnits || t.dacUnits || t.smrUnits)) hist = false;
  }
  check('T3 네 경로 1750~2200: 소품 수가 범위 안 (풍력 ≤ 6 · 설비 ≤ 3 · 충전소 ≤ 4 · 숲 ≤ +50 %)', bad.length === 0, bad.join(' / '));
  check('T3 역사 구간(≤ 2023)에는 해상풍력·숲 추가·포집·SMR 없음', hist);
  {
    const lv = paths[3][1];
    const line = y => { const o = FM.sample(y, FM.pathRun('custom', lv)); return JSON.stringify(FM.techState(o, FM.society(o, 'custom', lv, { ccus: 1.5, dac: 1.5 }))); };
    console.log(`INFO  T3 '모든 카드 최대'(재생 100 · 원자력 25 → 비율 조정) 2050: ${line(2050)}`);
    for (const p of ['ssp245', 'ssp119']) console.log(`INFO  T3 ${p} 2050 / 2100: ${[2050, 2100].map(y => { const o = FM.sample(y, FM.pathRun(p)); return JSON.stringify(FM.techState(o, FM.society(o, p))); }).join(' / ')}`);
  }

  // 그리는 쪽(fp-tech-world.js) — 정적 검사: 새 통로 없음 · 인스턴싱 · 렌더러 설정·투명 재질 손대지 않음(함정 14·15)
  const strip = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const tw = strip('firstperson/fp-tech-world.js'), wcode = strip('firstperson/fp-world.js'), mcode = strip('firstperson/fp-main.js');
  const body = (wcode.match(/function applyWorldState\(s, soc\) \{([\s\S]*?)\n\}/) || [, ''])[1];
  check('T3 세계 갱신 통로는 applyWorldState 하나 — 그 안에서 FPTechWorld.apply(s, soc, C), 다른 곳에서 apply 를 부르지 않음',
    /FPTechWorld\.apply\(s, soc, C\)/.test(body) && (wcode + mcode).split('FPTechWorld.apply(').length === 2 && !/function applyWorld(?!State)/.test(wcode + tw));
  const nIM = (tw.match(/instanced\(/g) || []).length - 1;   // 정의 한 번 빼고
  check('T3 InstancedMesh 9개 이하(종류마다 하나) · new THREE.Mesh 없음 → 세계 드로우콜 최대 +9 (+그림자 7)', nIM <= 9 && !/new THREE\.Mesh\(/.test(tw), `${nIM}개`);
  check('T3 렌더러 노출·그림자·scene.environment·안개를 바꾸지 않는다(함정 14), 투명·transmission 재질 없음(함정 15)',
    !/toneMapping|shadowMap|\.environment\b|\.fog\b|renderer\./.test(tw) && !/transparent\s*:\s*true|transmission/.test(tw));
  check('T3 소품 자리 결정적(Math.random 없음) — 같은 해에 다시 와도 같은 나무 밑에서 잰다', !/Math\.random/.test(tw));
  check('T3 FPTechWorld.build 는 세계를 만든 바로 뒤, update 는 프레임 루프에서', /buildFirstPersonWorld\(renderer\);\s*FPTechWorld\.build\(\);/.test(mcode) && /FPTechWorld\.update\(dt\)/.test(mcode));
  const html = read('firstperson/index.html');
  const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(m => m[1]);
  const b = read('tools/build_single_html.py').match(/FP_JS = \[([\s\S]*?)\]/);
  const list = b ? [...b[1].matchAll(/"([^"]+)"/g)].map(m => m[1]) : [];
  check('T3 로드 순서 fp-world → fp-tech-world → fp-minimap (index.html · 빌더 FP_JS)',
    srcs.indexOf('fp-tech-world.js') === srcs.indexOf('fp-world.js') + 1 && srcs.indexOf('fp-minimap.js') === srcs.indexOf('fp-tech-world.js') + 1
    && list.indexOf('firstperson/fp-tech-world.js') === list.indexOf('firstperson/fp-world.js') + 1);
  check('T3 D19: 잘피밭 확대·ESS 소품 없음', !/seagrass|잘피|\bESS\b/.test(tw));
  check('T3 등록부 fp_tech_visual (assumption)', SOURCES.fp_tech_visual && SOURCES.fp_tech_visual.kind === 'assumption');
}

// ── T4 목표 비교 · 나와 사회 · 조감 연결 (firstperson/fp-society.js, js/tab-future.js) ──────────
{
  vm.runInContext(read('firstperson/fp-society.js'), ctx, { filename: 'fp-society.js' });
  const FS = vm.runInContext('FPSociety', ctx);
  const near = (a, b, tol) => Math.abs(a - b) <= tol;
  const mid = { renew: 0.55, nuclear: 0.15, ev: 0.5, ccus: 0.5, dac: 0.3, industry: 0.4, forest: 0 };
  const L = SC.leversFrom(mid);
  const rows = FS.table(2100, L), T = rows.find(r => r.key === 'T'), P = rows.find(r => r.key === 'ppm');
  check('T4 표: 열 = 기준 사회(현재 정책) · 우리 사회 · NDC 비교 · 1.5 °C, 행 = CO₂ → 기온 편차 → 해수온 → pH',
    FS.PATHS.map(p => p.id).join() === 'ssp245,custom,ndc,ssp119' && rows.map(r => r.key).join() === 'ppm,T,sst,pH');
  check('T4 표 값 = 엔진(문헌값 6-3 ±1 %): 2100년 현재 정책 548 ppm·2.26 °C · 1.5 °C 357·1.00 · NDC 53 % 372·1.09',
    near(P.vals.ssp245, 548, 5.5) && near(T.vals.ssp245, 2.26, 0.023) && near(P.vals.ssp119, 357, 3.6) && near(T.vals.ssp119, 1.0, 0.01)
    && near(P.vals.ndc, 372, 3.7) && near(T.vals.ndc, 1.09, 0.011), `${P.vals.ssp245.toFixed(0)}/${T.vals.ssp245.toFixed(2)} · ${P.vals.ssp119.toFixed(0)}/${T.vals.ssp119.toFixed(2)} · ${P.vals.ndc.toFixed(0)}/${T.vals.ndc.toFixed(2)}`);
  check('T4 우리 사회 열 = 1인칭 그 미래의 값(FPModel.pathRun custom 같은 해), 설계 없으면 비움',
    T.vals.custom === FM.sample(2100, FM.pathRun('custom', L)).T && FS.table(2050, null).every(r => r.vals.custom === null));
  // 문헌값 1-5 의 '여섯 가지 모두'는 걷기 31.5 kg(학교편)을 넣은 합이라 ACTIONS(자전거 147 kg)와 다르다 → 한 줄짜리 비행으로 맞춘다
  const me1 = FS.mineDelta(2100, { ids: ['flight'], recycleAccuracy: 1 });
  check('T4 나의 행동(대한민국 전체) = 문헌값 1-5: 장거리 왕복 비행 1회 2100년 −0.0017 °C', near(me1, -0.0017, 0.00006), me1.toFixed(5));
  const me = FS.mineDelta(2100, { ids: AC.ACTIONS.map(a => a.id), recycleAccuracy: 1 }), soc = FS.societyDelta(2100, L);
  check('T4 우리 사회(설계 예 중간) − 기준 사회 = 엔진 차이, 사회의 선택이 수백 배 이상(문헌값 6-3 읽는 법)', soc < 0 && soc / me > 100
    && soc === FM.sample(2100, FM.pathRun('custom', L)).T - FM.sample(2100, FM.pathRun('ssp245')).T, `${soc.toFixed(3)} °C · ${(soc / me).toFixed(0)}배`);
  check('T4 행동이 없으면 나의 행동 줄은 비움(숫자를 만들지 않음)', FS.mineDelta(2100, { ids: [] }) === null && FS.societyDelta(2100, null) === null);
  const q = new URLSearchParams(FS.aerialQuery(L)), back = JSON.parse(q.get('levers'));
  check('T4 조감 주소 = /dashboard?tab=future&preset=custom&levers=… (레버 일곱 칸 그대로 되돌아옴)', q.get('tab') === 'future' && q.get('preset') === 'custom'
    && Object.keys(ES.LEVER_NOW).every(k => back[k] === L[k]) && FS.aerialHref(L).startsWith('/dashboard?tab=future&preset=custom&levers='));
  const tf = read('js/tab-future.js');
  check('T4 조감 tab-future.js 는 주소 levers 읽기만 더함(window.__AERIAL_QUERY__ || location.search · 엔진 범위로 자름 · 세 비중 합 1)',
    /function leversFromQuery\(\)/.test(tf) && /window\.__AERIAL_QUERY__ \|\| location\.search/.test(tf) && /ES\.LEVER_RANGE\[k\]/.test(tf)
    && /if \(L\) \{ FUT\.preset = 'custom'; FUT\.levers = L;/.test(tf));
  const bd = read('tools/build_single_html.py');
  check('T4 단일 HTML: 1인칭 [data-aerial-go] → 껍데기가 조감을 열고 쿼리를 __AERIAL_QUERY__ 로', /closest\('\[data-aerial-go\]'\)/.test(bd) && /w\.__AERIAL_QUERY__ = tab\.slice/.test(bd));
  const fa = read('firstperson/fp-actions.js');
  check('T4 F4 미래 비교 카드에 \'우리 사회 차이\' 열(같은 함수 FPSociety.societyDelta)', /FPSociety\.societyDelta\(y, ours, r\.key\)/.test(fa));
}

// ── T5 [우리 사회] 탭 · 과제 ⑫~⑮ · 탐험 지도 (firstperson/fp-society.js) ─────────────
{
  const FS = vm.runInContext('FPSociety', ctx);
  const nos = FS.SOC_TASKS.map(t => t.no).join('');
  const field = read('firstperson/fp-field.js'), html = read('firstperson/index.html');
  const fieldNos = ['①', '②', '③', '④', '⑤'].every(n => new RegExp(`title: '${n} `).test(field));
  check('T5 과제 번호: 1장 ①~⑤(D3) 다음 2장 ⑥~⑪(F5 여섯) · 3장 ⑫~⑭ · 4장 ⑮ — 빈 번호 없음, 탐험 지도 표와 같음',
    nos === '⑫⑬⑭⑮' && fieldNos && FS.CHAPTERS.map(c => c.nos).join('|') === '①~⑤|⑥~⑪|⑫~⑭|⑮'
    && FS.SOC_TASKS.filter(t => t.chapter === 3).length === 3 && FS.SOC_TASKS.filter(t => t.chapter === 4).length === 1);
  check('T5 탐험 지도 네 장 = 관측자 · 시민 · 결정자 · 성찰 (T §6-3)', FS.CHAPTERS.map(c => c.role).join() === '관측자,시민,결정자,성찰');
  const none = FS.taskProgress({ tasks: {}, society: {} }, []);
  check('T5 아무것도 안 했으면 ⑫~⑮ 미완료', none.every(p => !p.done));
  const fp = { society: { levers: { ...ES.LEVER_NOW } }, tasks: {
    soc_design: { obs: { '고른 카드와 까닭': '재생 3단계' } },
    soc_measure: { obs: {}, diff: '우리 사회가 낮다' },
    soc_issue: { obs: { '찬성 근거': 'a', '우려 근거': 'b' }, diff: '' },
    soc_scale: { obs: { '견준 결과': 'x' }, diff: 'y' } } };
  const rows = [];
  const add = (n, path, kind, spot) => { for (let i = 0; i < n; i++) rows.push({ year: 2050, branch: 'base', path, kind, spot }); };
  add(5, 'custom', 'co2', 'airCity'); add(5, 'ssp245', 'co2', 'airCity'); add(5, 'custom', 'ph', 'sea'); add(4, 'ssp245', 'ph', 'sea');
  add(9, 'custom', 'co2', 'airGreen');                 // 녹지 CO₂ 는 세지 않는다
  rows.push({ year: 2100, branch: 'base', path: 'ssp245', kind: 'ph', spot: 'sea' });   // 다른 해는 세지 않는다
  const P = Object.fromEntries(FS.taskProgress(fp, rows).map(p => [p.task.id, p]));
  check('T5 판정은 기록 수·글 유무로만: ⑫ 설계 확정 + 글 → 완료, ⑭ 세 칸 중 판단이 비면 미완료(어느 쪽 판단이든 같음), ⑮ 두 칸 → 완료',
    P.soc_design.done && !P.soc_issue.done && P.soc_scale.done);
  check('T5 ⑬ = 2050년·기준 미래 갈래·경로(우리 사회 custom / 기준 사회 ssp245)·도심 CO₂·해수 pH 각 5 — 4/5 면 미완료',
    !P.soc_measure.done && P.soc_measure.subs.slice(0, 4).map(s => s.n).join() === '5,5,5,4');
  add(1, 'ssp245', 'ph', 'sea');
  check('T5 ⑬ 다섯째 기록으로 완료', FS.taskProgress(fp, rows).find(p => p.task.id === 'soc_measure').done);
  check('T5 설계 초안이 확정한 레버와 다르면 알림(draftChanged)', FS.draftChanged({ levers: { ...ES.LEVER_NOW }, cards: { renew: 0.55 } }) && !FS.draftChanged({ levers: SC.leversFrom({ renew: 0.55 }), cards: { renew: 0.55 } }));
  const src = read('firstperson/fp-society.js');
  check('T5 저장 모양 = 현장 과제와 같음 { id, title, link, obs, diff, scenario, time } (조감 renderFp, 마스터 §6-4) · 쟁점 메모 = fp.society.issueNotes',
    /fp\.tasks\[id\] \|\| \{ id, title: t\.title, link: TASK_LINK, obs: \{\} \}/.test(src) && /scenario: typeof FPScenario/.test(src) && /time: new Date\(\)\.toISOString\(\)/.test(src)
    && /so\.issueNotes = \{\}/.test(src));
  check('T5 탐험 지도 자리(#socMap)·과제 자리(#socTasks) · 첫 안내 셋째 장에 \'탐험 지도는 학습지 [과제] 탭\' · 교사용 ?chapter=',
    /id="socMap"/.test(html) && /id="socTasks"/.test(html) && /탐험 지도<\/b>[^<]*학습지 \[과제\] 탭/.test(html) && /q\.get\('chapter'\)/.test(src));
  const strs = (src.replace(/\/\/.*$/gm, '').match(/'[^'\n]*'|`[^`]*`/g) || []).join('\n');
  const BAN = [/완벽한/, /반드시/, /무조건/, /위험하다/, /포집하면.{0,15}배출|배출해도\s*(된|돼|괜찮)/, /소용없|의미 없/, /지구를 구|해결된다|해결돼요/];
  check('T5 문구 점검: [우리 사회]·과제 화면 글 금지 표현 0건', !BAN.some(re => re.test(strs)), BAN.filter(re => re.test(strs)).map(String).join(', '));
}

console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
process.exit(fails ? 1 : 0);
