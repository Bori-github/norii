import { describe, expect, it } from "vitest";

import { isIpcError } from "./ipc-error";
import { unwrapIpcResult } from "./unwrap";

// 왜: features는 invoke 실패의 원형이 아니라 정규화된 IpcError만 처리한다
//     (→ .claude/docs/error-handling.md#프론트--에러-바운더리--ipc-정규화).
//     이 정규화가 무너지면 에러 분기(충돌·권한·디스크)가 앱 곳곳에서 제각각 깨진다.
// 보장: ok Result는 데이터를 반환하고, error Result는 kind가 보존된 IpcError를 던진다.
// 경계: 실제 Rust AppError 직렬화 형태는 Rust 테스트가, 실제 IPC 왕복은 E2E가 검증한다.
describe("unwrapIpcResult", () => {
  it("ok 결과는 데이터를 그대로 반환한다", async () => {
    const data = await unwrapIpcResult(Promise.resolve({ status: "ok" as const, data: 42 }));
    expect(data).toBe(42);
  });

  it("error 결과는 kind가 보존된 IpcError로 던진다", async () => {
    const failing = unwrapIpcResult(
      Promise.resolve({
        status: "error" as const,
        error: { kind: "conflict" as const, message: "외부 변경" },
      }),
    );
    await expect(failing).rejects.toSatisfy(
      (error: unknown) => isIpcError(error) && error.kind === "conflict",
    );
  });
});
