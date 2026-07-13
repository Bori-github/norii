# 창 표면 계약 (투명 창 · 뒤 흐림 · 폴백)

norii의 창은 macOS에서 **투명하게 뚫리고, 그 뒤의 바탕화면을 OS가 흐린다.** 이 문서는 그 설정값과 폴백 규칙의 단일 출처이며, `apps/desktop/src-tauri/tauri.conf.json` · `src/window_glass.rs` · `src/titlebar_drag.rs`와 **1:1로 대응해야 하는 계약 문서**다(→ [작업 규칙](../../rules/project-rules.md#문서-규칙)).

**왜** 이 방식인지는 [결정 0002](decisions/0002-glass-is-made-by-os.md)가, App Store를 포기하는 배포 판단은 [플랫폼 전략](../platform-strategy.md#배포-경로--app-store는-비목표)이 소유한다. 표면의 역할·재질 규칙은 [결정 0001](decisions/0001-surface-role-and-material.md)이 소유한다. 이 문서는 **무엇을 어떤 값으로** 만 다룬다.

## 의존 사슬 (왜 이 셋이 한 묶음인가)

셋 중 하나라도 빠지면 유리가 보이지 않는다.

```text
macOSPrivateApi  WKWebView의 투명 배경(drawsBackground=NO)을 켠다. 비공개 API다.
      │          ↓ 이것 없이는 transparent가 조용히 무시된다.
transparent      창·웹뷰 배경을 뚫는다. 이제 창 뒤 바탕화면이 그대로 보인다.
      │          ↓ 그런데 그대로 보이는 것은 유리가 아니라 구멍이다. 흐림이 없다.
CGS 흐림 반경     윈도서버에 "이 창 뒤를 이만큼 흐려라"를 건다 → 비로소 유리가 된다.
```

`macOSPrivateApi`는 투명 배경 외에 `fullScreenEnabled` 프리퍼런스도 함께 켠다.

## 계약 — tauri.conf.json

```jsonc
{
  "app": {
    "macOSPrivateApi": true,     // 웹뷰 투명 배경 + fullScreenEnabled. App Store 포기의 원인.
    "windows": [
      {
        "transparent": true,           // 창 배경을 뚫는다. macOSPrivateApi 없이는 조용히 무시된다.
        "titleBarStyle": "Overlay"     // 웹뷰를 창 맨 위까지 올린다 → 상단이 한 장의 유리.
      }
    ]
  }
}
```

**`windowEffects`(NSVisualEffectView)는 쓰지 않는다.** 그것은 뒤를 비추는 유리가 아니라 **테마 색을 띤 서리 재질**이다 — 실측 결과 창 뒤 배경이 흰색에서 검은색으로 바뀌어도 크롬 픽셀이 **5**밖에 변하지 않았다. 같은 조건에서 아래 CGS 흐림은 **81** 변한다. 재질을 덧대는 것과 뒤를 비추는 것은 다른 일이다.

**`titleBarStyle`은 `Overlay`다** — 웹뷰가 타이틀바 자리까지 올라와 **상단 전체가 한 장의 유리**가 된다. 앱 이름(`title`)과 신호등은 OS가 그 유리 위에 그대로 그린다. `hiddenTitle`은 쓰지 않는다 — 앱 이름은 늘 보여야 한다.

`Transparent`는 기각했다. 타이틀바가 투명해지지만 유리가 아니라 **흐림 없는 구멍**이 된다 — 창 뒤 흐림은 웹뷰가 덮는 영역에만 걸리고, 웹뷰가 닿지 않는 타이틀바 띠는 아무도 칠하지 않아 뒤 창이 선명하게 비친다(실측).

`Overlay`의 대가는 **창 드래그**다. 웹뷰가 마우스를 가로채고, 웹 쪽에서 IPC로 드래그를 요청해도 native `performDrag(with:)`에 넘길 살아 있는 NSEvent가 이미 사라진 뒤다(tauri#9503, 미해결). 그래서 웹뷰 **위에 네이티브 드래그 띠**를 얹어 되찾는다.

## 계약 — 드래그 띠

`src/titlebar_drag.rs`가 소유한다. 창이 뜬 뒤 setup에서 한 번 얹는다.

```text
TITLEBAR_STRIP_HEIGHT = 28   창 최상단 투명 NSView의 높이(px). OS 타이틀바 높이와 같다.
```

그 띠에서 눌린 마우스는 웹뷰를 거치지 않고 AppKit이 직접 처리하므로(`isMovableByWindowBackground`), IPC를 타지 않아 tauri#9503에 걸리지 않는다 — 네이티브 앱과 같은 경로다.

**웹 쪽은 이만큼 위를 비운다.** 탭바가 `_glass`에서 `padding-top: 28px`를 두어 탭이 띠 아래에서 시작한다. 침범하면 탭을 눌러도 클릭이 띠에 먹혀 창이 끌린다. 두 값은 같아야 하고, 위 상수가 단일 출처다.

**`core:window:allow-start-dragging` 권한은 두지 않는다.** 드래그를 웹이 요청하지 않기 때문이다 — 네이티브 띠가 직접 처리한다(→ [Rust 커맨드 계약 · 권한](../rust-commands.md#권한-capabilities)).

## 계약 — 흐림 반경

`src/window_glass.rs`가 소유한다. 창이 뜬 뒤 setup에서 한 번 건다.

```text
DEFAULT_BLUR_RADIUS = 30   창 뒤 배경을 흐리는 반경(px). 0이면 흐림 없음(= 구멍).
```

반경은 **유리의 뿌연 정도**이고, 크롬의 **불투명도**는 웹 쪽 토큰(`bg.chrome`의 알파)이 따로 소유한다 — 둘은 독립적이다. 설정 화면에서 사용자가 조절할 값도 이 둘이다(→ [실제 구현 계획](../implementation-plan.md)의 열린 결정).

macOS에는 창 뒤를 흐리는 공개 API가 없으므로 윈도서버(CoreGraphics)의 비공개 심볼을 직접 부른다. 웹뷰 투명 배경으로 이미 비공개 API 선을 넘었으므로(`macOSPrivateApi`) **새로 잃는 것은 없다.**

## 창 테마 동기화

OS 타이틀바와 신호등은 **창의 NSAppearance**를 따르지, 웹 콘텐츠의 테마를 모른다. 앱만 다크로 바꾸면 밝은 타이틀바 아래 어두운 크롬이 붙어 상단이 갈라진다(실측: 단차 146). 그래서 테마가 바뀔 때 `getCurrentWindow().setTheme()`으로 창에도 같은 테마를 알린다 — 권한 `core:window:allow-set-theme`가 이 때문에 필요하다.

## 폴백 — macOS 밖

`window_glass::apply_window_glass`는 macOS 밖에서 아무 일도 하지 않고, 창은 불투명하게 뜬다. 웹 쪽은 캔버스를 불투명으로 칠해 **인앱 글라스로 자연 후퇴**한다(→ [결정 0003](decisions/0003-opaque-fallback-outside-macos.md)).

## 웹 쪽 계약 — 캔버스만 갈라진다

CSS는 한 갈래로 유지한다. **플랫폼에 따라 달라지는 것은 캔버스 배경의 불투명도 하나뿐**이다.

```text
유리 켜짐(macOS)  캔버스 = 투명   → 창 뒤 흐려진 바탕화면이 그대로 비친다
유리 꺼짐         캔버스 = 불투명 → 앱이 자기 배경을 깐다(인앱 글라스로 자연 후퇴)
```

표식은 "macOS인가"가 아니라 **"이 빌드에서 창 유리가 켜져 있는가"** 를 뜻한다 — 두 명제는 다르고, 유리를 끄면 macOS에서도 불투명 캔버스여야 한다. 판정은 `shared/lib/platform.ts`가 소유하고 `app` 레이어가 루트 요소에 심으며, 컴포넌트는 이 표식을 알지 못한다(시맨틱 토큰이 값을 갈라 준다 → [디자인 시스템](design-system.md#표면-토큰)).

**선행 조건**: 캔버스를 투명으로 바꾸는 변경은 **편집면과 CM6 테마에 불투명 배경을 명시적으로 칠한 뒤에만** 들어간다. 편집면이 배경을 칠하지 않고 캔버스를 비쳐 쓰면 본문이 바탕화면 위에 뜬다(→ [결정 0001](decisions/0001-surface-role-and-material.md)).

## 검증

창 뒤 흐림은 **OS 합성기가 그리므로 웹뷰 스크린샷에 잡히지 않는다.** "유리가 보이는가"는 E2E로 검증할 수 없다 — 자동 검증이 불가능한 영역이므로 [작업 규칙](../../rules/project-rules.md#품질-게이트)에 따라 수동 검증 방법을 남긴다.

```text
자동  ① 크롬 틴트 대비 기준 — 토큰 값만으로 계산되는 순수 함수라 유닛 테스트가 막는다
        (→ design-system.md 대비 게이트)
     ② 편집면이 불투명 배경을 칠하는가 (빈 상태·짧은 문서 포함)
     ③ 캔버스가 유리 표식에 따라 갈리는가
     ①~③은 유리 없이도 도는 웹 쪽 계약이라 실앱 없이 검증된다.

수동  1. 창 뒤에 흰 창을, 다음엔 어두운 창을 두고 크롬 픽셀을 각각 잰다
     2. 두 값이 크게 벌어져야 한다 — 뒤가 비친다는 증거다
        참고 실측: CGS 흐림 81 · NSVisualEffectView 5 (후자는 유리가 아니다)
     3. 창을 움직여 흐림이 배경을 따라오는지 본다
     4. 상단 띠(앱 이름 자리)를 잡고 창을 끈다 — 네이티브 드래그 띠가 살아 있는지
     5. 탭을 클릭한다 — 띠가 탭 클릭을 먹지 않는지(탭은 띠 아래에서 시작해야 한다)
     6. 창을 리사이즈해 띠가 폭을 따라오는지, 코너·그림자 아티팩트가 없는지 본다
     7. 시스템 "투명도 줄이기"를 켜고 앱이 불투명으로 물러서는지 본다
```
