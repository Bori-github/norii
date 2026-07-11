#!/usr/bin/env bash
# 실앱 데모 영상 녹화 — E2E 시나리오를 그대로 녹화해 PR 첨부용 영상을 만든다.
# 사용법: mise run demo  (→ .claude/docs/development-commands.md)
#
# 왜 E2E를 녹화하나: E2E 시나리오가 곧 "기능이 동작함"의 증거다. 별도 데모 스크립트를
# 두면 테스트와 데모가 따로 낡는다. 테스트가 늘면 데모도 자동으로 풍부해진다.
#
# 좌표 주의: WebDriver의 창 크기는 Retina 픽셀, screencapture -R은 논리 좌표다.
# 둘을 섞으면 창 밖을 녹화한다 — 그래서 창 배치는 AppleScript(논리 좌표)로 한다.
set -euo pipefail

OUT="${1:-/tmp/norii-demo.mov}"
WIN_X=40
WIN_Y=40
WIN_W=1120
WIN_H=640
MAX_SECONDS=180 # 안전 상한 — E2E가 끝나면 즉시 중단한다.

if ! nc -z 127.0.0.1 4445 2>/dev/null; then
  echo "✘ E2E 앱이 실행 중이 아닙니다. 먼저 다른 터미널에서: mise run dev-webdriver" >&2
  exit 1
fi

echo "▸ 창을 (${WIN_X},${WIN_Y}) ${WIN_W}×${WIN_H} 논리 좌표에 배치"
osascript -e "tell application \"System Events\" to tell process \"norii\" to set position of window 1 to {${WIN_X}, ${WIN_Y}}" \
  -e "tell application \"System Events\" to tell process \"norii\" to set size of window 1 to {${WIN_W}, ${WIN_H}}" >/dev/null

echo "▸ 녹화 시작 → $OUT"
rm -f "$OUT"
screencapture -V "$MAX_SECONDS" -R "${WIN_X},${WIN_Y},${WIN_W},${WIN_H}" -x "$OUT" &
CAPTURE_PID=$!
sleep 1

echo "▸ E2E 시나리오 실행 (이 화면이 그대로 녹화된다)"
mise run e2e || echo "⚠ E2E 실패 — 녹화는 그대로 저장한다(실패 화면도 증거다)"

sleep 2
kill -INT "$CAPTURE_PID" 2>/dev/null || true
wait "$CAPTURE_PID" 2>/dev/null || true

if [ ! -f "$OUT" ]; then
  echo "✘ 녹화 실패 — 화면 기록 권한을 확인하세요(시스템 설정 → 개인정보 보호 → 화면 기록)" >&2
  exit 1
fi
echo "✔ 완료: $OUT ($(( $(stat -f%z "$OUT") / 1048576 ))MB)"
echo "  PR 첨부: mise run upload-demo $OUT"
