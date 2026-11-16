// ============================================================================
// 학습지 내보내기 검사 (4차 G1) - firstperson/fp-export.js · fp-field.js 기록 저장
// ----------------------------------------------------------------------------
// TASK_4차_G §3 검사 1·2:
//   - 가짜 기록 30줄 → ② 지점별 요약의 n·평균·표준편차(n−1)가 손계산과 같다
//   - ③ 나의 행동 · ④ 미래 비교가 ActionsCore · 엔진(FPModel) 값과 같다
//   - ⑥ 미니게임 판 정확도 = 첫 시도 점수 합 ÷ 10
//   - 만든 .xlsx 를 zip 으로 열어 시트 7장 · 셀 개수 · 숫자 칸 타입(숫자)을 본다(압축 없는 zip 이라 node 로 직접 읽는다)
// 그 밖에 기록 저장(fp.records) 왕복·2,000줄 상한·CSV(BOM·열)·화면 연결(버튼·로드 순서)을 본다.
// DOM 없이 1인칭 파일들을 vm 으로 불러 순수 함수만 부른다(읽는 순간 DOM 을 건드리지 않는다 — 함정 10).
// 실행: node tools/test_export.js      (실패하면 종료 코드 1)
// ============================================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// 1인칭 index.html 과 같은 상대 순서(DOM·three.js 를 쓰는 파일은 뺐다)
const LOAD = ['js/earth-model.js', 'js/earth-data.js', 'js/sources.js', 'js/worksheet-store.js', 'js/xlsx-lite.js', 'js/earth-system.js', 'js/earth-visual.js',
  'js/society-core.js', 'js/actions-core.js', 'firstperson/fp-model.js', 'firstperson/fp-field.js', 'firstperson/fp-actions.js', 'firstperson/fp-society.js',
  'firstperson/fp-export.js', 'firstperson/fp-recycle-items.js'];
// 가짜 localStorage — 저장소가 막히지 않은 브라우저처럼(WorksheetStore 가 실제로 쓰고 읽는다)
const LS = new Map();
const localStorage = { getItem: k => (LS.has(k) ? LS.get(k) : null), setItem: (k, v) => { LS.set(k, String(v)); }, removeItem: k => LS.delete(k) };
const ctx = vm.createContext({ console, Math, URLSearchParams, location: { search: '' }, window: {}, localStorage, Blob, TextEncoder });
for (const f of LOAD) vm.runInContext(read(f), ctx, { filename: f });
const G = n => vm.runInContext(n, ctx);
const FX = G('FPExport'), F = G('FPField'), FS = G('FieldStore'), AC = G('ActionsCore'), FM = G('FPModel'), FA = G('FPActions');
const RI = G('RecycleItems'), SC = G('SocietyCore'), FSo = G('FPSociety'), WS = G('WorksheetStore');

let fails = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`);
  if (!ok) fails++;
}
const near = (a, b, tol = 1e-9) => typeof a === 'number' && Math.abs(a - b) <= tol;

// ── 가짜 기록 30줄 (저장 모양 fp.records) ─────────────────────────────────────
// CO₂ 도심 2026 현재 ×10 · 온도 녹지 2100 기준(현재 정책) ×8 · pH 개방 해역 2100 나의 미래 ×6 · 해수 분석기 냉수대 2050 기준(우리 사회) ×6
const recs = [];
let n = 0;
const rec = o => recs.push({ n: ++n, time: '2026-11-05T01:12:03.000Z', city: 0, society: '', scale: '', seaClass: null, nearCoral: false,
  transect: null, co2: 425.3, channels: null, waterTemp: null, x: 812.0, z: -35.5, ...o });
for (let i = 0; i < 10; i++) rec({ year: 2026, branch: 'now', path: 'ssp245', zone: 'city', spot: 'airCity', spotKo: '도심 대기', tool: 'co2', value: 440 + i, unit: 'ppm', transect: i * 2.5 });
for (let i = 0; i < 8; i++) rec({ year: 2100, branch: 'base', society: 'ssp245', path: 'ssp245', zone: 'green', spot: 'airGreen', spotKo: '녹지 대기', tool: 'temp', value: 15 + i * 0.2, unit: '°C' });
for (let i = 0; i < 6; i++) rec({ year: 2100, branch: 'mine', society: 'ssp126', scale: 'korea', city: 42, path: 'mine:ssp126:korea:bike+transit:city42', zone: 'ocean', spot: 'sea',
  spotKo: '해수(개방 해역)', seaClass: 'open', tool: 'ph', value: [8.01, 8.03, 8.02, 8.05, 8.04, 8.0][i], unit: 'pH', waterTemp: 20.1 });
for (let i = 0; i < 6; i++) rec({ year: 2050, branch: 'base', society: 'custom', path: 'custom', zone: 'ocean', spot: 'sea', spotKo: '해수(냉수대)', seaClass: 'cold',
  tool: 'sea', value: 2.1 + i * 0.01, unit: 'Ω', channels: { co2aq: 20 + i * 0.1, dic: 2100 + i, omega: 2.1 + i * 0.01, temp: 7.2 } });
check('가짜 기록 30줄', recs.length === 30);

// ── 기록 저장 (fp-field.js → fp.records) ──────────────────────────────────────
{
  const back = recs.map(F.fromRecord);
  const again = back.map(F.toRecord);
  check('G1 저장 줄 ↔ 기록 줄 왕복: 30줄 그대로(값 · 좌표 m ↔ 유닛 · 채널 · 경로 · 사회의 선택 · 규모 · 우리 도시 · 횡단 거리)', back.every(Boolean)
    && again.every((r, i) => r.value === recs[i].value && r.x === recs[i].x && r.z === recs[i].z && r.path === recs[i].path && r.society === recs[i].society
      && r.scale === recs[i].scale && r.city === recs[i].city && r.transect === recs[i].transect && JSON.stringify(r.channels) === JSON.stringify(recs[i].channels))
    && near(back[0].x, 812 / 50) && back[0].branchKo === '현재' && back[29].sw.dic === 2105);
  check('G1 깨진 저장 줄은 버린다(모르는 도구 · 값 없음)', F.fromRecord({ tool: 'wind', value: 1 }) === null && F.fromRecord({ tool: 'co2' }) === null && F.fromRecord(null) === null);
  const pp = F.pathParts;
  check('G1 path → 사회의 선택 · 참여 규모 · 우리 도시: 기준 = 선택 id, 나의 미래 = mine:선택:규모:행동, 우리 도시 = :cityNN, 과거·현재는 비움',
    JSON.stringify(pp('base', 'ssp126')) === '{"society":"ssp126","scale":"","city":0}'
    && JSON.stringify(pp('mine', 'mine:ndc:school:bike+tumbler:city25')) === '{"society":"ndc","scale":"school","city":25}'
    && JSON.stringify(pp('now', 'ssp245:city42')) === '{"society":"","scale":"","city":42}' && JSON.stringify(pp('past', 'ssp245')) === '{"society":"","scale":"","city":0}');
  // 저장소(가짜 localStorage)에 실제로 쌓이고, 상한에서 멈추고, 지우면 빈다
  LS.clear();
  check('G1 fp.records 기본 빈 배열 (worksheet-store)', Array.isArray(WS.readFp().records) && WS.readFp().records.length === 0);
  check('G1 기록 한 줄 저장 → 새로 읽어도 남음', FS.addRecord(recs[0]) === true && FS.loadRecords().length === 1 && FS.loadRecords()[0].value === 440);
  WS.updateFp(fp => { fp.records = Array.from({ length: F.RECORD_MAX - 1 }, (_, i) => ({ ...recs[0], n: i + 1 })); });
  const okLast = FS.addRecord(recs[1]), okOver = FS.addRecord(recs[2]);
  check(`G1 상한 ${F.RECORD_MAX}줄: 마지막 한 줄은 저장 · 넘으면 저장 안 함(자동 삭제 없음 — 앞 기록 그대로)`, F.RECORD_MAX === 2000 && okLast === true && okOver === false
    && WS.readFp().records.length === 2000 && WS.readFp().records[0].n === 1);
  FS.clearRecords();
  check('G1 기록 지우기 → fp.records 빈 배열 · 다른 fp 묶음(tasks) 그대로', WS.readFp().records.length === 0 && typeof WS.readFp().tasks === 'object');
  LS.clear();
}

// ── ① 측정 기록 · CSV ─────────────────────────────────────────────────────────
const S1 = FX.sheetRecords(recs);
{
  const H = S1[0];
  check('① 열 = 번호 · 기록 시각 · 연도 · 미래 갈래 · 사회의 선택 · 참여 규모 · 구역 · 측정 지점 · 측정 항목 · 값 · 단위 · X(m) · Z(m) · 횡단 거리(m)',
    H.join('|') === '번호|기록 시각|연도|미래 갈래|사회의 선택|참여 규모|구역|측정 지점|측정 항목|값|단위|X(m)|Z(m)|횡단 거리(m)');
  check('① 해수 분석기는 채널마다 한 줄(같은 번호) → 24 + 6×4 = 48줄', S1.length === 1 + 48
    && S1.filter(r => r[0] === 25).map(r => r[8]).join('|') === '해수분석 용존CO₂|해수분석 DIC|해수분석 Ω|해수분석 수온', `${S1.length - 1}줄`);
  const numCols = [0, 2, 9, 11, 12];
  check('① 숫자 칸은 숫자(번호 · 연도 · 값 · X · Z), 횡단 거리는 숫자 또는 빈칸', S1.slice(1).every(r => numCols.every(c => typeof r[c] === 'number') && (r[13] === '' || typeof r[13] === 'number'))
    && S1[2][13] === 2.5 && S1[12][13] === '');
  check('① 갈래 · 사회의 선택 · 참여 규모 칸 (나의 미래 = 선택 · 규모 · 우리 도시)', S1[1][3] === '현재' && S1[1][4] === '' && S1[11][3] === '기준 미래' && S1[11][4] === '현재 정책'
    && S1[19][3] === '나의 미래' && S1[19][4] === '파리협약 2 °C' && S1[19][5] === '대한민국 · 우리 도시 −42 %', `${S1[19].slice(3, 6).join(' / ')}`);
  check('① 소수 자리 = 분해능 (CO₂ 정수 · 온도 0.1 · pH 0.01 · DIC 정수)', S1[1][9] === 440 && S1[12][9] === 15.2 && S1[19][9] === 8.01 && S1.find(r => r[0] === 26 && r[8] === '해수분석 DIC')[9] === 2101);
  check('① 기록 시각은 읽는 시각(YYYY-MM-DD HH:MM:SS)', /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(S1[1][1]), S1[1][1]);
  const csv = FX.toCSV(recs);
  const L = csv.replace(/^\uFEFF/, '').split('\r\n');
  check('CSV: UTF-8 BOM · ① 과 같은 열 · 줄 수 · 쉼표 없는 칸', csv.charCodeAt(0) === 0xFEFF && L.length === S1.length && L[0] === S1[0].join(',')
    && L.every(l => l.split(',').length === 14) && L[1].split(',')[9] === '440');
  check('CSV 칸에 쉼표·따옴표가 있으면 따옴표로 감싼다', FX.toCSV([{ ...recs[0], spotKo: '도심, "대기"' }]).split('\r\n')[1].includes('"도심, ""대기"""'));
  check('파일 이름 = 미니지구_탐험기록_YYYYMMDD_HHMM.xlsx / .csv', FX.fileName('xlsx', new Date(2026, 10, 5, 9, 7)) === '미니지구_탐험기록_20261105_0907.xlsx'
    && FX.fileName('csv', new Date(2026, 0, 2, 13, 45)) === '미니지구_탐험기록_20260102_1345.csv');
}

// ── ② 지점별 요약 = 손계산 ────────────────────────────────────────────────────
{
  const S2 = FX.sheetSummary(recs);
  check('② 열 = 연도 · 미래 갈래 · 구역 · 측정 지점 · 측정 항목 · n · 평균 · 표준편차(n−1) · 최솟값 · 최댓값',
    S2[0].join('|') === '연도|미래 갈래|구역|측정 지점|측정 항목|n|평균|표준편차(n−1)|최솟값|최댓값');
  check('② 묶음 7개 (CO₂ · 온도 · pH · 해수 분석기 4채널)', S2.length === 1 + 7, `${S2.length - 1}`);
  const row = item => S2.find(r => r[4] === item);
  // 손계산: CO₂ 440~449 → 평균 444.5, s = √(82.5/9) = 3.03 → 3.0(분해능 1 ppm + 한 자리)
  //         온도 15.0~16.4(0.2 간격) → 평균 15.7, s = √(1.68/7) = 0.490 → 0.49
  //         pH 8.01 8.03 8.02 8.05 8.04 8.00 → 평균 8.025, s = √(0.00175/5) = 0.0187 → 0.019
  //         DIC 2100~2105 → 평균 2102.5, s = √(17.5/5) = 1.87 → 1.9
  const c = row('CO₂ (ppm)'), t = row('온도 (°C)'), p = row('pH'), d = row('해수분석 DIC (µmol/kg)');
  check('② CO₂ 도심 2026: n 10 · 평균 444.5 · s 3.0 · 최소 440 · 최대 449', c && c[5] === 10 && c[6] === 444.5 && c[7] === 3.0 && c[8] === 440 && c[9] === 449, c && c.slice(5).join(' '));
  check('② 온도 녹지 2100: n 8 · 평균 15.7 · s 0.49 · 최소 15 · 최대 16.4', t && t[5] === 8 && t[6] === 15.7 && t[7] === 0.49 && t[8] === 15 && t[9] === 16.4, t && t.slice(5).join(' '));
  check('② pH 개방 해역 2100 나의 미래: n 6 · 평균 8.025 · s 0.019', p && p[5] === 6 && p[6] === 8.025 && p[7] === 0.019 && p[8] === 8 && p[9] === 8.05, p && p.slice(5).join(' '));
  check('② DIC 냉수대 2050: n 6 · 평균 2102.5 · s 1.9', d && d[5] === 6 && d[6] === 2102.5 && d[7] === 1.9, d && d.slice(5).join(' '));
  check('② 갈래 칸에 사회의 선택 · 규모 · 우리 도시 (같은 지점의 다른 세계가 구분되게)', p[1] === '나의 미래 (파리협약 2 °C · 대한민국 · 우리 도시 −42 %)' && d[1] === '기준 미래 (우리가 설계한 사회)'
    && t[1] === '기준 미래' && c[1] === '현재', `${p[1]} / ${d[1]}`);
  // 한 줄뿐이면 표준편차 빈칸, 다른 해·다른 경로는 섞지 않는다
  const one = FX.sheetSummary([recs[0], { ...recs[1], year: 2100, branch: 'base', society: 'ssp245' }, { ...recs[2], year: 2100, branch: 'base', society: 'ssp119', path: 'ssp119' }]);
  check('② n = 1 이면 표준편차 빈칸 · 다른 해 · 다른 경로는 따로', one.length === 4 && one.slice(1).every(r => r[5] === 1 && r[7] === ''));
}

// ── ③ 나의 행동 = ActionsCore ─────────────────────────────────────────────────
{
  const chosen = { ids: ['tumbler', 'recycle', 'flight'], recycleAccuracy: 0.7 };
  const S3 = FX.sheetActions(chosen, 'world');
  check('③ 열 = 행동 · 1인 kg CO₂/년 · 원 자료 단위 · 참여 규모 · 사람 수 · 합계 t CO₂/년 · 출처 · 출처 기관', S3[0].join('|') === '행동|1인 kg CO₂/년|원 자료 단위|참여 규모|사람 수|합계 t CO₂/년|출처|출처 기관');
  const by = label => S3.find(r => r[0] === label);
  const AT = id => AC.ACTIONS.find(a => a.id === id);
  check('③ 1인 kg = ActionsCore (텀블러 3.5 · 분리배출 88 × 정확도 0.7 = 61.6 · 비행 1000)', by(AT('tumbler').label)[1] === 3.5 && by(AT('recycle').label)[1] === 61.6 && by(AT('flight').label)[1] === 1000);
  const world = AC.SCALES.find(s => s.id === 'world');
  check('③ 사람 수 = 참여 규모 (세계 10억, 비행은 국제선 상한 3.3억)', by(AT('tumbler').label)[4] === world.people && by(AT('flight').label)[4] === AT('flight').capPeople);
  const tot = S3[S3.length - 1];
  const want = AC.cutGtC(chosen, 'world') * AC.C_TO_CO2 * 1e9;
  check('③ 합계 t CO₂/년 = ActionsCore.cutGtC × 3.664 × 10⁹', tot[0] === '합계' && Math.abs(tot[5] - want) / want < 1e-9 && near(tot[1], 3.5 + 61.6 + 1000, 1e-9), `${tot[5]} t`);
  const SRC = G('SOURCES');
  check('③ 출처 = 등록부 label · org', by(AT('tumbler').label)[6] === SRC.act_tumbler.label && by(AT('tumbler').label)[7] === SRC.act_tumbler.org);
  check('③ 행동이 없으면 안내 한 줄', FX.sheetActions({ ids: [], recycleAccuracy: 0 }, 'me').length === 2);
  check('③ 숫자 칸은 숫자', S3.slice(1, -1).every(r => [1, 4, 5].every(i => typeof r[i] === 'number')));
}

// ── ④ 미래 비교 = 엔진 ─────────────────────────────────────────────────────────
{
  const chosen = { ids: ['bike', 'transit', 'flight'], recycleAccuracy: 0 };
  const st = { chosen, scale: 'korea', preset: 'ssp245', levers: null, choiceKo: '현재 정책' };
  const S4 = FX.sheetFuture(st);
  check('④ 열 = 연도 · 항목 · 기준 미래 · 나의 미래 · 차이 · 사회의 선택 · 참여 규모', S4[0].join('|') === '연도|항목|기준 미래|나의 미래|차이(나의 − 기준)|사회의 선택|참여 규모');
  check('④ 2050 · 2100 × CO₂ · 기온 편차 · 해수온 · pH = 8줄', S4.length === 9 && S4.slice(1, 5).every(r => r[0] === 2050) && S4.slice(5).every(r => r[0] === 2100));
  const base = FM.pathRun('ssp245'), mine = FM.mineRun('ssp245', null, chosen, 'korea');
  let ok = true; const dbg = [];
  for (const r of S4.slice(1)) {
    const cr = FA.CMP_ROWS.find(c => r[1].startsWith(c.label));
    const b = FM.sample(r[0], base)[cr.key], m = FM.sample(r[0], mine)[cr.key];
    if (r[2] !== Number(b.toFixed(cr.dec)) || r[3] !== Number(m.toFixed(cr.dec)) || r[4] !== Number((m - b).toFixed(cr.ddec))) { ok = false; dbg.push(r.join(' ')); }
  }
  check('④ 기준 미래 · 나의 미래 · 차이 = FPModel.pathRun / mineRun 값(미래 비교 카드와 같은 소수 자리)', ok, dbg.join(' / ') || `2100 CO₂ ${S4[5][2]} → ${S4[5][3]} (${S4[5][4]})`);
  check('④ 사회의 선택 · 참여 규모 칸', S4[1][5] === '현재 정책' && S4[1][6] === '대한민국');
  const none = FX.sheetFuture({ ...st, chosen: { ids: [], recycleAccuracy: 0 } });
  check('④ 행동이 없으면 나의 미래 · 차이 빈칸(기준 미래만)', none.slice(1).every(r => typeof r[2] === 'number' && r[3] === '' && r[4] === ''));
}

// ── ⑤ 과제 답 ─────────────────────────────────────────────────────────────────
{
  const tasks = {
    shell: { id: 'shell', title: '④ 조개껍데기', link: '', obs: { 2026: '단단함', 2100: '얇아짐' }, diff: 'pH 가 낮아져서' },
    coral: { id: 'coral', title: '③ 산호', obs: { 2026: ' ' }, diff: '' },
    soc_issue: { id: 'soc_issue', title: '⑭ 쟁점 카드 토론', obs: { '찬성 근거': '무탄소' }, diff: '둘 다 일리' },
  };
  const S5 = FX.sheetTasks(tasks);
  check('⑤ 열 = 과제 · 연도 · 관찰 글 · 달라진 점', S5[0].join('|') === '과제|연도|관찰 글|달라진 점');
  check('⑤ 연도 칸은 숫자 · 달라진 점은 첫 줄에만 · 빈 글 과제는 뺌 · 번호 순서', S5.length === 4 && S5[1][0] === '④ 조개껍데기' && S5[1][1] === 2026 && S5[1][3] === 'pH 가 낮아져서'
    && S5[2][1] === 2100 && S5[2][3] === '' && S5[3][0] === '⑭ 쟁점 카드 토론' && S5[3][1] === '' && S5[3][2] === '찬성 근거: 무탄소');
}

// ── ⑥ 미니게임: 판 정확도 = 첫 시도 점수 합 ÷ 10 ─────────────────────────────────
{
  const scores = [1, 1, 0.5, 0, 1, 1, 0.5, 1, 0, 1];   // 합 7 → 0.7
  const ids = RI.RECYCLE_ITEMS.filter(it => !it.spawnOnly).slice(0, 10);
  const rows = ids.map((it, i) => ({ id: it.id, name: it.name, chosen: it.bin, tries: [it.bin], bin: it.bin, prep: it.prep.slice(), done: scores[i] === 0.5 ? [] : it.prep.slice(),
    missing: scores[i] === 0.5 ? it.prep.slice() : [], score: scores[i], spawned: false }));
  rows.push({ id: 'pet_label', name: '떼어 낸 페트병 라벨', chosen: 'vinyl', tries: ['vinyl'], bin: 'vinyl', prep: [], done: [], missing: [], score: 1, spawned: true });
  const acc = RI.accuracy(rows);
  const e = FA.recycleEntry({ at: '2026-11-05T02:00:00Z', accuracy: acc, kg: RI.kgFor(acc), region: 'common', rows }, 1, id => (RI.BIN_INFO[id] || {}).name || id);
  const cafe = FA.cafeEntry({ at: '2026-11-05T01:00:00Z', drink: 'latte', drinkLabel: '카페라테', cup: 'tumbler', cupLabel: '텀블러', perWeek: 3 });
  const S6 = FX.sheetMinigame({ cafe: [cafe], recycle: [e] });
  const rh = S6.findIndex(r => String(r[0]).startsWith('분리배출'));
  const H = S6[rh], body = S6.slice(rh + 1);
  const ci = name => H.indexOf(name);
  const mainRows = body.filter(r => r[ci('비고')] !== '딸린 품목');
  const sum = mainRows.reduce((a, r) => a + r[ci('점수(첫 시도)')], 0);
  check('⑥ 카페 표(날짜 · 음료 · 컵 · 주당 잔 수) 위, 분리배출 표 아래', String(S6[0][0]).startsWith('카페') && S6[1][1] === '카페라테' && S6[1][3] === 3 && rh === 3);
  check('⑥ 판 정확도 = 첫 시도 점수 합 ÷ 10 (딸린 품목은 표에만)', near(acc, 0.7) && body.length === 11 && mainRows.length === 10 && near(sum / 10, body[0][ci('그 판 정확도')]),
    `합 ${sum} ÷ 10 = ${sum / 10} · 정확도 ${body[0][ci('그 판 정확도')]}`);
  const half = body.find(r => r[ci('점수(첫 시도)')] === 0.5);
  check('⑥ 빠진 준비 · 이유 칸 (품목 파일의 이유 한 줄)', ci('빠진 준비') > 0 && ci('이유') > 0 && half[ci('빠진 준비')] !== ''
    && body[0][ci('이유')] === RI.itemFor(ids[0].id).why);
  check('⑥ 점수 · 판 · 정확도 칸은 숫자', body.every(r => typeof r[ci('점수(첫 시도)')] === 'number' && typeof r[ci('판')] === 'number' && typeof r[ci('그 판 정확도')] === 'number'));
}

// ── ⑦ 우리 사회 ───────────────────────────────────────────────────────────────
{
  const cards = { renew: 0.8, nuclear: 0.15, ev: 1.0, carbon_price: true, grid: true };
  const levers = SC.leversFrom(cards);
  const so = { cards, levers, savedAt: '2026-11-05T03:00:00Z', issuesOpened: ['nuclear'], issueNotes: { nuclear: '안전이 걱정' } };
  const S7 = FX.sheetSociety(so);
  check('⑦ 설계 저장 시각 · 카드(기술 3 + 정책 2) · 단계', S7[0][0] === '설계 저장 시각' && /^\d{4}-/.test(S7[0][1])
    && S7.filter(r => r[1] === '기술').length === 3 && S7.filter(r => r[1] === '정책(열쇠)').length === 2 && S7.find(r => r[0] && r[0].startsWith('태양광'))[2] === 3);
  const lv = S7.find(r => r[0] === '재생 발전 비중');
  check('⑦ 레버 값(지금 · 우리 사회, %)', lv && typeof lv[1] === 'number' && lv[2] === Number((levers.renewShare * 100).toFixed(1)), lv && lv.join(' '));
  const tb = FSo.table(2100, { ...G('EarthSystem').LEVER_NOW, ...levers }).find(r => r.key === 'T');
  const row = S7.find(r => r[0] === 2100 && String(r[1]).startsWith('기온 편차'));
  check('⑦ 2100 기온 편차: 우리 사회 · 기준 사회 · NDC · 1.5 °C = FPSociety.table', row && row[2] === Number(tb.vals.custom.toFixed(2)) && row[3] === Number(tb.vals.ssp245.toFixed(2))
    && row[4] === Number(tb.vals.ndc.toFixed(2)) && row[5] === Number(tb.vals.ssp119.toFixed(2)), row && row.slice(2).join(' / '));
  check('⑦ 2050 · 2100 × CO₂ · 기온 편차 = 4줄', S7.filter(r => (r[0] === 2050 || r[0] === 2100) && /^(CO₂|기온 편차)/.test(r[1])).length === 4);
  check('⑦ 쟁점 메모', S7.some(r => r[0] === SC.issues.nuclear.title && r[1] === '안전이 걱정'));
  const empty = FX.sheetSociety({});
  check('⑦ 설계가 없어도 시트는 만든다(우리 사회 칸만 빈칸)', /확정하지 않았/.test(empty[0][1]) && empty.find(r => r[0] === 2100 && /^기온/.test(r[1]))[2] === ''
    && typeof empty.find(r => r[0] === 2100 && /^기온/.test(r[1]))[3] === 'number');
}

// ── G2: 학습지 표 모양은 LAYOUT 한 곳에서 (시트 이름 · 열 이름 · 순서 · 빼기) ───────────────────────────
{
  const L = FX.LAYOUT;
  check('G2 시트 이름 = LAYOUT 의 sheet (시트 7장 순서 ORDER)', FX.ORDER.length === 7 && FX.SHEET_NAMES.join('|') === FX.ORDER.map(k => L[k].sheet).join('|'));
  check('G2 ①~⑤ 머리줄 = LAYOUT cols 이름 그대로', ['records', 'summary', 'actions', 'future', 'tasks'].every(k => {
    const rows = { records: FX.sheetRecords(recs), summary: FX.sheetSummary(recs), actions: FX.sheetActions({ ids: ['bike'], recycleAccuracy: 0 }, 'me'),
      future: FX.sheetFuture({ chosen: { ids: [] }, scale: 'me', preset: 'ssp245', levers: null }), tasks: FX.sheetTasks({}) }[k];
    return rows[0].join('|') === L[k].cols.map(c => c[1]).join('|');
  }));
  // 동료 양식에 맞춘다고 치고: ① 열 순서 바꾸기 · 열 하나 빼기 · 이름 바꾸기 → 표와 CSV 가 그대로 따른다 (끝나면 되돌린다)
  const saved = L.records.cols.slice();
  L.records.cols = [saved[9], saved[8], saved[0]].map(c => c.slice());
  L.records.cols[0][1] = '측정값';
  const S = FX.sheetRecords(recs), C = FX.toCSV(recs).replace(/^\uFEFF/, '').split('\r\n');
  L.records.cols = saved;
  check('G2 LAYOUT 만 고치면 ① 열 순서 · 빼기 · 이름이 엑셀 · CSV 에 그대로 (값은 열 키로 따라감)', S[0].join('|') === '측정값|측정 항목|번호' && S[1].join('|') === '440|CO₂|1'
    && C[0] === '측정값,측정 항목,번호' && C[1] === '440,CO₂,1' && FX.sheetRecords(recs)[0].length === 14);
  const savedRn = L.minigame.rename;
  L.minigame.rename = { 컵: '고른 컵' };
  const M = FX.sheetMinigame({ cafe: [], recycle: [] });
  L.minigame.rename = savedRn;
  check('G2 ⑥ 미니게임 열 이름 바꾸기(rename) — 열은 M4 minigameTable 그대로', M[0].join('|') === '카페 — 날짜|음료|고른 컵|주당 잔 수');
}

// ── 엑셀 파일을 zip 으로 열기 ─────────────────────────────────────────────────
// xlsx-lite 는 압축 없는(STORE) zip — 로컬 파일 머리(PK\x03\x04)를 차례로 읽으면 파일 이름과 내용이 그대로 나온다
function unzipStore(buf) {
  const files = {};
  let o = 0;
  while (o + 30 <= buf.length && buf.readUInt32LE(o) === 0x04034b50) {
    const size = buf.readUInt32LE(o + 18), nl = buf.readUInt16LE(o + 26), xl = buf.readUInt16LE(o + 28);
    const name = buf.toString('utf8', o + 30, o + 30 + nl);
    files[name] = buf.toString('utf8', o + 30 + nl + xl, o + 30 + nl + xl + size);
    o += 30 + nl + xl + size;
  }
  return files;
}
(async () => {
  const st = {
    records: recs,
    fp: { tasks: { shell: { title: '④ 조개껍데기', obs: { 2026: '단단함' }, diff: '' } }, actions: { minigameLog: {} },
      society: {} },
    chosen: { ids: ['tumbler'], recycleAccuracy: 0 }, scale: 'class', preset: 'ssp245', levers: null, choiceKo: '현재 정책',
  };
  const wb = FX.workbook(st);
  const blob = G('buildXlsx')(wb);
  const buf = Buffer.from(await blob.arrayBuffer());
  const z = unzipStore(buf);
  const sheets = Object.keys(z).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k));
  const names = [...(z['xl/workbook.xml'] || '').matchAll(/<sheet name="([^"]+)"/g)].map(m => m[1]);
  check('xlsx: zip 으로 열림 · 시트 7장 · 이름 ①~⑦', sheets.length === 7 && names.join('|') === FX.SHEET_NAMES.join('|'), names.join(' · '));
  const nonEmpty = rows => rows.reduce((a, r) => a + r.filter(v => v !== null && v !== undefined && v !== '').length, 0);
  const cellCounts = wb.map((s, i) => [(z[`xl/worksheets/sheet${i + 1}.xml`].match(/<c r=/g) || []).length, nonEmpty(s.rows)]);
  check('xlsx: 시트마다 셀 개수 = 빈칸 아닌 칸 수', cellCounts.every(([a, b]) => a === b), cellCounts.map(([a]) => a).join(' · '));
  const x1 = z['xl/worksheets/sheet1.xml'];
  // ① 두 번째 줄(첫 기록) 의 값(J2) · 연도(C2) · X(L2) 는 숫자 칸(<v>), 측정 지점(H2) 은 글 칸(inlineStr)
  const cell = ref => (new RegExp(`<c r="${ref}"([^>]*)>(.*?)</c>`).exec(x1) || []);
  check('xlsx: ① 값 · 연도 · X 칸은 숫자 타입, 측정 지점은 글', /<v>440<\/v>/.test(cell('J2')[2] || '') && !/inlineStr/.test(cell('J2')[1] || 'x')
    && /<v>2026<\/v>/.test(cell('C2')[2] || '') && /<v>812<\/v>/.test(cell('L2')[2] || '') && /inlineStr/.test(cell('H2')[1] || '') && /도심 대기/.test(cell('H2')[2] || ''));
  check('xlsx: 첫 줄 고정 · 굵게(엑셀 정렬 · 필터가 첫 줄을 머리로)', /state="frozen"/.test(x1) && /<c r="A1" t="inlineStr" s="1">/.test(x1));

  // ── 화면 연결(정적) ──
  const html = read('firstperson/index.html'), field = read('firstperson/fp-field.js'), builder = read('tools/build_single_html.py');
  const btn = id => new RegExp(`<button id="${id}" class="btn btn--rec[^"]*" type="button">`).test(html);
  check('학습지 [기록] 아래 [엑셀로 내보내기](주) · [CSV로 내보내기] · [기록 지우기] — btn--rec', btn('fieldXlsxBtn') && btn('fieldCsvBtn') && btn('fieldClearBtn')
    && /id="fieldXlsxBtn" class="btn btn--rec is-on"/.test(html) && /엑셀로 내보내기/.test(html) && /CSV로 내보내기/.test(html));
  check('기록 지우기는 확인 대화 · 엑셀/CSV 는 FPExport', /confirm\(`측정 기록/.test(field) && /FPExport\.xlsx\(\)/.test(field) && /FPExport\.csv\(\)/.test(field) && !/FPField\.toCSV/.test(field));
  const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  check('1인칭 로드 순서: worksheet-store → xlsx-lite … fp-society → fp-export → fp-tools (빌더 FP_JS 와 같은 자리)',
    srcs.indexOf('/js/xlsx-lite.js') === srcs.indexOf('/js/worksheet-store.js') + 1 && srcs.indexOf('fp-export.js') === srcs.indexOf('fp-society.js') + 1
    && srcs.indexOf('fp-tools.js') === srcs.indexOf('fp-export.js') + 1
    && /"js\/worksheet-store\.js", "js\/xlsx-lite\.js"/.test(builder) && /"firstperson\/fp-society\.js", "firstperson\/fp-export\.js", "firstperson\/fp-tools\.js"/.test(builder));
  check('기록은 저장소에 · 되살림 · 상한 안내', /FieldStore\.addRecord\(toRecord\(row\)\)/.test(field) && /this\.rows\.push\(\.\.\.FieldStore\.loadRecords\(\)\)/.test(field) && /id="fieldCapNote"/.test(html));
  check('옛 야장 열(시각 · 바람 · 게임 시간 · 해수 pCO₂) 없음', !/wind: '무풍'|gameTime:|hour: FPWorld\.hour|pco2Sw:/.test(field));
  check('조감 안내 문구: "1인칭 학습지 [기록]의 엑셀로"', /1인칭 학습지 \[기록\]의 엑셀로/.test(read('js/worksheet.js')) && !/야장\(F\)의 CSV/.test(read('js/worksheet.js')));

  console.log(fails ? `\n${fails}개 실패` : '\n전부 통과');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
