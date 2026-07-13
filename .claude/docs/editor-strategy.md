# 에디터 전략 (CodeMirror 6 · 하이브리드 접기)

norii의 편집기는 CodeMirror 6 기반 소스 뷰다. 이 문서는 확장 구성과 하이브리드 접기(폴딩)의 단일 출처다.

설계 의도는 **"아웃라이너를 흉내내되, 그 구조를 파일이 아니라 에디터의 표현 계층에만 둔다"** 는 것이다. 접기는 `.md`를 바꾸지 않는다. 이 원칙이 로컬 파일 순수성을 지킨다(→ [비목표](../rules/non-goals.md)).

## 확장 구성 (초기)

```text
@codemirror/state, view      에디터 코어 (상태·뷰)
@codemirror/lang-markdown    마크다운 하이라이팅 + 폴딩용 Lezer 파서 (내장)
@codemirror/language         폴딩(foldService)·들여쓰기·구문 트리 유틸
@codemirror/commands         히스토리(undo/redo)·기본 키맵
@codemirror/search           문서 내 검색
@codemirror/autocomplete     자동완성 (필요 시)
커스텀 키맵                  저장·탭 전환 등 (OS별 modifier 분기)
라인 래핑·활성 줄·브래킷 매칭  view 확장
테마                         Panda 디자인 토큰을 CM6 테마에 주입 (앱과 단일 소스)
```

에디터 테마는 앱과 **같은 디자인 토큰**을 쓴다. Panda가 생성한 토큰 값을 CM6 테마 객체에 주입해 UI·에디터가 하나의 출처를 공유한다(→ [디자인 시스템](design/design-system.md#테마-라이트다크)).

버전은 [기술 스택](tech-stack.md)을 단일 출처로 둔다. 폴딩용 **별도 파서는 필요 없다** — `@codemirror/lang-markdown`이 만드는 구문 트리를 재사용한다. 다만 헤딩-섹션 접기는 lang-markdown에 기본 내장이 아니므로, `@codemirror/language`의 fold 인프라(`foldService`)에 **헤딩 접기 로직을 직접 등록**해 구현한다(→ [기술 스택](tech-stack.md#왜-에디터는-codemirror-6인가)).

## 단축키 계약

앱 전역(파일·탭)과 에디터 내부(검색·접기·히스토리) 단축키의 단일 출처다. mac은 `Cmd`, Windows/Linux는 `Ctrl`로 분기한다(→ [플랫폼 전략](platform-strategy.md#플랫폼-차이-체크포인트)).

| 동작 | mac | Windows/Linux | 구현 |
|---|---|---|---|
| 저장 | `Cmd+S` | `Ctrl+S` | 커스텀 키맵 |
| 다른 이름으로 저장 | `Cmd+Shift+S` | `Ctrl+Shift+S` | 커스텀 키맵 |
| 새 문서 | `Cmd+N` | `Ctrl+N` | 커스텀 키맵 |
| 파일 열기 | `Cmd+O` | `Ctrl+O` | 커스텀 키맵 |
| 탭 닫기 | `Cmd+W` | `Ctrl+W` | 커스텀 키맵 |
| 다음/이전 탭 | `Ctrl+Tab` / `Ctrl+Shift+Tab` | 동일 | 커스텀 키맵 |
| 문서 내 검색 | `Cmd+F` | `Ctrl+F` | `@codemirror/search` 기본 |
| 접기/펼치기 | `Cmd+Alt+[` / `Cmd+Alt+]` | `Ctrl+Shift+[` / `Ctrl+Shift+]` | CM6 기본 `foldKeymap` |
| undo/redo | `Cmd+Z` / `Cmd+Shift+Z` | `Ctrl+Z` / `Ctrl+Y` | CM6 기본 `historyKeymap` |

CM6가 기본 제공하는 키맵(fold·history·search)은 그대로 채택하고, 앱 전역 동작만 커스텀 키맵으로 추가한다. 표에 없는 단축키를 추가할 때는 이 표를 먼저 갱신한다. 저장(`Cmd+S`)은 자동 저장의 디바운스를 기다리지 않는 **즉시 저장**이다(→ [파일 생명주기 정책 — 자동 저장](file-lifecycle.md#자동-저장)).

## 하이브리드 접기 (아웃라이너 대체)

Obsidian·Logseq의 접기 **동작·UX만 참고**하고 CM6로 독립 구현한다(비공개/AGPL이므로 코드를 가져오지 않는다 — clean-room 규칙은 [참고 사례](../rules/prior-art.md)를 단일 출처로 둔다). 접기는 순전히 **에디터 표현(view)** 이며 파일 내용을 건드리지 않는다. 세 방식 모두 `.md`를 깨끗하게 유지한다.

```text
1단계: 헤딩 접기       #, ## 아래를 접음. 구문 트리 기반 커스텀 foldService로 구현(별도 파서 불필요, fold 로직은 작성).
2단계: 리스트 접기     불릿 들여쓰기 계층을 접음. 들여쓰기 기반 fold 로직 추가.
선택:  <details> 태그  프리뷰에서 네이티브 토글로 렌더 (markdown-it 통과).
```

구현 순서는 [실제 구현 계획](implementation-plan.md)을 따른다. 1단계(헤딩 접기)를 먼저, 2단계(리스트 접기)를 나중에 둔다.

## 접힘 상태 영속화

- **초기: 저장하지 않는다.** 열 때마다 펼친 상태로 시작한다. 접힘 상태를 아무 데도 쓰지 않으므로 `.md`를 건드리지 않는다.
- **필요해지면:** 접힘 상태는 UI 상태이므로 `.md`가 **아니라** 사이드카 config(예: `.norii/foldstate.json`)에 저장한다. 본문에 절대 기록하지 않는다. 경계 근거는 [비목표](../rules/non-goals.md#접힘-상태-영속화의-경계).

## 성능 원칙

- 커스텀 데코레이션(하이라이트·폴드 표시)은 **뷰포트 범위에만** 적용한다. 전체 문서에 적용하면 대용량에서 느려진다.
- CM6 증분 파서·가상화를 신뢰한다. 대용량 문서(수만 줄) 스크롤 성능은 회귀 검증 대상으로 둔다(방법·환경은 → [테스트 전략](testing.md)).

## 한글 IME

소스 뷰는 WYSIWYG보다 IME에 안전하지만, 커스텀 키맵·자동완성이 조합(composition) 이벤트와 충돌할 수 있다.

- **한글 입력은 실제 WKWebView에서 자동 테스트**한다(에뮬레이션 DOM으로는 조합 이벤트를 못 잡음). 위험 영역이라 실제 앱 E2E로 끝단까지 검증한다(→ [테스트 전략](testing.md#위험-영역은-실제-앱으로-검증-핵심)).
- 조합 중인 글자에 키맵/자동완성이 잘못 발동하지 않는지 확인한다.

## 에디터 계층 경계

에디터 로직은 `packages/editor`에 두고 플랫폼 중립을 유지한다. 파일시스템·Tauri를 알지 않는다(→ [파일/폴더 구조](project-structure.md)). 이렇게 두면 향후 모바일에서도 그대로 재사용한다(→ [플랫폼 전략](platform-strategy.md)).
