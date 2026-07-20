# 파일/폴더 구조

norii는 pnpm workspaces + Turborepo 모노레포다. 지금은 데스크탑 앱 하나지만, 재사용 가능한 도메인 로직(에디터·마크다운·UI)을 패키지로 분리해 **향후 모바일(Tauri 2 모바일) 재사용**에 대비한다(→ [플랫폼 전략](platform-strategy.md)).

## 원칙

- `apps/desktop`은 얇은 셸로 유지한다. Tauri 연동과 조립만 맡고 도메인 로직을 떠안지 않는다.
- 재사용 가능한 로직은 `packages/*`에 목적별로 둔다. 모바일 앱이 생겨도 그대로 가져다 쓴다.
- 파일은 가능한 한 하나의 목적을 갖는다. 서로 다른 이유로 바뀌는 코드가 한 파일에 쌓이면 분리한다.
- 문서는 주제별 단일 출처로 둔다(이 저장소의 `docs/*` 컨벤션 자체가 그렇다).

## 모노레포 구조

```text
norii/
  .mise.toml                 툴 버전(node/rust/pnpm) + 태스크 단일 출처
  pnpm-workspace.yaml
  turbo.json                 빌드/타입체크/테스트 파이프라인 + 캐시 (린트·포맷은 루트 oxlint/oxfmt)
  .oxlintrc.json             oxlint 룰 설정
  .oxfmtrc.json              oxfmt 포맷 설정 (포맷 대상 제외 목록)
  lefthook.yml               Git 훅 (pre-commit: oxlint/oxfmt · commit-msg: commitlint)
  commitlint.config.js       Conventional Commits 규칙 (→ .claude/rules/commit-convention.md)
  renovate.json              의존성 자동 갱신 규칙 (그룹핑·자동머지 범위 → code-quality.md)
  package.json               루트 (private)
  tsconfig.base.json
  LICENSE                    MIT (© 2026 bori)
  CLAUDE.md                  Claude 진입점 → AGENTS.md
  AGENTS.md                  문서 인덱스 + 핵심 원칙
  DESIGN.md                  디자인 규칙 (불변식·표면 표 → 상세는 .claude/docs/design/)
  .github/
    pull_request_template.md PR 본문 템플릿 (→ .claude/rules/commit-convention.md)
  examples/                  앱으로 열어 눈으로 확인하는 예시 문서
    README.md                목록·작성 규칙의 단일 출처 (생성 여부 판단은 rules/project-rules.md)
  scripts/
    docs-drift.mjs           문서-코드 드리프트 검사 (계약 문서 ↔ 코드 → development-commands.md)
    bundle-size.mjs          번들 크기 측정 (목표 <15MB → platform-strategy.md)
    free-port.mjs            개발 서버 빈 포트 선택 (dev·dev-webdriver 동시 실행 → development-commands.md)
    record-demo.sh           E2E 화면을 녹화해 PR 데모 영상 생성 (→ development-commands.md)
    upload-attachment.sh     영상·이미지를 GitHub CDN에 업로드, 커밋 없이 (→ development-commands.md)
  .claude/
    docs/                    설계 문서 (아키텍처·스택·전략 등, 이 폴더)
      design/                디자인 상세 (주제별 결정 기록 · Panda 토큰 · 창 표면 계약)
    rules/                   규칙·정책 (작업 규칙·비목표·라이선스·커밋 컨벤션)
    commands/                Claude 슬래시 커맨드 (/commit·/pr → commit-convention.md)

  apps/
    desktop/                 Tauri 데스크탑 앱
      src/                   React 프론트엔드 — FSD 레이어 (배치 기준 → frontend-architecture.md)
        main.tsx             엔트리 — app 레이어를 마운트
        app/                 레이아웃·부트스트랩(테마/유리 표식 적용·전역 단축키·종료 방어)
        pages/               화면 조합
        widgets/             완결 UI 블록
        features/            사용자 상호작용
        entities/            도메인 모델·상태
        shared/              외부 연결·공용 (ipc[Tauri]·ui·lib·config·types 세그먼트)
      src-tauri/             Rust 백엔드
        src/                 커맨드·파일 I/O·감시 · 창 유리·드래그 띠 (→ design/window-chrome.md)
        build.rs             tauri-build 훅 (빌드 시 코드 생성)
        icons/               앱 아이콘 번들
        Cargo.toml           (webdriver 피처로 tauri-plugin-webdriver 선택 포함 → testing.md)
        tauri.conf.json
        capabilities/        커맨드·플러그인 노출 선언 (경로 스코프는 커맨드가 강제 → rust-commands.md)
      e2e/                    실앱 E2E 스모크 (webdriverio + 임베디드 WebDriver → testing.md)
      vitest.config.ts        단위(node)·브라우저(WebKit) 테스트 설정 (→ testing.md)
      vitest.e2e.config.ts    E2E 전용 Vitest 설정 (빠른 test 게이트와 분리)
      svgr.config.cjs         SVGR 아이콘 코드젠 설정 (mise run icons → design/design-system.md)
      index.html
      vite.config.ts          vite-tsconfig-paths로 @app~@shared 별칭 반영
      tsconfig.app.json       FSD 레이어 path alias 정의
      tsconfig.json           편집기용 위임 설정 — tsconfig.app.json을 extends (언어 서버는 이 이름만 자동 탐색)
      steiger.config.ts       FSD 린트 설정
      panda.config.ts         디자인 시스템 토큰·recipe 단일 출처 (→ design/design-system.md)
      postcss.config.cjs      Panda PostCSS 플러그인
      styled-system/          Panda 생성물 (VCS 제외 — 빌드 시 생성)
      package.json

  packages/
    editor/                  CodeMirror 6 래퍼 — 확장 구성·폴딩·테마. 플랫폼 무관
    markdown/                프리뷰 파이프라인 — markdown-it + DOMPurify + 스크롤 매핑
    ui/                      공유 React 컴포넌트 — 버튼·탭바·트리 등
    tsconfig/                공유 TS/린트 설정
```

## 패키지 경계

```text
packages/editor
  - CodeMirror 6 EditorState/EditorView 구성
  - 마크다운 언어·하이라이팅·폴딩 확장
  - 키맵·테마 (앱 테마와 단일 소스 공유)
  - 파일시스템/Tauri를 알지 않는다 (순수 편집 계층)

packages/markdown
  - markdown-it 파서 구성 (GFM 옵션)
  - DOMPurify sanitize
  - 소스 라인 ↔ 렌더 블록 매핑 (스크롤 동기화용)
  - DOM 렌더는 소비 측(apps/desktop)이 담당

packages/ui
  - 플랫폼 무관 프레젠테이션 컴포넌트
  - 상태·파일 I/O를 알지 않는다

apps/desktop
  - 위 패키지를 조립하고 Tauri IPC에 연결
  - Zustand 스토어(탭·문서·설정) 소유
  - src-tauri: Rust 커맨드 구현 (→ rust-commands.md)
```

`apps/desktop`이 유일하게 Tauri·파일시스템·상태를 아는 층이다. `packages/*`는 그 아래에서 플랫폼 중립을 유지한다.

## 새 코드 추가 규칙

- 새 편집 기능 → `packages/editor`
- 새 마크다운/렌더 기능 → `packages/markdown`
- 새 파일/OS 기능 → `apps/desktop/src-tauri` (커맨드는 [rust-commands.md](rust-commands.md)에 계약을 먼저 추가)
- 새 화면 조립 → `apps/desktop/src`

빈 폴더도 의도를 문서화해 나중의 위치 재조정 리팩토링을 줄인다.
