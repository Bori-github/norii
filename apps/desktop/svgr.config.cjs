// 아이콘 생성 설정 — SVG 원본(shared/ui/icons/svg) → React 컴포넌트(generated).
// 실행은 `mise run icons`. 규칙의 근거는 디자인 시스템 문서가 단일 출처다
// (→ .claude/docs/design/design-system.md#아이콘).
//
// 원본은 디자인 산출물 그대로 두고, 아래 정규화를 **모든 아이콘에 기계적으로** 적용한다:
//   - 색: 검정 스트로크/필을 currentColor로 — 아이콘은 품는 컨트롤의 글자색을 따른다(테마 대응)
//   - 크기: width/height 제거(dimensions: false) — 크기는 소비 측 CSS가 정한다(viewBox만 유지)
//   - 접근성: aria-hidden — 아이콘은 장식이고, 이름은 품는 컨트롤의 aria-label이 진다
module.exports = {
  typescript: true,
  jsxRuntime: "automatic",
  // 파일명은 저장소 컨벤션(kebab-case)을 따른다 — 컴포넌트 공개 이름(XxxIcon)은 배럴이 관리.
  filenameCase: "kebab",
  dimensions: false,
  expandProps: "end",
  svgProps: { "aria-hidden": "true" },
  replaceAttrValues: {
    black: "currentColor",
    "#000": "currentColor",
    "#000000": "currentColor",
  },
};
