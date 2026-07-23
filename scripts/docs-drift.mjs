// 문서-코드 드리프트 검사 — 계약 문서와 코드의 기계 대조.
// 설명·의도의 단일 출처: .claude/docs/development-commands.md#문서-코드-드리프트-검사-docs-drift
//
// 두 표면을 단방향으로 검사한다:
//   1) Rust #[tauri::command] 함수명이 rust-commands.md에 등재됐는지 (코드 → 문서).
//      계약 없는 커맨드는 실패, 문서에만 있는 커맨드(미구현 계약)는 허용.
//   2) tech-stack.md 표의 버전이 package.json·Cargo.toml 실제 핀과 일치하는지 (표 → 핀).
//      표에 없는 의존성은 등재를 요구하지 않는다.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const IGNORED_DIRS = new Set(["node_modules", "target", "styled-system", "dist", ".git"]);

function read(path) {
  return readFileSync(join(ROOT, path), "utf8");
}

// 디렉터리를 재귀 순회하며 파일명이 match에 맞는 상대 경로를 모은다(생성물·의존성 디렉터리 제외).
function walk(dir, match, out = []) {
  let entries;
  try {
    entries = readdirSync(join(ROOT, dir), { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const rel = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!IGNORED_DIRS.has(entry.name)) {
        walk(rel, match, out);
      }
    } else if (match.test(entry.name)) {
      out.push(rel);
    }
  }
  return out;
}

// tech-stack.md에서 패키지 이름을 담은 표 줄을 찾는다. 백틱 토큰을 우선하고(정밀),
// 스코프 패키지는 마지막 세그먼트도 후보로 둔다(@codemirror/view가 `view`로 적히는 경우).
function findDocLines(lines, name) {
  const candidates = ["`" + name + "`"];
  const slash = name.indexOf("/");
  if (name.startsWith("@") && slash !== -1) {
    candidates.push("`" + name.slice(slash + 1) + "`");
  }
  const backtickHits = lines.filter((line) => candidates.some((c) => line.includes(c)));
  if (backtickHits.length > 0) {
    return backtickHits;
  }
  return lines.filter((line) => line.includes(name));
}

// 0) 플랫폼 상수 — 같은 숫자가 Rust와 CSS 두 곳에 사는 자리를 대조한다.
//
// 왜: 타이틀바 드래그 띠의 높이는 네이티브(NSView 프레임)와 웹(탭바 padding-top)이 **같은 값**을
//     써야 한다. 어긋나면 조용히 깨진다 — 탭이 띠에 먹혀 눌러도 창이 끌리거나, 아무것도 없는
//     띠가 남는다. 화면을 봐야만 알 수 있고, 그때는 이미 늦다.
// 무엇: Rust의 TITLEBAR_STRIP_HEIGHT와 탭바 CSS의 paddingTop이 같은 숫자인지.
// 경계: "띠가 실제로 웹뷰 위에 있는가"는 여기서 못 본다 — 그건 실앱 검증 영역이다
//       (→ .claude/docs/design/window-chrome.md#검증).
function checkPlatformConstants(problems) {
  const rust = read("apps/desktop/src-tauri/src/titlebar_drag.rs");
  const css = read("apps/desktop/src/widgets/title-strip/ui/title-strip.tsx");

  const rustMatch = /TITLEBAR_STRIP_HEIGHT:\s*f64\s*=\s*(\d+(?:\.\d+)?)/.exec(rust);
  if (!rustMatch) {
    problems.push("titlebar_drag.rs에서 TITLEBAR_STRIP_HEIGHT를 찾지 못했습니다.");
    return 0;
  }
  const stripHeight = Number.parseFloat(rustMatch[1]);

  // 타이틀 스트립은 유리(_glass)에서만 띠 높이를 차지한다. 소문자 height:만 잡아 minHeight는 건너뛴다.
  const cssMatch = /_glass:\s*\{[^}]*[ ,]height:\s*"(\d+)px"/.exec(css);
  if (!cssMatch) {
    problems.push("title-strip.tsx의 _glass height(띠 높이)를 찾지 못했습니다.");
    return 0;
  }
  const stripCssHeight = Number.parseFloat(cssMatch[1]);

  if (stripHeight !== stripCssHeight) {
    problems.push(
      `드래그 띠 높이가 어긋납니다 — Rust TITLEBAR_STRIP_HEIGHT=${stripHeight}, ` +
        `title-strip height=${stripCssHeight}px. 같은 값이어야 띠 아래에서 콘텐츠가 시작한다.`,
    );
  }

  // 클릭 통과 영역 — 띠에서 클릭이 웹뷰로 통과하는 사각형과 토글이 실제로 앉는 자리가 같아야 한다.
  // 어긋나면 조용히 깨진다: 토글이 그 영역 밖으로 나가면 눌러도 창만 끌린다.
  const cutout = { x: "TITLEBAR_CUTOUT_X", width: "TITLEBAR_CUTOUT_WIDTH" };
  const rustCutout = {};
  for (const [key, name] of Object.entries(cutout)) {
    const match = new RegExp(`${name}:\\s*f64\\s*=\\s*(\\d+(?:\\.\\d+)?)`).exec(rust);
    if (!match) {
      problems.push(`titlebar_drag.rs에서 ${name}를 찾지 못했습니다.`);
      return 1;
    }
    rustCutout[key] = Number.parseFloat(match[1]);
  }

  // 토글 자리는 _glass 안에서만 절대배치된다 — left·width 순서로 쓴다(아래 정규식의 전제).
  const slotMatch =
    /const toggleSlotClass = css\(\{[\s\S]*?left:\s*"(\d+)px"[\s\S]*?width:\s*"(\d+)px"/.exec(css);
  if (!slotMatch) {
    problems.push(
      "title-strip.tsx의 toggleSlotClass에서 클릭 통과 영역 좌표(left·width)를 찾지 못했습니다.",
    );
    return 1;
  }
  const [slotX, slotWidth] = [Number.parseFloat(slotMatch[1]), Number.parseFloat(slotMatch[2])];

  if (rustCutout.x !== slotX || rustCutout.width !== slotWidth) {
    problems.push(
      `클릭 통과 영역이 어긋납니다 — Rust(${rustCutout.x}, ${rustCutout.width}), ` +
        `토글 자리(${slotX}, ${slotWidth}). 같아야 토글이 그 영역 안에서 눌린다.`,
    );
  }
  return 1;
}

// 1) Rust 커맨드 → rust-commands.md 등재 여부.
function checkRustCommands(problems) {
  const doc = read(".claude/docs/rust-commands.md");
  const commandRe =
    /#\[tauri::command\]\s*(?:#\[[^\]]*\]\s*)*(?:pub\s+)?(?:async\s+)?fn\s+([a-z_][a-z0-9_]*)/g;
  let checked = 0;
  for (const file of walk("apps", /\.rs$/)) {
    const src = read(file);
    let m;
    while ((m = commandRe.exec(src)) !== null) {
      checked += 1;
      if (!doc.includes(m[1])) {
        problems.push(`Rust 커맨드 '${m[1]}'(${file})가 rust-commands.md 계약에 없습니다.`);
      }
    }
  }
  return checked;
}

// package.json(root·apps·packages)의 exact 핀을 name → 버전 집합으로 모은다.
function collectNpmPins() {
  const manifests = [
    "package.json",
    ...walk("apps", /^package\.json$/),
    ...walk("packages", /^package\.json$/),
  ];
  const pins = new Map();
  for (const file of manifests) {
    let json;
    try {
      json = JSON.parse(read(file));
    } catch {
      continue;
    }
    for (const field of ["dependencies", "devDependencies"]) {
      const deps = json[field];
      if (!deps) {
        continue;
      }
      for (const [name, spec] of Object.entries(deps)) {
        if (
          typeof spec !== "string" ||
          spec.startsWith("workspace:") ||
          name.startsWith("@norii/")
        ) {
          continue;
        }
        const version = spec.replace(/^[\^~]/, "");
        if (!pins.has(name)) {
          pins.set(name, new Set());
        }
        pins.get(name).add(version);
      }
    }
  }
  return pins;
}

// 2a) npm 버전 → tech-stack.md 표.
function checkTechStackNpm(problems) {
  const lines = read(".claude/docs/tech-stack.md").split("\n");
  let checked = 0;
  for (const [name, versions] of collectNpmPins()) {
    const docLines = findDocLines(lines, name);
    if (docLines.length === 0) {
      continue;
    }
    for (const version of versions) {
      checked += 1;
      if (!docLines.some((line) => line.includes(version))) {
        problems.push(
          `tech-stack.md의 '${name}' 버전이 실제 핀 ${version}과 다릅니다(표를 갱신하세요).`,
        );
      }
    }
  }
  return checked;
}

// 2b) Cargo.toml 크레이트 버전 → tech-stack.md 표. [dependencies]/[build-dependencies]의 exact 핀만.
function checkTechStackCargo(problems) {
  const lines = read(".claude/docs/tech-stack.md").split("\n");
  const depRe = /^([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]+)"|\{[^}]*version\s*=\s*"([^"]+)"[^}]*\})/;
  let checked = 0;
  for (const file of walk("apps", /^Cargo\.toml$/)) {
    let inDeps = false;
    for (const raw of read(file).split("\n")) {
      const line = raw.trim();
      if (line.startsWith("[")) {
        // [dependencies]·[build-dependencies]·[dev-dependencies]·[target.'...'.dependencies] 포함.
        inDeps = line.endsWith("dependencies]");
        continue;
      }
      if (!inDeps || line === "" || line.startsWith("#")) {
        continue;
      }
      const m = depRe.exec(line);
      // 범위 핀("2", "1.0")은 tech-stack이 "2.x"로 문서화하므로 exact(x.y.z)만 검사한다.
      if (!m) {
        continue;
      }
      const version = m[2] ?? m[3];
      if (!/^\d+\.\d+\.\d+/.test(version)) {
        continue;
      }
      const docLines = findDocLines(lines, m[1]);
      if (docLines.length === 0) {
        continue;
      }
      checked += 1;
      if (!docLines.some((docLine) => docLine.includes(version))) {
        problems.push(
          `tech-stack.md의 크레이트 '${m[1]}' 버전이 Cargo.toml 핀 ${version}과 다릅니다.`,
        );
      }
    }
  }
  return checked;
}

const problems = [];
const constCount = checkPlatformConstants(problems);
const rustCount = checkRustCommands(problems);
const npmCount = checkTechStackNpm(problems);
const cargoCount = checkTechStackCargo(problems);

if (problems.length > 0) {
  console.error(`✘ docs-drift: 문서-코드 불일치 ${problems.length}건`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error("\n계약 문서를 코드와 함께 갱신하세요(→ .claude/rules/project-rules.md).");
  process.exit(1);
}

console.log(
  `✔ docs-drift: 정합 (플랫폼 상수 ${constCount} · Rust 커맨드 ${rustCount} · ` +
    `npm 버전 ${npmCount} · 크레이트 ${cargoCount} 대조)`,
);
