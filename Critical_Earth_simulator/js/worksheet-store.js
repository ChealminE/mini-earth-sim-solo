// ============================================================================
// 학습지 공용 저장소 (4차 D3) — localStorage['worksheet.v1'] 읽기·쓰기만. DOM 없음
// ----------------------------------------------------------------------------
// 왜 따로 떼었나: 3차 E1의 저장소는 js/worksheet.js(조감 학습지 패널) 안에 있었는데, 그 파일은 조감 DOM(#wsTabInquiry 등)·
// Chart.js·GraphWorkspace·Inquiry 에 묶여 있어 1인칭에서 불러올 수 없다(마스터 §6-3). 1인칭 학습지 패널(firstperson/fp-sheet.js)과
// 조감 학습지가 같은 저장소를 쓰도록 저장소 부분만 여기로 옮겼다. 조감 동작은 그대로다(worksheet.js 가 open() 을 부른다).
//
// localStorage['worksheet.v1'] = {
//   answers: { 경로 id: { saveAs: 응답 } },  evidence: [...],  ui: {...},  inquiry: { on, pathId, idx, records },   ← 조감
//   fp: {                                                                                                            ← 1인칭
//     tasks:   { [id]: { id, title, link, obs: {연도: 글}, diff, scenario, time } },   // 조감 [기록] 탭 renderFp 가 읽는다 — 형태를 바꾸지 말 것(마스터 §6-4)
//     records: [ /* G1 — 측정 기록 */ ],
//     actions: { chosen: [...], scale: 'korea', society: 'ssp245', minigames: {...} },   // F·M
//     society: { cards: {...}, levers: {...}, savedAt, issueNotes: {...} },             // T (우리가 설계한 사회)
//     ui:      { sheetOpen, tab, onboarded, grade: 'high', chapter },                     // grade = 마스터 D15(고등학생만)
//   },
// }
// 처음 읽을 때 2차의 'inquiry.v1'이 있으면 한 번 옮겨 담는다(조감 open). 옛 키는 되돌리기 대비로 지우지 않는다.
// 모든 읽기·쓰기 try/catch — file:// 단일 HTML 등 저장소가 막힌 환경이면 이번 화면 동안만 메모리에 둔다(마스터 §6-4·§6-8).
// 그림(dataURL)은 넣지 않는다(용량 약 5 MB).
// 두 화면이 한 키를 나눠 쓰는 규칙: 조감은 fp 를 읽기만 하고(쓸 때 저장소의 최신 fp 를 다시 가져와 덮어쓰지 않는다),
// 1인칭은 fp 만 고친다(쓸 때마다 저장소 전체를 다시 읽고 fp 만 바꿔 쓴다 — 다른 창의 조감 응답을 지우지 않게).
// ============================================================================
const WorksheetStore = (() => {
  const KEY = 'worksheet.v1', OLD = 'inquiry.v1';
  let mem = null;   // 쓰기가 한 번이라도 막히면 그 뒤로는 이 메모리 사본이 기준이다
  const clone = o => JSON.parse(JSON.stringify(o));

  function readRaw() {
    if (mem) return clone(mem);
    try { const d = JSON.parse(localStorage.getItem(KEY) || 'null'); return d && typeof d === 'object' ? d : {}; }
    catch (e) { return {}; }
  }
  function writeRaw(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); mem = null; return true; }
    catch (e) { mem = clone(d); return false; }
  }
  // 묶음 하나가 없거나 모양이 다르면 빈 값으로 (예전 저장분·손상된 값 대비)
  function fill(o, defs) {
    for (const [k, v] of Object.entries(defs)) if (o[k] == null || typeof o[k] !== typeof v || Array.isArray(o[k]) !== Array.isArray(v)) o[k] = clone(v);
    return o;
  }
  const TOP = { answers: {}, evidence: [], fp: {}, ui: {}, inquiry: {} };
  const FP = { tasks: {}, records: [], actions: {}, society: {}, ui: {} };
  const FP_UI = { sheetOpen: false, tab: 'tasks', onboarded: false, grade: 'high', chapter: 1 };
  function normalizeFp(fp) {
    fill(fp, FP);
    fill(fp.ui, FP_UI);
    return fp;
  }

  // ── 조감 학습지(js/worksheet.js)용: 전체 묶음을 들고 있다가 save() 로 쓴다 ──
  // 3차 E1 저장소와 같은 동작: 기본 묶음 채우기 → inquiry.v1 옮기기(한 번) → 바로 한 번 쓰기.
  function open() {
    const d = fill(readRaw(), TOP);
    if (!d.migratedInquiryV1) {
      try {
        const o = JSON.parse(localStorage.getItem(OLD) || 'null');
        if (o) {
          // 2차 응답은 saveAs → 응답 하나의 평평한 묶음이었다 → 경로별로 나눈다
          for (const [saveAs, r] of Object.entries(o.answers || {})) (d.answers[r.path] = d.answers[r.path] || {})[saveAs] = r;
          d.inquiry = { on: !!o.on, pathId: o.pathId || null, idx: o.idx || 0, records: o.records || [] };
        }
      } catch (e) { /* 옛 기록을 못 읽으면 새로 시작 */ }
      d.migratedInquiryV1 = true;
    }
    // fp 는 1인칭이 쓰는 몫 — 조감은 읽기만 하므로, 쓰기 전에 저장소의 최신 fp 를 가져와 덮어쓰지 않게 한다
    const save = () => {
      const cur = readRaw();
      if (cur && cur.fp) d.fp = cur.fp;
      writeRaw(d);
    };
    save();
    return { data: d, save };
  }

  // ── 1인칭용: fp 묶음만 ──
  // readFp: 지금 저장된 fp(기본 묶음을 채운 사본). updateFp(fn): 최신 전체를 읽어 fn(fp) 으로 고친 뒤 쓴다.
  const readFp = () => normalizeFp(fill(readRaw(), TOP).fp);
  function updateFp(fn) {
    const d = fill(readRaw(), TOP);
    normalizeFp(d.fp);
    fn(d.fp);
    writeRaw(d);
    return d.fp;
  }
  return { KEY, open, readFp, updateFp, normalizeFp };
})();
if (typeof module !== 'undefined') module.exports = { WorksheetStore };
