# 개발 명령

norii 개발에 쓰는 명령의 단일 출처다. 태스크 정의의 실제 출처는 `.mise.toml`이며, 이 문서는 그 사용법과 의도를 설명한다.

## 사전 준비

```sh
mise install     # .mise.toml의 node/rust/pnpm을 고정 버전으로 설치
pnpm install     # 워크스페이스 의존성 설치
```

`mise install` 한 번으로 Node·Rust·pnpm이 프로젝트 고정 버전으로 세팅된다. 팀원·CI가 동일 환경을 재현한다.

`pnpm install`은 postinstall 훅으로 **`panda codegen`**을 실행해 `styled-system/` 생성물을 만든다(VCS 제외 — → [디자인 시스템](design-system.md#fsd-배치)). 이 단계가 빠지면 clone 직후 `typecheck`·빌드가 생성물 부재로 실패한다.

## 자주 쓰는 명령

```sh
mise run dev        # 데스크탑 앱 개발 모드 (Vite dev + Tauri)
mise run build      # 데스크탑 앱 릴리스 빌드
mise run fmt        # 포맷 적용 (oxfmt)
mise run check      # 전체 게이트 (커밋 전 필수, 수정 없이 검증)
```

## 개별 태스크

품질 도구·전략은 [코드 품질 전략](code-quality.md)을 단일 출처로 둔다.

```sh
# JS/TS (Oxc 패밀리)
mise run lint         # oxlint (린트)
mise run fmt          # oxfmt (포맷 적용)
mise run fmt-check    # oxfmt --check (포맷 검증, 수정 없음)
mise run fsd-lint     # steiger (FSD 아키텍처 검증)
mise run typecheck    # tsc (타입 체크)
mise run test         # Vitest (테스트)

# Rust
mise run rust-fmt-check  # cargo fmt --check
mise run clippy          # cargo clippy -D warnings
mise run rust-test       # cargo test

# 실앱 E2E (check 미포함 — CI에서 실행)
mise run e2e             # tauri-plugin-webdriver 실앱 E2E (→ testing.md)
```

`mise run check`는 위 검증 태스크(`fmt-check`·`lint`·`fsd-lint`·`typecheck`·`test`·`rust-fmt-check`·`clippy`·`rust-test`)를 모두 실행한다. 포맷을 **수정**하는 건 `mise run fmt`뿐이고, 게이트는 검증만 한다.

## 문서-코드 드리프트 검사 (docs-drift)

```sh
mise run docs-drift   # 계약 문서 ↔ 코드 기계 대조 (M0에서 구현 → check에 편입)
```

문서-코드 간극을 성실함이 아니라 **게이트가 잡는다**. 대조 대상은 [작업 규칙](../rules/project-rules.md)의 계약 문서 중 기계 대조 가능한 두 표면이다:

- Rust 소스의 `#[tauri::command]` 함수명이 [Rust 커맨드 계약](rust-commands.md)에 등재됐는지 — **코드 → 문서 단방향 검사**다. 계약 없는 커맨드는 게이트 실패이고, 문서에만 있는 커맨드는 아직 미구현 계약으로 허용한다(개발 진행 중 게이트가 항상 빨간불이 되지 않게)
- [기술 스택](tech-stack.md) 표에 적힌 버전이 `package.json`·`Cargo.toml`의 실제 핀과 일치하는지 — **단방향 검사**다. 표에 없는 의존성에 등재를 요구하지 않는다(요구하면 모든 의존성 추가가 게이트에 걸리는 과잉 검사가 된다)

## 규칙

- **커밋 전 `mise run check`를 통과**시킨다(→ [작업 규칙](../rules/project-rules.md)).
- 새 태스크는 `.mise.toml`에 추가하고 이 문서에 사용법을 남긴다.
- 새 패키지·앱은 pnpm workspace와 Turborepo 파이프라인에 연결한다(→ [파일/폴더 구조](project-structure.md)).
- 자동 검증이 불가능한 동작(예: macOS 서명·시각 확인)은 그 이유와 수동 검증 방법을 PR·문서에 남긴다.

## 성공 기준

현재 단계(M0)의 성공 기준은 [실제 구현 계획](implementation-plan.md#성공-기준-현재-단계)을 단일 출처로 둔다.
