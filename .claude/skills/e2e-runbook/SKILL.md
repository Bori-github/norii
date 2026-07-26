---
name: e2e-runbook
description: "실앱 E2E(tauri-plugin-webdriver) 런북. 작성: 새 사용자 표면의 E2E 시나리오(순서+함정 체크리스트) · 실행: `mise run dev-webdriver` → `mise run e2e` · 수정: DOM 리팩터링으로 깨진 selector · 검증: PR에 E2E 결과값 적기 전. '새 표면 E2E 추가', 'E2E 시나리오 작성', 'dev-webdriver 붙이기', 'E2E selector 깨짐', 'PR 전 E2E 실행' 류 요청에 트리거. 규칙·근거는 다시 정의하지 않고 testing.md를 단일 출처로 링크한다."
---

실앱 E2E를 작성·실행할 때의 **순서와 점검 항목만** 소유한다. 방법론·환경·성숙도 한계 등 사실의 단일 출처는 [테스트 전략](../../docs/testing.md), 명령의 단일 출처는 [개발 명령](../../docs/development-commands.md)이다. 이 스킬은 그 둘을 실행할 뿐 규칙을 다시 정의하지 않는다 — 플러그인 버전·플랫폼에 묶인 한계는 링크가 소유하므로, 여기서 "무엇을 할지"만 읽고 "왜/한계"는 링크에서 확인한다.

이 스킬은 **norii 저장소의 프로젝트 스코프 전용**이다. 아래 상대 링크는 저장소 루트 기준이라 사용자 스코프(`~/.claude/skills/`)로 옮기면 깨진다.

## 언제 도는가

- 표면이 **위험 영역(한글 IME·데이터 유실 방지)** 에 닿을 때 — 실앱 E2E는 선택이 아니라 필수다. 무엇이 위험 영역인지는 [testing.md#위험-영역은-실제-앱으로-검증-핵심](../../docs/testing.md)가 정한다.
- 새 사용자 표면을 만들 때 — 실앱 E2E 시나리오를 **같은 변경 단위에서 함께** 낸다(→ [testing.md#위험-영역은-실제-앱으로-검증-핵심](../../docs/testing.md)).
- DOM 구조를 바꾸는 리팩터링(태그·`role` 교체) — selector 동반 수정이 같은 변경에 들어간다.
- PR 검증을 적기 전 — E2E를 **실제로 돌려** 값으로 적는다(아래 §실행).

## 실행

앱을 띄우고 붙인다. 두 명령은 별도 터미널/백그라운드로:

```bash
mise run dev-webdriver &   # webdriver 피처 개발 빌드 — 임베디드 WebDriver가 127.0.0.1:4445에 기동
mise run e2e               # webdriverio가 그 앱에 붙어 시나리오 실행
```

`dev`와 `dev-webdriver`는 동시에 띄울 수 있다(각자 빈 포트 1420~ / 1520~). 데모 녹화가 필요하면 `mise run e2e` 대신 `mise run demo`(내부에서 E2E를 돌리며 녹화). 세부는 [development-commands.md](../../docs/development-commands.md).

네이티브 층(창 버튼 정렬·드래그 불변식·전체화면 클릭)은 `mise run verify-native`가 실제 입력으로 검증한다. **frontmost가 필요하므로 실행 전 사용자에게 알리고** 화면을 비워둘 수 있게 한 뒤 돌린다 — 실행 중 마우스·키보드·창을 건드리면 좌표가 어긋나 실패한다(→ [testing.md#성숙도-주의](../../docs/testing.md)).

## 시나리오 작성 — 지킬 것

작성 중 아래를 지킨다. 각 항목의 **이유는 링크가 소유**하며, 여기서는 무엇을 할지만 정한다.

- [ ] **정상 케이스만 담지 않는다 — 실패 공간을 먼저 열거하고 시나리오를 도출한다**(→ [testing.md#실패-경로를-먼저-열거한다](../../docs/testing.md)).
- [ ] **트리거는 WebDriver 키 액션으로 만들지 않는다** — UI 클릭이나 `browser.execute`로 만든다. 단축키도 `browser.execute`로 합성 `KeyboardEvent`를 디스패치해 핸들러 층까지 고정한다. 방법·현재 한계는 [testing.md#성숙도-주의](../../docs/testing.md)가 소유한다.
- [ ] **텍스트 입력 방식은 [testing.md#성숙도-주의](../../docs/testing.md)를 따른다**(현재 검증된 방법: `element.addValue()`).
- [ ] **selector는 이름 텍스트로 잡는다**(예: `span=이름`) — 근거는 [testing.md#위험-영역은-실제-앱으로-검증-핵심](../../docs/testing.md)가 소유한다.
- [ ] **파일을 다루는 시나리오는 E2E 스코프 루트(`NORII_E2E_SCOPE_ROOT`, dev-webdriver가 설정) 안에서만 논다.** 임의 경로를 쓰지 않는다.
- [ ] **자동화 장벽을 만나면 먼저 훅을 본다.** 네이티브 다이얼로그 등은 "자동화 불가"로 분류하기 전에 E2E 훅(`apps/desktop/src/app/lib/expose-e2e-api.ts`, `window.noriiE2e`)으로 우회 가능한지 확인한다 — 파일·폴더 열기가 이미 이 방식이다(→ [testing.md#위험-영역은-실제-앱으로-검증-핵심](../../docs/testing.md), 예: `apps/desktop/e2e/file-lifecycle.e2e.ts`).
- [ ] **계약을 집행하는 E2E는 그 문서 섹션을 주석으로 인용한다**(예: `// 집행: <문서>#<섹션>`) — 동작을 바꾸면 게이트에서 잡히게(→ [testing.md#테스트는-스스로를-설명한다](../../docs/testing.md)).

## 작성 후 확인

- [ ] **타이밍에 좌우되는 시나리오는 반복 실행으로 검증한다**(실패까지 N회 반복, 실패 출력 보존). 한 번 통과는 증거가 아니다(→ [testing.md#타이밍-기반-테스트는-반복-실행으로-검증한다](../../docs/testing.md)).

## PR 검증에 적을 때

- **사용자에게 보이는 동작이 바뀐 PR이면 E2E를 돌려 값으로 적는다**(예: `13/13`). "mac 실기 항목이라 N/A"로 넘겨짚지 않는다 — E2E가 도는 환경인지 불확실하면 돌려서 확인한다. (실측 교훈: N/A로 넘겼다가 DOM 리팩터링이 깬 selector 3건을 놓칠 뻔함.)
- **번들 크기는 N/A가 맞다** — 빌드 산출물이 필요해 `mise run check`에 없고 자동 실행되지 않는다.

## 정말 자동화가 불가한 것

훅으로도 우회되지 않는 것(실제 OS 키가 핸들러로 라우팅되는지·유리 투과 등)만 수동 검증으로 남기고, **그 사유와 검증 방법을 PR·문서에 적는다**(→ [작업 규칙 — 품질 게이트](../../rules/project-rules.md)). 재현이 어렵다는 이유로 목록에서 빼지 않는다.
