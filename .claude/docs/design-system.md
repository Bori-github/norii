# 디자인 시스템 (Panda CSS)

norii는 프로젝트 내부에 디자인 시스템을 구축하고, 스타일을 **Panda CSS**로 작성한다. 이 문서는 토큰 계층·recipe·테마·배치의 단일 출처다.

설계 의도는 **일관성을 도구로 강제**하는 것이다. 색·간격·타이포를 컴포넌트마다 하드코딩하지 않고, **토큰 하나를 단일 출처**로 두어 라이트/다크·리브랜딩·접근성 조정을 한 곳에서 바꾼다.

## 왜 Panda CSS인가

- **디자인 시스템용 프레임워크** — 토큰·시맨틱 토큰·recipe(컴포넌트 변형)를 1급으로 제공한다. DS를 밑바닥부터 조립하지 않는다.
- **제로 런타임** — 빌드 시 원자 CSS로 추출한다. JS 런타임 비용 0 → norii의 "가볍고 빠름"과 번들 목표(<15MB)에 정렬(→ [기술 스택](tech-stack.md)).
- **완전한 타입 안전** — 토큰·변형까지 타입으로 잡힌다. 잘못된 토큰 사용이 컴파일 타임에 걸려 TS strict 정책(→ [코드 품질](code-quality.md#타입-엄격도-tsconfig))과 맞물린다.
- **툴체인 정합** — 순수 TS로 스타일을 작성하므로 oxlint/oxfmt가 그대로 처리한다(Tailwind의 Prettier 전용 클래스 정렬 같은 도구 공백이 없다).

## 토큰 계층

두 층으로 나눈다. **컴포넌트는 시맨틱 토큰만** 참조하고, 원시 토큰을 직접 쓰지 않는다.

```text
primitive tokens   원시값 — colors.gray.900, spacing.4, radii.md, fontSizes.sm …
      │  (테마 조건에 따라 매핑)
semantic tokens    의미값 — colors.text, colors.bg.surface, colors.border …
      │
컴포넌트           semantic token만 참조 (원시값·raw hex 금지)
```

- **원시 토큰**: 팔레트·스케일의 실제 값. 바뀔 일이 적다.
- **시맨틱 토큰**: "이 자리에 쓰는 의미". 라이트/다크에서 서로 다른 원시 토큰으로 매핑된다. 테마 전환의 핵심.

## 테마 (라이트/다크)

시맨틱 토큰 + Panda `_dark` 조건으로 구현한다. 루트 요소의 속성(예: `data-theme`)으로 조건을 켜고, 그 상태는 FSD `app` 레이어의 Zustand 스토어가 소유한다(→ [프론트엔드 아키텍처](frontend-architecture.md)).

```text
semanticTokens.colors.bg = { value: { base: '{colors.white}', _dark: '{colors.gray.900}' } }
```

**에디터도 같은 토큰을 공유한다.** CodeMirror 6 테마는 JS 객체이므로, Panda가 생성한 토큰 값을 CM6 테마에 주입해 **앱 UI와 에디터가 하나의 토큰 출처**를 쓴다. 이 단일화가 [에디터 전략](editor-strategy.md)의 "테마는 앱 테마와 단일 소스 공유" 원칙을 실현한다.

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
- `styled-system/`는 생성물이라 **버전관리에서 제외하고 빌드 시 생성**한다(→ [파일/폴더 구조](project-structure.md)).

## 통합

- Panda는 **PostCSS 플러그인**(`@pandacss/dev/postcss`)으로 동작한다. Vite의 PostCSS 파이프라인에 얹는다.
- 코드 생성: `panda codegen`(postinstall·빌드·dev 시 — → [개발 명령](development-commands.md#사전-준비)). `@pandacss/dev` 버전은 [기술 스택](tech-stack.md#애플리케이션-스택)에 핀한다.

## 규칙

- **raw hex·매직 넘버 금지.** 색·간격·타이포·radius는 토큰으로만 쓴다.
- **컴포넌트는 시맨틱 토큰**을 참조한다. 원시 토큰 직접 참조는 토큰 정의 계층에서만.
- **컴포넌트 변형은 recipe**로. 조건부 클래스 난립을 막는다.
- 디자인 시스템 컴포넌트는 `shared/ui`에 두고, 상위 레이어는 그것을 조합한다.
