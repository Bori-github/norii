import type { ReactNode } from "react";

// 스토리를 나란히 놓는 배치. 컴포넌트와 섞이지 않게 Panda 토큰이 아니라 인라인 스타일을 쓴다.
const labelStyle = {
  fontSize: 11,
  fontFamily: "ui-monospace, monospace",
  opacity: 0.55,
  letterSpacing: "0.02em",
  // 긴 이름이 옆 칸을 침범하지 않게 한다.
  maxWidth: "100%",
  overflowWrap: "anywhere",
} as const;

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section style={{ marginBottom: 32 }}>
      <h3 style={{ ...labelStyle, marginBottom: 10, textTransform: "uppercase" }}>{title}</h3>
      {children}
    </section>
  );
}

export function Row({ children }: { children: ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
      {children}
    </div>
  );
}

export function Cell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 6,
        minWidth: 0,
      }}
    >
      {children}
      <span style={labelStyle}>{label}</span>
    </div>
  );
}
