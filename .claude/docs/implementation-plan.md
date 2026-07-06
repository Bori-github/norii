# 실제 구현 계획

norii의 구현 순서와 열린 결정의 단일 출처다. 각 단계는 앞 단계가 동작한 뒤 진행한다.

설계 의도는 **작동하는 얇은 슬라이스를 먼저 세우고, 경계를 지키며 넓히는 것**이다. 큰 기능을 한 번에 만들지 않는다.

## 마일스톤

| 단계 | 내용 | 핵심 산출물 |
|---|---|---|
| M0. 스캐폴드 | 모노레포(mise + pnpm + turbo) · Tauri+Vite+React 최소 실행 · CM6 마크다운 하이라이팅·문서 내 검색(기본 키맵) · 디자인 시스템 토큰(Panda, → [디자인 시스템](design-system.md)) · 품질 게이트(oxlint/oxfmt/Vitest/lefthook, → [코드 품질](code-quality.md)) · 문서 드리프트 검사(`docs-drift`) · **E2E 하네스**(tauri-plugin-webdriver 스모크 1개, → [테스트 전략](testing.md)) · 번들 크기 측정 기반 | `mise run dev`로 창이 뜨고 편집·하이라이팅 동작 · `mise run check` 통과 · E2E 스모크 실행 |
| M1. 코어 편집(왕복) | 파일 열기/저장(**UTF-8·단일 EOL만** — 저장이 원본 바이트를 재작성하게 되는 파일(비UTF-8·혼합 EOL·CR-only)은 이 단계에선 거부. 단일 EOL의 판정·유지는 포함) · 원자적 쓰기·해시 충돌 검사 · **자동 저장** · 다중 탭 · dirty 추적 · **종료 방어** · IPC 에러 정규화·에러 바운더리·로깅(→ [에러 처리](error-handling.md)) · E2E 실전 시나리오(파일 왕복·종료 방어) | 파일을 열고 고치면 자동 저장, 탭 여러 개, 종료 시 유실 없음 |
| M2. 파일 강건성 | **M1이 거부하던 파일을 안전하게 연다** — 인코딩 파이프라인(chardetng 변환)·혼합 EOL/CR-only 수용 + 배너·**정규화 승인** · watch 외부 변경 처리(에코 억제·충돌 흐름) | EUC-KR·혼합 EOL 문서를 열어 승인 후 저장, 외부 수정 시 리로드/충돌 안내 |
| M3. 프리뷰 | 분할 프리뷰(markdown-it + DOMPurify) · 스크롤 동기화 | 소스 옆에 렌더 프리뷰, 스크롤 연동 |
| M4. 하이브리드 구조 | 사이드바 파일 트리 · 헤딩 접기 | 폴더 열어 트리 탐색, 헤딩 폴딩 |
| M5. 다듬기 | 리스트 접기 · 테마 · 설정 영속화(자동 저장 토글 포함) · 세션 복원 · **한글 IME QA**(E2E) | 실사용 가능한 수준 |
| M6. 배포(mac) | 코드 서명·공증 · 자동 업데이트 · 번들 크기 목표 확정 | 배포 가능한 서명된 mac 빌드 |
| 이후 | Windows/Linux 확장 → (필요 시) 모바일 · KaTeX/Mermaid | — |

모든 마일스톤 기능은 **TDD로 진행**한다 — 실패하는 테스트를 먼저 쓰고 구현한다(→ [테스트 전략 · TDD](testing.md)). M0에서 테스트 하네스(Vitest·cargo test)를 게이트에 연결한다.

각 마일스톤은 **문서 대조로 끝난다** — 구현과 계약 문서(→ [작업 규칙 — 문서 규칙](../rules/project-rules.md))의 차이가 0이어야 완료다. 차이를 발견하면 임의로 문서를 코드에 맞춰 고치지 않고, [작업 규칙](../rules/project-rules.md)의 **설계 변경 워크플로**(멈춤 → 보고 → 문서 갱신 → 코드 정렬)를 따른다. 여기서 "차이"란 **구현된 것이 문서와 다른 것**이다 — 아직 배정된 마일스톤이 오지 않은 계약의 미구현은 차이가 아니다(`docs-drift` 커맨드 검사의 단방향 원칙과 동일).

각 단계의 세부 정책은 해당 문서를 단일 출처로 둔다.

```text
M0  → project-structure.md · development-commands.md · tech-stack.md · design-system.md · testing.md
M1  → rust-commands.md · document-model.md · file-lifecycle.md · error-handling.md
M2  → file-lifecycle.md · rust-commands.md
M3  → preview-strategy.md
M4  → document-model.md · editor-strategy.md
M5  → editor-strategy.md · file-lifecycle.md · design-system.md · document-model.md
M6  → platform-strategy.md
```

## 열린 결정 (Open Decisions)

로드맵을 진행하며 확정한다. 이 목록에 없는 새 결정이 필요하면 [작업 규칙](../rules/project-rules.md)에 따라 사용자에게 보고한다.

```text
스냅샷 백업       주기 스냅샷(File Recovery류) 도입 여부  (→ file-lifecycle.md)
접힘 상태 영속화  사이드카 도입 시점                     (→ editor-strategy.md, non-goals.md)
Mermaid 번들      무거운 mermaid를 lazy-load로 <15MB 목표 내 흡수 가능한지 실측 (→ preview-strategy.md)
테마 커스터마이징 프리셋 토큰 vs 사용자 커스텀 깊이     (→ design-system.md)
탭 세션 복원      커서 위치까지 복원할지                 (→ document-model.md)
oxfmt 1.0 재확인  베타(0.x) → 1.0 도달 시 안정성 재점검   (→ code-quality.md)
E2E 도구 재확인   tauri-plugin-webdriver pre-1.0 → 1.0 도달 시 재점검 — 도입 시점은 확정(하네스 M0 · 실전 시나리오 M1) (→ testing.md)
tauri-specta 2.0  rc 핀 → 정식 2.0 도달 시 재확인            (→ tech-stack.md)
원격 이미지       프리뷰에서 http(s) 이미지 로드 허용 여부   (→ security.md)
커버리지 임계값   도입 시점·수치                              (→ testing.md)
인코딩 수동 선택  encoding_override는 계약에 있음 — 배너 UI 노출 시점 (→ file-lifecycle.md)
트리 외부 변경    사이드바 트리의 외부 생성/삭제 반영 방식 — M4 (→ document-model.md)
프리뷰 디바운스   구체 값은 M3에서 실측으로 확정              (→ preview-strategy.md)
번들 크기 측정    무엇을(.app/dmg) 어떻게 측정할지 — 측정 기반은 M0 (→ platform-strategy.md)
```

## 성공 기준 (현재 단계)

M0의 성공 기준:

```text
mise install        툴체인 세팅 성공
mise run dev        창이 뜨고 마크다운 편집·하이라이팅 동작
mise run check      포맷·타입·테스트·린트·docs-drift 통과
mise run e2e        실앱 스모크 시나리오 1개 통과 (하네스 동작 확인)
```
