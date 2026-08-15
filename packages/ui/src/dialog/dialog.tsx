import type { DialogHTMLAttributes, HTMLAttributes, ReactNode, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { css, cva, cx } from "styled-system/css";

export const DIALOG_STYLES = {
  base: {
    margin: "auto",
    borderWidth: "1px",
    borderStyle: "solid",
    borderColor: "border",
    background: "bg.paper",
    color: "text",
    boxShadow: "lg",
    overflow: "hidden",
    animation: "dialogIn 0.16s ease",
    // 애니메이션이 끝나면 시작 상태로 되돌아가기 때문에 forwards로 끝 상태를 유지
    '&[data-closing="true"]': { animation: "dialogOut 0.12s ease forwards" },
    _motionReduce: { animation: "none" },
    _backdrop: { background: "bg.scrim" },
  },
  variants: {
    width: {
      sm: { maxWidth: "sm", borderRadius: "md" },
      lg: { width: "90vw", maxWidth: "2xl", borderRadius: "lg" },
    },
  },
  defaultVariants: { width: "sm" },
} as const;

// 여백은 Dialog가 아니라 아래 세 컴포넌트가 갖는다.
const DIALOG_PART_STYLES = {
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "5",
    paddingX: "5",
    paddingY: "4",
  },
  body: { padding: "6", overflowY: "auto" },
  footer: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "2",
    paddingX: "5",
    paddingY: "4",
  },
} as const;

const DIALOG_DIVIDER_STYLES = {
  header: { borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: "border" },
  footer: { borderTopWidth: "1px", borderTopStyle: "solid", borderTopColor: "border" },
} as const;

const dialogRecipe = cva(DIALOG_STYLES);

export interface DialogProps extends DialogHTMLAttributes<HTMLDialogElement> {
  /** `false`로 바꿔도 닫는 전환이 끝날 때까지 DOM에 남음 */
  open: boolean;
  /** 상자의 폭. 여백은 안에 넣는 컴포넌트가 가짐 */
  width?: "sm" | "lg";
  /** `<dialog>` 요소를 직접 만져야 할 때 넘김 — 없으면 내부 ref 사용 */
  dialogRef?: RefObject<HTMLDialogElement | null>;
  children: ReactNode;
}

/**
 * 화면 전체를 막고 뜨는 대화상자. 여백을 갖지 않으므로 `DialogHeader`·`DialogBody`·`DialogFooter`를
 * 넣어 조립함 — 셋 다 선택임
 *
 * @description
 * 포커스는 닫을 때 연 요소로 돌아감 — 여는 시점의 `document.activeElement`를 기억해 두고 되돌림
 */
export function Dialog({ open, width, className, dialogRef, children, ...rest }: DialogProps) {
  const fallbackRef = useRef<HTMLDialogElement>(null);
  const ref = dialogRef ?? fallbackRef;
  // 즉시 언마운트하면 dialogOut이 재생되지 않기 때문에 전환이 끝날 때까지 마운트를 유지
  const [rendered, setRendered] = useState(open);
  if (open && !rendered) {
    setRendered(true);
  }

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (open) {
      // <dialog>가 DOM에서 제거돼 브라우저가 포커스를 복원하지 않기 때문에 여는 시점의 요소를 기억
      const opener = document.activeElement;
      if (!dialog.open) {
        delete dialog.dataset.closing;
        dialog.showModal();
      }
      return () => {
        if (opener instanceof HTMLElement) {
          opener.focus();
        }
      };
    }
    if (!dialog.open) {
      setRendered(false);
      return;
    }
    const finish = () => {
      delete dialog.dataset.closing;
      dialog.close();
      setRendered(false);
    };
    // animation이 none이면 animationend가 오지 않기 때문에 전환 없이 바로 닫음
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      finish();
      return;
    }
    dialog.dataset.closing = "true";
    dialog.addEventListener("animationend", finish, { once: true });
    // animationend가 유실되면 닫히지 않기 때문에 상한을 지정
    const timer = setTimeout(finish, 300);
    return () => {
      clearTimeout(timer);
      dialog.removeEventListener("animationend", finish);
    };
  }, [open, ref]);

  if (!open && !rendered) {
    return null;
  }
  return (
    <dialog ref={ref} className={cx(dialogRecipe({ width }), className)} {...rest}>
      {children}
    </dialog>
  );
}

interface PartProps extends HTMLAttributes<HTMLDivElement> {
  /** 본문과 나누는 선 — 본문이 스크롤하는 화면에서 씀 */
  divider?: boolean;
}

export function DialogHeader({ divider, className, ...rest }: PartProps) {
  const style = css(DIALOG_PART_STYLES.header, divider && DIALOG_DIVIDER_STYLES.header);

  return <div className={cx(style, className)} {...rest} />;
}

export function DialogBody({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx(css(DIALOG_PART_STYLES.body), className)} {...rest} />;
}

export function DialogFooter({ divider, className, ...rest }: PartProps) {
  const style = css(DIALOG_PART_STYLES.footer, divider && DIALOG_DIVIDER_STYLES.footer);

  return <div className={cx(style, className)} {...rest} />;
}
