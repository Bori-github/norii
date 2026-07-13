# 기술 스택

아래 버전은 **2026-07-05 기준 최신 안정판**이며 npm 레지스트리(`registry.npmjs.org/<pkg>/latest`)에서 확인했다. 버전 핀의 단일 출처는 `.mise.toml`(툴체인) · 각 `package.json`(JS 의존성) · `Cargo.toml`(Rust)이다. 이 표는 그 값을 문서화한 것이며, 갱신 시 실제 핀 파일과 함께 고친다.

스택 선택의 일관된 기준은 **"가볍고 빠른 단독 데스크탑 에디터"** 다. 서버·협업·PKM을 하지 않으므로([비목표](../rules/non-goals.md)), 그쪽을 겨냥한 무거운 도구는 배제한다.

## 런타임 · 툴체인

| 도구              | 버전             | 역할                                  |
| ----------------- | ---------------- | ------------------------------------- |
| mise              | latest (rolling) | 툴 버전 핀 · 태스크 · 환경변수 통합   |
| Node.js           | 24 LTS (24.x)    | 프론트엔드 빌드 런타임                |
| pnpm              | 11.10.0          | 패키지 매니저 (워크스페이스)          |
| Rust              | stable (rolling) | Tauri 백엔드                          |
| Turborepo (turbo) | 2.10.3           | 모노레포 태스크 오케스트레이션 · 캐시 |

## 애플리케이션 스택

| 레이어                 | 기술 (패키지)                                        | 버전                                                 | 근거                                                                                                                  |
| ---------------------- | ---------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 셸/런타임              | Tauri (`@tauri-apps/cli`, `@tauri-apps/api`)         | cli 2.11.4 · api 2.11.1                              | 네이티브 웹뷰 → Electron 대비 ~1/30 크기. 경량 목표의 핵심. 모바일 타깃 지원. 두 패키지는 버전이 독립적으로 올라간다. |
| 백엔드                 | Rust                                                 | stable (rolling)                                     | 파일 I/O·감시·다이얼로그                                                                                              |
| UI                     | React (`react`, `react-dom`)                         | 19.2.7                                               | 생태계·팀 친숙도                                                                                                      |
| UI 타입                | `@types/react`·`@types/react-dom`                    | react 19.2.17 · react-dom 19.2.3                     | React 19 타입 정의                                                                                                    |
| 빌드                   | Vite (`vite`)                                        | 8.1.3                                                | Rolldown/Oxc 기반 초고속 번들. Tauri 공식 지원.                                                                       |
| 빌드 플러그인          | `@vitejs/plugin-react`                               | 6.0.3                                                | Vite 공식 React 플러그인 — JSX 변환·Fast Refresh                                                                      |
| 언어                   | TypeScript (`typescript`)                            | 6.0.3                                                | 타입 안전                                                                                                             |
| 에디터 코어            | CodeMirror 6 (`@codemirror/state`·`view`·`commands`) | state 6.7.0 · view 6.43.5 · commands 6.10.4          | 소스 편집·하이라이팅·폴딩. 증분 파서 내장. 대용량 가상화.                                                             |
| 마크다운 언어          | `@codemirror/lang-markdown`                          | 6.5.0                                                | 하이라이팅 + 폴딩용 Lezer 파서 (내장)                                                                                 |
| 에디터 확장            | `@codemirror/language`·`search`                       | language 6.12.4 · search 6.7.1                       | 폴딩(language)·문서 내 검색                                                                                           |
| 에디터 구문 태그       | `@lezer/highlight`                                   | 1.2.3                                                | 마크다운 구문 태그(heading·link·mark) — CM6 테마가 앱 토큰으로 색을 입힐 때 쓴다(→ [디자인 시스템](design/design-system.md#테마-라이트다크)) |
| 프리뷰 파서            | markdown-it (`markdown-it`)                          | 14.3.0                                               | 마크다운 → HTML. GFM·플러그인 생태계. 웹뷰에서 실행.                                                                  |
| Sanitizer              | DOMPurify (`dompurify`)                              | 3.4.11                                               | XSS 방어 (필수)                                                                                                       |
| 상태 관리              | Zustand (`zustand`)                                  | 5.0.14                                               | 탭·문서·설정 상태 (경량)                                                                                              |
| 스타일 / 디자인 시스템 | Panda CSS (`@pandacss/dev`)                          | 1.11.4                                               | 프로젝트 내부 DS — 토큰·시맨틱·recipe·제로 런타임 (→ [디자인 시스템](design/design-system.md))                               |

> **예정(미설치)**: `@codemirror/autocomplete`(확인된 최신 6.20.3)는 자동완성 기능을 도입할 때 추가한다([에디터 전략](editor-strategy.md#확장-구성-초기)의 "필요 시"). 이 표는 **실제 설치된 핀**의 단일 출처이므로, 설치 전까지 버전 열에 넣지 않는다(→ `docs-drift` 검사가 표↔핀을 단방향 대조).

## Tauri 플러그인 (네이티브 기능)

문서가 설명하는 기능(다이얼로그·설정 저장·세션 복원·자동 업데이트·로깅)이 요구하는 공식 플러그인이다. JS(`@tauri-apps/plugin-*`)와 Rust(`tauri-plugin-*`)는 동일 버전이다.

| 플러그인              | 버전   | 용도                                                                                                      |
| --------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `plugin-dialog`       | 2.7.1  | 파일 열기/저장 네이티브 다이얼로그 (→ [Rust 커맨드 계약](rust-commands.md))                               |
| `plugin-store`        | 2.4.3  | 설정·최근 파일·세션 상태 JSON 저장 (→ [문서 모델](document-model.md), [파일 생명주기](file-lifecycle.md)) |
| `plugin-window-state` | 2.4.1  | 창 크기·위치 복원                                                                                         |
| `plugin-updater`      | 2.10.1 | 자동 업데이트 (→ [플랫폼 전략](platform-strategy.md))                                                     |
| `plugin-process`      | 2.3.1  | 업데이트 후 재실행                                                                                        |
| `plugin-log`          | 2.8.0  | Rust·프론트 통합 로깅 (→ [에러 처리와 로깅](error-handling.md))                                           |

## Rust 크레이트 (백엔드)

`Cargo.toml`에 핀한다. `tauri`·`tauri-build`는 Tauri 2 릴리스(2.x)를 따르고, `tauri-plugin-*`는 위 플러그인과 동일 버전이다.

| 크레이트                | 버전    | 용도                                                                                         |
| ----------------------- | ------- | -------------------------------------------------------------------------------------------- |
| `serde`                 | 1.0.228 | IPC 직렬화·역직렬화                                                                          |
| `serde_json`            | 1.0.150 | 테스트의 직렬화 형태 검증(dev) — serde와 버전 라인이 다름에 주의                             |
| `sha2`                  | 0.10.9  | 내용 해시(SHA-256) — 저장 충돌 검사·에코 억제 기준값 (→ [파일 생명주기 정책](file-lifecycle.md)) |
| `tempfile`              | 3.24.0  | 원자적 쓰기의 임시 파일 + 테스트 임시 디렉터리 (→ [파일 생명주기 정책](file-lifecycle.md))   |
| `log`                   | 0.4.x   | 로깅 파사드 — plugin-log의 레벨 필터 타입. 사실상 동결된 크레이트라 범위 핀                     |
| `objc2`                 | 0.6.4   | **macOS 전용 타깃 의존성.** 창 유리·드래그 띠에서 NSWindow·NSView를 다룬다 (→ [창 표면 계약](design/window-chrome.md)) |
| `libc`                  | 0.2.180 | **macOS 전용 타깃 의존성.** 비공개 흐림 심볼을 실행 시점에 찾는다(`dlsym`) — 정적 링크하면 심볼이 사라진 macOS에서 앱이 못 뜬다 |
| `tauri-specta`          | 2.0.0-rc.25 | Rust 커맨드 → TS 바인딩 생성 (코드 품질 표의 IPC 타입 계약과 동일 항목)                  |
| `specta`                | 2.0.0-rc.25 | tauri-specta의 타입 도출 코어 — rc 버전을 tauri-specta와 맞춰 핀                          |
| `specta-typescript`     | 0.0.12  | TS 내보내기 백엔드 (pre-1.0)                                                                 |
| `thiserror`             | 2.0.18  | `AppError` 정의 (→ [에러 처리와 로깅](error-handling.md))                                    |
| `notify`                | 8.2.0   | 파일 외부 변경 감시(watch) (→ [Rust 커맨드 계약](rust-commands.md))                          |
| `encoding_rs`           | 0.8.35  | 인코딩 변환(레거시 → UTF-8)·BOM 처리 (→ [파일 생명주기 정책](file-lifecycle.md#인코딩-정책)) |
| `chardetng`             | 1.0.0   | 인코딩 감지 — Firefox 감지기, encoding_rs와 짝으로 설계됨                                    |
| `tauri` / `tauri-build` | 2.x     | Tauri 코어 (애플리케이션 스택의 Tauri와 동일 릴리스)                                         |

## 코드 품질

품질 도구·게이트의 전략과 근거는 [코드 품질 전략](code-quality.md)을 단일 출처로 둔다. 아래는 버전 명시다.

| 영역               | 도구 (패키지)                                                    | 버전                                              | 비고                                                                                                                                                                |
| ------------------ | ---------------------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| JS/TS 린트         | oxlint (`oxlint`)                                                | 1.72.0                                            | Oxc 패밀리 (Vite/Rolldown과 정렬)                                                                                                                                   |
| JS/TS 포맷         | oxfmt (`oxfmt`)                                                  | **0.57.0 (베타)**                                 | 버전 정확 핀 + 업그레이드 시 diff 확인 (→ [코드 품질 전략](code-quality.md#oxfmt-성숙도-알아둘-것))                                                                 |
| FSD 아키텍처 린트  | Steiger (`steiger` + `@feature-sliced/steiger-plugin`)           | **steiger 0.5.13 · plugin 0.6.0 (둘 다 pre-1.0)** | FSD 공식 린터 + 공식 규칙 플러그인. 레이어 참조·Public API 강제 (→ [프론트엔드 아키텍처](frontend-architecture.md))                                                 |
| 경로 별칭          | vite-tsconfig-paths (`vite-tsconfig-paths`)                      | 6.1.1                                             | tsconfig `paths`(@app~@shared)를 Vite에 반영                                                                                                                        |
| 타입 체크          | TypeScript (`tsc --noEmit`)                                      | 6.0.3                                             | (애플리케이션 스택과 동일)                                                                                                                                          |
| JS/TS 테스트       | Vitest (`vitest`)                                                | 4.1.9                                             | Vite 8 네이티브                                                                                                                                                     |
| 컴포넌트/렌더 환경 | `@vitest/browser` + `playwright`(WebKit)                         | browser 4.1.9 · playwright 1.61.1                 | Playwright의 패치된 WebKit 렌더 — WebKit 기반이나 시스템 WKWebView와 동일하진 않음. happy-dom 대체 (→ [테스트 전략](testing.md#레이어별--무엇을-어디서-테스트하나)) |
| 컴포넌트 쿼리      | `@testing-library/react`                                         | 16.3.2                                            | 역할·텍스트 기반 쿼리                                                                                                                                               |
| 실앱 E2E           | `tauri-plugin-webdriver` (Choochmeque · MIT)                     | **0.2.1 · 2026-02 (pre-1.0)**                     | 임베디드 W3C WebDriver — macOS WKWebView 지원. 대안: 공식 임베디드 provider `@wdio/tauri-service`·CrabNebula(상용). **운영 동일 E2E**                               |
| E2E 클라이언트     | `webdriverio` (programmatic `remote()`)                          | 9.29.1                                            | 임베디드 WebDriver(127.0.0.1:4445)에 붙는 JS 클라이언트. wdio 테스트러너 없이 Vitest 안에서 직접 구동 (→ [테스트 전략](testing.md#레이어별--무엇을-어디서-테스트하나))    |
| IPC 타입 계약      | `tauri-specta`                                                   | **2.0.0-rc.25 (pre-1.0)**                         | Rust 커맨드 → TS 타입 생성 (계약 드리프트 차단). **Tauri 2 지원은 2.0.0-rc 라인뿐**(1.x는 Tauri v1 전용)                                                            |
| 커버리지           | `@vitest/coverage-v8`                                            | 4.1.9                                             | 커버리지 측정 (V8 기반)                                                                                                                                             |
| Rust 포맷          | rustfmt (`cargo fmt`)                                            | Rust 툴체인 기본                                  | 별도 설치 없음                                                                                                                                                      |
| Rust 린트          | Clippy (`cargo clippy`)                                          | Rust 툴체인 기본                                  | `-D warnings`                                                                                                                                                       |
| Rust 테스트        | `cargo test`                                                     | Rust 툴체인 기본                                  | —                                                                                                                                                                   |
| Git 훅             | lefthook (`lefthook`)                                            | 2.1.9                                             | 커밋 전 게이트 자동화                                                                                                                                               |
| 커밋 린트          | commitlint (`@commitlint/cli`·`@commitlint/config-conventional`) | 21.2.0                                            | Conventional Commits 검증 (→ [커밋 컨벤션](../rules/commit-convention.md))                                                                                          |
| 의존성 자동 갱신   | Renovate (Mend 호스티드 GitHub App)                              | 호스티드 (버전 핀 없음)                           | 설정 스키마 `renovate.json`. 의존성 업데이트를 PR로 추적 (→ [코드 품질 전략](code-quality.md#의존성-자동-갱신-renovate))                                            |

## 결정 근거 (why)

### 왜 Tauri인가 (Electron 아님)

마크다운 에디터는 무거운 네이티브 연산이 없고 **가볍고 빠른 게 곧 경쟁력**이다. Electron은 Chromium을 통째로 번들해 수백 MB가 되지만, Tauri는 OS 네이티브 웹뷰를 써서 번들이 ~1/30이다. Obsidian이 Electron 때문에 무겁다는 평을 듣는 지점을 norii는 Tauri로 피한다(→ [참고 사례](../rules/prior-art.md)).

### 왜 Vite + React인가 (Next.js 아님)

Tauri에는 서버가 없어 **정적 익스포트만 가능**하다. Next.js의 간판 기능(SSR·API Routes·서버 컴포넌트·미들웨어)이 전부 무효가 되고, 데이터는 어차피 Rust 커맨드가 담당한다. 남는 이점(파일 라우팅·웹 코드 공유)은 단독 데스크탑 앱에 불필요하다. 따라서 경량·단순한 Vite + React를 기본값으로 둔다. 모바일 확장도 Next.js가 아니라 Tauri 2 모바일로 간다(→ [플랫폼 전략](platform-strategy.md)).

### 왜 프리뷰 파서가 markdown-it(JS)인가 (Rust 아님)

웹뷰(JS)에서 파싱해 IPC 왕복을 없애고 GFM·플러그인 생태계를 얻는다. 결정 근거는 [아키텍처](architecture.md#프리뷰-파서를-웹뷰에-두는-이유), 파이프라인은 [프리뷰 전략](preview-strategy.md)을 단일 출처로 둔다.

### 왜 에디터는 CodeMirror 6인가

소스 뷰 편집·하이라이팅·폴딩을 모두 커버하며, **증분 파서와 뷰포트 가상화**로 대용량 문서에서 강하다. 헤딩/리스트 접기도 CM6가 이미 가진 파서 트리로 구현하므로 별도 파서가 필요 없다(→ [에디터 전략](editor-strategy.md)). Obsidian이 CM6로 대규모 vault를 감당하는 것이 확장성의 증거다.

> 에디터(CM6 Lezer)와 프리뷰(markdown-it)로 파서가 둘인 것은 소스+프리뷰의 표준 구조다. 원칙은 [프리뷰 전략 — 두 파서 원칙](preview-strategy.md#두-파서-원칙)을 단일 출처로 둔다.
