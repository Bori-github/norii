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

## 강제 (Enforcement)

**commitlint**(`@commitlint/config-conventional`)로 검증하고, **lefthook `commit-msg` 훅**이 매 커밋에 이를 실행한다(→ [코드 품질 전략](../docs/code-quality.md#lefthook-커밋-전-자동화)). 규칙 위반 시 커밋이 거부된다.

- 타입·형식은 commitlint가 강제한다.
- 요약을 한국어로 쓰는 것은 이 문서의 팀 규칙이다(commitlint는 언어를 검사하지 않음).
- 커밋 메시지 작성은 전역 `commit-message` 스킬로 생성할 수 있으며, 생성 결과도 이 컨벤션을 따른다.

버전 핀은 [기술 스택 — 코드 품질](../docs/tech-stack.md#코드-품질)을 단일 출처로 둔다.
