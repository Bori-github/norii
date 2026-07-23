import { create } from "zustand";

// 트리의 roving tabindex — 보이는 노드 중 **하나만** Tab 정지점(tabindex=0)이고 나머지는 -1이다
// (ARIA 트리 패턴). 그 하나의 경로를 여기 든다. 화살표 이동·클릭이 이 값을 옮기고,
// TreeItem은 자기 경로와 같을 때만 정지점이 된다.
interface TreeNavState {
  currentPath: string | null;
}

export const useTreeNavStore = create<TreeNavState>(() => ({
  currentPath: null,
}));

export function setTreeNavCurrent(path: string): void {
  useTreeNavStore.setState({ currentPath: path });
}

export function resetTreeNav(): void {
  useTreeNavStore.setState({ currentPath: null });
}
