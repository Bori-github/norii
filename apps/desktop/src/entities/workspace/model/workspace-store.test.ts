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

// 집행: document-model.md#파일-트리-사이드바 — "병합은 살아남은 폴더의 기존 children·
//       펼침 상태를 경로 기준으로 보존한다(재읽기가 하위 트리를 접어버리지 않게)".
// 왜: 외부 변경 재읽기가 목록을 통째로 갈아끼우면, 사용자가 펼쳐 둔 하위 트리가
//     이벤트마다 접히고 다시 읽힌다 — 감시 반영이 탐색을 방해하게 된다.
// 보장: 재읽기 병합이 새 목록을 채택하되 살아남은 폴더의 children을 보존하고,
//       사라진 항목은 제거, 새 항목은 미해석(children 부재)으로 추가된다.
//       루트 레벨과 중첩 레벨 모두 같은 규칙이고, 안 읽은 폴더는 건드리지 않는다.
// 경계: 이벤트 수신·read_dir 호출 판단은 feature(tree-refresh) 테스트 소관.
describe("refreshLevel (외부 변경 병합)", () => {
  it("살아남은 폴더의 children은 보존하고, 사라진 항목은 지우고, 새 항목은 미해석으로 더한다", () => {
    const store = useWorkspaceStore.getState();
    store.openRoot("/vault", [dir("/vault/keep"), file("/vault/gone.md")]);
    store.setChildren("/vault/keep", [file("/vault/keep/inner.md")]);

    useWorkspaceStore
      .getState()
      .refreshLevel("/vault", [dir("/vault/keep"), file("/vault/new.md")]);

    const tree = useWorkspaceStore.getState().fileTree;
    expect(tree.map((node) => node.name)).toEqual(["keep", "new.md"]);
    expect(findTreeNode(tree, "/vault/keep/inner.md")?.name).toBe("inner.md"); // 하위 보존
    expect(findTreeNode(tree, "/vault/gone.md")).toBeUndefined();
  });

  it("중첩 폴더의 재읽기도 같은 병합 규칙을 따른다", () => {
    const store = useWorkspaceStore.getState();
    store.openRoot("/vault", [dir("/vault/a")]);
    store.setChildren("/vault/a", [dir("/vault/a/b"), file("/vault/a/old.md")]);
    store.setChildren("/vault/a/b", [file("/vault/a/b/deep.md")]);

    useWorkspaceStore.getState().refreshLevel("/vault/a", [dir("/vault/a/b")]);

    const tree = useWorkspaceStore.getState().fileTree;
    expect(findTreeNode(tree, "/vault/a/old.md")).toBeUndefined();
    expect(findTreeNode(tree, "/vault/a/b/deep.md")?.name).toBe("deep.md"); // 하위 보존
  });

  it("사라진 폴더의 펼침 상태는 함께 정리된다 (재생성 시 접힌 채 시작)", () => {
    const store = useWorkspaceStore.getState();
    store.openRoot("/vault", [dir("/vault/gone"), dir("/vault/keep")]);
    store.setChildren("/vault/gone", [dir("/vault/gone/inner")]);
    store.setExpanded("/vault/gone", true);
    store.setExpanded("/vault/gone/inner", true);
    store.setExpanded("/vault/keep", true);

    useWorkspaceStore.getState().refreshLevel("/vault", [dir("/vault/keep")]);

    // gone과 그 하위의 펼침은 지워지고, 살아남은 keep의 펼침은 보존된다.
    expect(useWorkspaceStore.getState().expandedDirs).toEqual(["/vault/keep"]);
  });

  it("안 읽은 폴더(children 부재)는 재읽기 대상이 아니다", () => {
    useWorkspaceStore.getState().openRoot("/vault", [dir("/vault/unread")]);

    useWorkspaceStore.getState().refreshLevel("/vault/unread", [file("/vault/unread/x.md")]);

    expect(
      findTreeNode(useWorkspaceStore.getState().fileTree, "/vault/unread")?.children,
    ).toBeUndefined();
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
