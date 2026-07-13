# 프론트엔드 아키텍처 (FSD)

norii의 웹뷰 프론트엔드(`apps/desktop/src`)는 **Feature-Sliced Design(FSD)** 을 따른다. 이 문서는 그 레이어·슬라이스·경계 규칙의 단일 출처이며, [FSD 공식 스펙](https://feature-sliced.design)을 기준으로 한다.

설계 의도는 **기능을 세로로(레이어) 자르고 도메인으로(슬라이스) 나눠, 의존 방향을 단방향으로 고정**하는 것이다. 이러면 한 기능을 고칠 때 영향 범위가 슬라이스 안으로 갇히고, 큰 앱으로 커져도 책임 경계가 흐려지지 않는다.

## 레이어와 참조 방향

FSD 레이어는 책임이 큰 순서로 배열되며, **한 슬라이스의 모듈은 자기보다 엄격히 아래 레이어의 슬라이스만 import**할 수 있다. `app`과 `shared`는 예외로, 레이어이자 슬라이스처럼 동작해 내부 세그먼트끼리 자유롭게 참조한다(FSD 공식 규칙).

```
app → pages → widgets → features → entities → shared
```

> `processes` 레이어는 FSD에서 **deprecated**다. norii는 쓰지 않는다(다중 페이지 흐름은 `features`나 `app`으로 흡수).

| 레이어 | 책임 (FSD 정의) | norii 슬라이스(예정) |
|---|---|---|
| `app/` | 앱 전역 관심사 — Provider·전역 스토어·전역 스타일·부트스트랩 | `providers/`, `layouts/`, Tauri 초기화(window·menu·IPC), `index.css`, 테마 **적용**(data-theme 심기 — 상태는 entities가 소유) |
| `pages/` | 화면(스크린) 단위 조합. 데이터 페칭·에러 바운더리 포함 가능 | `editor/`(메인 워크스페이스), `settings/`(후) |
| `widgets/` | 독립적으로 완결된 큰 UI 블록 (여러 곳에서 재사용되거나 페이지가 여러 독립 블록으로 구성될 때) | `sidebar/`(파일 트리), `tab-bar/`, `editor-pane/`, `preview-pane/`, `status-bar/` |
| `features/` | 비즈니스 가치를 가진 사용자 상호작용 (여러 페이지에서 재사용되는 게 좋은 지표) | `open-file/`, `save-file/`, `tab-management/`, `toggle-fold/`, `scroll-sync/`, `switch-theme/`, `reload-on-external-change/` |
| `entities/` | 실세계 비즈니스 개념 — 데이터 모델·스키마·API·표현 | `document/`(탭·dirty 상태), `theme/`(테마 의도·해석), `file-tree/`, `workspace/`, `settings/` |
| `shared/` | 외부 시스템·라이브러리·환경과의 연결 기반. **슬라이스 없음, 세그먼트만** | `ipc/`(Tauri 커맨드 래퍼), `ui/`, `lib/`, `config/`, `types/` |

## 슬라이스와 세그먼트

- **슬라이스**: 비즈니스 의미로 코드를 묶는 2단계(예: `document`, `open-file`). `app`·`shared`에는 슬라이스가 없다.
- **세그먼트**: 슬라이스 안을 기술적 성격으로 나누는 3단계. FSD 표준 세그먼트를 쓴다.

```
<slice>/
├─ ui/       인터페이스 컴포넌트·포매터·스타일
├─ model/    데이터 스키마·스토어·비즈니스 로직
├─ api/      백엔드/외부 통신 — 요청·타입·매퍼 (norii에선 주로 shared/ipc 경유)
├─ lib/      슬라이스 국소 유틸
├─ config/   설정·기능 플래그
└─ index.ts  ← Public API (배럴). 외부는 여기만 import
```

## 저수준 결합 규칙 (Low Coupling)

FSD의 핵심 불변식이다.

- **같은 레이어의 다른 슬라이스를 직접 참조하지 않는다.** `features/open-file`이 `features/save-file`을 직접 import하는 것은 금지. 공통이 필요하면 아래 레이어(`entities`/`shared`)로 내린다.
- **참조는 단방향**이다. `features`는 `entities`·`shared`만, `entities`는 `shared`만 import한다. 역방향(`entities`가 `features`를 참조 등)은 금지.
- **외부는 슬라이스의 Public API(`index.ts`)로만 접근**한다. 슬라이스 내부 파일을 우회 import하지 않는다.

## Public API (배럴 규칙)

- 각 슬라이스는 `index.ts`로 **의도한 것만** 노출한다. 내부 구현은 감춘다.
- 슬라이스 경계를 넘는 import는 절대경로/별칭(아래)을 쓰고, 슬라이스 내부에서만 상대경로를 쓴다.

## 경로 별칭 (Path Alias)

레이어별 별칭을 `apps/desktop/tsconfig.app.json`의 `paths`에 정의하고, 번들러에는 `vite-tsconfig-paths`로 반영한다.

```jsonc
"paths": {
  "@app/*":      ["./src/app/*"],
  "@pages/*":    ["./src/pages/*"],
  "@widgets/*":  ["./src/widgets/*"],
  "@features/*": ["./src/features/*"],
  "@entities/*": ["./src/entities/*"],
  "@shared/*":   ["./src/shared/*"]
}
```

## 모노레포 패키지와의 관계

`packages/{editor,markdown,ui}`는 **플랫폼 중립 재사용 building block**이다(향후 모바일 재사용 목적 — [파일/폴더 구조](project-structure.md), [플랫폼 전략](platform-strategy.md)). FSD 관점에서 이들은 **레이어 계층 밖의 외부 라이브러리**(npm 의존성과 동급)이므로, 앱의 적절한 슬라이스가 소비한다.

```text
packages/editor   (CM6 래퍼)        → widgets/editor-pane 가 소비
packages/markdown (md-it + sanitize) → widgets/preview-pane 가 소비
packages/ui       (공용 프리미티브)  → shared/ui 가 래핑·재노출
```

원칙: 외부 라이브러리는 가능한 한 **해당 관심사를 가진 슬라이스 안에서** 감싼다. `packages/*`의 세부 API가 앱 전역에 새지 않게 한다.

## 스타일 · 디자인 시스템

스타일은 **Panda CSS**로 작성하고, 디자인 시스템을 프로젝트 내부에 구축한다. 토큰은 `panda.config.ts`(단일 출처), 디자인 시스템 컴포넌트는 `shared/ui`(recipe로 구성)에 둔다. 상위 레이어는 `shared/ui` 컴포넌트를 소비하고 직접 스타일을 최소화한다. 상세는 [디자인 시스템](design/design-system.md)을 단일 출처로 둔다.

**테마 상태는 `entities/theme`이 소유한다.** 앱 전역 관심사처럼 보이지만 실은 **사용자가 바꾸는 도메인 상태**이며(탭·문서와 다르지 않다), `features/switch-theme`이 그것을 바꾸고 `app`이 읽어 루트에 `data-theme`을 심는다. `app`이 소유하면 토글 UI(`features`)가 상위 레이어를 참조하게 되어 **의존 방향을 거스른다** — Steiger가 이를 막는다. 설정 화면이 생기면 `pages/settings` → `features/switch-theme` → `entities/theme`으로 같은 방향을 탄다.

## UI 문자열과 i18n (현재 미도입)

norii는 macOS 우선의 단독 사용자 앱이고 초기 UI 문자열이 적어, **i18n 라이브러리는 지금 도입하지 않는다**(YAGNI). 다만 나중에 다국어가 필요해지면 교체가 쉽도록, **UI에 표시되는 문자열을 컴포넌트에 흩뿌리지 않고 한곳에 모으는 규칙**을 지금부터 지킨다.

- 사용자에게 보이는 문자열(메뉴·버튼·상태 메시지·에러 문구)은 **`shared/config`의 상수**로 모은다. JSX에 리터럴을 직접 쓰지 않는다.
- 이러면 훗날 i18n 라이브러리(예: `react-i18next`)를 붙일 때, 상수 모듈을 로케일 리소스로 바꾸기만 하면 되고 컴포넌트는 거의 손대지 않는다.
- i18n 정식 도입 여부·시점은 [열린 결정](implementation-plan.md#열린-결정-open-decisions)에서 추적한다.

## Tauri IPC의 자리

Rust 커맨드 호출(`invoke`)은 **`shared/ipc`** 에 모은다. FSD에서 `shared`는 "외부 시스템과의 연결 기반"이라, Tauri IPC가 정확히 여기 해당한다.

- `entities`/`features`는 `shared/ipc`의 함수를 부르고, 컴포넌트 곳곳에서 `invoke`를 직접 흩뿌리지 않는다.
- 이는 [아키텍처](architecture.md)의 "웹뷰는 파일시스템을 `invoke`로만 만진다" 경계와, [Rust 커맨드 계약](rust-commands.md)을 프론트에서 단일 진입점으로 감싸는 것이다.

## 배치 결정 가이드

새 코드를 어디에 둘지 헷갈릴 때:

1. **도메인 지식이 없는 순수 유틸/프리미티브인가?** → `shared`.
2. **비즈니스 개념(문서·파일트리·워크스페이스)의 모델·상태인가?** → `entities`.
3. **사용자 행동 하나에 대응하는가?** (열기·저장·접기·스크롤 동기) → `features`.
4. **여러 feature/entity를 조합한 완결 UI 블록인가?** (사이드바·프리뷰 패널) → `widgets`.
5. **화면 전체 조합인가?** → `pages`.
6. **앱 전역 설정·Provider·부트스트랩인가?** → `app`.

애매하면 **더 낮은 레이어**에서 시작하고 필요할 때 끌어올린다.

## 강제 (Enforcement)

FSD 위반은 **Steiger**(FSD 팀의 공식 아키텍처 린터)로 잡는다. norii는 oxlint(ESLint 아님)를 쓰므로 `eslint-plugin` 계열 대신 독립 실행형 Steiger를 쓴다. 도구·게이트 연결은 [코드 품질 전략](code-quality.md#fsd-아키텍처-린트-steiger)을 단일 출처로 둔다.

```bash
mise run fsd-lint    # steiger — 레이어 참조 방향·Public API·구조 검증
```

`mise run check` 게이트에 포함된다.
