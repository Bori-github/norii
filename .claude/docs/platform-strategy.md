# 플랫폼 전략 (mac → Windows → Linux → 모바일)

norii는 macOS를 기준으로 개발하고, 완료 후 다른 플랫폼 지원을 판단한다. 이 문서는 플랫폼 확장 순서와 배포 정책의 단일 출처다.

설계 의도는 **하나의 Tauri + React 코드베이스로 데스크탑부터 모바일까지 간다**는 것이다. 그래서 재사용 로직을 `packages/*`에 분리해 둔다(→ [파일/폴더 구조](project-structure.md)).

## 확장 순서

```text
1차 macOS    기준 플랫폼. Tauri 2 + Vite + React + CM6. 여기서 완성한다.
2차 Windows  같은 코드. 경로·개행·단축키 modifier·다이얼로그 차이 QA.
3차 Linux    같은 코드. 웹뷰(WebKitGTK) 차이 확인.
향후 모바일  Tauri 2 모바일 타깃으로 packages/* 재사용. 터치 UI 레이아웃만 별도.
```

각 단계는 앞 단계 완료 후 진행 여부를 판단한다. macOS 완성이 최우선이다.

## 모바일은 Tauri 2로 간다 (React Native/Next.js 아님)

- **Next.js 불필요**: Next.js는 웹 프레임워크지 모바일 도구가 아니다. 모바일과 무관하다.
- **React Native 회피**: RN에는 DOM이 없어 **CodeMirror 6이 돌지 않는다**. RN으로 가면 에디터를 통째로 다시 만들어야 한다.
- **Tauri 2 모바일 채택**: 웹뷰 기반이라 같은 React + CM6를 그대로 재사용한다. 터치·작은 화면용 레이아웃만 추가한다.

즉 norii가 Tauri를 고른 덕에 데스크탑 → 모바일 확장 경로가 자연스럽다. 근거 상세는 [기술 스택](tech-stack.md#왜-vite--react인가-nextjs-아님).

## 플랫폼 차이 체크포인트

```text
경로:        구분자(/ vs \), 대소문자 민감도
개행:        LF vs CRLF (→ file-lifecycle.md)
단축키:      Cmd(mac) vs Ctrl(win/linux) modifier 분기
네이티브 메뉴: OS별 메뉴 관례
웹뷰:        WKWebView(mac) / WebView2(win) / WebKitGTK(linux) 렌더 차이
```

## 배포 (초기 인지 항목)

나중에 하면 비용이 큰 항목이라 설계 단계에서 인지한다.

```text
번들 식별자:     com.norii.app (tauri.conf.json identifier).
                 서명·공증·설정 저장 경로가 이 값에 종속되므로 배포 후 변경하지 않는다.
코드 서명/공증:  macOS notarization — 계정·인증서 준비 필요.
                 미서명 시 "확인되지 않은 개발자" 경고.
자동 업데이트:   Tauri updater 플러그인. 업데이트 서버·서명키 전략 사전 결정.
번들 크기:       목표 < 15MB. 측정·유지(→ project-rules.md).
```

배포 구현은 [실제 구현 계획](implementation-plan.md)의 mac 배포 단계(M6)에서 다룬다. 번들 크기는 M0부터 빌드마다 측정해 추세를 지킨다.

## 번들 크기 측정

`mise run bundle-size`(`scripts/bundle-size.mjs`, 의존성 없는 Node)로 측정한다. `check` 게이트에는 넣지 않는다 — 빌드 산출물이 있어야 하므로 `mise run build`(프론트) · `tauri build`(앱) 뒤에 돈다.

**무엇을 재나** — 두 층:

```text
앱 번들(.app/.dmg)   15MB 예산의 대상. src-tauri/target/release/bundle 아래 산출물.
                    Tauri 바이너리 + 웹뷰 리소스가 대부분이라 이게 진짜 목표다.
                    mac tauri build 후에만 존재. 예산 초과 시 exit 1(CI 게이팅용).
프론트엔드(dist)     우리가 직접 제어하는 하위 신호. 매 vite build 측정 가능.
                    앱 번들의 일부일 뿐이라 별도 하드 임계값은 두지 않는다(추세만).
```

앱 번들이 없으면(빌드 전) 안내만 하고 통과한다. macOS 앱 번들 측정은 M6 배포 단계에서 CI에 붙인다.
