import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import "@app/index.css";

import { Dialog } from "./dialog";

// 왜: showModal이 포커스를 다이얼로그 안으로 옮기는데, 닫을 때 <dialog>가 DOM에서 빠지면
//     활성 요소가 body가 된다 — 키보드로 열었다 닫으면 다음 Tab이 문서 맨 앞에서 시작한다.
// 보장: 닫으면 열기 전에 포커스를 갖고 있던 요소로 돌아온다.
// 경계: 열려 있는 동안의 포커스 이동은 보지 않는다 — 표준 <dialog>의 몫이다.

function Harness({ open }: { open: boolean }) {
  return (
    <>
      <button type="button" data-testid="opener">
        설정
      </button>
      <Dialog open={open} data-testid="dialog">
        <button type="button" data-testid="inside">
          닫기
        </button>
      </Dialog>
    </>
  );
}

afterEach(cleanup);

it("닫으면 열기 전 요소로 포커스가 돌아온다", async () => {
  const { getByTestId, rerender } = render(<Harness open={false} />);
  const opener = getByTestId("opener");
  opener.focus();

  rerender(<Harness open />);
  await waitFor(() => expect(document.activeElement).not.toBe(opener));

  rerender(<Harness open={false} />);
  await waitFor(() => expect(document.activeElement).toBe(opener));
});
