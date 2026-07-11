import type { AppError } from "./bindings";
import { IpcError } from "./ipc-error";

/** tauri-specta 바인딩이 반환하는 Result 형태. */
export type IpcResult<T> = { status: "ok"; data: T } | { status: "error"; error: AppError };

const APP_ERROR_KINDS: readonly AppError["kind"][] = [
  "notFound",
  "permission",
  "conflict",
  "diskFull",
  "encoding",
  "io",
];

/**
 * 바인딩의 Result를 "성공 값 또는 IpcError throw"로 정규화한다.
 * features가 kind로 분기해 사용자에게 구분된 메시지를 줄 수 있게 한다(→ error-handling.md).
 * AppError 형태가 아닌 실패(Rust 패닉·플러그인 에러는 문자열로 reject된다)도 kind가
 * 검증된 IpcError("io")로 승격한다 — kind=undefined가 새어 나가 분기·메시지 조회를
 * 깨뜨리지 않게 한다.
 */
export async function unwrapIpcResult<T>(result: Promise<IpcResult<T>>): Promise<T> {
  const resolved = await result;
  if (resolved.status === "error") {
    const error: unknown = resolved.error;
    if (
      typeof error === "object" &&
      error !== null &&
      "kind" in error &&
      APP_ERROR_KINDS.includes((error as AppError).kind)
    ) {
      const appError = error as AppError;
      throw new IpcError(appError.kind, appError.message);
    }
    throw new IpcError("io", typeof error === "string" ? error : "알 수 없는 IPC 오류");
  }
  return resolved.data;
}
