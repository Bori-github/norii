#!/usr/bin/env bash
# GitHub 자산 CDN에 파일을 업로드하고 마크다운용 URL을 출력한다(커밋 없이).
# 사용법: mise run upload-demo <파일>  (→ .claude/docs/development-commands.md)
#
# 리포에 바이너리를 커밋하지 않고 PR에 영상·스크린샷을 붙이는 유일한 경로다.
# 전제: agent-browser + jq 설치, GitHub 로그인이 브라우저 프로필에 저장돼 있을 것.
# 인증이 없으면 아래 안내대로 한 번만 로그인하면 프로필에 저장돼 이후 자동이다.
set -euo pipefail

FILE="${1:?사용법: scripts/upload-attachment.sh <파일 경로>}"
[ -f "$FILE" ] || { echo "✘ 파일 없음: $FILE" >&2; exit 1; }

SKILL_SCRIPTS="$HOME/.claude/skills/uploading-attachments/scripts"
PROFILE="$HOME/.claude/browser-profiles/github"
SESSION="gh-upload"

command -v jq >/dev/null || { echo "✘ jq 필요: brew install jq" >&2; exit 1; }
command -v agent-browser >/dev/null || { echo "✘ agent-browser 필요: npm i -g agent-browser" >&2; exit 1; }
[ -x "$SKILL_SCRIPTS/upload-image.sh" ] || { echo "✘ uploading-attachments 스킬 스크립트를 찾을 수 없습니다: $SKILL_SCRIPTS" >&2; exit 1; }

REPO_ID=$(bash "$SKILL_SCRIPTS/get-repo-info.sh" | jq -r .repo_id)
REPO_URL=$(bash "$SKILL_SCRIPTS/get-repo-info.sh" | jq -r .repo_url)

# 저장된 프로필로 세션을 연다 — 쿠키(user_session)를 업로드 스크립트가 여기서 꺼낸다.
agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
agent-browser --session "$SESSION" --profile "$PROFILE" open "$REPO_URL" >/dev/null 2>&1

if agent-browser --session "$SESSION" snapshot -i 2>/dev/null | grep -q 'link "Sign in"'; then
  echo "✘ GitHub 로그인이 필요합니다. 한 번만 아래를 실행해 로그인하면 프로필에 저장됩니다:" >&2
  echo "    agent-browser --session $SESSION --headed --profile $PROFILE open https://github.com/login" >&2
  echo "    (로그인 후) agent-browser --session $SESSION close" >&2
  agent-browser --session "$SESSION" close >/dev/null 2>&1 || true
  exit 1
fi

RESULT=$(bash "$SKILL_SCRIPTS/upload-image.sh" "$REPO_ID" "$SESSION" "$FILE")
agent-browser --session "$SESSION" close >/dev/null 2>&1 || true

HREF=$(echo "$RESULT" | jq -r '.[0].href // empty')
[ -n "$HREF" ] || { echo "✘ 업로드 실패: $RESULT" >&2; exit 1; }

echo "✔ 업로드 완료"
echo "$HREF"
echo
echo "PR 본문/코멘트에 붙여넣기 (영상은 URL만 두면 GitHub이 플레이어로 렌더한다):"
echo "$HREF"
