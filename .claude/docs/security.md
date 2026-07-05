# 보안 (Security)

norii의 보안 방어층 단일 출처다. norii는 **사용자가 작성한 마크다운을 렌더**하고 **로컬 파일에 접근**하는 앱이라, XSS·파일 접근·웹뷰 공격면을 명시적으로 막는다.

설계 의도는 **방어를 세 층으로 겹치는 것**이다. 한 층이 뚫려도 다른 층이 막는다.

## 3층 방어

```text
1. Tauri CSP          웹뷰가 로드·실행할 수 있는 리소스를 제한
2. Capabilities       파일시스템 접근을 사용자가 연 경로로 스코프 제한
3. 프리뷰 sanitize    렌더 직전 DOMPurify로 위험 HTML 제거
```

### 1. Tauri CSP (Content Security Policy)

`apps/desktop/src-tauri/tauri.conf.json`의 `app.security.csp`에 정책을 명시한다. 웹뷰가 원격 스크립트를 실행하거나 임의 호스트에 연결하지 못하게 막는다.

```text
default-src 'self';
script-src  'self';                     원격/인라인 스크립트 차단
style-src   'self' 'unsafe-inline';     CM6·프리뷰 인라인 스타일 최소 허용
img-src     'self' data: asset:;        로컬·data· Tauri asset만
connect-src 'self';                     local-first → 외부 연결 없음 (업데이트 서버만 예외 도메인 추가)
```

원칙: norii는 local-first라 **외부 연결이 거의 없다.** `connect-src`를 최대한 좁히고, 자동 업데이트 서버 도메인만 예외로 연다(→ [플랫폼 전략](platform-strategy.md)). 원격 이미지(`http(s)://`) 로드 허용 여부는 열린 결정이며, 기본은 로컬 상대경로 이미지를 우선한다(→ [실제 구현 계획](implementation-plan.md)).

### 2. Capabilities (권한 스코프)

파일시스템 접근은 사용자가 다이얼로그로 선택했거나 연 루트 폴더 하위로 제한한다. 정책의 단일 출처는 [Rust 커맨드 계약 — 권한](rust-commands.md#권한-capabilities)이다.

### 3. 프리뷰 sanitize

markdown-it이 만든 HTML은 삽입 전 DOMPurify로 정화한다. 마크다운은 원시 HTML(`<details>` 등)을 통과시키므로 필수다. 단일 출처는 [프리뷰 전략 — Sanitize는 필수다](preview-strategy.md#sanitize는-필수다).

## 원칙

- **신뢰 경계**: 사용자 문서 내용은 신뢰하지 않는다(스크립트·원시 HTML 포함 가능). 렌더·저장 경로 모두에서 방어한다.
- **최소 권한**: 웹뷰·파일 접근·네트워크를 기본 차단하고 필요한 것만 연다.
- **local-first**: 외부 연결이 없으므로 네트워크 공격면이 작다. 이 이점을 CSP로 못박는다.
