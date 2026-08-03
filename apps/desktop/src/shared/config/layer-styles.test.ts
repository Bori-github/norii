import { describe, expect, it } from "vitest";

import config from "../../../panda.config";

// 왜: 포커스 링은 화면 열두 곳에 같은 값으로 복사돼 있었다. 한 곳으로 모은 뒤에도 규칙
//     ("text로 그린다" — decisions/color-palette)이 지켜지는지는 코드가 아니라 여기서 막는다.
// 경계: 어느 요소가 안쪽 링을 쓰고 어느 요소가 바깥 링을 쓰는지는 각 화면이 정한다.

const layerStyles = config.theme?.extend?.layerStyles ?? {};

describe("포커스 링", () => {
  it.each(["focusInside", "focusOutside"] as const)("%s는 text로 그린다", (name) => {
    expect(layerStyles[name]?.value).toMatchObject({
      _focusVisible: { outline: "2px solid", outlineColor: "text" },
    });
  });

  // 탭 묶음처럼 잘라내는 컨테이너 안에서는 바깥 링이 잘려 보이지 않아 안쪽 링을 쓴다.
  it("안쪽 링은 요소 안으로, 바깥 링은 요소 밖으로 그린다", () => {
    expect(layerStyles.focusInside?.value).toMatchObject({
      _focusVisible: { outlineOffset: "-2px" },
    });
    expect(layerStyles.focusOutside?.value).toMatchObject({
      _focusVisible: { outlineOffset: "2px" },
    });
  });
});
