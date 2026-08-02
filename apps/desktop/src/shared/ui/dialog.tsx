import type { DialogHTMLAttributes, ReactNode, RefObject } from "react";
import { useEffect, useRef } from "react";
import { cva, cx } from "styled-system/css";

// 다이얼로그는 앱 위에 뜨지만 불투명하다 — 투명 창에서 backdrop-filter가 동작하지 않는다는 보고가
// 있고, 캔버스가 투명하면 흐릴 픽셀 자체가 없다. 흐림 채택은 실측 후 결정한다(→ decisions/glass).
export const DIALOG_STYLES = {
  base: {
    margin: "auto",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "border",
    background: "bg.paper",
    color: "text",
    boxShadow: "lg",
    animation: "dialogIn 0.16s ease",
    _motionReduce: { animation: "none" },
    _backdrop: { background: "bg.scrim" },
  },
  variants: {
    size: {
      // 안쪽 여백을 상자가 갖는다 — 내용이 글 한 덩어리다.
      sm: { maxWidth: "sm", padding: "6", borderRadius: "md" },
      // 여백을 내용이 갖는다 — 머리말·본문이 자기 경계까지 채운다.
      lg: { width: "90vw", maxWidth: "2xl", padding: "0", overflow: "hidden", borderRadius: "lg" },
    },
  },
  defaultVariants: { size: "sm" },
} as const;

const dialogRecipe = cva(DIALOG_STYLES);

export interface DialogProps extends DialogHTMLAttributes<HTMLDialogElement> {
  open: boolean;
  size?: "sm" | "lg";
  /** 내용이 자기 안에서 포커스를 옮겨야 할 때 넘긴다. */
  dialogRef?: RefObject<HTMLDialogElement | null>;
  children: ReactNode;
}

// 표준 <dialog>가 포커스 트랩과 Esc(cancel 이벤트)를 맡는다. 비차단이라 E2E가 안의 버튼을
// 직접 클릭해 검증할 수 있다(→ file-lifecycle.md#종료-방어).
export function Dialog({ open, size, className, dialogRef, children, ...rest }: DialogProps) {
  const fallbackRef = useRef<HTMLDialogElement>(null);
  const ref = dialogRef ?? fallbackRef;

  useEffect(() => {
    const dialog = ref.current;
    if (open && dialog && !dialog.open) {
      dialog.showModal();
    }
  }, [open, ref]);

  if (!open) {
    return null;
  }
  return (
    <dialog ref={ref} className={cx(dialogRecipe({ size }), className)} {...rest}>
      {children}
    </dialog>
  );
}
