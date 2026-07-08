import { createEditorView } from "@norii/editor";
import { useEffect, useRef } from "react";

// M0 확인용 초기 문서 — M1에서 실제 파일 열기로 대체된다(→ .claude/docs/implementation-plan.md).
const SAMPLE_DOC = `# norii

가볍고 빠른 로컬 우선 마크다운 소스 뷰 에디터.

- 소스 뷰 편집
- 구문 하이라이팅
- 문서 내 검색 (Cmd+F)
`;

// 에디터 패널 위젯 — CodeMirror 6 뷰를 DOM에 마운트하고 생명주기를 관리한다.
export function EditorPane() {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }
    const view = createEditorView({ parent: host, doc: SAMPLE_DOC });
    return () => {
      view.destroy();
    };
  }, []);

  return <div ref={hostRef} />;
}
