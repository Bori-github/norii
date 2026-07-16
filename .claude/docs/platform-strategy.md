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

## 배포 경로 — App Store는 비목표

norii는 **직접 배포(서명·공증된 DMG + 자동 업데이트)** 로 간다. **Mac App Store는 비목표**다.

이건 선택이 아니라 디자인 결정의 귀결이다. norii의 창은 반투명 유리로 뜨는데([결정 0002](design/decisions/0002-glass-is-made-by-os.md)), 그 유리는 **macOS 비공개 API를 요구한다**(설정 키와 의존 사슬은 [창 표면 계약](design/window-chrome.md)이 소유). Tauri가 해당 설정의 문서에 명시한다 — *"Using private APIs on macOS prevents your application from being accepted to the App Store."*

App Store를 잃어도 무방하다고 판단한 근거는 **배포 계획이 애초에 공증 + Tauri updater(직접 배포)라 심사 경로를 쓰지 않기 때문**이다.

**단, 이 결정은 비대칭이다.** 유리를 나중에 포기하는 것은 가능하지만, App Store로 **복귀**하는 것은 그렇지 않다 — 직접 배포를 전제로 굳어지는 서명·공증·자동 업데이트(M7) 선택을 되돌려야 한다. 되돌리기 비용의 전체 목록은 [결정 0003](design/decisions/0003-opaque-fallback-outside-macos.md#되돌리기-비용-정직한-판)에 있다.

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

배포 구현은 [실제 구현 계획](implementation-plan.md)의 mac 배포 단계(M7)에서 다룬다. 번들 크기는 M0부터 빌드마다 측정해 추세를 지킨다.

## 번들 크기 측정

`mise run bundle-size`(`scripts/bundle-size.mjs`, 의존성 없는 Node)로 측정한다. `check` 게이트에는 넣지 않는다 — 빌드 산출물이 있어야 하므로 프론트(`pnpm --filter desktop build`) · 앱(`tauri build --bundles app`) 뒤에 돈다. (`mise run build`는 풀 tauri 릴리스 빌드이며, `bundle.active:false`라 `.app`을 만들려면 `--bundles app`이 필요하다 — 상시 번들링은 M7.)

**무엇을 재나** — 두 층:

```text
앱 번들(.app/.dmg)   15MB 예산의 대상. src-tauri/target/release/bundle 아래 산출물.
                    Tauri 바이너리 + 웹뷰 리소스가 대부분이라 이게 진짜 목표다.
                    mac tauri build 후에만 존재. 예산 초과 시 exit 1(CI 게이팅용).
프론트엔드(dist)     우리가 직접 제어하는 하위 신호. 매 vite build 측정 가능.
                    앱 번들의 일부일 뿐이라 별도 하드 임계값은 두지 않는다(추세만).
```

앱 번들이 없으면(빌드 전) 안내만 하고 통과한다. macOS 앱 번들 측정은 M7 배포 단계에서 CI에 붙인다.

**실측 기록** — 예산 판정의 기준은 dist가 아니라 `.app`이다. dist 증가분은 Tauri가 웹 자산을 압축해 바이너리에 넣으면서 앱에서는 크게 줄어 실린다.

```text
2026-07-14 (M4 프리뷰 확장: 각주·수식·다이어그램, macOS)
  앱 번들      11.09 MB → 12.75 MB  (+1.66 MB — 예산 15MB, 여유 2.25MB)
  프론트 dist   0.89 MB →  5.15 MB  (+4.26 MB — 앱에서는 1/3 수준으로 줄어 실림)
```
