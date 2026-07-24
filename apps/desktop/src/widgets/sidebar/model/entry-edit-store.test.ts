import { beforeEach, describe, expect, it } from "vitest";

import { useWorkspaceStore } from "@entities/workspace";

import { cancelEntryEdit, startCreate, startRename, useEntryEditStore } from "./entry-edit-store";

beforeEach(() => {
  useEntryEditStore.setState({ edit: null });
  useWorkspaceStore.setState({ rootDir: "/vault", fileTree: [], expandedDirs: [] });
});

// 왜: 만들 위치를 사용자가 따로 고르게 하면 조작이 한 단계 늘어난다 — 트리에서 보고 있던
//     자리를 그대로 쓴다. 파일에 포커스가 있을 때 그 파일 "안"에 만들 수는 없으므로
//     부모로 올라간다.
// 보장: 폴더는 자기 안, 파일은 부모, 아무 데도 없으면 루트가 대상이 된다.
// 경계: 루트가 없으면(폴더를 열지 않았으면) 시작하지 않는다 — 만들 곳이 없다.
describe("startCreate", () => {
  beforeEach(() => {
    useWorkspaceStore.setState({
      fileTree: [
        { path: "/vault/묶음", name: "묶음", kind: "dir", isSymlink: false, children: [] },
        { path: "/vault/회의.md", name: "회의.md", kind: "file", isSymlink: false },
      ],
    });
  });

  it("포커스된 폴더 안에, 파일이면 그 부모에 만든다", async () => {
    await startCreate("file", "/vault/묶음");
    expect(useEntryEditStore.getState().edit).toMatchObject({
      mode: "create",
      dir: "/vault/묶음",
      kind: "file",
    });

    await startCreate("dir", "/vault/회의.md");
    expect(useEntryEditStore.getState().edit).toMatchObject({ dir: "/vault", kind: "dir" });

    await startCreate("file", null);
    expect(useEntryEditStore.getState().edit).toMatchObject({ dir: "/vault" });
  });

  // 왜: 접힌 폴더 안에 입력칸을 세우면 화면에 보이지 않아 사용자가 무엇을 기다리는지 모른다.
  // 보장: 대상 폴더가 펼쳐진다.
  it("대상 폴더를 펼친다", async () => {
    await startCreate("file", "/vault/묶음");
    expect(useWorkspaceStore.getState().expandedDirs).toContain("/vault/묶음");
  });

  it("루트가 없으면 시작하지 않는다", async () => {
    useWorkspaceStore.setState({ rootDir: null });
    await startCreate("file", null);
    expect(useEntryEditStore.getState().edit).toBeNull();
  });
});

// 왜: 이름 변경은 그 항목의 형제들과 겹치면 안 되는데, 자기 이름은 겹쳐도 되는 것이라
//     형제 목록에서 자기를 빼야 한다(대소문자 교정이 이 경우다).
// 보장: 이름 변경은 대상 경로와 부모를 들고, 취소하면 편집이 사라진다.
// 경계: 실제 이름 판정은 features/manage-entries가 소유한다.
describe("startRename · cancelEntryEdit", () => {
  it("대상과 부모를 들고 시작하고 취소하면 사라진다", () => {
    startRename("/vault/묶음/주간.md", "file");
    expect(useEntryEditStore.getState().edit).toMatchObject({
      mode: "rename",
      path: "/vault/묶음/주간.md",
      dir: "/vault/묶음",
      kind: "file",
    });

    cancelEntryEdit();
    expect(useEntryEditStore.getState().edit).toBeNull();
  });
});
