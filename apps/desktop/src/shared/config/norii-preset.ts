import { createNoriiPreset, GLASS_OPACITY_DEFAULT } from "@norii/ui/panda-preset";

// 앱이 쓰는 preset 인스턴스. panda.config와 토큰을 읽는 테스트가 이 하나를 공유한다 —
// 각자 만들면 인자가 갈려도 아무도 못 알아채고, 게이트가 빌드에 안 들어가는 값을 검사하게 된다.
export const noriiPreset = createNoriiPreset({ glassOpacity: GLASS_OPACITY_DEFAULT });
