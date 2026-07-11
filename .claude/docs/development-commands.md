# 개발 명령

norii 개발에 쓰는 명령의 단일 출처다. 태스크 정의의 실제 출처는 `.mise.toml`이며, 이 문서는 그 사용법과 의도를 설명한다.

## 사전 준비

```sh
mise install     # .mise.toml의 node/rust/pnpm을 고정 버전으로 설치
pnpm install     # 워크스페이스 의존성 설치
```

`mise install` 한 번으로 Node·Rust·pnpm이 프로젝트 고정 버전으로 세팅된다. 팀원·CI가 동일 환경을 재현한다.

`pnpm install`은 postinstall 훅으로 **`panda codegen`**을 실행해 `styled-system/` 생성물을 만든다(VCS 제외 — → [디자인 시스템](design/design-system.md#fsd-배치)). 이 단계가 빠지면 clone 직후 `typecheck`·빌드가 생성물 부재로 실패한다.

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

# 실앱 E2E (check 미포함 — 앱 실행 필요, CI에서 실행)
mise run dev-webdriver & # 1) webdriver 피처를 켠 개발 빌드 앱 (임베디드 WebDriver가 127.0.0.1:4445에 기동)
mise run e2e             # 2) webdriverio가 그 앱에 붙어 스모크 실행 (→ testing.md)

# PR 데모 영상 (check 미포함 — 앱 실행·화면 기록 권한 필요, macOS 전용)
mise run dev-webdriver &        # 1) E2E용 앱 실행
mise run demo                   # 2) E2E 시나리오를 실행하며 앱 창을 녹화 → /tmp/norii-demo.mov
mise run upload-demo <파일>     # 3) GitHub CDN 업로드 → PR에 붙일 URL 출력 (리포에 커밋하지 않는다)

# 번들 크기 측정 (check 미포함 — 빌드 산출물 필요)
# 현재(M0)는 프론트엔드 dist 측정만 유효하다. 앱 번들(.app)은 아래 참고.
pnpm --filter desktop build   # vite 빌드 → dist 생성 (빠름)
mise run bundle-size          # dist 측정 · 앱 번들 있으면 15MB 예산과 비교 (→ platform-strategy.md)

# 실제 .app 크기(15MB 예산의 대상)를 재려면 번들링을 켜서 릴리스 빌드한다 (느림):
#   pnpm --filter desktop tauri build --bundles app   # → target/release/bundle/macos/*.app
#   mise run bundle-size
# 번들링 상시화·서명·CI 측정은 배포 단계(M6, → platform-strategy.md)에서 다룬다.
# 주의: `mise run build`는 프론트가 아니라 풀 tauri 릴리스 빌드다(bundle.active:false라 .app 미생성).
```

`mise run check`는 위 검증 태스크(`fmt-check`·`lint`·`fsd-lint`·`typecheck`·`test`·`rust-fmt-check`·`clippy`·`rust-test`)를 모두 실행한다. 포맷을 **수정**하는 건 `mise run fmt`뿐이고, 게이트는 검증만 한다.

## 문서-코드 드리프트 검사 (docs-drift)

```sh
mise run docs-drift   # 계약 문서 ↔ 코드 기계 대조 (scripts/docs-drift.mjs)
```

`mise run check` 게이트에 편입돼 있다. 구현은 `scripts/docs-drift.mjs`(의존성 없는 Node 스크립트)다. 문서-코드 간극을 성실함이 아니라 **게이트가 잡는다**. 대조 대상은 [작업 규칙](../rules/project-rules.md)의 계약 문서 중 기계 대조 가능한 두 표면이다:

- Rust 소스의 `#[tauri::command]` 함수명이 [Rust 커맨드 계약](rust-commands.md)에 등재됐는지 — **코드 → 문서 단방향 검사**다. 계약 없는 커맨드는 게이트 실패이고, 문서에만 있는 커맨드는 아직 미구현 계약으로 허용한다(개발 진행 중 게이트가 항상 빨간불이 되지 않게)
- [기술 스택](tech-stack.md) 표에 적힌 버전이 `package.json`·`Cargo.toml`의 실제 핀과 일치하는지 — **단방향 검사**다. 표에 없는 의존성에 등재를 요구하지 않는다(요구하면 모든 의존성 추가가 게이트에 걸리는 과잉 검사가 된다)

## PR 데모 영상 (demo · upload-demo)

사용자에게 보이는 동작이 바뀐 PR에는 데모 영상을 붙인다(→ [/pr 커맨드](../commands/pr.md)). **E2E 시나리오를 그대로 녹화**하는 것이 규칙이다 — 별도 데모 스크립트를 두면 테스트와 데모가 따로 낡는다. E2E가 늘면 데모도 자동으로 풍부해진다.

- `mise run demo`(`scripts/record-demo.sh`) — 앱 창을 논리 좌표에 배치하고 `mise run e2e`를 실행하며 그 화면을 녹화한다. **좌표 주의**: WebDriver의 창 크기는 Retina 픽셀이고 `screencapture -R`은 논리 좌표다 — 섞으면 창 밖이 찍힌다. 그래서 창 배치는 AppleScript(논리 좌표)로 한다.
- `mise run upload-demo <파일>`(`scripts/upload-attachment.sh`) — GitHub 자산 CDN에 올려 URL을 받는다. **리포에 영상 바이너리를 커밋하지 않기 위한 유일한 경로**다. 인증은 `agent-browser` 브라우저 프로필에 저장되며, 첫 실행에서 로그인이 없으면 스크립트가 한 줄 안내를 출력한다(이후 자동).
- 전제: macOS **화면 기록 권한**(시스템 설정 → 개인정보 보호), `jq`, `agent-browser`. 권한·도구가 없으면 스크립트가 이유를 출력하고 멈춘다.

## 규칙

- **커밋 전 `mise run check`를 통과**시킨다(→ [작업 규칙](../rules/project-rules.md)).
- 새 태스크는 `.mise.toml`에 추가하고 이 문서에 사용법을 남긴다.
- 새 패키지·앱은 pnpm workspace와 Turborepo 파이프라인에 연결한다(→ [파일/폴더 구조](project-structure.md)).
- 자동 검증이 불가능한 동작(예: macOS 서명·시각 확인)은 그 이유와 수동 검증 방법을 PR·문서에 남긴다.

## 성공 기준

현재 단계(M0)의 성공 기준은 [실제 구현 계획](implementation-plan.md#성공-기준-현재-단계)을 단일 출처로 둔다.
