// 번들 크기 측정 — 목표 <15MB(→ .claude/docs/platform-strategy.md, .claude/rules/project-rules.md).
//
// 무엇을 재나:
//   (1) 최종 앱 번들(.app/.dmg) — **15MB 예산의 대상.** mac `tauri build` 후에만 존재한다.
//   (2) 프론트엔드 dist — 우리가 직접 제어하는 하위 신호. 매 `vite build`마다 측정 가능.
// check 게이트에는 넣지 않는다(빌드 산출물이 있어야 하므로). `mise run build` 후 실행한다.
// 앱 번들이 예산을 넘으면 exit 1(추세 관리·CI 게이팅용), 없으면 안내 후 exit 0.
import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const BUDGET_BYTES = 15 * 1024 * 1024;
const FRONTEND_DIST = "apps/desktop/dist";
const BUNDLE_DIR = "apps/desktop/src-tauri/target/release/bundle";

function sizeOf(path) {
  const stat = statSync(path);
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

// 번들 디렉터리에서 배포 산출물(.app 디렉터리·.dmg 파일)을 재귀로 찾는다.
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

const bundles = findAppBundles(join(ROOT, BUNDLE_DIR));
if (bundles.length === 0) {
  console.log(
    `앱 번들 (.app/.dmg): 없음 — mac에서 tauri build 후 측정 (예산 <${mb(BUDGET_BYTES)})`,
  );
  process.exit(0);
}

let overBudget = false;
console.log(`\n앱 번들 (예산 <${mb(BUDGET_BYTES)}):`);
for (const bundle of bundles) {
  const size = sizeOf(bundle);
  const rel = bundle.slice(ROOT.length + 1);
  const withinBudget = size <= BUDGET_BYTES;
  overBudget = overBudget || !withinBudget;
  console.log(`  ${withinBudget ? "✔" : "✘"} ${rel} — ${mb(size)}`);
}

if (overBudget) {
  console.error(`\n✘ 번들 크기 예산(<${mb(BUDGET_BYTES)}) 초과 — 목표를 지키세요.`);
  process.exit(1);
}
console.log(`\n✔ 번들 크기 예산 이내(<${mb(BUDGET_BYTES)}).`);
