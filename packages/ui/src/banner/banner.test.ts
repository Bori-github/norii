import { describe, expect, it } from "vitest";

import { BANNER_STYLES } from "./banner";

// 왜: 배너는 알림·충돌·삭제됨 세 곳이 각자 div와 클래스를 조립하고 있었다. 한 컴포넌트에서
//     나오게 하고, 배너가 지켜야 할 것(종이 면·아래 경계선·danger는 왼쪽 띠)을 여기서 막는다.
// 경계: 어떤 상황에 배너를 띄우고 무슨 버튼을 다는지는 각 기능이 정한다. 좁은 폭에서 액션이
//     상자 안에 남는지는 banner.stories.tsx의 좁은_폭이 렌더해서 본다.

const { base, variants } = BANNER_STYLES;

describe("배너 껍데기", () => {
  // 떠 있지 않고 레이아웃을 미는 띠라 흐릴 대상이 없다(→ DESIGN.md 표면 표).
  it("종이 면 위에 놓이고 아래 경계선으로 편집면과 갈린다", () => {
    expect(base.background).toBe("bg.paper");
    expect(base.borderBottomColor).toBe("border");
  });

  it("본문이 남는 자리를 채우고 액션은 오른쪽에 남는다", () => {
    expect(base.display).toBe("flex");
    expect(base.alignItems).toBe("center");
  });
});

describe("tone", () => {
  // 전부 빨갛게 하면 "빨강 = 지금 손대야 함"이 흐려진다.
  it("기본 tone은 색을 더하지 않는다", () => {
    expect(JSON.stringify(variants.tone.default)).not.toContain("status");
  });

  it("danger는 왼쪽 띠로만 표시한다", () => {
    expect(variants.tone.danger).toMatchObject({
      borderLeftWidth: "3px",
      borderLeftColor: "status.danger",
    });
  });
});
