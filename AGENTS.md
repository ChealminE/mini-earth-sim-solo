# 미니 지구 시뮬레이션 — AI 작업 안내

실제로 쓰는 앱은 **`Critical_Earth_simulator/`** 하나다. 작은 파이썬 개발 서버(FastAPI) + 순수 HTML/JS(three.js, Chart.js)이고 빌드 도구가 없다.
배포는 단일 HTML(`dist/MiniEarth.html`) 하나뿐이다. 직접 실험(센서)이 들어 있던 협동판은 태그 `v2.0-collab-final`에 있다.

## 구조
- `server.py` — 개발용 정적 파일 서버. html 을 내줄 때 js/css 주소에 내용 지문(`?v=`)을 붙이고(versioned_html) 캐시 정책을 정한다
- `select.html` 시작 화면(카드 3장, 배경 3D가 카드에 따라 모드별 지구로 바뀜) → `index.html?tab=current|future` 조감 2탭 / `firstperson/` 1인칭 탐험
- `js/earth-model.js` — 조감·1인칭이 공유하는 해수 화학(탄산 평형). 예측식은 여기서만 고친다
- `js/earth-system.js`(지구 시스템 엔진: 배출 → 탄소순환 → 기온), `js/earth-data.js`(생성물 — `tools/gen_earth_data.py`), `js/earth-visual.js`(엔진 값 → 3D 연출 대응), `js/sources.js`(출처 등록부)
- `js/common.js` — 아크릴 3D 씬(`buildAcrylicScene`·`setEarthVisual`·`applyState`)과 카메라, `js/tab-current.js`·`js/tab-future.js` — 두 탭, `js/main.js` — 탭 전환(맨 마지막에 읽힘)
- 현재 실태·미래 예측 공용(3차): `js/data-catalog.js`(그래프 작업대에 놓는 자료 카드 목록 — 교사는 이 파일만 고쳐 카드를 넣고 뺀다), `js/graph-workspace.js`(자료 카드를 끌어 놓아 비교하는 공용 그래프 작업대, 축 규칙 R1~R8), `js/worksheet.js`(오른쪽 학습지 패널: 탐구·나의 증거·기록 탭, 공용 저장소 `localStorage['worksheet.v1']` — 1인칭 야장 답도 여기에), `js/inquiry.js`·`js/inquiry-steps.js`(탐구 경로), `js/ir-scope.js`(3D [가시광 | 적외선] 보기 — 장파 복사·CO₂ 빛망울·에너지 화살표, 끌 때 재질을 저장값으로 되돌림)
- `js/xlsx-lite.js` — `downloadBlob`(파일 내려받기)·엑셀 쓰기. 미래 예측·탐구·학습지·1인칭 내보내기가 쓴다
- 4차 순수 계산 모듈(DOM·three.js 없음, node 검사로 값 확인):
  - `js/actions-core.js` — 행동 계산(행동 6·참여 규모 5, 2026부터 화석 배출에서 빼는 배출 경로·개인 kg·우리 도시 국소 감축)
  - `js/society-core.js` — 사회의 선택(기술 카드 7·정책 카드 6·사회의 선택 5·NDC 경로·쟁점 4, 2026까지 하나의 역사 `pickRun`)
  - `js/worksheet-store.js` — 학습지 공용 저장소 `worksheet.v1` 읽기·쓰기만(조감 `worksheet.js`·1인칭 학습지가 함께 씀)
  - `firstperson/fp-model.js` — 1인칭 값 계산(`FPModel`: `NOW_YEAR` 2026, 같은 해·같은 경로의 조감 엔진 값, 구역 대기·바다·도시·기후테크 상태)
- 1인칭(`firstperson/`) 4차 화면 파일:
  - `fp-sheet.js` — 학습지 패널(오른쪽 40 %, [과제][기록][나의 행동][우리 사회], F·Esc)
  - `fp-onboard.js` — 첫 진입 안내 3장(`fp.ui.onboarded`)
  - `fp-timeline.js` — 위 가운데 타임라인 막대(정거장·슬라이더·[기준 미래 | 나의 미래], [ ] 키)
  - `fp-actions.js` — [나의 행동] 탭 행동 카드·참여 규모·우리 도시·미래 비교 표 + 세계 속 행동 지점 4곳
  - `fp-society.js` — [우리 사회] 탭(목표 비교·설계 요약·쟁점 메모)·과제 ⑫~⑮·탐험 지도 네 장
  - `fp-export.js` — 엑셀(시트 7장)·CSV 내보내기. 맨 위 `LAYOUT` 한 곳에서 시트·열 이름·순서를 고친다
  - `fp-tech-world.js` — 세계 속 기후테크(해상풍력·지붕 태양광·숲·CCUS·DAC·SMR·충전소, 개수는 `FPModel.techState`에서만)
  - `fp-stage.js` — 미터 축척 무대 공통 틀(들어가기·나오기, 렌더러 저장→복원, 사진 자세 `?stage=&shot=`)
  - `fp-stage-kit.js` — 무대 소품 도구(둥근 상자·회전체·관·재질 14·조명·접지 그림자·강조·김)
  - `fp-stage-cafe.js` — 미니게임 ① '초록잔 카페'(일회용 컵 vs 텀블러), `fp-stage-recycle.js` — 미니게임 ② 분리배출장, `fp-stage-council.js` — 3장 기후 정책 회의실(시청)
  - `fp-recycle-items.js` — 분리배출 품목·수거함·준비·지역 규칙 데이터. **교사는 이 파일만 고쳐 품목을 넣고 뺀다**
- `tools/build_single_html.py` — 단일 HTML 빌더, `tools/test_*.js`·`check_*.js` — 검사
  - 4차 검사: `tools/test_fp_model.js`(1인칭 = 조감 엔진 같은 해 같은 값), `test_actions.js`(문헌값 1-5 표 ±1 %), `test_recycle_items.js`(품목 데이터), `test_society.js`(문헌값 6-3 표 ±1 %·쟁점 문구), `test_fp_stage.js`(무대 품질 규칙·렌더러 복원), `test_export.js`(내보내기 표)
  - 사람 확인용 콘솔 스니펫(앱 코드 아님): `tools/check_fp_snippet.js`(1인칭 드로우콜·삼각형·FPS·글자 크기 `checkFp('all')`), `tools/stage_kit_preview.js`(무대 소품 견본), `tools/check_layout_snippet.js`(조감 4해상도)

## 실행·확인
- `Critical_Earth_simulator/run_server.bat` (또는 `.venv\Scripts\python server.py`) → http://127.0.0.1:8000
- 단일 HTML: `build_html.bat` (또는 `python tools/build_single_html.py`) → `dist/MiniEarth.html`
- 검사: `node tools/test_earth_system.js`, `test_earth_visual.js`, `test_inquiry.js`, `test_catalog.js`, `check_sources.js`, `check_contrast.js`, `test_fp_model.js`, `test_actions.js`, `test_recycle_items.js`, `test_society.js`, `test_fp_stage.js`, `test_export.js`
- 출처 문서: 등록부(`js/sources.js`)를 고친 뒤 `node tools/gen_sources_doc.js` → `docs/데이터출처.md`(손으로 고치지 않는다)

## 지켜야 할 것
- **`index.html`·`firstperson/index.html`에 `<script>`·스타일시트를 추가·삭제하면 `tools/build_single_html.py`의 `AERIAL_JS`·`FP_JS`·`AERIAL_CSS`·`FP_CSS` 목록도 같은 순서로 맞춘다** (안 맞으면 단일 HTML 빌드가 멈춤)
- **화면에서 새 폴더의 파일을 읽으면 `server.py`에 그 폴더의 `StaticFiles` 마운트를 더한다.** 마운트가 없으면 개발 서버에서만 404가 나고 단일 HTML에서는 멀쩡해 놓치기 쉽다
- `.venv/`, `dist/`는 각자 PC에만 두는 파일이다 (git 제외)
- 1인 작업이다(철민, ChealminE — 1인칭 모드·과학 모델·논문 대응 포함 전부). 작업 기록은 `Critical_Earth_simulator/철민진행상황.md` 하나에 남긴다
- 주석은 한국어로, "무엇"보다 "왜 이렇게 했는지"를 적는 것이 이 저장소의 스타일이다
