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

// ── C2 기온 · 해수온 (§6-5 · §6-6) ─────────────────────────────────────────
{
  const AIR_T0 = vm.runInContext('AIR_T0', ctx);
  const r = FM.pathRun('ssp245'), s20 = FM.sample(2020, r), s1750 = FM.sample(1750, r), s2100 = FM.sample(2100, r);
  check('AIR_T0 = 14 °C (earth-model.js, 값 불변 — 조감 기록 표와 같은 기준)', AIR_T0 === 14);
  check('tab-future.js 는 AIR_T0 를 다시 선언하지 않는다 (단일 HTML 중복 선언 방지)', !/const AIR_T0\b/.test(read('js/tab-future.js')));
  check('육지 증폭 = 1.59/1.09 ≈ 1.46 (AR6 SPM A.1.2)', Math.abs(FM.K.LAND_AMP - 1.46) < 0.01, FM.K.LAND_AMP.toFixed(4));
  check('해양 증폭 = 0.88/1.09 ≈ 0.81', Math.abs(FM.K.OCEAN_AMP - 0.81) < 0.01, FM.K.OCEAN_AMP.toFixed(4));
  let ampG = true, ampO = true, sstOk = true;
  for (const p of PATHS) for (const y of [1850, 1950, 2023, 2050, 2100, 2200]) {
    const s = FM.sample(y, FM.pathRun(p));
    if (Math.abs((FM.airTemp('green', s) - AIR_T0) / s.T - 1.46) > 0.01) ampG = false;
    if (Math.abs((FM.airTemp('ocean', s) - AIR_T0) / s.T - 0.81) > 0.01) ampO = false;
    if (FM.seaTemp(0, s) !== s.sst) sstOk = false;
  }
  check('녹지 대기 편차 ÷ T = 1.46 ± 0.01 (세 경로 × 6개 연도)', ampG);
  check('해양 대기 편차 ÷ T = 0.81 ± 0.01', ampO);
  check('개방 해역 수온 = 엔진 o.sst (차이 0, 조감 water_temp 와 같은 값)', sstOk);
  // 1750년 엔진 T는 0에 아주 가깝지만 정확히 0은 아니다(첫해 배출 적분) → ±0.01
  check('1750년: 세 구역 대기 ≈ AIR_T0 (T ≈ 0, 도시 없음)', ['green', 'ocean', 'city'].every(z => Math.abs(FM.airTemp(z, s1750) - AIR_T0) < 0.1)
    && ['green', 'ocean'].every(z => Math.abs(FM.airTemp(z, s1750) - AIR_T0) < 0.01), `T ${s1750.T.toExponential(2)}`);
  const uhi = s => FM.airTemp('city', s) - FM.airTemp('green', s);
  check('도심 − 녹지: 2020년 2.0 ± 0.01 °C (fp_uhi)', Math.abs(uhi(s20) - 2) < 0.01, uhi(s20).toFixed(4));
  check('도심 − 녹지: 1750년 < 0.1 °C', uhi(s1750) < 0.1, uhi(s1750).toFixed(4));
  check('도심 − 녹지: 2020년 열섬은 세 경로가 같다 (역사 구간)', PATHS.every(p => uhi(FM.sample(2020, FM.pathRun(p))) === uhi(s20)));
  check('열섬은 도시 규모를 따라 줄지 않는다 (1.5 °C 경로 2100 ≥ 2020)', uhi(FM.sample(2100, FM.pathRun('ssp119'))) >= uhi(s20),
    `ssp119 2100 ${uhi(FM.sample(2100, FM.pathRun('ssp119'))).toFixed(2)} · ssp245 2100 ${uhi(s2100).toFixed(2)}`);
  let coldOk = true, iceOk = true;
  for (const p of PATHS) for (const o of FM.pathRun(p)) {
    for (const prox of [0, 0.5, 1]) if (FM.seaTemp(prox, o) < -1.9) coldOk = false;
    if (FM.iceSurfaceTemp(o) > 0) iceOk = false;
  }
  // 엔진 궤적만으로는 상한에 안 닿으므로 큰 T 를 직접 넣어 상한·하한도 본다
  const hot = { T: 20, sst: 38 }, cold = { T: 0, sst: 5 };
  check('냉수대 수온 ≥ −1.9 °C (세 경로 전 구간 + 차가운 바다)', coldOk && FM.seaTemp(1, cold) === -1.9);
  check('빙하 표면 ≤ 0 °C (세 경로 전 구간 + T 20 °C)', iceOk && FM.iceSurfaceTemp(hot) === 0);
  check('냉수대: 유빙 바로 옆 = sst − 12', Math.abs(FM.seaTemp(1, s20) - (s20.sst - 12)) < 1e-12);
  let jMax = 0;
  for (let x = -3; x <= 3; x += 0.013) for (let z = -1.5; z <= 1.5; z += 0.017) jMax = Math.max(jMax, Math.abs(FM.tempJitter(x, z)));
  check('지점 흔들림 |j| ≤ 0.3 °C (열섬 2 °C보다 충분히 작게, fp_jitter)', jMax <= 0.3 + 1e-12, `최대 ${jMax.toFixed(3)}`);
  check('알 수 없는 구역은 오류', (() => { try { FM.airTemp('beach', s20); return false; } catch (e) { return true; } })());
}
{
  // 옛 회귀식·여름 정오 기준·지면 3종이 1인칭에 남아 있지 않은가 (주석은 빼고 코드만)
  const code = f => read(f).replace(/\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
  const fp = ['firstperson/fp-world.js', 'firstperson/fp-tools.js', 'firstperson/fp-field.js', 'firstperson/fp-main.js'];
  check('warmingSince280·climateAnomaly 삭제 (earth-model.js·1인칭 어디서도 안 씀)',
    !/warmingSince280|climateAnomaly/.test(code('js/earth-model.js')) && fp.every(f => !/warmingSince280|climateAnomaly/.test(code(f))));
  check('계절 표·일교차 곡선 삭제 (SEASONS·seasonDef·diurnal)', fp.every(f => !/\bSEASONS\b|seasonDef|seasonEnv|diurnal|DIURNAL_AT_NOON/.test(code(f))));
  const tools = code('firstperson/fp-tools.js');
  check('온도계 지점에 지면 3종 없음 (해변 모래·녹지 지면·도시 지면, D9)', !/beach\s*:|'beach'|녹지 지면|도시 지면|해변 모래/.test(tools)
    && !/녹지 지면|도시 지면|해변 모래/.test(code('firstperson/fp-field.js')) && !/녹지 지면|도시 지면|해변 모래/.test(code('firstperson/index.html')));
  check('도움말 온도계 문단에 "연평균"', /<b>1 온도계<\/b>[\s\S]{0,300}연평균/.test(read('firstperson/index.html')));
}

// ── C3 구역 대기 CO₂ (§6-3 · §6-4) ─────────────────────────────────────────
{
  const r = FM.pathRun('ssp245'), s20 = FM.sample(2020, r), s1750 = FM.sample(1750, r), s2100 = FM.sample(2100, r);
  const urb = s => FM.zoneCO2('city', s) - s.ppm;
  let oceanOk = true;
  for (const p of PATHS) for (const o of FM.pathRun(p)) if (Math.abs(FM.zoneCO2('ocean', o) - o.ppm) > 0.01) oceanOk = false;
  check('해양 대기 CO₂ = 배경 ±0.01 ppm (세 경로 전 구간, 문헌값 2-4)', oceanOk);
  check('도심 − 배경: 2020년 23 ± 0.5 ppm (서울 도시 증가분, 문헌값 2-3)', Math.abs(urb(s20) - 23) <= 0.5, urb(s20).toFixed(3));
  check('도심 − 배경: 1750년 < 1 ppm', urb(s1750) < 1, urb(s1750).toFixed(3));
  check('도심 − 배경: 현재 정책 2100년 < 2020년', urb(s2100) < urb(s20), `${urb(s2100).toFixed(2)} < ${urb(s20).toFixed(2)}`);
  check('도심 − 배경: 2020년은 세 경로가 같다 (역사 구간)', PATHS.every(p => urb(FM.sample(2020, FM.pathRun(p))) === urb(s20)));
  const u119 = FM.sample(2100, FM.pathRun('ssp119'));
  check('도심 증가분 ≥ 0 (화석 배출 음수인 1.5 °C 2100년 → 0)', urb(u119) === 0 && FM.pathRun('ssp119').every(o => urb(o) >= 0), `F ${u119.fossil.toFixed(2)}`);
  check('localCut 0.42 → 증가분 × 0.58, 상한 0.42에서 멈춤 (문헌값 1-6)',
    Math.abs(FM.zoneCO2('city', s20, { localCut: 0.42 }) - s20.ppm - urb(s20) * 0.58) < 1e-9
    && FM.zoneCO2('city', s20, { localCut: 0.9 }) === FM.zoneCO2('city', s20, { localCut: 0.42 })
    && FM.zoneCO2('city', s20, { localCut: -1 }) === FM.zoneCO2('city', s20));
  const g = FM.zoneCO2('green', s20), t = FM.zoneCO2('green', s20, { treeShade: 1 });
  check('녹지 < 배경, 나무 밑 < 녹지 (3차 낮 정상 상태값, assumption)', g < s20.ppm && t < g, `녹지 ${(g - s20.ppm).toFixed(1)} · 나무 밑 ${(t - s20.ppm).toFixed(1)} ppm`);
  check('국소 굴뚝: 그해 화석 배출 ≤ 0이면 굴뚝 곁도 배경과 같음 (stackLevel)', FM.zoneCO2('city', u119, { stackNear: 1 }) === FM.zoneCO2('city', u119)
    && FM.zoneCO2('city', s20, { stackNear: 1 }) > FM.zoneCO2('city', s20) + 200);
  check('국소 배기구: 근접도 1 → +110 ppm', Math.abs(FM.zoneCO2('ocean', s20, { exhaustNear: 1 }) - s20.ppm - 110) < 1e-9);
  check('측정 하한 150 ppm', FM.zoneCO2('green', { ppm: 160, fossil: 0 }, { treeShade: 1 }) === 150);
  check('알 수 없는 구역은 오류', (() => { try { FM.zoneCO2('sky', s20); return false; } catch (e) { return true; } })());
  const code = f => read(f).replace(/\/\/.*$/gm, '');
  const tools = code('firstperson/fp-tools.js');
  check('옛 구역 오프셋·적분 삭제 (CO2_ZONE·zoneCO2Target·AIR_TAU_Z, 도심 +55~+120·해양 −15~−30)',
    !/CO2_ZONE|zoneCO2Target|AIR_TAU_Z|FPAir\.D\b|this\.D\[/.test(tools));
  // 측정(fp-tools measureCO2)과 HUD '이 지점 공기'(fp-main, C4에서 FPAir.zoneCO2 대신 직접)가 같은 함수를 부른다
  check('구역 CO₂ 계산은 FPModel.zoneCO2 하나 (fp-tools 측정·fp-main HUD)', /FPModel\.zoneCO2\(/.test(tools) && /FPModel\.zoneCO2\(/.test(code('firstperson/fp-main.js'))
    && !/\* 260|\* 110|55 \+ 60/.test(tools));
}

// ── C4 바다 = 엔진의 그해 표층 상태 (§6-2, 수용 조건 10) ─────────────────────
{
  const pco2FromDic = vm.runInContext('pco2FromDic', ctx);
  let dpH = 0, dOm = 0, dT = 0, dP = 0;
  for (const p of PATHS) for (const y of YEARS) {
    const s = FM.sample(y, FM.pathRun(p)), o = FM.seaState(0, s);
    dpH = Math.max(dpH, Math.abs(o.pH - s.pH)); dOm = Math.max(dOm, Math.abs(o.omega - s.omega));
    dT = Math.max(dT, Math.abs(o.temp - s.sst)); dP = Math.max(dP, Math.abs(o.pco2 - pco2FromDic(s.dic, s.sst).pco2));
  }
  check('개방 해역 pH = 엔진 o.pH ±0.001 (세 경로 × 7개 연도)', dpH <= 0.001, `최대 차 ${dpH.toExponential(1)}`);
  check('개방 해역 Ω = 엔진 o.omega ±0.01', dOm <= 0.01, `최대 차 ${dOm.toExponential(1)}`);
  check('개방 해역 수온 = 엔진 o.sst (차이 0)', dT === 0);
  check('해수 pCO₂ = pco2FromDic(o.dic, o.sst) (엔진과 같은 함수)', dP === 0);
  const s23 = FM.sample(2023, FM.pathRun('ssp245')), c23 = FM.seaState(1, s23);
  check('냉수대: 같은 해수 pCO₂, 더 차가운 물 → Ω 더 낮음 (헨리 법칙·석회화)', c23.pco2 === FM.seaState(0, s23).pco2 && c23.omega < s23.omega,
    `Ω 개방 ${s23.omega.toFixed(2)} · 냉수대 ${c23.omega.toFixed(2)}`);
  // 냉수대 Ω < 1 경고: 억지로 켜지 않는다 — 실제 최솟값을 남긴다(세이브포인트)
  let omMin = Infinity, omAt = '';
  for (const p of PATHS) for (const o of FM.pathRun(p)) { const w = FM.seaState(1, o).omega; if (w < omMin) { omMin = w; omAt = `${p} ${o.year}`; } }
  console.log(`보고  냉수대(유빙 바로 옆) Ω 최솟값 ${omMin.toFixed(3)} (${omAt}) — ${omMin < 1 ? 'Ω<1 경고 켜짐' : 'Ω<1 경고 안 뜸(정직한 결과)'}`);
  const V2 = V;
  let bleachOk = true;
  for (const p of PATHS) for (const o of FM.pathRun(p)) {
    if (Math.abs(FM.coralState(0, o).bleach - (1 - V2.coralHealthy(o.T))) > 1e-12) bleachOk = false;
    if (FM.coralState(1, o).bleach !== 0) bleachOk = false;
  }
  check('개방 해역 산호 백화 = 1 − EarthVisual.coralHealthy(T) (조감과 같은 식), 유빙 옆 냉수대 0', bleachOk);
  check('산호 서식지 = habitatFromOmega(그 자리 Ω): Ω 1 → 0, 3.4 → 1', FM.habitatFromOmega(1) === 0 && FM.habitatFromOmega(3.4) === 1
    && FM.coralState(1, s23).habitat === FM.habitatFromOmega(c23.omega));
  check('어류·수초 건강: 1750년 1, 현재 정책 2100 < 2023', FM.oceanHealth(FM.sample(1750, FM.pathRun('ssp245'))) === 1
    && FM.oceanHealth(FM.sample(2100, FM.pathRun('ssp245'))) < FM.oceanHealth(s23));
  // 주석(//·<!-- -->·/* */)은 빼고 본다 — 지운 이유를 적은 주석은 남아도 된다
  const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/<!--[\s\S]*?-->/g, '');
  const fp = ['firstperson/fp-world.js', 'firstperson/fp-tools.js', 'firstperson/fp-field.js', 'firstperson/fp-main.js', 'firstperson/index.html', 'firstperson/style.css'];
  const bad = fp.filter(f => /stepSeaCO2|equilibrateSeaCO2|SEA_TAU_SW|pco2Sea|oceanAirCO2|seaEqBtn|seaEqState|평형 중|즉시 평형|\bFPAir\b|AIR_DAY_S|AIR_TICK/.test(code(f)));
  check('해수 평형 적분·즉시 평형 버튼·FPAir 틱 삭제', bad.length === 0, bad.join(', '));
  const bad2 = fp.filter(f => /SEA_BASE_T|BLEACH_ON|BLEACH_FULL|bleachFromTemp|ICE_SIZE_K/.test(code(f)));
  check('옛 백화 임계(18 °C 기준)·유빙 고정 배수 삭제', bad2.length === 0, bad2.join(', '));
  check('유빙 크기 = EarthVisual.glacierFrac(T), 충돌체 같이 갱신', /glacierFrac\(T\)/.test(code('firstperson/fp-world.js')) && /collider\.r\s*=/.test(code('firstperson/fp-world.js')));
}

// ── C5 시각 언어 = EarthVisual 규칙 ──────────────────────────────────────────
{
  const N = 8;   // fp-world.js bldDefs 건물 수
  const nB = (read('firstperson/fp-world.js').match(/const bldDefs = \[([\s\S]*?)\n  \];/) || [, ''])[1].split('],').filter(t => /\d/.test(t)).length;
  check('건물 정의 8채 (fp-world.js bldDefs)', nB === N, `${nB}`);
  const st = (p, y) => { const s = FM.sample(y, FM.pathRun(p)); return FM.cityState(s, FM.society(s, p), N); };
  const c1750 = st('ssp245', 1750), c2023 = st('ssp245', 2023);
  check('1750년: 건물 1~2채, 자동차 0대, 굴뚝·연기 없음, 포집 타워 없음', c1750.buildings >= 1 && c1750.buildings <= 2 && c1750.cars === 0 && !c1750.stackOn && c1750.removal === 0,
    `건물 ${c1750.buildings} 높이×${c1750.heightK.toFixed(2)}`);
  check('1900년: 아직 자동차 없음 (조감과 같은 carFrac)', st('ssp245', 1900).cars === 0);
  check('2023년: 전기차 = round(대수 × LEVER_NOW.ev)', c2023.evCars === Math.round(c2023.cars * ES.LEVER_NOW.ev) && c2023.cars + 0 === c2023.evCars + c2023.gasCars,
    `${c2023.cars}대 중 전기 ${c2023.evCars}`);
  let mono = true;
  for (const p of PATHS) { let prev = null; for (const o of FM.pathRun(p)) { const c = FM.cityState(o, FM.society(o, p), N);
    if (prev && (c.buildings < prev.buildings || c.heightK < prev.heightK || c.cars < prev.cars)) mono = false; prev = c; } }
  check('건물 수·높이·자동차 대수는 줄지 않는다 (누적 최댓값, 세 경로 전 구간)', mono);
  const u = st('ssp119', 2100);
  check('1.5 °C 2100: 화석 배출 음수 → 굴뚝·연기 없음, 포집 타워, 전부 전기차', !u.stackOn && u.removal > 0 && u.gasCars === 0, `차 ${u.cars} 전기 ${u.evCars} 포집 ${u.removal.toFixed(2)}`);
  check('같은 해 같은 도시: 도시 규모·굴뚝 = 조감 EarthVisual.cityLevel·stackLevel', PATHS.every(p => YEARS.every(y => {
    const s = FM.sample(y, FM.pathRun(p)), c = FM.cityState(s, FM.society(s, p), N);
    return c.level === V.cityLevel(s.cumFossilMax) && c.stack === V.stackLevel(s.fossil);
  })));
  const levers = { ...ES.LEVER_NOW, ev: 0.8 };
  const sc = FM.sample(2050, FM.pathRun('custom', levers));
  check('직접 설계: 전기차 비율 = 그해 레버 값 (조감 applyLevers3D 와 같은 규칙)', FM.society(sc, 'custom', levers).ev === ES.leversAt(levers, 2050).ev);
  // 하늘·안개·파도는 CO₂와 무관 — 연출 코드에서 CO₂ 비례 항이 없어야 한다
  const code = f => read(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  const w = code('firstperson/fp-world.js'), m = code('firstperson/fp-main.js'), pl = code('firstperson/fp-player.js');
  check('하늘·안개 고정: HAZY_SKY·daySky·co2k 없음', ![w, m, pl, code('firstperson/fp-tools.js'), code('firstperson/fp-minimap.js')].some(t => /HAZY_SKY|daySky|co2k/.test(t)));
  check('파도 고정: waveHeightAt·waveNormalAt 에 세기(intensity) 항 없음, 1인칭 몸과 수면이 같은 식', !/intensity \* 0\.5|FPWorld\.co2 - 280/.test(w + pl) && /waveHeightAt\(lx, -z, t\)/.test(pl));
  check('세계 상태 함수 하나: applyWorldState(s, soc), applyWorldCO2 없음', /function applyWorldState\(s, soc\)/.test(w) && !/applyWorldCO2/.test(w + m));
  const body = (w.match(/function applyWorldState\(s, soc\) \{([\s\S]*?)\n\}/) || [, ''])[1];
  check('applyWorldState 는 CO₂(s.ppm)를 숫자 기록에만 쓴다 (연출에는 안 씀)', (body.match(/s\.ppm/g) || []).length === 1 && /FPWorld\.co2 = s\.ppm/.test(body));
  check('CO2_MIN/CO2_MAX 상수 불변 (280 / 1000, 함정 7)', vm.runInContext('CO2_MIN === 280 && CO2_MAX === 1000', ctx));
  check('건물·자동차·굴뚝·포집 타워 충돌체가 보이는 것과 같이 갱신된다', /b\.box\.top = on \?/.test(body) && /car\.box\.minX = car\.box\.maxX/.test(body)
    && /stack\.col\.top = C\.stackOn/.test(body) && /tower\.col\.top = on/.test(body));
  console.log('\n      C5 도시 모습 (건물 수·높이 배율 · 자동차 대수(전기) · 굴뚝 · 포집)');
  for (const p of PATHS) console.log('      ' + p + '  ' + [1750, 1850, 1950, 2023, 2050, 2100].map(y => {
    const c = st(p, y); return `${y}: 건물 ${c.buildings}×${c.heightK.toFixed(2)} 차 ${c.cars}(${c.evCars}) 굴뚝 ${c.stackOn ? c.stack.toFixed(2) : '없음'}${c.removal > 0 ? ' 포집' : ''}`;
  }).join(' | '));
}

// ── 표 (세이브포인트에 붙인다) ───────────────────────────────────────────────
console.log('\n      경로     연도   CO₂ppm   T°C    sst°C   pH      Ω      화석GtC  누적최대GtC');
for (const p of PATHS) {
  for (const y of [1750, 2023, 2026, 2100]) {
    const s = FM.sample(y, FM.pathRun(p));
    console.log(`      ${p}  ${y}  ${s.ppm.toFixed(1).padStart(7)}  ${s.T.toFixed(3).padStart(6)}  ${s.sst.toFixed(3)}  ${s.pH.toFixed(4)}  ${s.omega.toFixed(3)}  ${s.fossil.toFixed(2).padStart(7)}  ${s.cumFossilMax.toFixed(1).padStart(7)}`);
  }
}

console.log('\n      C2 지점 기온 (°C, 연평균, 흔들림 제외)');
console.log('      경로     연도   해양대기  녹지대기  도심대기  해수(개방)  해수(냉수대)  빙하표면');
for (const p of PATHS) {
  for (const y of [1750, 2023, 2026, 2100]) {
    const s = FM.sample(y, FM.pathRun(p)), f = v => v.toFixed(2).padStart(8);
    console.log(`      ${p}  ${y}  ${f(FM.airTemp('ocean', s))}  ${f(FM.airTemp('green', s))}  ${f(FM.airTemp('city', s))}  ${f(FM.seaTemp(0, s))}    ${f(FM.seaTemp(1, s))}    ${f(FM.iceSurfaceTemp(s))}`);
  }
}

console.log('\n      C3 구역 대기 CO₂ (ppm, 연평균, 계측 오차 제외 · 괄호 = 배경과의 차)');
console.log('      경로     연도   배경     해양대기        녹지대기        나무밑(근접1)    도심대기');
for (const p of PATHS) {
  for (const y of [1750, 2023, 2026, 2100]) {
    const s = FM.sample(y, FM.pathRun(p)), f = v => `${v.toFixed(1).padStart(6)} (${(v - s.ppm >= 0 ? '+' : '') + (v - s.ppm).toFixed(1)})`.padEnd(15);
    console.log(`      ${p}  ${y}  ${s.ppm.toFixed(1).padStart(6)}  ${f(FM.zoneCO2('ocean', s))} ${f(FM.zoneCO2('green', s))} ${f(FM.zoneCO2('green', s, { treeShade: 1 }))} ${f(FM.zoneCO2('city', s))}`);
  }
}

console.log('\n      C4 바다 (개방 해역 = 엔진 · 냉수대 = 유빙 바로 옆) · 산호 백화·서식지 · 어류 건강 · 유빙 크기');
console.log('      경로     연도   해수pCO₂  pH(개방)  Ω(개방)  pH(냉수)  Ω(냉수)  백화(개방)  서식지(개방/냉수)  어류건강  유빙');
for (const p of PATHS) {
  for (const y of [1750, 2023, 2026, 2100]) {
    const s = FM.sample(y, FM.pathRun(p)), o = FM.seaState(0, s), c = FM.seaState(1, s), co = FM.coralState(0, s), cc = FM.coralState(1, s);
    console.log(`      ${p}  ${y}  ${o.pco2.toFixed(1).padStart(7)}  ${o.pH.toFixed(4)}   ${o.omega.toFixed(3)}    ${c.pH.toFixed(4)}   ${c.omega.toFixed(3)}    ${(co.bleach * 100).toFixed(0).padStart(3)} %       ${co.habitat.toFixed(2)} / ${cc.habitat.toFixed(2)}        ${FM.oceanHealth(s).toFixed(2)}     ${V.glacierFrac(s.T).toFixed(2)}`);
  }
}

console.log(fails ? `\n실패 ${fails}건` : '\n전부 통과');
process.exit(fails ? 1 : 0);
