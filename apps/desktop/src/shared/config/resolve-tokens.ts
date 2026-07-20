import config from "../../../panda.config";

// panda.config.ts의 시맨틱 토큰을 테마별 실제 색 문자열로 푼다.
// 대비 게이트가 "문서에 적힌 값"이 아니라 "코드가 실제로 쓰는 값"을 검사하게 하려면
// 토큰 참조({colors.lime.50})를 원시 토큰까지 따라가야 한다(→ design/design-system.md#대비-게이트).

type Theme = "light" | "dark";

/** 대비 게이트가 검사하는 시맨틱 색. Panda의 조건부 값을 테마 하나로 평탄화한 결과다. */
export interface SemanticColors {
  bgPaper: string;
  bgChrome: string;
  text: string;
  textMuted: string;
  textMark: string;
  accent: string;
}

/** Panda의 조건부 토큰 값. 다크 조건 키는 Panda가 정한 이름이라 그대로 받는다. */
type ConditionalValue = Record<"base" | "_dark", string | undefined>;

interface TokenLeaf {
  value: string | ConditionalValue;
}

type TokenTree = { [key: string]: TokenTree | TokenLeaf };

function isLeaf(node: TokenTree | TokenLeaf): node is TokenLeaf {
  return "value" in node;
}

function lookup(tree: TokenTree, path: readonly string[]): TokenLeaf {
  let node: TokenTree | TokenLeaf = tree;
  for (const key of path) {
    if (isLeaf(node)) {
      break;
    }
    const next: TokenTree | TokenLeaf | undefined = node[key];
    if (next === undefined) {
      throw new Error(`토큰을 찾을 수 없습니다: ${path.join(".")}`);
    }
    node = next;
  }
  if (!isLeaf(node)) {
    throw new Error(`토큰이 잎이 아닙니다: ${path.join(".")}`);
  }
  return node;
}

/**
 * `var(--이름, 기본값)`을 기본값으로 접는다 — 게이트가 검사하는 것은 **기본값뿐**이고,
 * 설정이 런타임에 덮어쓴 값은 검사 범위 밖이다. 그래도 되는 이유는 decisions/glass가 소유한다.
 */
function foldCssVar(value: string): string {
  return value.replaceAll(/var\(--[\w-]+,\s*([^()]+)\)/g, "$1");
}

/** `{colors.lime.50}` 참조를 원시 토큰 값으로 바꾼다. 참조가 아니면 그대로 돌려준다. */
function deref(value: string, primitives: TokenTree): string {
  const [, reference] = /^\{colors\.([\w.]+)\}$/.exec(value) ?? [];
  if (reference === undefined) {
    return value;
  }
  const resolved = lookup(primitives, reference.split(".")).value;
  if (typeof resolved !== "string") {
    throw new Error(`원시 토큰이 조건부 값을 가질 수 없습니다: ${value}`);
  }
  return resolved;
}

export function resolveSemanticColors(theme: Theme): SemanticColors {
  const themeConfig = config.theme?.extend;
  const primitives = themeConfig?.tokens?.colors as TokenTree | undefined;
  const semantic = themeConfig?.semanticTokens?.colors as TokenTree | undefined;
  if (!primitives || !semantic) {
    throw new Error("panda.config.ts에 색 토큰이 없습니다");
  }

  const pick = (path: string): string => {
    const { value } = lookup(semantic, path.split("."));
    const raw = typeof value === "string" ? value : value[theme === "dark" ? "_dark" : "base"];
    if (raw === undefined) {
      throw new Error(`시맨틱 토큰 ${path}에 ${theme} 값이 없습니다`);
    }
    return foldCssVar(deref(raw, primitives));
  };

  return {
    bgPaper: pick("bg.paper"),
    bgChrome: pick("bg.chrome"),
    text: pick("text.DEFAULT"),
    textMuted: pick("text.muted"),
    textMark: pick("text.mark"),
    accent: pick("accent"),
  };
}
