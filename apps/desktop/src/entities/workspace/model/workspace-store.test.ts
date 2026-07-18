import { beforeEach, describe, expect, it } from "vitest";

import type { TreeNode } from "@shared/ipc";

import { findTreeNode, useWorkspaceStore } from "./workspace-store";

function dir(path: string): TreeNode {
  return { path, name: path.split("/").at(-1) ?? path, kind: "dir", isSymlink: false };
}

function file(path: string): TreeNode {
  return { path, name: path.split("/").at(-1) ?? path, kind: "file", isSymlink: false };
}

beforeEach(() => {
  useWorkspaceStore.setState({ rootDir: null, fileTree: [], expandedDirs: [] });
});

// 집행: document-model.md#파일-트리-사이드바 — "read_dir(한 단계 목록) 결과를 프론트가
//       조립한 트리"·"children 부재 = 아직 안 읽음, [] = 빈 폴더".
// 왜: 이 구분이 무너지면 lazy 로딩이 "빈 폴더"와 "안 읽은 폴더"를 섞어, 빈 폴더를
//     펼칠 때마다 IPC를 다시 부르거나 안 읽은 폴더를 빈 것으로 표시한다.
// 보장: 루트 열기는 한 단계를 심고(children 전부 부재), setChildren이 지정 폴더에만
//       결과를 붙이며, 빈 배열도 "읽었음"으로 남는다.
// 경계: read_dir의 필터·정렬은 Rust 테스트 소관 — 여기는 조립만 다룬다.
describe("트리 조립", () => {
  it("루트 열기는 한 단계만 심고 이전 상태를 버린다", () => {
    const store = useWorkspaceStore.getState();
    store.openRoot("/vault-old", [dir("/vault-old/a")]);
    store.setExpanded("/vault-old/a", true);

    useWorkspaceStore.getState().openRoot("/vault", [dir("/vault/notes"), file("/vault/a.md")]);

    const state = useWorkspaceStore.getState();
    expect(state.rootDir).toBe("/vault");
    expect(state.fileTree.map((node) => node.name)).toEqual(["notes", "a.md"]);
    expect(state.fileTree[0]?.children).toBeUndefined(); // 아직 안 읽음
    expect(state.expandedDirs).toEqual([]);
  });

  it("setChildren은 중첩 경로의 해당 폴더에만 붙인다", () => {
    useWorkspaceStore.getState().openRoot("/vault", [dir("/vault/a"), dir("/vault/b")]);
    useWorkspaceStore.getState().setChildren("/vault/a", [dir("/vault/a/inner")]);
    useWorkspaceStore.getState().setChildren("/vault/a/inner", [file("/vault/a/inner/doc.md")]);

    const tree = useWorkspaceStore.getState().fileTree;
    expect(findTreeNode(tree, "/vault/a/inner/doc.md")?.name).toBe("doc.md");
    expect(findTreeNode(tree, "/vault/b")?.children).toBeUndefined();
  });

  it("빈 배열은 '읽었지만 빈 폴더'로 남는다 (부재와 구분)", () => {
    useWorkspaceStore.getState().openRoot("/vault", [dir("/vault/empty")]);
    useWorkspaceStore.getState().setChildren("/vault/empty", []);

    expect(findTreeNode(useWorkspaceStore.getState().fileTree, "/vault/empty")?.children).toEqual(
      [],
    );
  });
});

// 왜: 펼침은 에디터 표현 상태다 — 트리 데이터와 분리돼야 접기/펼치기가 children 캐시를
//     버리지 않는다.
// 보장: setExpanded가 목록을 중복 없이 켜고 끈다.
// 경계: 펼침 시 lazy 읽기(IPC)는 feature 테스트 소관.
describe("펼침 상태", () => {
  it("중복 없이 켜고 끈다", () => {
    const store = useWorkspaceStore.getState();
    store.openRoot("/vault", [dir("/vault/a")]);
    store.setExpanded("/vault/a", true);
    store.setExpanded("/vault/a", true);
    expect(useWorkspaceStore.getState().expandedDirs).toEqual(["/vault/a"]);

    store.setExpanded("/vault/a", false);
    expect(useWorkspaceStore.getState().expandedDirs).toEqual([]);
  });
});
