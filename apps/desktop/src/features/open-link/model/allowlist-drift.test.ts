import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { ALLOWED_PROTOCOLS } from "./external-link";

// 집행: rust-commands.md#권한-capabilities — "허용 스킴은 두 곳에 있고 서로 일치해야 한다".
//
// 왜: 허용목록이 프론트(판정)와 capabilities(Rust 강제) 두 곳에 산다. 한쪽만 고치면
//     링크가 조용히 죽거나(capabilities만 좁힘) 무의미한 에러 로그가 쌓인다(프론트만 넓힘).
//     capabilities는 설정 파일이라 타입체크·린트가 잡아주지 못하므로 테스트가 지킨다.
// 보장: 두 목록이 정확히 같은 스킴 집합을 가리킨다. 어느 한쪽만 바꾸면 이 테스트가 깨진다.
// 경계: 스킴이 실제로 열리는지(플러그인 동작)는 실앱 수동 검증의 몫이다 — 설정 파일의
//       정합만 여기서 고정한다.

interface UrlScope {
  url: string;
}

interface ScopedPermission {
  identifier: string;
  allow: UrlScope[];
}

type Permission = string | ScopedPermission;

const CAPABILITIES_PATH = fileURLToPath(
  new URL("../../../../src-tauri/capabilities/default.json", import.meta.url),
);

function openUrlScopeSchemes(): Set<string> {
  const capability = JSON.parse(readFileSync(CAPABILITIES_PATH, "utf8")) as {
    permissions: Permission[];
  };
  const openUrl = capability.permissions.find(
    (permission): permission is ScopedPermission =>
      typeof permission === "object" && permission.identifier === "opener:allow-open-url",
  );
  expect(openUrl, "capabilities에 opener:allow-open-url 스코프가 없습니다").toBeDefined();
  // "https://*" · "mailto:*" → "https:" · "mailto:" (URL.protocol과 같은 형태로 정규화)
  return new Set(
    (openUrl as ScopedPermission).allow.map((scope) => `${scope.url.split(":")[0] ?? ""}:`),
  );
}

describe("링크 허용목록 — 프론트와 capabilities가 어긋나지 않는다", () => {
  it("두 곳의 스킴 집합이 정확히 같다", () => {
    expect(openUrlScopeSchemes()).toEqual(new Set(ALLOWED_PROTOCOLS));
  });

  it("capabilities 스코프가 비어 있지 않다 — 비우면 모든 URL이 거부된다", () => {
    // 권한 이름만 넣고 allow를 비워 두면 플러그인이 전부 거부한다(Not allowed to open url).
    expect(openUrlScopeSchemes().size).toBeGreaterThan(0);
  });
});
