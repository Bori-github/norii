# 파일 생명주기 정책

로컬 `.md` 파일을 다루는 규칙의 단일 출처다. 데이터 유실 방지가 최우선이다.

norii는 파일을 유일한 진실로 두므로, 저장·감시·인코딩·외부 변경 처리가 앱 신뢰도를 직접 좌우한다.

## 정책 표

| 항목 | 정책 |
|---|---|
| Dirty 추적 | CM6 `docChanged`로 감지. 탭에 ● 표시(→ [문서 모델](document-model.md)). |
| 미저장 종료 방어 | Tauri `onCloseRequested`로 저장 확인 다이얼로그. **데이터 유실 방지 최우선.** |
| 자동 저장 | 초기 off (수동 `Cmd+S`). 옵션 제공 여부는 열린 결정(→ [실제 구현 계획](implementation-plan.md)). |
| 외부 변경 감지 | Rust 파일 watch로 외부 수정 시 리로드/충돌 안내(→ [Rust 커맨드 계약](rust-commands.md)). |
| 인코딩 | UTF-8 확정. BOM 처리. |
| 개행 | 파일의 기존 EOL 유지(LF/CRLF). Windows 대응 시 중요(→ [플랫폼 전략](platform-strategy.md)). |

## 미저장 종료 방어

창을 닫거나 앱을 종료할 때 dirty 탭이 있으면 저장 확인 다이얼로그를 띄운다. 이 방어가 없으면 데이터 유실로 직결되므로, [실제 구현 계획](implementation-plan.md)의 코어 편집 단계(M1)에 반드시 포함한다.

## 외부 변경 처리

Rust watch가 `file-changed`/`file-removed` 이벤트를 보낸다(→ [Rust 커맨드 계약](rust-commands.md#이벤트-계약-rust--웹뷰)). 프론트 처리:

```text
file-changed (해당 탭이 dirty 아님):  조용히 리로드
file-changed (해당 탭이 dirty):       충돌 안내 — 디스크 버전 vs 편집 버전 선택
file-removed:                         탭에 표시, 저장 시 새로 생성 선택
```

Obsidian도 외부 변경 처리에서 골치를 앓는 영역이므로, 충돌 정책을 초기에 단순하고 명확하게 정한다.

## 앱 상태는 `.md`에 넣지 않는다

세션 복원·접힘 상태 같은 UI 상태는 `.md` 본문이 아니라 앱 config/사이드카에 저장한다. `.md`에 메타데이터를 섞으면 파일이 지저분해지고 다른 에디터 호환이 깨진다. 이 경계는 [비목표](../rules/non-goals.md#접힘-상태-영속화의-경계)를 단일 출처로 둔다.
