---
description: 현재 브랜치로 Pull Request를 생성한다 (.github PR 템플릿·커밋 컨벤션 기반)
argument-hint: "[base 브랜치 — 생략 시 main]"
---

현재 브랜치의 변경으로 Pull Request를 만든다. 규칙의 단일 출처는 아래이며, 이 커맨드는 그것을 실행할 뿐 규칙을 다시 정의하지 않는다:

- 제목·라벨 규칙: `.claude/rules/commit-convention.md`
- 본문 구조: `.github/pull_request_template.md`

## 절차

1. **base 결정** — 인자로 받은 브랜치, 없으면 `main`. `origin/<base>`가 있으면 그것을 기준으로 삼는다. 현재 브랜치가 base면 "리뷰/생성할 변경이 없다"고 알리고 멈춘다.
2. **맥락 수집**
   - `git log origin/<base>..HEAD --oneline` — 커밋들이 곧 의도다
   - `git diff origin/<base>..HEAD --stat` — 변경 파일
   - 커밋 본문과 `.claude` 문서 변경에서 결정·이탈을 읽는다
3. **본문 작성** — `.github/pull_request_template.md`를 읽어 각 섹션을 diff·커밋을 근거로 채운다.
   - 범위의 "의도적으로 안 한 것/후속"과 검증(값)은 **반드시** 채운다 — diff에 안 담기는 정보다
   - 확실치 않으면 추측하지 말고 사용자에게 묻는다
   - diff·커밋·`.claude` 문서에서 읽을 수 있는 것은 중복하지 않는다(의도·제외·검증 결과·이탈 위주)
4. **제목** — `type(scope): 한국어 요약`. 지배적 변경으로 type 결정. **한국어 단어로 시작**한다(commitlint subject-case가 대문자 영문 시작을 거부한다).
5. **라벨** — 변경 유형에 맞는 라벨(feat·fix·docs·refactor·perf·test·build·ci·chore)을 고른다.
6. **검증 상태** — `mise run check` 결과를 본문에 값으로 적는다(못 돌리면 그 이유). 실앱 E2E·번들 크기는 mac 실기 항목이라 통과/미검증 상태만 표기한다.
7. **확인 후 생성** — 초안(제목·본문·라벨·담당자)을 사용자에게 보여주고 **승인받은 뒤에만** 실행한다:
   - 브랜치가 원격에 없으면 먼저 `git push -u origin <branch>` (승인 후)
   - `gh pr create --base <base> --title "…" --body "…" --assignee @me` 후 `gh pr edit --add-label <label>`
   - 담당자는 `@me`(현재 인증 사용자)로 자동 배정한다 — 계정명을 하드코딩하지 않는다.

## 규칙

- **push·PR 생성·라벨 부여 등 외부 작업은 반드시 먼저 확인**받는다. 승인 전엔 실행하지 않는다.
- 저장소 식별자(GitHub 계정·URL)를 본문에 하드코딩하지 않는다.
- 본문 마크다운은 `.github/**`라 oxfmt 대상이 아니다(플레이스홀더 구조 보존).
