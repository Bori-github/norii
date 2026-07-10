import { error, info, warn } from "@tauri-apps/plugin-log";

// Rust·프론트 로그를 tauri-plugin-log 파이프라인 하나로 통합한다(→ .claude/docs/error-handling.md).
// 민감정보 원칙: 파일 경로·문서 내용·사용자 데이터를 메시지에 넣지 않는다.
// 로깅 실패가 앱 동작을 깨지 않도록 실패는 조용히 무시한다.
export const logger = {
  error(message: string): void {
    void error(message).catch(() => {});
  },
  warn(message: string): void {
    void warn(message).catch(() => {});
  },
  info(message: string): void {
    void info(message).catch(() => {});
  },
};
