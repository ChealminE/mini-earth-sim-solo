// ============================================================================
// 1인칭 학습지 내보내기 (4차 G1) — 학습지 [기록] 탭의 [엑셀로 내보내기] · [CSV로 내보내기]
// ----------------------------------------------------------------------------
// 왜: 1인칭에서 잰 값·고른 행동·미래 비교·과제 글을 수업 학습지의 표와 같은 모양으로 가져 나가게 한다(TASK_4차_G §1).
//   엑셀(.xlsx) = 시트 7장 ① 측정 기록 ② 지점별 요약 ③ 나의 행동 ④ 미래 비교 ⑤ 과제 답 ⑥ 미니게임 ⑦ 우리 사회
//   CSV       = ① 측정 기록만(UTF-8 + BOM — 엑셀이 한글을 깨지 않게), 열은 ①과 같다.
//   시트·열 이름은 기본안이다 — 마스터 D7: 수업 설계 동료와 확정(G2)하면 아래 HEAD 표들만 고친다.
// 엑셀 파일은 조감과 같은 js/xlsx-lite.js(buildXlsx · downloadBlob)로 만든다 — 새 라이브러리를 넣지 않는다(마스터 §6-2).
// 숫자 칸은 숫자로 넣는다(문자열 금지) — 학생이 엑셀에서 바로 평균·그래프를 낼 수 있게. 소수 자리는 계측기 분해능 그대로.
// 숫자를 만들지 않는다: 행동 kg·사람 수는 ActionsCore, 미래 값은 FPModel(엔진), 우리 사회 표는 FPSociety.table 을 그대로 옮긴다.
//
// 구조: 순수 함수(lines · summarize · sheet* · workbook · toCSV — node 검사 tools/test_export.js)와 화면(collect · xlsx · csv).
//   순수 함수는 다른 모듈(FPModel·ActionsCore·FPActions …)을 부를 때 typeof 로 확인한다 — 하나가 없어도 그 시트만 비고 내보내기는 된다.
// 로드 순서: … fp-actions → fp-society → fp-export → fp-tools …. 읽는 순간에는 정의만(함정 10). 버튼은 FPField.init 이 단다.
// ============================================================================
const FPExport = (() => {
  // ── 이름표 ────────────────────────────────────────────────────────────────
  const ZONE_KO = { ocean: '해양', green: '녹지', city: '도심' };
  const BRANCH_KO = { past: '과거', now: '현재', base: '기준 미래', mine: '나의 미래' };
  // 사회의 선택 이름 — fp-main FPScenario.PRESETS · SocietyCore.CHOICES 와 같은 말(조감 시나리오 버튼과 같은 이름)
  const SOCIETY_KO = { ssp245: '현재 정책', ssp126: '파리협약 2 °C', ssp119: '1.5 °C 탄소중립', ndc: '국가 목표(NDC)',
    custom: '우리가 설계한 사회', aerial: '직접 설계(조감)' };
  // 측정 항목 — 소수 자리는 계측기 분해능(fp-tools TOOL_SPEC.res: 온도 0.1 · pH 0.01 · CO₂ 1 · 해수 분석기 0.1/1/0.01/0.1)
  const ITEMS = {
    temp: { ko: '온도', unit: '°C', dec: 1 },
    ph:   { ko: 'pH', unit: '', dec: 2 },
    co2:  { ko: 'CO₂', unit: 'ppm', dec: 0 },
  };
  // 해수 분석기 한 번 = 네 채널 줄(TASK G §1-1 — 예전 CSV 의 water_temp·co2_aq·dic·omega 열이 채널 줄로 바뀌었다)
  const CHANNELS = [
    { key: 'co2aq', ko: '해수분석 용존CO₂', unit: 'µmol/kg', dec: 1 },
    { key: 'dic',   ko: '해수분석 DIC',     unit: 'µmol/kg', dec: 0 },
    { key: 'omega', ko: '해수분석 Ω',       unit: '',        dec: 2 },
    { key: 'temp',  ko: '해수분석 수온',    unit: '°C',      dec: 1 },
  ];
  // ③ '원 자료 단위' — 등록부(js/sources.js act_*)의 dataset 줄을 짧게 옮긴 것(새 숫자 없음)
  const SRC_UNIT = { tumbler: '1인 kg/년', standby: '1가구 kg/년 ÷ 가구원', recycle: '1인 kg/년 × 분리배출 정확도',
    bike: '승용차 1대 kg/년', transit: '승용차 1대 kg/년', flight: '장거리 왕복 1회 kg' };
  // ⑦ 레버 — fp-society.js LEVER_KO 와 같은 순서·이름(전력 구성 → 전기차 → 포집 → 나머지 감축 → 산림)
  const LEVERS = [
    { key: 'fossilShare', ko: '화석 발전 비중', pct: true }, { key: 'nuclearShare', ko: '원자력 발전 비중', pct: true },
    { key: 'renewShare', ko: '재생 발전 비중', pct: true }, { key: 'ev', ko: '전기차 비율', pct: true },
    { key: 'ccs', ko: '탄소 포집', pct: false }, { key: 'otherCut', ko: '나머지 배출 감축', pct: true },
    { key: 'forest', ko: '토지이용 배출', pct: false },
  ];

  // ── 작은 도구 ──────────────────────────────────────────────────────────────
  const num = v => (typeof v === 'number' && Number.isFinite(v));
  const round = (v, d) => (num(v) ? Number(v.toFixed(Math.max(0, d))) : '');
  const p2 = n => String(n).padStart(2, '0');
  // ISO → 'YYYY-MM-DD HH:MM:SS'(이 컴퓨터 시각). 저장은 ISO(UTC) 그대로 하고, 표에서만 학생이 읽는 시각으로 바꾼다
  function localTime(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso);
    return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  }
  // 파일 이름: 미니지구_탐험기록_YYYYMMDD_HHMM.xlsx (예전 야장 CSV 이름 규칙과 같은 방식)
  const fileName = (ext, d = new Date()) =>
    `미니지구_탐험기록_${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}_${p2(d.getHours())}${p2(d.getMinutes())}.${ext}`;
  const scaleLabel = id => {
    if (!id) return '';
    const sc = typeof ActionsCore !== 'undefined' ? ActionsCore.SCALES.find(s => s.id === id) : null;
    return sc ? sc.label : String(id);
  };
  // 참여 규모 칸: 나의 미래면 규모, 우리 도시에 참여 중이었으면 '우리 도시 −42 %'
  const scaleCell = l => [scaleLabel(l.scale), l.city > 0 ? `우리 도시 −${l.city} %` : ''].filter(Boolean).join(' · ');
  const societyCell = id => (id ? SOCIETY_KO[id] || String(id) : '');
  // ② 요약의 갈래 칸: 같은 해 같은 지점이라도 사회의 선택·참여 규모·우리 도시가 다르면 따로 센다(fp-field summary 와 같은 규칙) — 그 차이를 이름에 적는다
  function branchDetail(l) {
    const b = BRANCH_KO[l.branch] || '';
    const extra = [];
    if (l.branch === 'base' && l.society && l.society !== 'ssp245') extra.push(societyCell(l.society));
    if (l.branch === 'mine') extra.push(societyCell(l.society), scaleLabel(l.scale));
    if (l.city > 0) extra.push(`우리 도시 −${l.city} %`);
    const e = extra.filter(Boolean);
    return e.length ? `${b} (${e.join(' · ')})` : b;
  }

  // ── ① 측정 기록 ───────────────────────────────────────────────────────────
  // 저장 줄(fp.records 한 줄 = 한 측정) → 표 줄. 해수 분석기는 채널마다 한 줄(같은 번호)
  function lines(records) {
    const out = [];
    for (const r of records || []) {
      if (!r || typeof r !== 'object') continue;
      const base = { n: r.n, time: r.time, year: r.year, branch: r.branch, society: r.society || '', scale: r.scale || '', city: Number(r.city) || 0,
        path: r.path || '', zone: r.zone || '', spot: r.spot || '', spotKo: r.spotKo || '', x: r.x, z: r.z, transect: r.transect };
      if (r.tool === 'sea' && r.channels && typeof r.channels === 'object') {
        for (const ch of CHANNELS) {
          const v = r.channels[ch.key];
          if (num(v)) out.push({ ...base, item: 'sea.' + ch.key, itemKo: ch.ko, unit: ch.unit, dec: ch.dec, value: round(v, ch.dec) });
        }
      } else if (r.tool === 'sea') {
        if (num(r.value)) out.push({ ...base, item: 'sea.omega', itemKo: CHANNELS[2].ko, unit: '', dec: 2, value: round(r.value, 2) });
      } else if (ITEMS[r.tool] && num(r.value)) {
        const it = ITEMS[r.tool];
        out.push({ ...base, item: r.tool, itemKo: it.ko, unit: it.unit, dec: it.dec, value: round(r.value, it.dec) });
      }
    }
    return out;
  }
  const HEAD_RECORDS = ['번호', '기록 시각', '연도', '미래 갈래', '사회의 선택', '참여 규모', '구역', '측정 지점', '측정 항목', '값', '단위',
    'X(m)', 'Z(m)', '횡단 거리(m)'];
  const recordRow = l => [l.n, localTime(l.time), l.year, BRANCH_KO[l.branch] || '', societyCell(l.society), scaleCell(l),
    ZONE_KO[l.zone] || l.zone, l.spotKo, l.itemKo, l.value, l.unit, round(l.x, 1), round(l.z, 1), l.transect == null ? '' : round(l.transect, 1)];
  const sheetRecords = records => [HEAD_RECORDS, ...lines(records).map(recordRow)];

  // ── ② 지점별 요약 ─────────────────────────────────────────────────────────
  // (연도, 갈래, 경로, 구역, 지점, 항목)으로 묶는다 — fp-field summary 와 같은 키(4차 E3: 다른 해·다른 갈래·다른 경로 값끼리 평균하지 않는다)
  // 평균·표준편차는 분해능보다 한 자리 더, 최솟값·최댓값은 분해능 그대로
  function summarize(ls) {
    const g = new Map();
    for (const l of ls) {
      const key = [l.year, l.branch, l.path, l.zone, l.spotKo, l.item].join('|');
      if (!g.has(key)) g.set(key, { year: l.year, branch: l.branch, society: l.society, scale: l.scale, city: l.city, path: l.path, zone: l.zone,
        spotKo: l.spotKo, item: l.item, itemKo: l.itemKo, unit: l.unit, dec: l.dec, v: [] });
      g.get(key).v.push(l.value);
    }
    const out = [];
    for (const s of g.values()) {
      const n = s.v.length, mean = s.v.reduce((a, b) => a + b, 0) / n;
      const sd = n > 1 ? Math.sqrt(s.v.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;   // 표본표준편차(n−1)
      out.push({ ...s, n, mean, sd, min: Math.min(...s.v), max: Math.max(...s.v) });
    }
    out.sort((a, b) => a.itemKo.localeCompare(b.itemKo) || a.spotKo.localeCompare(b.spotKo) || a.year - b.year
      || String(a.branch).localeCompare(String(b.branch)) || String(a.path).localeCompare(String(b.path)));
    return out;
  }
  const HEAD_SUMMARY = ['연도', '미래 갈래', '구역', '측정 지점', '측정 항목', 'n', '평균', '표준편차(n−1)', '최솟값', '최댓값'];
  const sheetSummary = records => [HEAD_SUMMARY, ...summarize(lines(records)).map(s => [s.year, branchDetail(s), ZONE_KO[s.zone] || s.zone, s.spotKo,
    s.unit ? `${s.itemKo} (${s.unit})` : s.itemKo, s.n, round(s.mean, s.dec + 1), s.sd == null ? '' : round(s.sd, s.dec + 1), round(s.min, s.dec), round(s.max, s.dec)])];

  // ── ③ 나의 행동 ──────────────────────────────────────────────────────────
  // chosen = FPActions.chosen() ({ ids, recycleAccuracy }), scaleId = 참여 규모. 줄마다 1인 kg × 사람 수(비행은 국제선 상한) = 합계 t
  //   ActionsCore.cutGtC 와 같은 식이다(co2Share 를 곱한다 — 지금 행동은 모두 1). 합계 줄 t = cutGtC × 3.664 × 10⁹(검사가 확인)
  const HEAD_ACTIONS = ['행동', '1인 kg CO₂/년', '원 자료 단위', '참여 규모', '사람 수', '합계 t CO₂/년', '출처', '출처 기관'];
  function sheetActions(chosen, scaleId) {
    const rows = [HEAD_ACTIONS];
    if (typeof ActionsCore === 'undefined') return rows;
    const AC = ActionsCore, sc = AC.SCALES.find(s => s.id === scaleId) || AC.SCALES[0];
    const ids = chosen && Array.isArray(chosen.ids) ? chosen.ids : [];
    const S = typeof SOURCES !== 'undefined' ? SOURCES : {};
    let kgSum = 0, tSum = 0;
    for (const a of AC.ACTIONS) {
      if (!ids.includes(a.id)) continue;
      const kg = AC.personalKg({ ids: [a.id], recycleAccuracy: chosen.recycleAccuracy });
      const people = a.capPeople ? Math.min(sc.people, a.capPeople) : sc.people;
      const t = kg * a.co2Share * people / 1000;
      kgSum += kg; tSum += t;
      const src = S[a.src] || {};
      rows.push([a.label, round(kg, 2), SRC_UNIT[a.id] || '', sc.label, people, round(t, 4), src.label || a.src, src.org || '']);
    }
    if (rows.length === 1) rows.push(['(아직 고른 행동이 없어요 — 학습지 [나의 행동] 탭에서 고르세요)']);
    else rows.push(['합계', round(kgSum, 2), '', sc.label, '', round(tSum, 4), '', '']);
    return rows;
  }

  // ── ④ 미래 비교 ──────────────────────────────────────────────────────────
  // 2050·2100 × CO₂·기온 편차·해수온·pH — 기준 미래(사회의 선택 경로) · 나의 미래(같은 경로 − 나의 행동 × 참여 규모) · 차이.
  //   학습지 [나의 행동] 미래 비교 카드(fp-actions compareHtml)와 같은 함수·같은 소수 자리(FPActions.CMP_ROWS)
  const HEAD_FUTURE = ['연도', '항목', '기준 미래', '나의 미래', '차이(나의 − 기준)', '사회의 선택', '참여 규모'];
  const CMP_FALLBACK = [{ key: 'ppm', label: 'CO₂', unit: 'ppm', dec: 1, ddec: 2 }, { key: 'T', label: '기온 편차', unit: '°C', dec: 2, ddec: 3 },
    { key: 'sst', label: '해수온', unit: '°C', dec: 2, ddec: 3 }, { key: 'pH', label: 'pH', unit: '', dec: 3, ddec: 4 }];
  function sheetFuture(st) {
    const rows = [HEAD_FUTURE];
    if (typeof FPModel === 'undefined') return rows;
    const CMP = typeof FPActions !== 'undefined' && FPActions.CMP_ROWS ? FPActions.CMP_ROWS : CMP_FALLBACK;
    const has = st.chosen && st.chosen.ids && st.chosen.ids.length > 0;
    const baseRun = FPModel.pathRun(st.preset, st.levers);
    const mineRun = has ? FPModel.mineRun(st.preset, st.levers, st.chosen, st.scale) : null;
    for (const y of [2050, 2100]) {
      const b = FPModel.sample(y, baseRun), m = mineRun ? FPModel.sample(y, mineRun) : null;
      for (const r of CMP) {
        rows.push([y, r.unit ? `${r.label} (${r.unit})` : r.label, round(b[r.key], r.dec), m ? round(m[r.key], r.dec) : '',
          m ? round(m[r.key] - b[r.key], r.ddec) : '', st.choiceKo || societyCell(st.preset), scaleLabel(st.scale)]);
      }
    }
    return rows;
  }

  // ── ⑤ 과제 답 ────────────────────────────────────────────────────────────
  // fp.tasks[id] = { title, obs: {연도 또는 칸 이름: 글}, diff } — 현장 ③~⑤는 연도 칸, 행동 ⑥~⑪·사회 ⑫~⑮는 칸 이름(그 칸 이름을 글 앞에 붙인다).
  //   '달라진 점'은 과제의 첫 줄에만 둔다(같은 글이 줄마다 되풀이되지 않게). 과제 순서 = 제목의 번호(①~⑮ 는 유니코드 코드 포인트 순서가 번호 순서)
  const HEAD_TASKS = ['과제', '연도', '관찰 글', '달라진 점'];
  function sheetTasks(tasks) {
    const rows = [HEAD_TASKS];
    const list = Object.values(tasks && typeof tasks === 'object' ? tasks : {}).filter(t => t && typeof t === 'object')
      // localeCompare 는 쓰지 않는다 — 한국어 정렬 규칙이 ⑭를 '14'로 읽어 ④보다 앞에 둔다. 코드 포인트 순서(①→⑮)로 비교
      .sort((a, b) => { const x = String(a.title || ''), y = String(b.title || ''); return x < y ? -1 : x > y ? 1 : 0; });
    for (const t of list) {
      const obs = Object.entries(t.obs && typeof t.obs === 'object' ? t.obs : {}).filter(([, v]) => String(v == null ? '' : v).trim());
      const diff = String(t.diff == null ? '' : t.diff).trim();
      if (!obs.length && !diff) continue;
      if (!obs.length) { rows.push([t.title || t.id, '', '', diff]); continue; }
      obs.forEach(([k, v], i) => {
        const isYear = /^\d{4}$/.test(k);
        rows.push([t.title || t.id, isYear ? Number(k) : '', isYear ? String(v).trim() : `${k}: ${String(v).trim()}`, i === 0 ? diff : '']);
      });
    }
    return rows;
  }

  // ── ⑥ 미니게임 ───────────────────────────────────────────────────────────
  // FPActions.minigameTable(fp.actions.minigameLog) 의 두 표(카페 · 분리배출)를 한 시트에 위아래로. 날짜만 읽는 시각으로 바꾼다
  function sheetMinigame(log) {
    if (typeof FPActions === 'undefined' || !FPActions.minigameTable) return [['미니게임 기록을 읽을 수 없어요']];
    const RI = typeof RecycleItems !== 'undefined' ? RecycleItems : null;
    const prepName = p => (RI && RI.RECYCLE_PREP[p]) || p;
    const whyOf = (id, region) => { const it = RI ? RI.itemFor(id, region || 'common') : null; return it ? it.why || '' : ''; };
    const T = FPActions.minigameTable(log, prepName, whyOf);
    const withTime = r => [localTime(r[0]), ...r.slice(1)];
    return [
      ['카페 — ' + T.cafe.head[0], ...T.cafe.head.slice(1)], ...T.cafe.rows.map(withTime),
      [],
      ['분리배출 — ' + T.recycle.head[0], ...T.recycle.head.slice(1)], ...T.recycle.rows.map(withTime),
    ];
  }

  // ── ⑦ 우리 사회 ──────────────────────────────────────────────────────────
  // fp.society = { cards, levers, capture, savedAt, issuesOpened, issueNotes } (T2 회의실 · T5 쟁점 메모).
  //   설계가 없어도 시트는 만든다(비교 표의 기준 사회·NDC·1.5 °C 칸은 설계와 무관하다).
  function levelOf(t, v) {   // 카드 값 → 가장 가까운 단계(1~3) — fp-stage-council levelOf 와 같은 규칙(거리)
    if (typeof FPStageCouncil !== 'undefined' && FPStageCouncil.levelOf) return FPStageCouncil.levelOf(t, v);
    let best = 0, bd = Infinity;
    t.levels.forEach((L, i) => { const d = Math.abs(v - L); if (d < bd - 1e-9) { bd = d; best = i; } });
    return best + 1;
  }
  function sheetSociety(so) {
    so = so && typeof so === 'object' ? so : {};
    const hasDesign = !!(so.levers && typeof so.levers === 'object');
    const rows = [['설계 저장 시각', hasDesign ? localTime(so.savedAt) : '아직 회의실에서 설계를 확정하지 않았어요']];
    const SC = typeof SocietyCore !== 'undefined' ? SocietyCore : null;
    const NOW = typeof EarthSystem !== 'undefined' ? EarthSystem.LEVER_NOW : null;
    // 카드 · 단계
    rows.push([], ['카드', '종류', '단계', '값', '단위']);
    const cards = hasDesign && so.cards && typeof so.cards === 'object' ? so.cards : {};
    let nCard = 0;
    if (SC) {
      for (const t of SC.TECH_CARDS) if (num(cards[t.id])) { rows.push([t.label, '기술', levelOf(t, cards[t.id]), cards[t.id], t.unit]); nCard++; }
      for (const p of SC.POLICY_CARDS) if (cards[p.id] === true) { rows.push([p.label, '정책(열쇠)', '', '', '']); nCard++; }
    }
    if (!nCard) rows.push(['(놓은 카드 없음)']);
    // 레버 값(2050년 목표) — 비중·비율은 %, 포집·토지이용은 GtC/년
    rows.push([], ['레버(2050년 목표)', '지금', '우리 사회', '단위']);
    const L = hasDesign && NOW ? { ...NOW, ...so.levers } : null;
    for (const lv of LEVERS) {
      const f = v => (num(v) ? (lv.pct ? round(v * 100, 1) : round(v, 2)) : '');
      rows.push([lv.ko, NOW ? f(NOW[lv.key]) : '', L ? f(L[lv.key]) : '', lv.pct ? '%' : 'GtC/년']);
    }
    // 2050·2100 CO₂·기온 편차 — 우리 사회 · 기준 사회 · NDC 비교 · 1.5 °C 경로 (FPSociety.table = 학습지 [우리 사회] 목표 비교 표)
    rows.push([], ['연도', '항목', '우리 사회', '기준 사회(현재 정책)', 'NDC 비교', '1.5 °C 경로']);
    if (typeof FPSociety !== 'undefined' && FPSociety.table) {
      for (const y of FPSociety.YEARS) {
        for (const r of FPSociety.table(y, L)) {
          if (r.key !== 'ppm' && r.key !== 'T') continue;
          const dec = r.key === 'ppm' ? 1 : 2;
          rows.push([y, `${r.label} (${r.unit})`, round(r.vals.custom, dec), round(r.vals.ssp245, dec), round(r.vals.ndc, dec), round(r.vals.ssp119, dec)]);
        }
      }
    }
    // 쟁점 메모(T5) — 열어 본 쟁점 카드마다 한 줄, 메모가 없으면 빈칸
    rows.push([], ['쟁점 카드', '나의 메모']);
    const notes = so.issueNotes && typeof so.issueNotes === 'object' ? so.issueNotes : {};
    const ids = [...new Set([...(Array.isArray(so.issuesOpened) ? so.issuesOpened : []), ...Object.keys(notes)])];
    const issueTitle = id => (SC && SC.issues && SC.issues[id] ? SC.issues[id].title : id);
    for (const id of ids) rows.push([issueTitle(id), String(notes[id] == null ? '' : notes[id])]);
    if (!ids.length) rows.push(['(열어 본 쟁점 카드 없음)']);
    return rows;
  }

  // ── 묶기 ──────────────────────────────────────────────────────────────────
  // st = { records, fp, chosen, scale, preset, levers, choiceKo } (화면에서는 collect())
  const SHEET_NAMES = ['① 측정 기록', '② 지점별 요약', '③ 나의 행동', '④ 미래 비교', '⑤ 과제 답', '⑥ 미니게임', '⑦ 우리 사회'];
  function workbook(st) {
    const fp = st.fp || {};
    const log = fp.actions && fp.actions.minigameLog;
    return [
      { name: SHEET_NAMES[0], rows: sheetRecords(st.records), colWidths: [7, 20, 7, 11, 18, 18, 7, 16, 18, 9, 9, 9, 9, 12] },
      { name: SHEET_NAMES[1], rows: sheetSummary(st.records), colWidths: [7, 34, 7, 16, 26, 5, 10, 14, 9, 9] },
      { name: SHEET_NAMES[2], rows: sheetActions(st.chosen, st.scale), colWidths: [26, 14, 26, 26, 14, 16, 34, 34] },
      { name: SHEET_NAMES[3], rows: sheetFuture(st), colWidths: [7, 18, 12, 12, 18, 20, 26] },
      { name: SHEET_NAMES[4], rows: sheetTasks(fp.tasks), colWidths: [28, 7, 60, 40] },
      { name: SHEET_NAMES[5], rows: sheetMinigame(log), colWidths: [20, 12, 22, 16, 14, 22, 22, 12, 22, 10, 12, 10, 18, 60] },
      { name: SHEET_NAMES[6], rows: sheetSociety(fp.society), colWidths: [30, 22, 14, 22, 14, 14] },
    ];
  }
  // CSV: ① 측정 기록만. 쉼표·따옴표·줄바꿈이 든 칸은 따옴표로 감싼다. BOM = 엑셀이 UTF-8 한글을 알아보게
  function csvCell(v) {
    if (v == null) return '';
    const s = String(v);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }
  const toCSV = records => '﻿' + sheetRecords(records).map(r => r.map(csvCell).join(',')).join('\r\n');

  // ── 화면 ──────────────────────────────────────────────────────────────────
  function collect() {
    let fp = {};
    try { fp = WorksheetStore.readFp(); } catch (e) { fp = {}; }
    const S = typeof FPScenario !== 'undefined' ? FPScenario : null, A = typeof FPActions !== 'undefined' ? FPActions : null;
    return {
      // 메모리의 기록 전부(저장 상한을 넘은 줄까지) — 내보내기는 지금 화면에 보이는 기록과 같아야 한다
      records: typeof FPField !== 'undefined' ? FPField.rows.map(FPField.toRecord) : (fp.records || []),
      fp,
      chosen: A ? A.chosen() : { ids: [], recycleAccuracy: 0 },
      scale: A ? A.scale : 'me',
      preset: S ? S.preset : 'ssp245', levers: S ? S.levers : null, choiceKo: S ? S.shortName() : '',
    };
  }
  const say = (msg, ms) => { if (typeof FPField !== 'undefined' && FPField.toast) FPField.toast(msg, ms); };
  function xlsx() {
    try {
      const st = collect();
      downloadBlob(buildXlsx(workbook(st)), fileName('xlsx'));
      say(`엑셀 파일을 내려받았어요 — 시트 7장, 측정 기록 ${st.records.length}건.`, 3500);
    } catch (e) {
      console.error(e);
      say('엑셀 파일을 만들지 못했어요. [CSV로 내보내기]로 측정 기록만이라도 내려받아 주세요.', 6000);
    }
  }
  function csv() {
    try {
      const st = collect();
      if (!st.records.length) { say('아직 측정 기록이 없어요. 도구를 들고 좌클릭해 측정하세요.', 3500); return; }
      downloadBlob(new Blob([toCSV(st.records)], { type: 'text/csv;charset=utf-8' }), fileName('csv'));
      say(`CSV 파일을 내려받았어요 — 측정 기록 ${st.records.length}건.`, 3500);
    } catch (e) {
      console.error(e);
      say('CSV 파일을 만들지 못했어요.', 5000);
    }
  }

  return { ZONE_KO, BRANCH_KO, SOCIETY_KO, ITEMS, CHANNELS, SHEET_NAMES, HEAD_RECORDS, HEAD_SUMMARY, HEAD_ACTIONS, HEAD_FUTURE, HEAD_TASKS,
    localTime, fileName, lines, summarize, sheetRecords, sheetSummary, sheetActions, sheetFuture, sheetTasks, sheetMinigame, sheetSociety,
    workbook, toCSV, collect, xlsx, csv };
})();
