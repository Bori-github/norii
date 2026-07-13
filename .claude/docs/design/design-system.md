# 디자인 시스템 (Panda CSS)

norii는 프로젝트 내부에 디자인 시스템을 구축하고, 스타일을 **Panda CSS**로 작성한다. 이 문서는 토큰 계층·recipe·테마·배치의 단일 출처다.

설계 의도는 **일관성을 도구로 강제**하는 것이다. 색·간격·타이포를 컴포넌트마다 하드코딩하지 않고, **토큰 하나를 단일 출처**로 두어 라이트/다크·리브랜딩·접근성 조정을 한 곳에서 바꾼다.

## 이 문서의 경계

디자인 문서는 넷으로 나뉜다. 같은 사실을 복제하지 않는다.

```text
/DESIGN.md                       지금의 규칙 — 큰 그림 · 불변식 · 표면 표 · 원칙 요약
design/decisions/NNNN-*.md       왜 그렇게 정했는가 — 맥락 · 기각한 대안 · 치르는 비용
design/design-system.md          어떻게 구현하는가 — Panda 토큰 · recipe · 대비 게이트 (이 문서)
design/window-chrome.md          창 설정의 실제 값 — transparent · 창 뒤 흐림 반경 · 폴백
apps/desktop/panda.config.ts     값 — 팔레트·스케일의 실제 숫자. 문서가 아니라 코드가 소유한다.
```

**색·간격의 실제 값을 이 문서에 옮겨 적지 않는다.** 값이 두 곳에 살면 반드시 어긋난다.

## 왜 Panda CSS인가

- **디자인 시스템용 프레임워크** — 토큰·시맨틱 토큰·recipe(컴포넌트 변형)를 1급으로 제공한다. DS를 밑바닥부터 조립하지 않는다.
- **제로 런타임** — 빌드 시 원자 CSS로 추출한다. JS 런타임 비용 0 → norii의 "가볍고 빠름"과 번들 목표(<15MB)에 정렬(→ [기술 스택](../tech-stack.md)).
- **완전한 타입 안전** — 토큰·변형까지 타입으로 잡힌다. 잘못된 토큰 사용이 컴파일 타임에 걸려 TS strict 정책(→ [코드 품질](../code-quality.md#타입-엄격도-tsconfig))과 맞물린다.
- **툴체인 정합** — 순수 TS로 스타일을 작성하므로 oxlint/oxfmt가 그대로 처리한다(Tailwind의 Prettier 전용 클래스 정렬 같은 도구 공백이 없다).

## 토큰 계층

두 층으로 나눈다. **컴포넌트는 시맨틱 토큰만** 참조하고, 원시 토큰을 직접 쓰지 않는다.

```text
primitive tokens   원시값 — colors.gray.900, spacing.4, radii.md, fontSizes.sm …
      │  (테마 조건에 따라 매핑)
semantic tokens    의미값 — colors.text, colors.bg.chrome, colors.border …
      │
컴포넌트           semantic token만 참조 (원시값·raw hex 금지)
```

- **원시 토큰**: 팔레트·스케일의 실제 값. 바뀔 일이 적다.
- **시맨틱 토큰**: "이 자리에 쓰는 의미". 라이트/다크에서 서로 다른 원시 토큰으로 매핑된다. 테마 전환의 핵심.

## 표면 토큰

표면의 역할·재질 규칙(→ [결정 0001](decisions/0001-surface-role-and-material.md))은 **배경 토큰의 이름으로** 코드에 나타난다. 컴포넌트는 "얼마나 투명한가"를 몰라도 되고, **자기가 무엇인지만** 고르면 된다. 어느 표면이 어느 토큰을 쓰는지는 루트 `DESIGN.md`의 표면 표가 단일 출처다 — 여기서는 토큰 이름만 정의한다.

```text
bg.canvas    창 바닥. 유리가 켜지면 투명, 아니면 불투명. 갈라지는 유일한 토큰.
bg.chrome    도구 표면 — 유리 위에 얹는 틴트. 색이 아니라 불투명도만 얹는다(→ decisions/0007).
             알파는 대비 게이트가 하한을 정하고, 설정이 --norii-glass-opacity로 덮어쓴다.
bg.paper     글이 놓이는 면. 항상 불투명. 편집면·프리뷰면·활성 탭이 공유한다.
bg.hover     상태 배경(호버·선택). 캔버스와 분리한다 — 캔버스를 참조하면 유리에서 사라진다.
bg.scrim     오버레이 뒤를 가리는 딤. 반투명 검정.
```

- **`bg.canvas`를 상태 배경으로 쓰지 않는다.** 캔버스가 투명해지는 순간 호버 피드백이 통째로 사라진다. 그래서 `bg.hover`가 따로 있다.
- **활성 탭은 `bg.paper`다.** 크롬 안에 있지만 아래 편집면과 이어진 한 장의 종이로 읽힌다(→ [결정 0001](decisions/0001-surface-role-and-material.md)).
- 편집면은 **배경을 명시적으로 칠한다.** 캔버스를 비쳐 쓰면 유리 도입 시 본문이 뚫린다.

## 글자·액센트 토큰

```text
text          본문. 종이 위에서도 크롬(유리) 위에서도 이 색을 쓴다.
text.muted    흐린 글자. 종이 위에서만 — 크롬에는 금지(→ 결정 0004).
accent        액센트. **테마와 무관하게 한 색**이고, **글자에는 쓰지 않는다**(→ 결정 0005).
              표시(커서·dirty ●·포커스 링·강조 테두리)에만 쓰므로 비텍스트 기준(3:1)이 적용된다.
              크롬(유리) 위에도 금지.
```

세 금지는 취향이 아니라 [대비 게이트](#대비-게이트)의 계산 결과다. 브랜드 색 계열(세이지)에서 **두 종이를 모두 통과하는 단계는 하나뿐**이며, 그 단계가 곧 액센트다(→ [결정 0006](decisions/0006-sage-palette.md)).

## 대비 게이트

접근성 기준은 **토큰 값만으로 계산되는 순수 함수**로 정의한다 — 이 절이 그 정의의 단일 출처다. 유리 뒤 바탕화면은 통제할 수 없지만, 크롬 틴트의 알파 α가 정해지면 합성 결과가 구간에 갇힌다.

```text
크롬 텍스트   bg.chrome 틴트를 순백 위 / 순흑 위에 각각 합성한 두 색 모두에서 4.5:1
그 외 텍스트  해당 배경 토큰 위에서 4.5:1 (WCAG AA)
```

토큰이 이 기준을 어기면 **테스트가 실패한다**(`mise run check`). 바탕화면도 스크린샷도 필요 없다 — 색 계산이 전부다. 이 게이트가 팔레트 확정의 합격선이며, 실측·눈대중이 그 자리를 대신하지 않는다.

## 테마 (라이트/다크)

시맨틱 토큰 + Panda `_dark` 조건으로 구현한다. 루트 요소의 `data-theme` 속성으로 조건을 켠다. **상태는 `entities/theme`이 소유하고 `app`이 적용한다** — 소유 레이어의 근거는 [프론트엔드 아키텍처](../frontend-architecture.md)가 단일 출처다.

선택지는 셋이다 — `system`(OS를 따른다) · `light` · `dark`. **`system`은 기본값이자 하나의 선택**이라 저장한다: 그 의도를 버리고 light/dark만 저장하면 OS를 바꿔도 앱이 따라오지 않는다.

```text
semanticTokens.colors.bg.paper = { value: { base: '{colors.white}', _dark: '{colors.gray.900}' } }
```

**에디터도 같은 토큰을 공유한다.** CodeMirror 6 테마는 JS 객체이므로, Panda가 생성한 토큰 값을 CM6 테마에 주입해 **앱 UI와 에디터가 하나의 토큰 출처**를 쓴다. 이 단일화가 [에디터 전략](../editor-strategy.md)의 "테마는 앱 테마와 단일 소스 공유" 원칙을 실현한다.

**주입 방식은 CSS 변수다.** 앱이 `var(--colors-bg-paper)` 같은 **참조**를 넘기므로, 테마를 바꿔도 에디터 상태를 다시 만들 필요가 없다 — 브라우저가 변수를 다시 풀어 준다. 값을 넘기면 테마 전환마다 상태를 재생성해야 하고, 그러면 되돌리기 히스토리와 커서 위치가 날아간다.

`packages/editor`는 플랫폼 무관을 유지한다 — 토큰을 직접 읽지 않고 **색 문자열을 주입받는다**(`EditorColors`).

**CM6 기본 테마는 전부 덮는다.** 하나라도 남기면 앱 팔레트 밖 색이 화면에 남는다 — 활성 줄의 옅은 파랑(`#cceeff`), 검색 패널의 회색(`#f5f5f5`)이 그것이다. 덮었는지는 테스트가 고정한다(`packages/editor/src/theme.test.ts`).

**폰트 토큰 이름은 역할로 짓는다.** `fonts.body`/`fonts.mono` 같은 이름은 "본문"이 UI 산문인지 에디터 텍스트인지 가리지 못한다 — `fonts.ui`(크롬·다이얼로그) / `fonts.editor`(에디터 본문)로 둔다.

## Recipe (컴포넌트 변형)

버튼·탭 같은 컴포넌트의 변형(`variant`·`size`·상태)은 Panda **recipe**로 정의한다. 변형이 타입으로 노출되어 오용을 막는다.

```text
buttonRecipe = { base, variants: { variant: {solid, ghost}, size: {sm, md} }, defaultVariants }
```

여러 요소로 구성된 컴포넌트는 slot recipe(`sva`)를 쓴다.

## FSD 배치

```text
panda.config.ts        토큰·시맨틱 토큰·recipe·조건의 단일 출처 (apps/desktop)
      │  (panda codegen)
styled-system/         생성물 — 여기서 css()·recipe·토큰을 import
      │
shared/ui              styled-system로 만든 디자인 시스템 컴포넌트 (Button, Tab …)
      │
widgets / features     shared/ui 컴포넌트만 소비 (직접 스타일 최소화)
```

- 토큰 정의는 `panda.config.ts` 한 곳. `shared`가 이를 감싸 앱에 노출한다.
- `styled-system/`는 생성물이라 **버전관리에서 제외하고 빌드 시 생성**한다(→ [파일/폴더 구조](../project-structure.md)).

## 통합

- Panda는 **PostCSS 플러그인**(`@pandacss/dev/postcss`)으로 동작한다. Vite의 PostCSS 파이프라인에 얹는다.
- 코드 생성: `panda codegen`(postinstall·빌드·dev 시 — → [개발 명령](../development-commands.md#사전-준비)). `@pandacss/dev` 버전은 [기술 스택](../tech-stack.md#애플리케이션-스택)에 핀한다.

## 규칙

- **raw hex·매직 넘버 금지.** 색·간격·타이포·radius는 토큰으로만 쓴다.
- **컴포넌트는 시맨틱 토큰**을 참조한다. 원시 토큰 직접 참조는 토큰 정의 계층에서만.
- **컴포넌트 변형은 recipe**로. 조건부 클래스 난립을 막는다.
- 디자인 시스템 컴포넌트는 `shared/ui`에 두고, 상위 레이어는 그것을 조합한다.
