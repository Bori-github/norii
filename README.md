# norii

가볍고 빠른 로컬 우선(local-first) 마크다운 **소스 뷰** 에디터.

> 파일 트리 사이드바 + 마크다운 소스 편집 + 실시간 분할 프리뷰

파일은 언제나 평범한 `.md`다.

## 시작하기

```sh
mise install     # Node · Rust · pnpm을 고정 버전으로 설치
pnpm install     # 워크스페이스 의존성 설치
mise run dev     # 데스크탑 앱 개발 모드
```

명령 전체와 품질 게이트(`mise run check`)는 [개발 명령](.claude/docs/development-commands.md)을 본다.

## 구조

```text
apps/desktop     Tauri + React 앱 (조립 · IPC)
packages/        재사용 로직
examples/        눈으로 확인하는 예시 .md 문서
.claude/         규칙 · 설계 문서
```

## 문서

설계·규칙 문서의 인덱스는 [AGENTS.md](AGENTS.md)다. 구현 순서와 현재 상태는 [실제 구현 계획](.claude/docs/implementation-plan.md)에 있다.

## 라이선스

MIT — [LICENSE](LICENSE)
