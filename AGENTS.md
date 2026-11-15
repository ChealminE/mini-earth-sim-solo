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
- `js/xlsx-lite.js` — `downloadBlob`(파일 내려받기)·엑셀 쓰기. 미래 예측·탐구·학습지가 쓴다
- `tools/build_single_html.py` — 단일 HTML 빌더, `tools/test_*.js`·`check_*.js` — 검사

## 실행·확인
- `Critical_Earth_simulator/run_server.bat` (또는 `.venv\Scripts\python server.py`) → http://127.0.0.1:8000
- 단일 HTML: `build_html.bat` (또는 `python tools/build_single_html.py`) → `dist/MiniEarth.html`
- 검사: `node tools/test_earth_system.js`, `test_earth_visual.js`, `test_inquiry.js`, `test_catalog.js`, `check_sources.js`, `check_contrast.js`

## 지켜야 할 것
- **`index.html`·`firstperson/index.html`에 `<script>`·스타일시트를 추가·삭제하면 `tools/build_single_html.py`의 `AERIAL_JS`·`FP_JS`·`AERIAL_CSS` 목록도 같은 순서로 맞춘다** (안 맞으면 단일 HTML 빌드가 멈춤)
- **화면에서 새 폴더의 파일을 읽으면 `server.py`에 그 폴더의 `StaticFiles` 마운트를 더한다.** 마운트가 없으면 개발 서버에서만 404가 나고 단일 HTML에서는 멀쩡해 놓치기 쉽다
- `.venv/`, `dist/`는 각자 PC에만 두는 파일이다 (git 제외)
- 1인 작업이다(철민, ChealminE — 1인칭 모드·과학 모델·논문 대응 포함 전부). 작업 기록은 `Critical_Earth_simulator/철민진행상황.md` 하나에 남긴다
- 주석은 한국어로, "무엇"보다 "왜 이렇게 했는지"를 적는 것이 이 저장소의 스타일이다
