# 커밋 컨벤션

norii는 **Conventional Commits**를 따르되, **요약(subject)은 한국어**로 쓴다. 이 문서는 커밋 메시지 규칙의 단일 출처다.

의도는 **히스토리를 기계·사람 모두 읽을 수 있게** 하는 것이다. 타입·스코프로 변경 성격을 즉시 파악하고, 향후 changelog·버전 자동화의 토대로 삼는다.

## 형식

```
<type>(<scope>): <한국어 요약>

[본문 — 필요 시, 왜/무엇을]

[푸터 — BREAKING CHANGE, 이슈 참조 등]
```

- `type`은 **영문 소문자**, `scope`는 선택.
- 요약은 **한국어**, 명령형·간결하게. **마침표 없음**, 50자 내외 권장(최대 72자).
- **요약을 영문 고유명사로 시작하지 않는다** — commitlint `subject-case`가 대문자 영문 시작을 거부한다. 영문 이름으로 시작할 내용이면 한국어 단어를 앞에 둔다(예: `Renovate 도입` → `의존성 자동 갱신 Renovate 도입`).
- **본문은 각 줄 100자 이내** — commitlint `body-max-line-length` 기본값.
- 마지막 줄에 `Co-Authored-By: Claude <모델명> <noreply@anthropic.com>` 트레일러를 붙인다(모델명은 현재 실행 모델).
- 관련 PR/이슈는 요약 끝에 `(#12)`로 붙일 수 있다.

## 타입 (type)

| 타입 | 용도 |
|---|---|
| `feat` | 사용자 기능 추가/변경 |
| `fix` | 버그 수정 |
| `docs` | 문서(`.claude/**`, README 등) |
| `style` | 포맷·세미콜론 등 동작 없는 변경 |
| `refactor` | 동작 불변 리팩터링 |
| `perf` | 성능 개선 |
| `test` | 테스트 추가/수정 |
| `build` | 빌드·의존성(Vite·Cargo·pnpm) |
| `ci` | CI 설정(GitHub Actions 등) |
| `chore` | 잡무(설정·툴링) |
| `revert` | 되돌리기 |

## 스코프 (scope) — 선택

norii 구조에 맞춘 권장 스코프. 없으면 생략한다.

```text
프론트 영역   editor · preview · sidebar · tabs · theme · ipc · shared
백엔드        rust        (Tauri/파일 I/O/커맨드)
디자인 시스템 ds          (Panda 토큰·recipe)
패키지        pkg-editor · pkg-markdown · pkg-ui
앱            desktop
인프라        deps · ci · config · docs
```

## 예시

```text
feat(editor): 헤딩 접기(폴딩) 추가
fix(ipc): 저장 실패 시 dirty 상태가 유지되지 않던 문제 수정
feat(sidebar): 파일 트리 폴더 접기/펼치기 (#12)
docs(design-system): Panda 토큰 계층 문서 추가
refactor(shared): IPC 래퍼를 shared/ipc로 이동
build(deps): oxfmt 0.57.0으로 업데이트
ci: mac 러너에서 mise run check 게이트 추가

feat(preview): KaTeX 수식 렌더 지원

BREAKING CHANGE: 프리뷰 설정 키 이름 변경 (mathEnabled → katex)
```

## PR 제목·라벨

- **PR 제목도 커밋과 동일한 `type(scope): 한국어 요약` 형식**을 따른다. squash 병합을 하면 PR 제목이 그대로 `main`의 커밋 메시지가 되는데, 그 커밋은 GitHub이 만들어 로컬 commitlint 훅을 거치지 않으므로 제목 단계에서 규칙을 지킨다.
- **변경 유형은 라벨로 표시**한다 — 위 [타입](#타입-type) 표의 이름을 그대로 라벨로 둔다(`feat`…`revert` 전부 일치). 제목에 이미 타입이 있으니 본문 체크박스 대신 라벨을 써서 필터·집계가 되게 한다.
- PR 본문은 [PR 템플릿](../../.github/pull_request_template.md)을 따른다.

## 강제 (Enforcement)

**commitlint**(`@commitlint/config-conventional`)로 검증하고, **lefthook `commit-msg` 훅**이 매 커밋에 이를 실행한다(→ [코드 품질 전략](../docs/code-quality.md#게이트-자동화-훅과-ci)). 규칙 위반 시 커밋이 거부된다.

- 타입·형식은 commitlint가 강제한다.
- 요약을 한국어로 쓰는 것은 이 문서의 팀 규칙이다(commitlint는 언어를 검사하지 않음).
- 이 컨벤션을 실행하는 프로젝트 커맨드로 `/commit`(커밋)·`/pr`(PR 생성)이 있다(`.claude/commands/`). 전역 `commit-message` 스킬로도 생성할 수 있으며, 어느 쪽이든 결과는 이 컨벤션을 따른다.

버전 핀은 [기술 스택 — 코드 품질](../docs/tech-stack.md#코드-품질)을 단일 출처로 둔다.
