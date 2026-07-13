# norii 에이전트 인덱스

이 문서는 norii에서 작업하는 에이전트가 가장 먼저 읽는 진입점이다. 실제 규칙과 설명은 링크된 문서를 단일 출처로 둔다.

norii는 가볍고 빠른 로컬 우선(local-first) 마크다운 **소스 뷰** 에디터다. 한 줄 정의는 다음과 같다.

> "파일 트리 사이드바 + 자유 텍스트 마크다운 소스 편집 + 실시간 분할 프리뷰" — 단, 본문은 블록/아웃라이너 모델이 아니다.

## 먼저 읽을 문서

- [개발 명령](.claude/docs/development-commands.md)
- [작업 규칙](.claude/rules/project-rules.md)
- [커밋 컨벤션](.claude/rules/commit-convention.md)
- [파일/폴더 구조](.claude/docs/project-structure.md)
- [기술 스택](.claude/docs/tech-stack.md)
- [비목표와 경계 규칙](.claude/rules/non-goals.md)
- [실제 구현 계획](.claude/docs/implementation-plan.md)
- [테스트 전략 · TDD](.claude/docs/testing.md)

## 설계 문서

- [초기 아키텍처](.claude/docs/architecture.md)
- [프론트엔드 아키텍처(FSD)](.claude/docs/frontend-architecture.md)
- [디자인 규칙(불변식 · 표면 표 · 접근성)](DESIGN.md)
- [디자인 결정 기록(ADR)](.claude/docs/design/decisions/README.md)
- [디자인 시스템(Panda CSS)](.claude/docs/design/design-system.md)
- [창 표면 계약(투명 창 · 창 뒤 흐림 · 폴백)](.claude/docs/design/window-chrome.md)
- [문서 모델(다중 탭 + 파일 트리)](.claude/docs/document-model.md)
- [Rust 커맨드 계약(파일 I/O · IPC 경계)](.claude/docs/rust-commands.md)
- [에디터 전략(CodeMirror 6 · 하이브리드 접기)](.claude/docs/editor-strategy.md)
- [프리뷰 전략(markdown-it · sanitize · 스크롤 동기화)](.claude/docs/preview-strategy.md)
- [파일 생명주기 정책](.claude/docs/file-lifecycle.md)
- [코드 품질 전략(oxlint · oxfmt · Vitest · Rust 게이트)](.claude/docs/code-quality.md)
- [보안(Tauri CSP · capabilities · sanitize)](.claude/docs/security.md)
- [에러 처리와 로깅](.claude/docs/error-handling.md)
- [플랫폼 전략(mac → Windows → Linux → 모바일)](.claude/docs/platform-strategy.md)
- [참고 사례와 라이선스](.claude/rules/prior-art.md)

## 핵심 원칙

작업자는 [작업 규칙](.claude/rules/project-rules.md)을 따라야 한다. 이 문서에 없는 결정이 필요하거나 실제 구현이 설계와 달라지는 경우에는 임의로 진행하지 말고 사용자에게 먼저 보고한다.

norii의 모든 스코프 판단은 [비목표와 경계 규칙](.claude/rules/non-goals.md)의 한 문장을 단일 출처로 둔다.

> 구조가 텍스트 안(헤딩·들여쓰기·`<details>`)에 살면 채택하고, 텍스트 밖(블록 ID·영구 상태·참조)에 살면 거부한다.

Obsidian·Logseq 등 비공개/AGPL 앱의 기능을 참고할 때는 [참고 사례와 라이선스](.claude/rules/prior-art.md)의 clean-room 규칙을 단일 출처로 둔다.

> 동작·UX만 관찰해 독립 재구현한다. 코드·에셋·독점 문법을 가져오지 않는다. "코드를 봤는가"가 아니라 "코드에서 가져왔는가"로 판단한다.
