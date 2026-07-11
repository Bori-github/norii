import type { AppError } from "./bindings";

export type IpcErrorKind = AppError["kind"];

/**
 * Rust AppError를 프론트에서 다루기 쉬운 형태로 정규화한 에러
 * (→ .claude/docs/error-handling.md#프론트--에러-바운더리--ipc-정규화).
 * features는 이 타입만 처리하고, invoke 실패의 원형을 직접 다루지 않는다.
 */
export class IpcError extends Error {
  readonly kind: IpcErrorKind;

  constructor(kind: IpcErrorKind, message: string) {
    super(message);
    this.name = "IpcError";
    this.kind = kind;
  }
}

export function isIpcError(value: unknown): value is IpcError {
  return value instanceof IpcError;
}
