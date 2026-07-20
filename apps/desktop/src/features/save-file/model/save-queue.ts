// 키(탭)별 저장 직렬화 큐 — 같은 탭의 저장이 겹치지 않게 한다
// (VS Code saveSequentializer와 같은 전략, → file-lifecycle.md#외부-변경-처리).

export interface SaveQueue {
  /** 키의 직전 작업이 끝난 뒤 task를 실행한다. task의 결과/실패를 그대로 반환한다. */
  enqueue<T>(key: string, task: () => Promise<T>): Promise<T>;
}

export function createSaveQueue(): SaveQueue {
  const tails = new Map<string, Promise<unknown>>();

  return {
    enqueue(key, task) {
      const previous = tails.get(key) ?? Promise.resolve();
      // 앞 작업의 실패는 앞 제출자에게 전달됐다 — 체인은 성공/실패와 무관하게 잇는다.
      const run = previous.then(task, task);
      tails.set(
        key,
        run.catch(() => {}),
      );
      return run;
    },
  };
}
