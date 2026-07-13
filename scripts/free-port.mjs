// 빈 개발 서버 포트 찾기 — 기본 포트가 이미 쓰이면 다음 포트로 넘긴다.
// 왜 필요한가: Tauri의 devUrl은 Vite가 실제로 연 포트를 정확히 가리켜야 한다. 그래서
// Vite는 strictPort로 고정하고(포트가 밀리면 devUrl과 어긋나 빈 창이 뜬다), 대신 **기동
// 전에** 빈 포트를 골라 Vite와 Tauri 양쪽에 같은 값을 넘긴다.
// 출력은 포트 번호 한 줄 — 호출 측이 명령 치환으로 받는다(→ .mise.toml).
import { createServer } from "node:net";
import process from "node:process";

const BASE_PORT = Number(process.argv[2]) || 1420;
const MAX_TRIES = 20;

// Vite와 **같은 방식으로** 바인딩해 봐야 판정이 맞는다. Vite의 기본 host는 "localhost"이고,
// 이는 macOS에서 IPv6(::1)로 먼저 잡힌다 — "127.0.0.1"만 검사하면 IPv6에 붙어 있는 서버를
// 놓쳐 "비어 있다"고 오판한다(실측으로 확인).
function isFree(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "localhost");
  });
}

for (let offset = 0; offset < MAX_TRIES; offset += 1) {
  const port = BASE_PORT + offset;
  // eslint-disable-next-line no-await-in-loop -- 포트는 순서대로 하나씩 확인해야 한다.
  if (await isFree(port)) {
    console.log(port);
    process.exit(0);
  }
}

console.error(`빈 포트를 찾지 못했습니다 (${BASE_PORT}~${BASE_PORT + MAX_TRIES - 1})`);
process.exit(1);
