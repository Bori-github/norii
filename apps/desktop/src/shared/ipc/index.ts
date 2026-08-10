// Public API — Tauri IPC의 단일 진입점. invoke를 컴포넌트 곳곳에 흩뿌리지 않는다
// (→ .claude/docs/frontend-architecture.md#tauri-ipc의-자리).
import { convertFileSrc } from "@tauri-apps/api/core";

import type { Eol, Session } from "./bindings";
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
  readDir: (dir: string) => unwrapIpcResult(commands.readDir(dir)),
  createFile: (dir: string, name: string) => unwrapIpcResult(commands.createFile(dir, name)),
  createDir: (dir: string, name: string) => unwrapIpcResult(commands.createDir(dir, name)),
  renameEntry: (path: string, newName: string) =>
    unwrapIpcResult(commands.renameEntry(path, newName)),
  deleteEntry: (path: string) => unwrapIpcResult(commands.deleteEntry(path)),
  watchPaths: (paths: string[]) => unwrapIpcResult(commands.watchPaths(paths)),
  watchTree: (root: string | null) => unwrapIpcResult(commands.watchTree(root)),
  showOpenDialog: () => unwrapIpcResult(commands.showOpenDialog()),
  showSaveDialog: (defaultName: string, startDir: string | null) =>
    unwrapIpcResult(commands.showSaveDialog(defaultName, startDir)),
  showOpenFolderDialog: () => unwrapIpcResult(commands.showOpenFolderDialog()),
  // 결과를 돌려주지 않는다 — 흐림이 걸렸는지는 화면으로만 확인된다(→ design/window-chrome.md#검증).
  setWindowBlurRadius: (radius: number) => commands.setWindowBlurRadius(radius),
  loadSession: () => unwrapIpcResult(commands.loadSession()),
  saveSession: (session: Session) => unwrapIpcResult(commands.saveSession(session)),
};

/**
 * 파일 경로를 웹뷰가 실을 수 있는 asset URL로 바꾼다 — 프리뷰의 로컬 이미지가 쓴다.
 * 읽을 수 있는 경로는 Rust의 허용 루트가 정한다(→ .claude/docs/rust-commands.md#권한-capabilities).
 */
export function assetUrl(path: string): string {
  return convertFileSrc(path);
}

export { IpcError, isIpcError } from "./ipc-error";
export type { IpcErrorKind } from "./ipc-error";
export type {
  AppError,
  Eol,
  FileContent,
  SaveResult,
  Session,
  SessionTab,
  TreeNode,
} from "./bindings";
