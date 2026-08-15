import { useRef } from "react";
import { css } from "styled-system/css";

import { Button, Dialog, DialogBody, DialogFooter } from "@norii/ui";

import { useConfirmStore } from "./confirm-store";

const textClass = css({
  marginTop: "3",
  fontSize: "sm",
  color: "text.muted",
  whiteSpace: "pre-line",
});

export function ConfirmDialog() {
  const pending = useConfirmStore((state) => state.pending);
  const settle = useConfirmStore((state) => state.settle);
  // Dialog는 닫힘 전환이 끝날 때까지 마운트를 유지한다(→ ./dialog)
  const lastPending = useRef(pending);
  if (pending) {
    lastPending.current = pending;
  }
  const shown = pending ?? lastPending.current;

  if (!shown) {
    return null;
  }
  return (
    <Dialog
      open={pending !== null}
      data-testid="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-body"
      onCancel={() => settle(false)} // Esc — settle이 중복 호출을 무시하므로 close와 겹쳐도 안전.
    >
      <DialogBody>
        <strong id="confirm-dialog-title">{shown.title}</strong>
        <p id="confirm-dialog-body" className={textClass}>
          {shown.body}
        </p>
      </DialogBody>
      <DialogFooter>
        <Button data-testid="confirm-cancel" onClick={() => settle(false)}>
          {shown.cancelLabel}
        </Button>
        <Button variant="accent" data-testid="confirm-accept" onClick={() => settle(true)}>
          {shown.confirmLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
