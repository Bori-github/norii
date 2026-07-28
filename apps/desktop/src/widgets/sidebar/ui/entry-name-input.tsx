import { useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";

import { findTreeNode, useWorkspaceStore } from "@entities/workspace";
import type { EntryProblem } from "@features/manage-entries";
import {
  checkEntryName,
  createEntryIn,
  defaultEntryName,
  renameEntryTo,
} from "@features/manage-entries";
import { openPathInTab } from "@features/open-file";
import { STRINGS } from "@shared/config";
import { Tooltip } from "@shared/ui";

import type { EntryEdit } from "../model/entry-edit-store";
import { cancelEntryEdit } from "../model/entry-edit-store";

// 트리 안 인라인 이름 입력 — 규칙: .claude/docs/document-model.md#파일-트리-사이드바.

// 선택된 파일 줄과 같은 모양이다(→ tree-item의 rowClass).
const rowClass = css({
  display: "flex",
  alignItems: "center",
  gap: "1.5",
  marginX: "1.5",
  marginY: "1",
  paddingLeft: "2",
  paddingRight: "2",
  paddingY: "1.5",
  position: "relative",
  borderRadius: "md",
  background: "bg.paper",
  outline: "2px solid",
  outlineColor: "color-mix(in srgb, var(--colors-accent) 50%, transparent)",
});

const inputClass = css({
  width: "100%",
  border: "none",
  background: "transparent",
  color: "text",
  fontSize: "sm",
  padding: 0,
  _focusVisible: { outline: "none" },
});

const problemClass = css({ left: "2" });

const PROBLEM_ID = "entry-name-problem";

function nameOf(path: string): string {
  return path.split("/").at(-1) ?? path;
}

/** 확장자를 뺀 앞부분의 길이 — 타이핑하면 이름만 바뀌고 .md는 남게 한다. */
function stemLength(name: string): number {
  const match = /\.(md|markdown)$/i.exec(name);
  return match === null ? name.length : match.index;
}

function siblingNames(dir: string, excludePath: string | undefined): string[] {
  const { rootDir, fileTree } = useWorkspaceStore.getState();
  const nodes = dir === rootDir ? fileTree : (findTreeNode(fileTree, dir)?.children ?? []);
  return nodes.filter((node) => node.path !== excludePath).map((node) => node.name);
}

export function EntryNameInput({ edit }: { edit: EntryEdit }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<EntryProblem | null>(null);
  const [value, setValue] = useState(() =>
    edit.mode === "rename" && edit.path !== undefined
      ? nameOf(edit.path)
      : defaultEntryName(edit.kind, siblingNames(edit.dir, undefined)),
  );

  useEffect(() => {
    const input = inputRef.current;
    input?.focus();
    input?.setSelectionRange(0, stemLength(input.value));
  }, []);

  // 확정·취소가 끝난 뒤 입력칸이 사라지면서 blur가 한 번 더 온다 — 그 뒤늦은 blur가 같은
  // 이름을 다시 만들지 않게 한 번 끝난 편집을 표시해 둔다.
  const settledRef = useRef(false);

  const cancel = (): void => {
    settledRef.current = true;
    cancelEntryEdit();
  };

  const submit = async (): Promise<void> => {
    if (settledRef.current) {
      return;
    }
    const siblings = siblingNames(edit.dir, edit.path);
    const named = checkEntryName(value, siblings, edit.kind);
    if (named !== null) {
      setProblem(named);
      return;
    }
    const result =
      edit.mode === "rename" && edit.path !== undefined
        ? await renameEntryTo(edit.path, value)
        : await createEntryIn(edit.dir, value, edit.kind);
    if (!result.ok) {
      setProblem(result.problem);
      return;
    }
    settledRef.current = true;
    cancelEntryEdit();
    if (edit.mode === "create" && edit.kind === "file") {
      void openPathInTab(result.path);
    }
  };

  // → document-model.md#파일-트리-사이드바
  const submitOnBlur = (): void => {
    if (checkEntryName(value, siblingNames(edit.dir, edit.path), edit.kind) !== null) {
      cancel();
      return;
    }
    void submit();
  };

  return (
    // role="none" — 입력은 treeitem이 아닌데 tree/group의 자식 자리에 놓인다. 목록 항목
    // 의미를 지워 트리 구조에 맞지 않는 항목이 끼지 않게 한다.
    <li role="none" data-testid="entry-name-input-row">
      <div className={rowClass}>
        <input
          ref={inputRef}
          className={inputClass}
          aria-label={STRINGS.entryNameInputLabel}
          aria-invalid={problem !== null}
          aria-describedby={problem === null ? undefined : PROBLEM_ID}
          data-testid="entry-name-input"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setProblem(
              checkEntryName(event.target.value, siblingNames(edit.dir, edit.path), edit.kind),
            );
          }}
          // 이 입력칸은 트리 안에 있어 눌린 키가 트리의 키보드 핸들러까지 올라간다. 거기서
          // 방향키는 탐색, Enter는 폴더 토글이라 이름을 치는 동안 트리가 움직인다.
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              void submit();
            } else if (event.key === "Escape") {
              cancel();
            }
          }}
          onBlur={submitOnBlur}
        />
        {problem !== null && (
          <Tooltip id={PROBLEM_ID} className={problemClass} data-testid="entry-name-problem">
            {STRINGS.entryProblemMessages[problem]}
          </Tooltip>
        )}
      </div>
    </li>
  );
}
