// Public API — 외부는 이 배럴만 import한다.
export { createEditorState } from "./create-editor-state";
export type { CreateEditorStateOptions } from "./create-editor-state";
export { createEditorView } from "./create-editor-view";
export type { CreateEditorViewOptions } from "./create-editor-view";
export { noriiEditorExtensions } from "./extensions";
export { lineScrollTop, topVisibleLine } from "./scroll";
export { noriiTheme } from "./theme";
export type { EditorColors } from "./theme";
