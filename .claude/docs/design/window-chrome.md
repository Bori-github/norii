# 창 표면 계약 (투명 · vibrancy · 폴백)

norii의 창은 macOS에서 **반투명 + 흐림(vibrancy)** 으로 뜬다. 이 문서는 그 설정값과 폴백 규칙의 단일 출처이며, `apps/desktop/src-tauri/tauri.conf.json`의 창 설정과 **1:1로 대응해야 하는 계약 문서**다(→ [작업 규칙](../../rules/project-rules.md#문서-규칙)).

> **구현됐다.** Cargo의 `macos-private-api` 피처 + 아래 네 키가 실제 설정에 들어 있고, 실기에서 유리가 동작함을 확인했다 — 어두운 창 위에 놓았을 때 크롬 픽셀이 `rgb(225,228,227)`로, 유리가 없을 때의 예측값(`rgb(143,145,143)`)이 아니라 OS 재질이 밝힌 값에 가깝다.

**왜** 이렇게 하는지는 [결정 0002](decisions/0002-glass-is-made-by-os.md)가, App Store를 포기하는 배포 판단은 [플랫폼 전략](../platform-strategy.md#배포-경로--app-store는-비목표)이 소유한다. 표면의 역할·재질 규칙은 [결정 0001](decisions/0001-surface-role-and-material.md)이 소유한다. 이 문서는 **무엇을 어떤 값으로** 만 다룬다.

## 의존 사슬 (왜 이 설정들이 한 묶음인가)

셋 중 하나라도 빠지면 유리가 보이지 않는다. Tauri 소스에서 확인한 사실이다.

```text
windowEffects   OS가 NSVisualEffectView(흐린 재질)를 콘텐트 뷰 맨 아래에 꽂는다.
      │         ↓ 그런데 웹뷰가 불투명하면 그 재질이 웹뷰에 가려 안 보인다.
transparent     웹뷰 배경을 투명하게 뚫어 뒤의 재질이 비치게 한다.
      │         ↓ 그런데 WKWebView의 투명 배경(drawsBackground=NO)은 비공개 API다.
macOSPrivateApi 그 비공개 API를 켠다. → App Store 배포 불가(감수한 대가).
```

`macOSPrivateApi`는 투명 배경 외에 `fullScreenEnabled` 프리퍼런스도 함께 켠다.

## 계약 — tauri.conf.json

```jsonc
{
  "app": {
    "macOSPrivateApi": true,          // 웹뷰 투명 배경 + fullScreenEnabled. App Store 포기의 원인.
    "windows": [
      {
        "transparent": true,          // 웹뷰 배경을 뚫는다. macOSPrivateApi 없이는 조용히 무시된다.
        "titleBarStyle": "Overlay",   // 콘텐트를 상단까지 확장 → 상단이 한 장의 유리가 된다.
        "windowEffects": {
          "effects": ["sidebar"],     // macOS 재질. 값은 열린 결정 — 실측 후 확정.
          "state": "followsWindowActiveState" // 비활성 창은 OS 관례대로 가라앉는다.
        }
      }
    ]
  }
}
```

**`titleBarStyle`은 `Overlay`다. `Transparent`를 쓰면 안 된다** — Tauri가 그 값에서 `fullsize_content_view`를 **끄기** 때문에 콘텐트 뷰가 타이틀바 아래에서 시작하고, vibrancy 재질(콘텐트 뷰 크기로 생성)이 **타이틀바 스트립을 덮지 못한다.** 그러면 크롬 틴트가 닿지 않는 띠가 상단에 남아 가로 색 단차가 생긴다.

`Overlay`의 대가는 이 계약이 함께 규정한다.

```text
드래그 영역   상단 크롬에 data-tauri-drag-region을 직접 지정한다(네이티브 타이틀바가 없으므로).
             알려진 제약: 비활성 창에서는 드래그가 막힌다(tauri#4316).
신호등 인셋   좌측 상단 신호등 아래로 콘텐트가 들어가지 않게 탭바 좌측에 인셋을 둔다.
             현재 값은 spacing 20(=80px). 유리가 켜졌을 때만 적용한다(_glass 조건).
```

- `radius`는 지정하지 않는다. 창 모서리는 OS가 그린다. 리사이즈·코너 아티팩트는 실기에서 확인되지 않았다.
- `state`의 `followsWindowActiveState`는 window-vibrancy의 기본값과 같다. 계약을 명시하기 위해 적는다.
- `effects` 후보: `sidebar`(은은 — Finder/Xcode 사이드바) · `underWindowBackground`(표준 창 배경) · `hudWindow`(짙음). 셋 다 라이트/다크를 OS가 자동으로 따라간다. 배열은 폴백 체인이 아니라 **플랫폼에 맞는 첫 항목만 채택**되므로, Windows 지원 시 `["sidebar", "mica"]`처럼 나란히 둘 수 있다.

## 폴백 — macOS 밖

macOS 재질은 다른 OS에서 **조용히 무시된다** — Tauri는 Windows 전용 재질만 매칭하고 없으면 경고 없이 반환하며, Linux는 분기 자체가 없다. 창은 그냥 불투명하게 뜬다. Windows 11의 `mica`/`acrylic`은 지금 채택하지 않는다 — Windows 지원이 후순위이고(→ [플랫폼 전략](../platform-strategy.md#확장-순서)), 두 효과 모두 리사이즈·드래그 시 성능 저하가 상류 문서에 명시돼 있다.

## 웹 쪽 계약 — 캔버스만 갈라진다

CSS는 한 갈래로 유지한다. **플랫폼에 따라 달라지는 것은 캔버스 배경의 불투명도 하나뿐**이다.

```text
유리 켜짐(macOS)  캔버스 = 투명   → 창 뒤 OS 재질이 그대로 비친다
유리 꺼짐         캔버스 = 불투명 → 앱이 자기 배경을 깐다(인앱 글라스로 자연 후퇴)
```

표식은 "macOS인가"가 아니라 **"이 빌드에서 창 유리가 켜져 있는가"** 를 뜻한다 — 두 명제는 다르고, 유리를 끄면 macOS에서도 불투명 캔버스여야 한다. 판정은 `shared/lib/platform.ts`가 소유하고 `app` 레이어가 루트 요소에 심으며, 컴포넌트는 이 표식을 알지 못한다(시맨틱 토큰이 값을 갈라 준다 → [디자인 시스템](design-system.md#표면-토큰)).

**선행 조건**: 캔버스를 투명으로 바꾸는 변경은 **편집면과 CM6 테마에 불투명 배경을 명시적으로 칠한 뒤에만** 들어간다. 현재 편집면은 배경을 칠하지 않고 캔버스를 비쳐 쓰므로, 순서를 지키지 않으면 본문이 바탕화면 위에 뜬다(→ [결정 0001](decisions/0001-surface-role-and-material.md)).

## 검증

창 효과는 **OS 합성기가 그리므로 웹뷰 스크린샷에 잡히지 않는다.** "유리가 보이는가"는 E2E로 검증할 수 없다 — 자동 검증이 불가능한 영역이므로 [작업 규칙](../../rules/project-rules.md#품질-게이트)에 따라 수동 검증 방법을 남긴다.

```text
자동  ① 크롬 틴트 대비 기준 — 토큰 값만으로 계산되는 순수 함수라 유닛 테스트가 막는다
        (→ design-system.md 대비 게이트)
     ② 편집면이 불투명 배경을 칠하는가 (빈 상태·짧은 문서 포함)
     ③ 캔버스가 유리 표식에 따라 갈리는가
     ①~③은 유리 없이도 도는 웹 쪽 계약이라 실앱 없이 검증된다.

수동  1. 밝은 바탕화면 · 어두운 바탕화면 각각에서 앱을 띄운다
     2. 창을 움직여 크롬 뒤 바탕화면이 흐려지며 따라오는지 본다
     3. 상단(타이틀바+탭바)이 색 단차 없이 한 장으로 보이는지 본다
     4. 창을 비활성화해 재질이 가라앉는지 본다(followsWindowActiveState)
     5. 창을 잡고 리사이즈해 코너·그림자 아티팩트가 없는지 본다
     6. 시스템 "투명도 줄이기"를 켜고 앱이 불투명으로 물러서는지 본다
```
