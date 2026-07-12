// Public API — Tauri IPC의 단일 진입점. invoke를 컴포넌트 곳곳에 흩뿌리지 않는다
// (→ .claude/docs/frontend-architecture.md#tauri-ipc의-자리).
import type { Eol } from "./bindings";
import { commands } from "./bindings";
import { unwrapIpcResult } from "./unwrap";

export interface SaveFileArgs {
  path: string;
  text: string;
  eol: Eol;
  hasBom: boolean;
  expectedHash: string | null;
}

/** Rust 커맨드 래퍼 — 계약은 .claude/docs/rust-commands.md, 실패는 IpcError로 정규화된다. */
export const ipc = {
  openFile: (path: string, encodingOverride: string | null = null) =>
    unwrapIpcResult(commands.openFile(path, encodingOverride)),
  saveFile: (args: SaveFileArgs) =>
    unwrapIpcResult(
      commands.saveFile(args.path, args.text, args.eol, args.hasBom, args.expectedHash),
    ),
  watchPaths: (paths: string[]) => unwrapIpcResult(commands.watchPaths(paths)),
  showOpenDialog: () => unwrapIpcResult(commands.showOpenDialog()),
  showSaveDialog: (defaultName: string) => unwrapIpcResult(commands.showSaveDialog(defaultName)),
};

export { IpcError, isIpcError } from "./ipc-error";
export type { IpcErrorKind } from "./ipc-error";
export type { AppError, Eol, FileContent, SaveResult } from "./bindings";
