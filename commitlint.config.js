// 커밋 컨벤션 강제 — 규칙의 단일 출처는 .claude/rules/commit-convention.md
// 타입·형식은 config-conventional이 검사하고, 요약을 한국어로 쓰는 것은 팀 규칙이다(도구가 언어를 검사하지 않음).
module.exports = {
  extends: ["@commitlint/config-conventional"],
};
