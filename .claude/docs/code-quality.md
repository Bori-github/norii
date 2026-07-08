# 코드 품질 전략

norii의 코드 품질 도구와 게이트의 단일 출처다. 도구 버전은 [기술 스택](tech-stack.md#코드-품질)에, 명령 사용법은 [개발 명령](development-commands.md)에, 커밋 전 준수 규칙은 [작업 규칙](../rules/project-rules.md)에 둔다.

설계 의도는 **품질 도구도 스택 철학("가볍고 빠름")과 정렬하는 것**이다. JS/TS 린트·포맷을 **Oxc 패밀리(oxlint + oxfmt)** 로 통일한다. norii의 번들러 Vite 8이 Rolldown/Oxc 기반이므로, 린터·포매터까지 **같은 Oxc 엔진 패밀리**로 맞춘다.

## 도구 구성

| 영역 | 도구 | 근거 |
|---|---|---|
| JS/TS 린트 | **oxlint** | Oxc 기반 초고속 린터. 500+ 룰(ESLint·typescript-eslint·react·jsx-a11y 이식). Vite/Rolldown과 동일 패밀리. |
| JS/TS 포맷 | **oxfmt** | Oxc 포매터. oxlint와 같은 엔진·설정 철학. JS/TS/JSX/JSON/YAML/CSS/Markdown 등 폭넓게 지원. |
| FSD 아키텍처 린트 | **Steiger** | FSD 팀 공식 독립 린터. 레이어 참조 방향·Public API·구조 검증. oxlint(ESLint 아님)와 무관하게 동작. |
| 타입 체크 | **tsc** (`--noEmit`) | TypeScript 컴파일러가 진실. 패키지별 project references로 실행. |
| JS/TS 테스트 | **Vitest** | Vite 8 스택과 네이티브로 맞물림. 빠른 유닛·컴포넌트 테스트. |
| Rust 포맷 | **rustfmt** (`cargo fmt`) | Rust 툴체인 기본. 추가 설치 없음. |
| Rust 린트 | **Clippy** (`cargo clippy`) | Rust 표준 린터. 경고를 에러로(`-D warnings`) 취급. |
| Rust 테스트 | **cargo test** | Rust 표준. |
| Git 훅 | **lefthook** | 단일 바이너리 Git 훅. 커밋 전 `check` 게이트 자동 실행. |
| CI | **GitHub Actions** | 푸시·PR에서 `mise run check` 실행. |

## oxfmt 성숙도 (알아둘 것)

oxfmt는 현재 **0.x(베타)** 다(버전 핀은 [기술 스택](tech-stack.md#코드-품질)을 단일 출처로 둔다). 다만 Vue.js·Turborepo·Sentry 등 광범위하게 채택됐고 활발히 개선 중이다. **리스크 관리**:

- 버전을 정확히 핀하고(→ [기술 스택](tech-stack.md#코드-품질)), 업그레이드 시 포맷 diff를 확인한다.
- 만약 oxfmt가 특정 파일 타입에서 불안정하면, 그 타입만 임시로 다른 포매터로 우회하고 문서에 기록한다.
- 1.0 도달 시 재확인한다(열린 결정 — [실제 구현 계획](implementation-plan.md#열린-결정-open-decisions)).

## 통합 게이트 — `mise run check`

모든 품질 검사는 하나의 게이트로 모인다. **커밋 전 필수**이며(→ [작업 규칙](../rules/project-rules.md)), CI가 동일하게 실행한다.

```text
mise run check   # 아래를 모두 검증 (수정하지 않고 확인만)
  ├─ fmt-check       oxfmt --check .        JS/TS 포맷 검증
  ├─ lint            oxlint                 JS/TS 린트
  ├─ fsd-lint        steiger               FSD 아키텍처 검증
  ├─ typecheck       turbo typecheck (tsc)  타입 체크
  ├─ test            turbo test (vitest)    JS/TS 테스트
  ├─ rust-fmt-check  cargo fmt --check      Rust 포맷 검증
  ├─ clippy          cargo clippy -D warnings  Rust 린트
  ├─ rust-test       cargo test             Rust 테스트
  └─ docs-drift      node scripts/docs-drift.mjs  문서-코드 정합
```

**원칙**: 게이트는 코드를 **수정하지 않는다.** 포맷 적용은 `mise run fmt`(oxfmt 쓰기)로 따로 한다. 게이트는 `fmt-check`로 **검증만** 한다 — 그래야 CI에서 예상치 못한 변경이 생기지 않는다.

**oxfmt 검증 범위**: 네 경로를 제외한다(`.oxfmtrc.json`이 단일 출처). ① `.claude/**` — 설계 문서 원문을 포매터가 재작성하지 않게 한다. ② `**/src-tauri/gen/**` — Tauri가 빌드마다 재생성하는 산출물이라 검증 의미가 없다(버전 관리에서도 제외). ③ `**/styled-system/**` — Panda가 생성하는 디자인 시스템 코드(→ [디자인 시스템](design-system.md#fsd-배치)). ④ `**/dist/**` — 빌드 산출물. 생성물 제외 기준은 oxlint(`.oxlintrc.json`)와 맞춘다.

**`docs-drift`**(계약 문서 ↔ 코드 기계 대조)가 이 게이트에 편입돼 있다(→ [개발 명령](development-commands.md#문서-코드-드리프트-검사-docs-drift)).

## 타입 엄격도 (tsconfig)

TypeScript는 **strict 계열을 전부 켠다.** 타입 안전이 품질의 1차 방어선이다. `tsconfig.base.json`에 공통으로 둔다.

```jsonc
"strict": true,                        // 모든 strict 계열 on
"noUncheckedIndexedAccess": true,      // 인덱스 접근에 undefined 포함
"noImplicitOverride": true,
"noFallthroughCasesInSwitch": true,
"verbatimModuleSyntax": true,          // import type 명시
"skipLibCheck": true                    // 외부 d.ts는 스킵 (빌드 속도)
```

`tsc --noEmit`(=`mise run typecheck`)이 게이트에서 이를 강제한다.

## 테스트

norii는 **TDD를 기본값**으로 두며, **테스트 환경을 운영 환경과 동일하게** 맞춘다(에뮬레이션 DOM 미사용, 위험 영역은 실제 앱에서). 방법론·환경·레이어·도구 매핑·커버리지 정책은 [테스트 전략 · TDD](testing.md)를 단일 출처로 둔다. 게이트(`mise run check`)는 그중 JS/TS 테스트(`test`)와 Rust 테스트(`rust-test`)를 실행한다.

## lefthook (커밋 전 자동화)

lefthook으로 커밋 전에 게이트를 자동 실행한다. 전체 `check`는 실행이 느릴 수 있으므로, 커밋 훅에서는 **변경된 파일에만 oxlint/oxfmt**를 돌리고, 전체 게이트는 CI(push/PR)에서 강제하는 2단 구조를 권한다.

```text
pre-commit:  변경 파일 oxfmt --check + oxlint (빠름)
commit-msg:  commitlint — Conventional Commits 검증 (→ ../rules/commit-convention.md)
CI (push/PR): mise run check (전체)
```

## FSD 아키텍처 린트 (Steiger)

프론트엔드는 FSD를 따르며([프론트엔드 아키텍처](frontend-architecture.md)), 레이어 참조 방향·슬라이스 경계·Public API 규칙을 **Steiger**로 강제한다. Steiger는 FSD 팀의 공식 독립 린터라 oxlint(ESLint 아님)와 별개로 동작한다.

```bash
mise run fsd-lint    # steiger — apps/desktop/src의 FSD 위반 검출
```

`mise run check` 게이트에 포함된다. oxlint는 일반 코드 품질, Steiger는 아키텍처 경계 — **역할이 겹치지 않으므로 둘 다 돌린다.**

## CI (GitHub Actions)

`.github/workflows/ci.yml`이 푸시·PR에서 게이트를 강제한다. 로컬 `mise run check`와 **동일한 게이트**를 CI가 재현한다 — 로컬에서 통과한 것이 CI에서 깨지지 않게 한다.

```text
job: check
  - mise install            툴체인 고정 버전 세팅
  - pnpm install
  - mise run check          fmt-check·lint·fsd-lint·typecheck·test·rust(fmt/clippy/test)

matrix (확장 시):
  - macOS  (1차 — 기준 플랫폼)
  - Windows / Linux (플랫폼 확장 단계에서 추가, → platform-strategy.md)
```

Rust 빌드는 캐시(예: `Swatinem/rust-cache`)로 가속한다. 릴리스 빌드·서명은 별도 워크플로로 분리한다(→ [플랫폼 전략](platform-strategy.md)).

## 의존성 자동 갱신 (Renovate)

의존성 업데이트는 사람이 챙기지 않고 **Renovate**(Mend 호스티드 GitHub App)가 PR로 올린다. norii는 **정확한 버전 핀이 많고**(→ [기술 스택](tech-stack.md)) **베타 의존성**(oxfmt 0.x·Steiger pre-1.0·tauri-plugin-webdriver·tauri-specta rc)을 쓰므로, 새 릴리스를 놓치지 않고 추적하는 실익이 크다.

- 루트 `renovate.json`이 단일 출처다. 설계 의도에 맞춰 규칙을 둔다:
  - **그룹핑** — 관련 패키지를 묶어 PR 홍수를 막는다(예: `@codemirror/*`, `@tauri-apps/*`, 린트·포맷 툴링).
  - **자동 머지 범위 한정** — devDependencies의 patch/minor 등 저위험만 CI 그린 시 자동 머지 후보로 두고, major·런타임 의존성은 사람이 검토한다.
  - **베타 의존성 주의 라벨** — 0.x·rc·pre-1.0 핀은 별도 라벨을 달아 [열린 결정](implementation-plan.md#열린-결정-open-decisions)의 재확인 항목(oxfmt 1.0·tauri-specta 2.0 등)과 연결한다.
- Renovate PR도 `mise run check` 게이트를 CI에서 통과해야 머지된다 — 자동 갱신이 품질 게이트를 우회하지 않는다.
- 커밋 메시지는 [커밋 컨벤션](../rules/commit-convention.md)의 `build(deps):` 형식에 맞춘다(Renovate `commitMessagePrefix`로 강제).

## 실제 앱 E2E (운영 동일)

위험 영역(에디터·한글 IME·데이터 유실 왕복)은 **실제 Tauri 앱**(실제 Rust + 웹뷰 + IPC)에서 끝단까지 테스트하며, 실행이 느린 E2E는 로컬 게이트가 아니라 CI에서 돈다. 도구(`tauri-plugin-webdriver`)·macOS 지원·레이어별 방법론은 [테스트 전략 · TDD](testing.md)를 단일 출처로 둔다.
