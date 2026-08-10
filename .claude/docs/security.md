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
style-src   'self' 'unsafe-inline';     CM6·프리뷰 인라인 스타일·mermaid SVG의 style 최소 허용
font-src    'self';                     로컬 번들 폰트만 (KaTeX 등 — 외부 CDN 금지)
img-src     'self' data: asset: https:; 로컬·data·Tauri asset·원격 https 이미지
connect-src 'self';                     local-first → 외부 연결 없음 (업데이트 서버만 예외 도메인 추가)
```

원칙: norii는 local-first라 **외부 연결이 거의 없다.** `connect-src`를 최대한 좁히고, 자동 업데이트 서버 도메인만 예외로 연다(→ [플랫폼 전략](platform-strategy.md)).

원격 이미지는 이 원칙 밖에 있다. 마크다운 문서는 원격 이미지를 흔히 쓰고, 막으면 다른 뷰어에서 보이던 이미지가 norii에서만 빈자리가 된다.

```text
여는 것      https: 이미지
열지 않는 것 http: — 오가는 중에 응답이 바뀔 수 있고, 얻는 것은 사설 http 서버의 이미지뿐이다
남는 위험    문서를 여는 것만으로 그 URL에 요청이 나간다 —
             문서를 준 쪽이 언제 열렸는지와 접속한 IP를 알 수 있다
```

원격 이미지를 끄는 설정은 없다 — CSP는 정적이라 껐다 켜는 것이 렌더 단계의 별도 작업이 된다(→ [실제 구현 계획](implementation-plan.md#열린-결정-open-decisions)).

### 2. 경로 스코프 (capabilities + 커맨드 검증)

파일시스템 접근은 사용자가 다이얼로그로 선택했거나 연 루트 폴더 하위로 제한한다. **단, 파일 I/O는 커스텀 `std::fs` 커맨드라 capabilities가 경로를 자동 제한하지 못한다** — 실제 경로 스코프는 커맨드가 canonicalize + 허용 루트 검증으로 강제하고, capabilities는 커맨드·플러그인 노출을 제한한다. 두 층의 단일 출처는 [Rust 커맨드 계약 — 권한](rust-commands.md#권한-capabilities)이다.

#### 이미지 (asset 프로토콜)

프리뷰의 로컬 이미지는 파일 커맨드가 아니라 Tauri asset 프로토콜로 읽는다. 이 통로도 같은 허용 루트로 제한하며, 그 방법은 위 [Rust 커맨드 계약 — 권한](rust-commands.md#권한-capabilities)이 소유한다.

**문서는 asset URL을 위조하지 못한다.** 문서가 적은 `asset://…`는 프리뷰에 닿기 전에 DOMPurify가 지운다(→ [프리뷰 전략](preview-strategy.md#src는-sanitize-뒤에-바꾼다)) — 남는 asset URL은 norii가 문서 폴더 기준으로 계산한 것뿐이다.

#### 세션 파일

지난 세션의 경로가 다음 부팅의 허용 루트가 된다(→ [Rust 커맨드 계약 — 세션](rust-commands.md#세션)). 그래서 `session.json`은 **보안에 관여하는 입력**이며, 신뢰하는 범위를 여기서 못박는다.

```text
믿는 것      같은 사용자만 앱 config 디렉터리에 쓸 수 있다는 것
             (macOS: ~/Library/Application Support — 홈 문서 폴더와 달리 TCC 승인이 없다)
막는 것      norii 자신의 파일 커맨드로 그 파일을 고치는 길 (FileScope의 거부 목록)
             종류가 어긋난 경로로 허용을 넓히는 길 (→ rust-commands.md#세션의 자리별 종류)
남는 위험    같은 사용자 권한으로 도는 다른 프로세스가 파일을 미리 심어 두는 것 —
             norii가 가진 TCC 승인 범위 안에서 그 경로가 열린다
```

마지막 줄은 local-first 단독 사용자 모델에서 수용하는 위험이다 — 같은 사용자 프로세스는 이미 그 파일들을 직접 읽을 수 있다. 무결성을 가정이 아니라 검증으로 바꾸려면 서명(MAC)이 필요하며, 그것은 별도 결정이다.

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

**문서 내 `#앵커`는 이 허용목록의 대상이 아니다** — 문서 밖으로 나가지 않기 때문이다. 그 처리는 [프리뷰 전략 — 링크 정책](preview-strategy.md#링크-정책)이 소유한다. 위 1번(웹뷰 내비게이션 금지)은 링크의 종류를 가리지 않는다.

**허용목록(deny-by-default)이지 차단목록이 아니다.** OS 오프너는 등록된 모든 스킴을 프로그램 실행으로 바꿔 준다(`file:` · `smb:` · 설치된 앱의 커스텀 스킴). 차단목록은 새 스킴이 생길 때마다 뚫린다. 이 집합(http·https·mailto)은 VS Code의 `standardSupportedLinkSchemes`와 `tauri-plugin-opener` 기본 권한이 수렴하는 곳이고, **허용목록 없는 에디터들이 바로 이 지점에서 RCE를 겪었다**(Joplin CVE-2024-49362 "RCE on click of `<a>` link in markdown preview" · DeepChat CVE-2025-55733 · Obsidian CVE-2022-36450). 판정은 **URL 파싱**으로 한다 — 접두사 비교(`startsWith`)는 `https://example.com.attacker.com` 류에 뚫린다(Electron 보안 가이드가 명시).

`mailto:`는 조사한 모든 허용목록에 들어 있다(VS Code · Tauri 기본 권한). 잔여 위험(수신자·본문 프리필, 일부 메일 클라이언트의 비표준 `?attach=`)은 취약한 메일 클라이언트를 전제하고 작성 창이 눈에 보이므로, 업계가 공통으로 수용한다.

허용된 링크는 `plugin-opener`가 **OS 기본 브라우저**에 넘긴다 — 앱 웹뷰 안에서는 어떤 원격 페이지도 열지 않는다.

**허용목록은 두 겹으로 강제된다.** 프론트(`features/open-link`)가 URL 파싱으로 판정하고, Rust(capabilities의 `opener:allow-open-url` 스코프)가 다시 검사한다 — 프론트를 우회한 IPC 직접 호출도 Rust에서 막힌다. 두 목록은 값이 서로 일치해야 하며, 그 일치는 테스트가 지킨다. 선언 방법은 [Rust 커맨드 계약 — 권한](rust-commands.md#권한-capabilities), 프리뷰에서의 클릭 처리는 [프리뷰 전략 — 링크 정책](preview-strategy.md#링크-정책)을 각각 단일 출처로 둔다 — **허용 스킴 집합과 그 근거는 이 절이 단일 출처다.**

## 원칙

- **신뢰 경계**: 사용자 문서 내용은 신뢰하지 않는다(스크립트·원시 HTML 포함 가능). 렌더·저장 경로 모두에서 방어한다.
- **최소 권한**: 웹뷰·파일 접근·네트워크를 기본 차단하고 필요한 것만 연다.
- **local-first**: 외부 연결이 없으므로 네트워크 공격면이 작다. 이 이점을 CSP로 못박는다.
