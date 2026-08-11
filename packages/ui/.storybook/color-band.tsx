import type { ColorGroup } from "./tokens";

const LABEL = { fontSize: 11, fontFamily: "ui-monospace, monospace" } as const;
const MUTED = { ...LABEL, color: "var(--colors-text-muted)" } as const;
const VALUE = { ...MUTED, padding: "4px 8px 10px 0", overflowWrap: "anywhere" } as const;
const MARKER = { ...MUTED, display: "flex", alignItems: "center" } as const;
const SWATCH = { height: 38 } as const;
const GUTTER = 44;

/**
 * 색 그룹 하나를 빈틈 없는 띠로 그린다.
 *
 * @param group - 그릴 그룹
 *
 * @description
 * 값이 줄바꿈하면 칸마다 높이가 달라져 아래 띠가 어긋나기 때문에 행 높이를 공유하는 그리드로
 * 짠다 — flex로는 칸마다 따로 늘어난다
 */
export function ColorBand({ group }: { group: ColorGroup }) {
  const { tokens, light, dark, varies } = group;

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `${GUTTER}px repeat(${tokens.length}, minmax(0, 1fr))`,
        marginBottom: 28,
      }}
    >
      <div />
      {tokens.map((token) => (
        <div key={token} style={{ ...LABEL, padding: "0 8px 6px 0", overflowWrap: "anywhere" }}>
          {token}
        </div>
      ))}

      {/* 같은 값을 두 번 찍으면 갈리는 그룹이 눈에 안 들어오기 때문에 무관한 그룹은 가르지 않는다. */}
      <div style={MARKER}>{varies ? "light" : ""}</div>
      {tokens.map((token) => (
        <div key={token} style={{ ...SWATCH, background: light[token] }} />
      ))}

      <div />
      {tokens.map((token) => (
        <div key={token} style={VALUE}>
          {light[token]}
        </div>
      ))}

      {varies ? (
        <>
          <div style={MARKER}>dark</div>
          {tokens.map((token) => (
            <div key={token} style={{ ...SWATCH, background: dark[token] }} />
          ))}

          <div />
          {tokens.map((token) => (
            <div key={token} style={VALUE}>
              {dark[token]}
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}
