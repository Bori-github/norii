import { Component, type ErrorInfo, type ReactNode } from "react";
import { css } from "styled-system/css";

import { STRINGS } from "@shared/config";
import { logger } from "@shared/lib";

const fallbackClass = css({
  height: "100%",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "2",
  color: "text",
});

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// 앱 전역 에러 바운더리 — 예상치 못한 렌더 에러가 앱 전체를 죽이지 않게 한다
// (→ error-handling.md#프론트--에러-바운더리--ipc-정규화). 문서 내용은 CM6 인스턴스와
// 디스크에 있으므로 렌더 트리가 죽어도 데이터는 남는다 — 복구 UI만 보여준다.
export class AppErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // 민감정보 원칙: 문서 내용·파일 경로는 남기지 않는다 — 에러명과 컴포넌트 스택만.
    logger.error(`렌더 에러: ${error.name}${info.componentStack ?? ""}`);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className={fallbackClass} role="alert" data-testid="error-boundary">
          <strong>{STRINGS.errorBoundaryTitle}</strong>
          <span>{STRINGS.errorBoundaryBody}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
