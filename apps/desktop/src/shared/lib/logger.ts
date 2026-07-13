import { error, info, warn } from "@tauri-apps/plugin-log";

// Rust·프론트 로그를 tauri-plugin-log 파이프라인 하나로 통합한다(→ .claude/docs/error-handling.md).
// 민감정보 원칙: 파일 경로·문서 내용·사용자 데이터를 메시지에 넣지 않는다.
// 로깅 실패가 앱 동작을 깨지 않도록 실패는 조용히 무시한다 — 비동기 거부뿐 아니라
// 웹뷰 밖(node 테스트 등)에서 IPC 부재로 나는 동기 예외도 포함한다.
function safeLog(send: (message: string) => Promise<void>, message: string): void {
  try {
    void send(message).catch(() => {});
  } catch {
    // 웹뷰 밖 — 무시.
  }
}

export const logger = {
  error(message: string): void {
    safeLog(error, message);
  },
  warn(message: string): void {
    safeLog(warn, message);
  },
  info(message: string): void {
    safeLog(info, message);
  },
};
