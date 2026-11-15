"""
Mini Earth Model - 개발용 작은 서버 (정적 파일 + 화면 주소 몇 개)
==========================================================================
배포는 단일 HTML(tools/build_single_html.py → dist/MiniEarth.html) 하나뿐이다. 그런데 개발할 때
index.html 을 file:// 로 바로 열면 브라우저가 텍스처 읽기를 막아 3D가 비어 보인다(README 문제 해결 표).
그래서 개발·수업 준비용으로 이 서버를 남겼다.

4차 A4: 예전 server.py(약 1,100줄)는 직접 실험용 센서 중계 서버였다 — USB 시리얼·BLE·MQTT·WebSocket(/ws)·
/data·/api/*·/basic_experiments·실험 세션 기록. 직접 실험을 지운 단독판(4차 A3)에서는 화면이 그중 아무것도
부르지 않으므로 전부 걷어 내고, 화면을 내주는 데 필요한 것만 남겼다:
  - cache_policy / file_version / versioned_html : 고친 파일이 바로 반영되면서도 큰 파일은 다시 받지 않게(아래 설명)
  - 라우트 / · /favicon.ico · /dashboard · /firstperson/ · /style.css, 마운트 /js · /css · /vendor · /texture_image · /firstperson
(센서 중계 서버가 필요하면 협동판 태그 v2.0-collab-final 의 server.py 를 쓴다.)

실행 방법:
  python server.py                 # http://127.0.0.1:8000 (브라우저가 자동으로 열림)
  python server.py --no-browser    # 브라우저를 열지 않음
  python server.py --port 8080     # 다른 포트
"""

import argparse
import contextlib
import hashlib
import re
import socket
import sys
import webbrowser
from pathlib import Path
from typing import Dict

from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse, Response
from fastapi.staticfiles import StaticFiles

# exe(PyInstaller) 빌드는 4차 A3에서 그만뒀으므로 리소스는 늘 이 파일이 있는 폴더에서 읽는다
RESOURCE_DIR = Path(__file__).parent

app = FastAPI()


# ── 브라우저 저장(캐시) 정책 ─────────────────────────────
# StaticFiles(및 FileResponse)는 Cache-Control 없이 Last-Modified/ETag만 보내서,
# 브라우저가 자체 판단(heuristic caching)으로 js/css를 한동안 캐싱해버린다. 예전엔 그 때문에
# "분명히 고쳤는데 반영이 안 된 것처럼 보이는" 혼란이 반복돼서 모든 응답을 no-store(저장 금지)로 했는데,
# 그러면 화면을 옮길 때마다 텍스처·라이브러리(약 4MB)와 3D 코드를 매번 다시 받는다.
# 그래서 html을 내줄 때 서버가 js/css 주소 끝에 '파일 내용으로 만든 버전 표시(?v=...)'를 자동으로 붙인다
# (versioned_html). 파일이 바뀌면 주소가 바뀌어 새로 받고, 안 바뀌면 브라우저에 저장된 것을 그대로 쓴다.
# html 의 ?v= 숫자를 손으로 올리지 않는 이유도 이것이다(4차 마스터 함정 8).
#   ?v= 가 붙은 요청      → 1년 저장 (내용이 바뀌면 주소 자체가 바뀌므로 안전)
#   텍스처·라이브러리      → 저장하되 쓸 때마다 바뀌었는지만 확인 (안 바뀌었으면 본문 없이 '그대로' 응답)
#   그 밖 (html 등)        → 매번 새로
@app.middleware("http")
async def cache_policy(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if request.query_params.get("v") and path.endswith((".js", ".css")):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    elif path.startswith(("/texture_image/", "/vendor/")):
        response.headers["Cache-Control"] = "no-cache"
    else:
        response.headers["Cache-Control"] = "no-store"
    return response


_version_cache: Dict[Path, tuple] = {}


def file_version(path: Path) -> str:
    """파일 내용의 짧은 지문. 수정 시각이 같으면 다시 읽지 않는다."""
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return "0"
    cached = _version_cache.get(path)
    if cached and cached[0] == mtime:
        return cached[1]
    digest = hashlib.md5(path.read_bytes()).hexdigest()[:10]
    _version_cache[path] = (mtime, digest)
    return digest


_ASSET_REF = re.compile(r'(\b(?:src|href)=")([^"?#:]+\.(?:js|css))(?:\?[^"]*)?(")')


def versioned_html(html_path: Path) -> HTMLResponse:
    """html 안의 우리 js/css 주소 끝에 내용 지문(?v=...)을 붙여서 돌려준다 (손으로 ?v=4 올릴 필요 없음).
    파일 자체는 고치지 않는다."""
    text = html_path.read_text(encoding="utf-8")

    def stamp(m):
        url = m.group(2)
        target = (RESOURCE_DIR / url.lstrip("/")) if url.startswith("/") else (html_path.parent / url)
        return f"{m.group(1)}{url}?v={file_version(target)}{m.group(3)}"

    return HTMLResponse(_ASSET_REF.sub(stamp, text))


# ── 화면 주소 ─────────────────────────────────────────
@app.get("/")
async def select_page():
    return versioned_html(RESOURCE_DIR / "select.html")


# 브라우저가 페이지마다 /favicon.ico를 자동으로 요청하는데, 아이콘 파일이 없어서 콘솔에 매번
# "404 Not Found"가 찍혔다. 오류처럼 보여 혼란스러우므로 "내용 없음(204)"으로 조용히 답한다.
@app.get("/favicon.ico")
async def favicon():
    return Response(status_code=204)


# 현재 실태·미래 예측 대시보드 - ?tab=current|future 로 접속 (없는 탭은 화면 쪽 main.js 가 현재 실태로 연다)
@app.get("/dashboard")
async def dashboard():
    return versioned_html(RESOURCE_DIR / "index.html")


# 1인칭 탐험 모드 첫 페이지도 버전 표시를 붙여서 준다 (아래 /firstperson 정적 마운트보다 먼저 등록)
@app.get("/firstperson/")
@app.get("/firstperson/index.html")
async def firstperson_page():
    return versioned_html(RESOURCE_DIR / "firstperson" / "index.html")


@app.get("/style.css")
async def style_css():
    return FileResponse(RESOURCE_DIR / "style.css")


# 정적 파일 마운트는 위 라우트들 뒤에 등록해야 /firstperson/ 같은 주소가 마운트에 가로채이지 않는다
app.mount("/js", StaticFiles(directory=RESOURCE_DIR / "js"), name="js")
# 디자인 토큰·종이 테마 배치 (2차 개편 B: css/theme.css, css/paper.css)
app.mount("/css", StaticFiles(directory=RESOURCE_DIR / "css"), name="css")
# three.js·Chart.js를 인터넷(CDN) 대신 여기서 준다 - 인터넷이 없거나 느린 교실에서도 3D·그래프가 뜨게
app.mount("/vendor", StaticFiles(directory=RESOURCE_DIR / "vendor"), name="vendor")
app.mount("/texture_image", StaticFiles(directory=RESOURCE_DIR / "texture_image"), name="textures")
# 1인칭 탐험 모드 (firstperson/index.html) - html=True라 /firstperson/ 으로 접속하면 index.html이 열림
app.mount("/firstperson", StaticFiles(directory=RESOURCE_DIR / "firstperson", html=True), name="firstperson")


def get_local_ip():
    """같은 교실 와이파이의 다른 기기(교사 PC·태블릿)에서 열 주소를 안내하려고 이 PC의 내부 IP를 찾는다."""
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))   # 실제로 보내지는 않는다 - 나가는 길의 내 주소만 알아낸다
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


if __name__ == "__main__":
    # 한국어 Windows의 기본 콘솔 인코딩(cp949)은 —, … 같은 특수문자를 못 담아서, 그런 문자가
    # 섞인 print()가 실행되는 순간 UnicodeEncodeError로 서버가 죽는다. 콘솔을 UTF-8로 바꿔 둔다.
    if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")

    parser = argparse.ArgumentParser(description="미니 지구 모델 개발용 서버")
    parser.add_argument("--no-browser", action="store_true", help="서버 시작 시 브라우저 자동으로 열지 않음")
    parser.add_argument("--port", type=int, default=8000, help="웹 서버 포트 (기본 8000)")
    args = parser.parse_args()

    import uvicorn

    print("=" * 55)
    print(f"  브라우저 접속:  http://127.0.0.1:{args.port}")
    print(f"  같은 와이파이:  http://{get_local_ip()}:{args.port}")
    print("=" * 55)

    # 브라우저는 서버가 실제로 뜬 뒤에 연다(먼저 열면 '연결할 수 없음'이 잠깐 뜬다).
    # @app.on_event("startup")는 폐기 예정이라 lifespan(서버 시작~종료를 감싸는 함수)으로 한다.
    @contextlib.asynccontextmanager
    async def lifespan(_app):
        if not args.no_browser:
            webbrowser.open(f"http://127.0.0.1:{args.port}")
        yield

    app.router.lifespan_context = lifespan

    uvicorn.run(app, host="0.0.0.0", port=args.port)
