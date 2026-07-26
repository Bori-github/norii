# 한글 IME

norii의 한글 입력 동작과 그 검증 방법의 단일 출처다. 에디터 전체 전략은 [에디터 전략](editor-strategy.md)이, 위험 영역의 검증 층 구분은 [테스트 전략](testing.md)이 소유한다.

## 이 웹뷰에서 한글 입력이 도는 모습

macOS 한국어 2벌식으로 `한`을 치면 앱 웹뷰(WKWebView)에 다음이 온다. 손 타이핑과 CGEvent 주입에서 같은 시퀀스를 확인했다.

```text
keydown(keyCode 229, key=ㅎ) → compositionstart/update → beforeinput/input(insertCompositionText)
… 자모마다 반복하며 앞 글자를 교체 …
input(insertFromComposition) → compositionend(data="한")
```

`isComposing`은 조합 중 `keydown`에서 `false`로 온다. 조합 여부를 이 값으로 판단할 수 없다.

같은 입력이 **조합 없이** 자모 그대로 들어가는 상태도 있다(`ㅎㅏㄴ`). 입력 소스를 프로그램(`TISSelectInputSource`)으로 바꾸면 그 상태가 되며, 사람이 한/영으로 다시 전환하면 돌아온다. 자동 검증에서 입력 소스를 바꾸지 않는 이유다.

## 조합 확정 Enter가 개행을 두 개 만든다

조합 중인 음절이 있는 상태에서 Enter를 한 번 누르면 문서에 개행이 **두 개** 들어간다.

```text
"한" 입력 후 Enter 1회 → ["한", "", ""]      기대: ["한", ""]
```

커서는 첫 개행 뒤에 놓이고 남는 빈 줄은 그 아래라, 화면으로는 개행 하나처럼 보인다. 저장되는 `.md`에는 빈 줄이 하나 더 들어가고, 마크다운에서 빈 줄은 문단 분리이므로 프리뷰 결과가 달라진다.

### 어디서 오는가

측정한 순서는 이렇다.

1. `compositionend` 20ms 뒤 `keydown Enter`가 온다.
2. CM6는 조합 직후(100ms 이내)의 키를 무시한다 — Safari에서 조합 확정 키가 `compositionend` 뒤에 오는 것을 감안한 처리다(`@codemirror/view` `ignoreDuringComposition`). 그래서 키맵이 돌지 않고 `defaultPrevented`도 `false`로 남는다.
3. 브라우저 기본 동작이 편집면에 직접 쓴다. `white-space: pre-wrap` 편집면에서 WebKit은 개행 문자를 **둘** 넣는다.

   ```html
   <div class="cm-line cm-activeLine">한

   </div>
   ```

4. CM6의 DOM 읽기가 그 둘을 그대로 옮긴다 — 문서를 바꾼 트랜잭션은 한 건이고 내용이 `insert: "\n\n"`이다.

확장을 하나도 켜지 않은 CM6에서도 같고, 같은 웹뷰의 평범한 `contenteditable`은 개행 하나만 넣는다(블록으로 들어가므로 여분 개행이 붙지 않는다).

업스트림에 같은 증상이 [codemirror/dev#1403](https://code.haverbeke.berlin/codemirror/dev/issues/1403)으로 열려 있다(2024-07-08, 미해결). 유지보수자는 재현하지 못했고, 보고자는 "조합 밑줄이 보일 때만" 난다고 적었다 — 위의 조합 경로가 걸린 상태를 말한다.

### norii의 대응

조합 종료 후 100ms 안에 도착한 Enter는 편집기가 직접 처리한다 — 기본 동작을 막고 줄바꿈을 하나만 넣는다. 창을 벗어난 Enter는 건드리지 않으므로 평소 경로는 그대로다.

범위 밖: 조합 확정 전용 Enter를 개행 없이 삼키는 것(일본어·중국어 변환 확정). 이 맥에 해당 입력기가 없어 확인하지 못했다.

## 검증

| 층 | 무엇을 고정하는가 |
|---|---|
| 브라우저 모드 테스트(실제 WebKit) | 조합 종료 직후 Enter를 편집기가 처리해 개행이 하나만 들어가는 것. 합성 이벤트라 실제 IME는 아니다. CI에서 돈다. |
| 실키 검증(`verify-native`) | 실제 한국어 IME로 친 결과 — 편집기의 조합 확정 Enter와 사이드바의 한글 이름 짓기. 앱을 최상위로 세우고 CGEvent로 키를 보낸다 — 로컬 전용이다. |

실키 검증의 전제와 금지 사항:

- **입력 소스를 바꾸지 않는다.** 실행하는 사람이 한국어 입력 상태로 둔 채 시작한다. 프로그램 전환은 조합을 꺼뜨리고 시스템 입력기 상태를 망가뜨린다.
- 측정 전에 프로브 음절이 실제로 합쳐지는지 확인하고, 합쳐지지 않으면 그 시행을 버린다.
- WebDriver 입력(`addValue`)으로는 조합을 만들 수 없다 — `insertText` 한 번으로 끝나고 `keydown`조차 오지 않는다.
