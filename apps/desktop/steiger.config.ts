import fsd from "@feature-sliced/steiger-plugin";
import { defineConfig } from "steiger";

// FSD 아키텍처 검증 — 레이어 참조 방향·슬라이스 저결합·Public API 규칙.
// 단일 출처: .claude/docs/frontend-architecture.md
export default defineConfig([...fsd.configs.recommended]);
