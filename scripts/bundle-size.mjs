// 번들 크기 측정 — 측정 대상과 실행 시점은 .claude/docs/platform-strategy.md#번들-크기-측정.
import { existsSync, lstatSync, openSync, readdirSync, readSync, closeSync } from "node:fs";
import { basename, join } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
// 예산 값의 단일 출처 — 문서는 숫자를 적지 않고 이 파일을 가리킨다.
const BUDGET_PER_ARCH_BYTES = 25 * 1024 * 1024;
const FRONTEND_DIST = "apps/desktop/dist";
// `--target`을 준 빌드는 target/<타깃>/ 아래에 쌓인다 — target 전체를 훑어야 universal이 잡힌다.
const TARGET_DIR = "apps/desktop/src-tauri/target";

function sizeOf(path) {
  // lstat으로 심볼릭 링크를 따라가지 않는다 — macOS .app은 내부 링크(Versions/Current 등)를
  // 담으므로, 링크를 따라가면 실제 파일이 중복 집계되거나 깨진 링크에서 statSync가 던진다.
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    return 0;
  }
  if (!stat.isDirectory()) {
    return stat.size;
  }
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    total += sizeOf(join(path, entry.name));
  }
  return total;
}

function mb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// 0xCAFEBABE: 파일 종류를 알리려고 맨 앞에 박아 두는 약속된 숫자. 여러 아키텍처를 담은
// 파일의 매직 값, 그 뒤에 아키텍처 개수가 온다.
// 빅엔디안 — 큰 자리 바이트부터 저장하는 순서. 이 기계는 반대(리틀엔디안)지만 두 값은
// 빅엔디안으로 들어 있어 readUInt32BE로 읽는다.
function archCount(bundlePath) {
  const macosDir = join(bundlePath, "Contents", "MacOS");
  if (!existsSync(macosDir)) {
    // .dmg는 열어볼 수 없다 — 빌드가 쌓인 자리 이름으로 판별한다.
    return bundlePath.includes("universal-apple-darwin") ? 2 : 1;
  }
  // 실행 파일 이름 = .app 이름. 점 파일·디렉터리 미제외 시 .DS_Store를 실행 파일로 읽어
  // 아키텍처 오판, 또는 readSync EISDIR
  const files = readdirSync(macosDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.name.startsWith("."))
    .map((entry) => entry.name);
  const appName = basename(bundlePath, ".app");
  const name = files.includes(appName) ? appName : files[0];
  if (name === undefined) {
    return 1;
  }
  const fd = openSync(join(macosDir, name), "r");
  try {
    const head = Buffer.alloc(8);
    if (readSync(fd, head, 0, 8, 0) < 8) {
      return 1;
    }
    return head.readUInt32BE(0) === 0xcafebabe ? head.readUInt32BE(4) : 1;
  } finally {
    closeSync(fd);
  }
}

function findAppBundles(dir, out = []) {
  if (!existsSync(dir)) {
    return out;
  }
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && entry.name.endsWith(".app")) {
      out.push(full);
    } else if (entry.isFile() && entry.name.endsWith(".dmg")) {
      out.push(full);
    } else if (entry.isDirectory()) {
      findAppBundles(full, out);
    }
  }
  return out;
}

const frontendPath = join(ROOT, FRONTEND_DIST);
if (existsSync(frontendPath)) {
  console.log(`프론트엔드 번들 (dist): ${mb(sizeOf(frontendPath))}`);
} else {
  console.log("프론트엔드 번들 (dist): 없음 — `mise run build`로 생성");
}

const targetRoot = join(ROOT, TARGET_DIR);
const bundleDirs = existsSync(targetRoot)
  ? [
      join(targetRoot, "release", "bundle"),
      ...readdirSync(targetRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name !== "release")
        .map((entry) => join(targetRoot, entry.name, "release", "bundle")),
    ]
  : [];
const bundles = bundleDirs.flatMap((dir) => findAppBundles(dir));
if (bundles.length === 0) {
  console.log(
    `앱 번들 (.app/.dmg): 없음 — mac에서 tauri build 후 측정 (예산 아키텍처당 <${mb(BUDGET_PER_ARCH_BYTES)})`,
  );
  process.exit(0);
}

let overBudget = false;
console.log(`\n앱 번들 (예산 아키텍처당 <${mb(BUDGET_PER_ARCH_BYTES)}):`);
for (const bundle of bundles) {
  const size = sizeOf(bundle);
  const rel = bundle.slice(ROOT.length + 1);
  const arches = archCount(bundle);
  const budget = BUDGET_PER_ARCH_BYTES * arches;
  const withinBudget = size <= budget;
  overBudget = overBudget || !withinBudget;
  console.log(
    `  ${withinBudget ? "✔" : "✘"} ${rel} — ${mb(size)} (아키텍처 ${arches}개, 예산 <${mb(budget)})`,
  );
}

if (overBudget) {
  console.error("\n✘ 번들 크기 예산 초과 — 목표를 지키세요.");
  process.exit(1);
}
console.log("\n✔ 번들 크기 예산 이내.");
