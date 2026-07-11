// Panda CSS를 Vite의 PostCSS 파이프라인에 얹는다(→ .claude/docs/design/design-system.md#통합).
module.exports = {
  plugins: {
    "@pandacss/dev/postcss": {},
  },
};
