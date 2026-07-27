/**
 * 작업이 끝나기를 상한까지만 기다린다 — 끝났으면 true, 상한에 걸렸으면 false.
 *
 * 부팅(설정·세션 읽기)과 종료(저장 플러시)가 같은 규칙을 쓴다: 답이 오지 않아도 창을 보이고
 * 창을 닫는다(→ .claude/docs/design/window-chrome.md#부팅-순서--창은-언제-보이는가).
 * 상한에 걸린 작업은 계속 돌 수 있으므로, 결과를 쓰는 쪽이 false를 보고 그만둘지 정한다.
 */
export async function within(work: Promise<unknown>, timeoutMs: number): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const finished = await Promise.race([
    work.then(() => true),
    new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), timeoutMs);
    }),
  ]);
  clearTimeout(timer);
  return finished;
}
