import type { AppError } from "./bindings";
import { IpcError } from "./ipc-error";

/** tauri-specta 바인딩이 반환하는 Result 형태. */
export type IpcResult<T> = { status: "ok"; data: T } | { status: "error"; error: AppError };

/**
 * 바인딩의 Result를 "성공 값 또는 IpcError throw"로 정규화한다.
 * features가 kind로 분기해 사용자에게 구분된 메시지를 줄 수 있게 한다(→ error-handling.md).
 */
export async function unwrapIpcResult<T>(result: Promise<IpcResult<T>>): Promise<T> {
  const resolved = await result;
  if (resolved.status === "error") {
    throw new IpcError(resolved.error.kind, resolved.error.message);
  }
  return resolved.data;
}
