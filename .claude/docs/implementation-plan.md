# 실제 구현 계획

norii의 구현 순서·**구현 상태**와 열린 결정의 단일 출처다. 각 단계는 앞 단계가 동작한 뒤 진행한다. 구현 여부는 아래 마일스톤 표의 상태 열만 기록한다 — 설계·계약 문서는 구현 상태를 표기하지 않고, 이 표와 [단계별 문서](#마일스톤) 링크로 판별한다.

설계 의도는 **작동하는 얇은 슬라이스를 먼저 세우고, 경계를 지키며 넓히는 것**이다. 큰 기능을 한 번에 만들지 않는다.

## 마일스톤

| 단계 | 상태 | 내용 | 핵심 산출물 |
|---|---|---|---|
| M0. 스캐폴드 | ✅ 완료 | 모노레포(mise + pnpm + turbo) · Tauri+Vite+React 최소 실행 · CM6 마크다운 하이라이팅·문서 내 검색(기본 키맵) · 디자인 시스템 토큰(Panda, → [디자인 시스템](design/design-system.md)) · 품질 게이트(oxlint/oxfmt/Vitest/lefthook, → [코드 품질](code-quality.md)) · 문서 드리프트 검사(`docs-drift`) · **E2E 하네스**(tauri-plugin-webdriver 스모크 1개, → [테스트 전략](testing.md)) · 번들 크기 측정 기반 | `mise run dev`로 창이 뜨고 편집·하이라이팅 동작 · `mise run check` 통과 · E2E 스모크 실행 |
| M1. 코어 편집(왕복) | ✅ 완료 | 파일 열기/저장(**UTF-8·단일 EOL만** — 저장이 원본 바이트를 재작성하게 되는 파일(비UTF-8·혼합 EOL·CR-only)은 이 단계에선 거부. 단일 EOL의 판정·유지는 포함) · 원자적 쓰기·해시 충돌 검사 · **자동 저장** · 다중 탭 · dirty 추적 · **종료 방어** · IPC 에러 정규화·에러 바운더리·로깅(→ [에러 처리](error-handling.md)) · E2E 실전 시나리오(파일 왕복·종료 방어) | 파일을 열고 고치면 자동 저장, 탭 여러 개, 종료 시 유실 없음 |
| M2. 파일 강건성 | ✅ 완료 | **M1이 거부하던 파일을 안전하게 연다** — 인코딩 파이프라인(chardetng 변환)·혼합 EOL/CR-only 수용 + 배너·**정규화 승인** · watch 외부 변경 처리(에코 억제·충돌 흐름) | EUC-KR·혼합 EOL 문서를 열어 승인 후 저장, 외부 수정 시 리로드/충돌 안내 |
| M3. 프리뷰 | ✅ 완료 | 분할 프리뷰(markdown-it + DOMPurify) · 스크롤 동기화 | 소스 옆에 렌더 프리뷰, 스크롤 연동 |
| M4. 프리뷰 확장 | ✅ 완료 | **다이어그램(Mermaid) · 수식(KaTeX) · 각주** — 셋의 구현 방식·sanitize 경계는 [프리뷰 전략](preview-strategy.md#수식다이어그램-지원-채택)이 확정했다. **번들 실측을 선행**한다(스파이크 → 예산 판정 → lazy-load 구현). 이어서 **문서 내 앵커 이동 · 콜아웃 · 코드 복사 버튼** — 앵커는 각주의 마감이다(누를 수 없는 각주는 반쪽이다). 셋 다 프리뷰 안에서 끝나며 새 UI 표면을 만들지 않는다 | 다이어그램·수식·각주가 렌더되고 **각주를 눌러 오갈 수 있다** · 콜아웃이 강조 상자로 뜬다 · 코드 블록을 한 번에 복사한다 · 앱 번들이 예산 이내 |
| M5. 하이브리드 구조 | 예정 | 사이드바 파일 트리 · 헤딩/리스트 접기 | 폴더 열어 트리 탐색, 접기 동작 |
| M6. UI 다듬기 | 예정 | **시각 완성도를 책임지는 단계.** 타이포 스케일 토큰 확정 · 프리뷰 타이포/상호작용 · 탭 ⚠ 배지 색 · **설정 화면**(테마 선택 · 유리 불투명도/흐림 반경) · 설정 영속화(자동 저장 토글 포함) · 세션 복원 · **한글 IME QA**(E2E) | 실사용 가능한 시각 완성도 |
| M7. 배포(mac) | 예정 | 코드 서명·공증 · 자동 업데이트 · 번들 크기 목표 확정 | 배포 가능한 서명된 mac 빌드 |
| 이후 | — | Windows/Linux 확장 → (필요 시) 모바일 | — |

> **왜 다듬기가 사이드바 뒤인가.** 화면 구성(프리뷰 · 사이드바)이 다 선 뒤에 다듬어야 재작업이 없다. 그 전까지 눈에 띄게 거슬리는 것은 해당 마일스톤 안에서 즉시 처리한다 — 다듬기 단계로 미루지 않는다.
>
> **디자인 트랙은 순서를 앞질러 끝났다.** 테마(라이트/다크 · CM6 테마 토큰 통합)와 **창 유리**(투명 창 + 창 뒤 흐림 → [창 표면 계약](design/window-chrome.md))는 원래 다듬기 항목이었으나 별도 트랙에서 구현했다. M6에는 그 조각들 — **설정 화면**(테마 선택 · 유리 값 조절)과 영속화 — 만 남는다.

모든 마일스톤 기능은 **TDD로 진행**한다 — 실패하는 테스트를 먼저 쓰고 구현한다(→ [테스트 전략 · TDD](testing.md)). M0에서 테스트 하네스(Vitest·cargo test)를 게이트에 연결한다.

각 마일스톤은 **문서 대조로 끝난다** — 구현과 계약 문서(→ [작업 규칙 — 문서 규칙](../rules/project-rules.md))의 차이가 0이어야 완료다. 차이를 발견하면 임의로 문서를 코드에 맞춰 고치지 않고, [작업 규칙](../rules/project-rules.md)의 **설계 변경 워크플로**(멈춤 → 보고 → 문서 갱신 → 코드 정렬)를 따른다. 여기서 "차이"란 **구현된 것이 문서와 다른 것**이다 — 아직 배정된 마일스톤이 오지 않은 계약의 미구현은 차이가 아니다(`docs-drift` 커맨드 검사의 단방향 원칙과 동일).

각 단계가 구현하는 전략·계약은 아래 문서(절)를 단일 출처로 둔다 — 이 목록과 위 표의 상태 열을 겹쳐 보면 각 전략의 구현/미구현이 판별된다.

- M0 → [파일/폴더 구조](project-structure.md) · [개발 명령](development-commands.md) · [기술 스택](tech-stack.md) · [디자인 시스템](design/design-system.md) · [테스트 전략](testing.md)
- M1 → [Rust 커맨드 계약](rust-commands.md) · [문서 모델](document-model.md) · [파일 생명주기](file-lifecycle.md) · [에러 처리](error-handling.md)
- M2 → [파일 생명주기](file-lifecycle.md) · [Rust 커맨드 계약](rust-commands.md)
- M3 → [프리뷰 전략](preview-strategy.md)
- M4 → [프리뷰 전략](preview-strategy.md) · [플랫폼 전략](platform-strategy.md)(번들 예산) · [보안](security.md)(링크 판정 경계)
- M5 → [문서 모델 — 파일 트리](document-model.md#파일-트리-사이드바) · [에디터 전략 — 하이브리드 접기](editor-strategy.md#하이브리드-접기-아웃라이너-대체) · [Rust 커맨드 계약](rust-commands.md)(`read_dir`)
- M6 → [디자인 시스템 — 테마](design/design-system.md#테마-라이트다크) · [창 표면 계약](design/window-chrome.md) · [에디터 전략](editor-strategy.md) · [파일 생명주기 — 자동 저장](file-lifecycle.md#자동-저장) · [문서 모델 — 세션 복원](document-model.md#세션-복원)
- M7 → [플랫폼 전략](platform-strategy.md#배포-경로--app-store는-비목표)

## 열린 결정 (Open Decisions)

로드맵을 진행하며 확정한다. 이 목록에 없는 새 결정이 필요하면 [작업 규칙](../rules/project-rules.md)에 따라 사용자에게 보고한다.

```text
스냅샷 백업       주기 스냅샷(File Recovery류) 도입 여부  (→ file-lifecycle.md)
접힘 상태 영속화  사이드카 도입 시점                     (→ editor-strategy.md, non-goals.md)
테마 커스터마이징 프리셋 토큰 vs 사용자 커스텀 깊이     (→ design/design-system.md)
유리 설정 노출    불투명도(--norii-glass-opacity)·흐림 반경(DEFAULT_BLUR_RADIUS)을 설정 화면에 어떻게 노출할지 — 슬라이더 최솟값은 대비 게이트가 정한 하한과 같아야 한다. M6 설정 영속화와 함께 확정 (→ design/decisions/0007-glass-is-opacity-not-color.md · design/window-chrome.md)
타이포 스케일     글자 크기·행간이 아직 CM6 기본값 — 토큰 스케일 확정 시점. M6 (→ design/design-system.md)
네이티브 E2E     창 드래그·마우스 글자 선택·유리 투과·기동 프레임은 자동 검증이 없다 — 실제 OS 입력 합성(손쉬운 사용 권한)과 픽셀 판정이 필요하다. 이 공백 때문에 회귀 5건을 사람이 발견했다(유리가 유리가 아님·기동 시 흰 화면·선택 영역 소실·에디터 글자 선택 불가·앱 이름 위 드래그 불가). M6 설정 화면이 유리 값을 만질 때 함께 만든다 (→ testing.md · design/window-chrome.md#검증)
상태색 도입      팔레트에 상태색(정보·성공·경고·위험)이 없다. 이해관계자가 셋이다 — 탭 ⚠ 배지(유리 위, 지금은 본문색 상속) · 에러 배너 · M4 콜아웃(지금은 아이콘·경계선으로만 구별). 한 팔레트로 셋을 함께 정해야 하며, 라이트/다크 × 종이/유리 네 조합에서 대비 게이트를 통과해야 한다. 확정 시 ADR로 남긴다 (→ design/design-system.md#대비-게이트 · design/decisions/0005-accent-is-never-text.md · preview-strategy.md#콜아웃-gfm-alerts)
떠 있는 면 흐림   투명 창에서 backdrop-filter가 동작하지 않는다는 보고(tauri#6876·#12804) — 불투명으로 시작하고 실측 후 채택 여부 결정 (→ design/decisions/0002-glass-is-made-by-os.md)
한글 고정폭 폰트  표 정렬까지 지키려면 듀오스페이스 한글 폰트 번들(수 MB) 필요 — 15MB 예산과 함께 판단 (→ design/design-system.md#글자액센트-토큰)
탭 세션 복원      커서 위치까지 복원할지 · 에디터/프리뷰 스크롤 위치도 탭별 복원할지(VS Code 방식 — 현재는 화면 1개 공유, 전환 시 맨 위) (→ document-model.md)
oxfmt 1.0 재확인  베타(0.x) → 1.0 도달 시 안정성 재점검   (→ code-quality.md)
playwright 재상향 로컬 macOS 13이 WebKit을 지원하는 마지막 버전으로 다운핀 — 로컬 macOS 14+ 업그레이드 시 최신으로 복귀 (→ tech-stack.md#코드-품질)
E2E 도구 재확인   tauri-plugin-webdriver pre-1.0 → 1.0 도달 시 재점검 — 도입 시점은 확정(하네스 M0 · 실전 시나리오 M1) (→ testing.md)
tauri-specta 2.0  rc 핀 → 정식 2.0 도달 시 재확인            (→ tech-stack.md)
원격 이미지       프리뷰에서 http(s) 이미지 로드 허용 여부   (→ security.md)
커버리지 임계값   도입 시점·수치                              (→ testing.md)
경로 정규화 비교   스코프 허용 루트 비교가 바이트 단위 — 대소문자·NFC/NFD가 다른 입구(M5 트리·M6 세션 복원) 추가 전 비교 전략 확정. 심링크 별칭(/tmp↔/private/tmp)으로 같은 파일이 두 탭으로 열리는 문제도 이 결정에 포함 (→ rust-commands.md)
삭제 파일 부활 확인 밖에서 지운 파일의 dirty 탭을 닫기/종료 플러시가 확인 없이 재생성한다(데이터 보존 우선) — 자동 저장의 "조용히 되살리지 않는다"와 정책 비대칭. 확인 다이얼로그 도입 여부 (→ file-lifecycle.md#외부-변경-처리)
손실 변환 안내     감지 인코딩으로 못 읽는 바이트는 대체 문자(U+FFFD)로 변환되는데 배너가 손실 여부를 알리지 않음 — FileContent에 손실 플래그 추가 여부(계약 변경, 문서 선행) (→ file-lifecycle.md#인코딩-정책 · rust-commands.md)
자동 저장 maxWait   순수 디바운스라 연속 타이핑 중에는 자동 저장이 무기한 연기됨 — 상한(예: 30초) 도입 여부. 정책 변경이므로 문서 선행 (→ file-lifecycle.md#자동-저장)
트리 외부 변경    사이드바 트리의 외부 생성/삭제 반영 방식 — M5 (→ document-model.md)
프리뷰 상대 경로 링크  `#앵커` 이동은 M4에서 확정·구현한다(→ preview-strategy.md#링크-정책). 남은 것은 **상대 경로로 다른 .md를 여는 것** — 허용 루트 밖 경로 차단·이미 열린 탭 전환·미저장 문서의 기준 디렉터리 부재를 함께 풀어야 하므로 별도 결정이다 (→ security.md#4-외부-링크 · rust-commands.md)
프리뷰 코드면 토큰 프리뷰 코드 블록 배경에 전용 토큰이 없어 상태 배경(bg.hover)을 빌려 쓴다 — bg.canvas는 유리에서 투명해져 못 쓴다. 종이 위 "옅게 눌린 면"(bg.inset류) 토큰을 디자인 시스템에 추가할지 — M6 (→ design/design-system.md · design/decisions/0001-surface-role-and-material.md)
프리뷰 렌더 후속   적응형 디바운스가 문자열 렌더만 측정(DOM 반영 비용 제외)·탭 전환은 동기 렌더 — 측정 확장·탭별 캐시·증분 렌더 도입 여부 (→ preview-strategy.md#디바운스)
번들 크기 임계값  앱 번들 15MB 예산 확정. 프론트엔드 dist 하드 임계값 도입 여부는 열림 (→ platform-strategy.md)
i18n 도입         현재 미도입(UI 문자열은 shared/config 상수). 다국어 필요 시 도입 (→ frontend-architecture.md)
```

## 성공 기준 (상시 게이트)

마일스톤과 무관하게 항상 통과해야 하는 기본 기준이다(M0에서 확립). 마일스톤별 세부 성공 기준은 위 [마일스톤](#마일스톤) 표의 "핵심 산출물" 열이 단일 출처다 — 이 절은 단계마다 갱신하지 않는다.

```text
mise install        툴체인 세팅 성공
mise run dev        창이 뜨고 마크다운 편집·하이라이팅 동작
mise run check      포맷·타입·테스트·린트·docs-drift 통과
mise run e2e        실앱 E2E 시나리오 통과
```
