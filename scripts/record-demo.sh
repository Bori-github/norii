#!/usr/bin/env bash
# 실앱 데모 영상 녹화 — E2E 시나리오를 그대로 녹화해 PR 첨부용 영상을 만든다.
# 사용법: mise run demo  (→ .claude/docs/development-commands.md)
#
# 왜 E2E를 녹화하나: E2E 시나리오가 곧 "기능이 동작함"의 증거다. 별도 데모 스크립트를
# 두면 테스트와 데모가 따로 낡는다. 테스트가 늘면 데모도 자동으로 풍부해진다.
#
# 좌표 주의: WebDriver의 창 크기는 Retina 픽셀, screencapture -R은 논리 좌표다.
# 둘을 섞으면 창 밖을 녹화한다 — 그래서 창 배치는 AppleScript(논리 좌표)로 한다.
#
# 녹화 종료가 이 스크립트의 함정이다. 세 가지가 맞아떨어져야 "E2E가 끝난 그 지점까지"만 남는다:
#   1. `-V <초>`가 아니라 `-v`  — -V는 "그 시간 **동안** 녹화"라 중간에 끊을 수 없다. 180을 주면
#      E2E가 10초에 끝나도 빈 화면을 180초까지 채운다(실측: 52MB 중 대부분이 빈 바탕화면).
#   2. `set -m`(작업 제어)  — 비대화식 셸은 백그라운드 잡의 SIGINT를 **무시**하게 만든다.
#      켜지 않으면 아래 kill -INT가 허공에 날아가고, 사람 눈에는 정상 종료로 보인다.
#   3. 신호는 INT여야 한다  — TERM은 마무리 없이 죽어 **파일이 아예 남지 않는다**(실측).
set -euo pipefail
set -m

# 사용법: record-demo.sh [출력.mov] [시나리오 필터(vitest -t 정규식)]
# 필터를 주면 그 시나리오만 실행·녹화한다 — 전체 스위트는 기계 속도라 사람이 볼 데모로는
# 빠르므로, 주제별로 잘라 녹화한다. 종료 방어(앱 종료)는 필터 밖이면 실행되지 않는다.
OUT="${1:-/tmp/norii-demo.mov}"
TEST_FILTER="${2:-}"
WIN_X=40
WIN_Y=40
WIN_W=1120
WIN_H=640
MAX_SECONDS=180 # 안전 상한 — E2E가 매달려도 무한 녹화가 되지 않게 감시자가 끊는다.

if ! nc -z 127.0.0.1 4445 2>/dev/null; then
  echo "✘ E2E 앱이 실행 중이 아닙니다. 먼저 다른 터미널에서: mise run dev-webdriver" >&2
  exit 1
fi

echo "▸ 창을 (${WIN_X},${WIN_Y}) ${WIN_W}×${WIN_H} 논리 좌표에 배치하고 맨 앞으로"
# frontmost가 없으면 다른 창이 겹친 채 그 영역이 녹화된다 — screencapture -R은 "화면의
# 그 자리"를 찍을 뿐 창을 따라가지 않는다(실측).
osascript -e "tell application \"System Events\" to tell process \"norii\" to set frontmost to true" \
  -e "tell application \"System Events\" to tell process \"norii\" to set position of window 1 to {${WIN_X}, ${WIN_Y}}" \
  -e "tell application \"System Events\" to tell process \"norii\" to set size of window 1 to {${WIN_W}, ${WIN_H}}" >/dev/null

echo "▸ 녹화 시작 → $OUT"
rm -f "$OUT"

# `-v`는 "아무 키나 누르면 멈춘다" 모드라 **표준입력을 읽는다.** 스크립트에서 그냥 띄우면 stdin이
# 곧바로 EOF가 되어 0.1초 만에 스스로 멈춘다(실측). 그래서 아무것도 쓰지 않는 파이프를 물려
# 입력을 열어 둔다. 그 파이프를 붙잡는 sleep이 **안전 상한**도 겸한다 — 상한이 지나면 EOF가 흘러
# 녹화가 저장되며 끝난다(E2E가 매달려도 무한 녹화가 되지 않는다).
FIFO="$(mktemp -u /tmp/norii-demo-stdin.XXXXXX)"
mkfifo "$FIFO"
sleep "$MAX_SECONDS" >"$FIFO" &
HOLDER_PID=$!

screencapture -v -R "${WIN_X},${WIN_Y},${WIN_W},${WIN_H}" -x "$OUT" <"$FIFO" &
CAPTURE_PID=$!
sleep 1

echo "▸ E2E 시나리오 실행 (이 화면이 그대로 녹화된다)${TEST_FILTER:+ — 필터: ${TEST_FILTER}}"
if [ -n "$TEST_FILTER" ]; then
  (cd apps/desktop && pnpm test:e2e -t "$TEST_FILTER") || echo "⚠ E2E 실패 — 녹화는 그대로 저장한다(실패 화면도 증거다)"
else
  mise run e2e || echo "⚠ E2E 실패 — 녹화는 그대로 저장한다(실패 화면도 증거다)"
fi

sleep 2
kill -INT "$CAPTURE_PID" 2>/dev/null || true
wait "$CAPTURE_PID" 2>/dev/null || true
kill "$HOLDER_PID" 2>/dev/null || true
rm -f "$FIFO"

if [ ! -f "$OUT" ]; then
  echo "✘ 녹화 실패 — 화면 기록 권한을 확인하세요(시스템 설정 → 개인정보 보호 → 화면 기록)" >&2
  exit 1
fi
echo "✔ 완료: $OUT ($(( $(stat -f%z "$OUT") / 1048576 ))MB)"
echo "  PR 첨부: mise run upload-demo $OUT"
