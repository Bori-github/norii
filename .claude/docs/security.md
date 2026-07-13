# 보안 (Security)

norii의 보안 방어층 단일 출처다. norii는 **사용자가 작성한 마크다운을 렌더**하고 **로컬 파일에 접근**하는 앱이라, XSS·파일 접근·웹뷰 공격면을 명시적으로 막는다.

설계 의도는 **방어를 세 층으로 겹치는 것**이다. 한 층이 뚫려도 다른 층이 막는다.

## 3층 방어

```text
1. Tauri CSP              웹뷰가 로드·실행할 수 있는 리소스를 제한
2. 경로 스코프            capabilities(커맨드/플러그인 노출) + 커맨드 내부 경로 검증
3. 프리뷰 sanitize        렌더 직전 DOMPurify로 위험 HTML 제거
```

### 1. Tauri CSP (Content Security Policy)

`apps/desktop/src-tauri/tauri.conf.json`의 `app.security.csp`에 정책을 명시한다. 웹뷰가 원격 스크립트를 실행하거나 임의 호스트에 연결하지 못하게 막는다.

```text
default-src 'self';
script-src  'self';                     원격/인라인 스크립트 차단
style-src   'self' 'unsafe-inline';     CM6·프리뷰 인라인 스타일 최소 허용
font-src    'self';                     로컬 번들 폰트만 (KaTeX 등 — 외부 CDN 금지)
img-src     'self' data: asset:;        로컬·data· Tauri asset만
connect-src 'self';                     local-first → 외부 연결 없음 (업데이트 서버만 예외 도메인 추가)
```

원칙: norii는 local-first라 **외부 연결이 거의 없다.** `connect-src`를 최대한 좁히고, 자동 업데이트 서버 도메인만 예외로 연다(→ [플랫폼 전략](platform-strategy.md)). 원격 이미지(`http(s)://`) 로드 허용 여부는 열린 결정이며, 기본은 로컬 상대경로 이미지를 우선한다(→ [실제 구현 계획](implementation-plan.md)).

### 2. 경로 스코프 (capabilities + 커맨드 검증)

파일시스템 접근은 사용자가 다이얼로그로 선택했거나 연 루트 폴더 하위로 제한한다. **단, 파일 I/O는 커스텀 `std::fs` 커맨드라 capabilities가 경로를 자동 제한하지 못한다** — 실제 경로 스코프는 커맨드가 canonicalize + 허용 루트 검증으로 강제하고, capabilities는 커맨드·플러그인 노출을 제한한다. 두 층의 단일 출처는 [Rust 커맨드 계약 — 권한](rust-commands.md#권한-capabilities)이다.

### 3. 프리뷰 sanitize

markdown-it이 만든 HTML은 삽입 전 DOMPurify로 정화한다. 마크다운은 원시 HTML(`<details>` 등)을 통과시키므로 필수다. 단일 출처는 [프리뷰 전략 — Sanitize는 필수다](preview-strategy.md#sanitize는-필수다).

### 4. 외부 링크 (프리뷰에서 문서 밖으로 나가는 유일한 통로)

문서 속 링크는 **신뢰하지 않는 입력**이다. 두 가지를 막는다.

```text
1. 웹뷰 내비게이션 금지   앱 창이 문서 속 URL로 이동하면 앱 UI가 사라지고
                        원격 페이지가 그 자리를 차지한다 → 클릭을 가로채 항상 preventDefault
2. 스킴 허용목록         OS 브라우저로 넘기는 것은 http · https · mailto뿐이다.
                        file: · 그 외 커스텀 스킴(앱 실행·딥링크)은 거부한다 —
                        악성 문서가 클릭 한 번으로 로컬 파일·외부 앱을 열지 못하게.
```

**허용목록(deny-by-default)이지 차단목록이 아니다.** OS 오프너는 등록된 모든 스킴을 프로그램 실행으로 바꿔 준다(`file:` · `smb:` · 설치된 앱의 커스텀 스킴). 차단목록은 새 스킴이 생길 때마다 뚫린다. 이 집합(http·https·mailto)은 VS Code의 `standardSupportedLinkSchemes`와 `tauri-plugin-opener` 기본 권한이 수렴하는 곳이고, **허용목록 없는 에디터들이 바로 이 지점에서 RCE를 겪었다**(Joplin CVE-2024-49362 "RCE on click of `<a>` link in markdown preview" · DeepChat CVE-2025-55733 · Obsidian CVE-2022-36450). 판정은 **URL 파싱**으로 한다 — 접두사 비교(`startsWith`)는 `https://example.com.attacker.com` 류에 뚫린다(Electron 보안 가이드가 명시).

`mailto:`는 조사한 모든 허용목록에 들어 있다(VS Code · Tauri 기본 권한). 잔여 위험(수신자·본문 프리필, 일부 메일 클라이언트의 비표준 `?attach=`)은 취약한 메일 클라이언트를 전제하고 작성 창이 눈에 보이므로, 업계가 공통으로 수용한다.

허용된 링크는 `plugin-opener`가 **OS 기본 브라우저**에 넘긴다 — 앱 웹뷰 안에서는 어떤 원격 페이지도 열지 않는다.

**허용목록은 두 겹으로 강제된다.** 프론트(`features/open-link`)가 URL 파싱으로 판정하고, Rust(capabilities의 `opener:allow-open-url` 스코프)가 다시 검사한다 — 프론트를 우회한 IPC 직접 호출도 Rust에서 막힌다. 두 목록은 값이 서로 일치해야 하며, 그 일치는 테스트가 지킨다. 선언 방법은 [Rust 커맨드 계약 — 권한](rust-commands.md#권한-capabilities), 프리뷰에서의 클릭 처리는 [프리뷰 전략 — 링크 정책](preview-strategy.md#링크-정책)을 각각 단일 출처로 둔다 — **허용 스킴 집합과 그 근거는 이 절이 단일 출처다.**

## 원칙

- **신뢰 경계**: 사용자 문서 내용은 신뢰하지 않는다(스크립트·원시 HTML 포함 가능). 렌더·저장 경로 모두에서 방어한다.
- **최소 권한**: 웹뷰·파일 접근·네트워크를 기본 차단하고 필요한 것만 연다.
- **local-first**: 외부 연결이 없으므로 네트워크 공격면이 작다. 이 이점을 CSP로 못박는다.
