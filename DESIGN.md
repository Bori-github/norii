# norii 디자인

지켜야 할 규칙만 담는다. 왜 그렇게 정했는지는 [결정 기록](.claude/docs/design/decisions/README.md)이, 색·크기의 실제 값은 `apps/desktop/panda.config.ts`가 갖는다.

## 1. 재질

> **OS 유리(창 뒤 흐림)는 "창 가장자리에 닿아 있고, 그 뒤가 바탕화면인 표면"에만 쓴다. 그 외에는 전부 불투명하다.**

**하지 않는다**

- 글이 놓이는 면을 반투명하게 만들지 않는다.
- 크롬에 흐린 글자를 쓰지 않는다.

표면별 재질은 아래 표가 정한다(→ [표면](.claude/docs/design/decisions/surface.md)).

| 표면                                     | 역할    | 재질         |
| ---------------------------------------- | ------- | ------------ |
| 타이틀 스트립 · 탭바 · 상태바 · 사이드바 | chrome  | **os-glass** |
| 활성 탭                                  | chrome  | **opaque**   |
| 편집면 · 프리뷰면                        | content | **opaque**   |
| 검색 패널 · 프리뷰 구분선 · 거터         | chrome  | **opaque**   |
| 뷰 모드 전환 바                          | chrome  | **opaque**   |
| 다이얼로그 · 커맨드 팔레트               | overlay | **opaque**   |
| 딤 스크림                                | overlay | **scrim**    |
| 배너(알림 · 충돌)                        | chrome  | **opaque**   |

**한다**

- 활성/비활성은 배경으로 가른다.
- 표면 토큰은 [디자인 시스템](.claude/docs/design/design-system.md#표면-토큰)이 정의한 이름을 쓴다.

## 2. 색

근거는 [컬러 팔레트](.claude/docs/design/decisions/color-palette.md)가 갖는다.

**한다**

- 액센트는 채운 면에만 쓴다 — 선택 영역 · 검색 결과 · 활성 탭 · 배지 · 강조 버튼.
- 액센트 면 위의 글자는 `accent.fg`로 둔다 — 테마 공통이다.
- 라이트 테마에서 액센트 면에 `accent.fg` 1px 테두리를 둔다.
- 커서 · 포커스 링 · dirty 점 · 강조 테두리는 `text`로 그린다.
- 링크 · 강조 텍스트는 `text`에 밑줄로 표시한다.
- 상태색(정보 · 성공 · 경고 · 위험)은 표시에만 쓴다.
- 비활성은 액센트를 회수해 표시한다.

**하지 않는다**

- 액센트를 글자색으로 쓰지 않는다.
- 액센트를 커서 · 포커스 링 · dirty 점에 쓰지 않는다.
- 유리 크롬 위에 가는 표시를 두지 않는다. 채운 면만 올린다.
- 한 화면에 액센트 면을 둘 이상 두지 않는다.
- 액센트와 상태색을 한 요소에 같이 쓰지 않는다.
- 무채색과 유리 틴트에 색을 넣지 않는다(→ [유리](.claude/docs/design/decisions/glass.md)).

## 3. 타이포

근거는 [타이포](.claude/docs/design/decisions/typography.md)가 갖는다.

**한다**

- 열 정렬이 의미를 갖는 구간에서 고정폭을 쓴다 — 코드블록 · 표 · 들여쓰기.
- 고정 크기는 UI와 프리뷰 본문에만 쓴다.
- 프리뷰 안의 글자는 본문에 대한 배수로 둔다.
- 행간은 역할별로 짓는다 — ui · heading · editor · prose.
- 폰트 스택과 행간은 한글 본문에서 먼저 검증한다.

**하지 않는다**

- 본문에 고정폭을 쓰지 않는다.
- 한글 전용 폰트를 싣지 않는다 — 한글 낀 표·코드는 소스에서 정렬되지 않는다.
- 크롬·다이얼로그에 시스템 sans 외의 폰트를 쓰지 않는다.

## 4. 접근성

기준의 정의와 계산은 [대비 게이트](.claude/docs/design/design-system.md#대비-게이트)가 갖는다.

**한다**

- 본문 텍스트는 **AA(4.5:1)** 를 넘긴다.
- 액센트 면 위의 글자는 hover · pressed에서도 **AA** 를 넘긴다.
- 라이트 테마의 액센트 면은 **비텍스트 3:1** 을 테두리로 만족한다.
- 크롬 글자는 임의의 바탕화면 위에서 **AA** 를 넘긴다 — 이 조건이 유리 틴트 알파의 기본값을 정한다.
- 포커스 링은 종이 위에서만 쓴다. 유리 위에서는 배경으로 표시한다.
- `prefers-reduced-motion`을 존중한다.

**하지 않는다**

- 사용자가 유리 불투명도를 기본값 아래로 내린 상태를 보장하지 않는다.

투명도 줄이기 요청의 처리 경로는 [열린 결정](.claude/docs/implementation-plan.md#열린-결정-open-decisions)이 추적한다.

## 5. 모션 · 간격 · 모서리

**한다**

- 모션은 상태 변화를 설명하는 것만 둔다 — 탭 전환 · 배너 등장 · 다이얼로그 진입.
- 간격은 4px 기준으로 촘촘하게 둔다.
- 모서리는 작게 둔다. 창 모서리는 OS가 그린다.

**하지 않는다**

- 장식적 모션을 두지 않는다.
- 스크롤하는 면 위에 흐림을 겹치지 않는다(→ [작업 규칙 · 성능](.claude/rules/project-rules.md#성능-규칙)).

## 6. 문서 지도

```text
/DESIGN.md                           지켜야 할 규칙 (이 문서)
.claude/docs/design/decisions/       왜 그렇게 정했는가 — 주제 1개 = 파일 1개
.claude/docs/design/design-system.md Panda로 어떻게 구현하는가 (계약)
.claude/docs/design/window-chrome.md 창 설정의 실제 값 (계약)
apps/desktop/panda.config.ts         값 — 팔레트·스케일의 실제 숫자
```

미결정 사항은 [실제 구현 계획](.claude/docs/implementation-plan.md#열린-결정-open-decisions)의 열린 결정이 추적한다.
