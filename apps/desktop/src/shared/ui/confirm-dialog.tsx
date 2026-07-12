import { useEffect, useRef } from "react";
import { css } from "styled-system/css";

import { useConfirmStore } from "./confirm-store";

// 다이얼로그는 앱 위에 뜨지만 불투명하다 — 투명 창에서 backdrop-filter가 동작하지 않는다는 보고가
// 있고, 캔버스가 투명하면 흐릴 픽셀 자체가 없다. 흐림 채택은 실측 후 결정한다(→ decisions/0002).
const dialogClass = css({
  margin: "auto",
  maxWidth: "sm",
  padding: "5",
  border: "1px solid",
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

const buttonClass = css({
  paddingX: "3",
  paddingY: "1.5",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "sm",
  cursor: "pointer",
  background: "transparent",
  fontSize: "sm",
  _hover: { background: "bg.hover" },
});

// 확정 동작 버튼 — 강조는 글자색이 아니라 **테두리와 굵기**로 낸다. 액센트는 테마 공통 단일 값이라
// 글자로 쓰면 어느 한 테마에서 AA를 통과하지 못한다(→ decisions/0005). 테두리는 비텍스트라 안전하다.
const confirmButtonClass = css({
  borderColor: "accent",
  fontWeight: "semibold",
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
        <button
          type="button"
          className={buttonClass}
          data-testid="confirm-cancel"
          onClick={() => settle(false)}
        >
          {pending.cancelLabel}
        </button>
        <button
          type="button"
          className={`${buttonClass} ${confirmButtonClass}`}
          data-testid="confirm-accept"
          onClick={() => settle(true)}
        >
          {pending.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
