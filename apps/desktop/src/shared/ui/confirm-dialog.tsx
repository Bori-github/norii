import { useEffect, useRef } from "react";
import { css } from "styled-system/css";

import { Button } from "./button";
import { useConfirmStore } from "./confirm-store";

// 다이얼로그는 앱 위에 뜨지만 불투명하다 — 투명 창에서 backdrop-filter가 동작하지 않는다는 보고가
// 있고, 캔버스가 투명하면 흐릴 픽셀 자체가 없다. 흐림 채택은 실측 후 결정한다(→ decisions/glass).
const dialogClass = css({
  margin: "auto",
  maxWidth: "sm",
  padding: "5",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "border",
  borderRadius: "md",
  background: "bg.paper",
  color: "text",
  boxShadow: "lg",
  _backdrop: { background: "bg.scrim" },
});

const bodyClass = css({
  marginTop: "2",
  fontSize: "sm",
  color: "text.muted",
  whiteSpace: "pre-line",
});

const actionsClass = css({
  display: "flex",
  justifyContent: "flex-end",
  gap: "2",
  marginTop: "4",
});

// 인앱 확인 모달 — 표준 <dialog>가 포커스 트랩·Esc(cancel 이벤트)를 기본 제공한다.
// 비차단이라 E2E가 버튼을 직접 클릭해 검증할 수 있다(→ file-lifecycle.md#종료-방어).
export function ConfirmDialog() {
  const pending = useConfirmStore((state) => state.pending);
  const settle = useConfirmStore((state) => state.settle);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (pending && dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [pending]);

  if (!pending) {
    return null;
  }
  return (
    <dialog
      ref={dialogRef}
      className={dialogClass}
      data-testid="confirm-dialog"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-body"
      onCancel={() => settle(false)} // Esc — settle이 중복 호출을 무시하므로 close와 겹쳐도 안전.
    >
      <strong id="confirm-dialog-title">{pending.title}</strong>
      <p id="confirm-dialog-body" className={bodyClass}>
        {pending.body}
      </p>
      <div className={actionsClass}>
        <Button data-testid="confirm-cancel" onClick={() => settle(false)}>
          {pending.cancelLabel}
        </Button>
        <Button variant="accent" data-testid="confirm-accept" onClick={() => settle(true)}>
          {pending.confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
