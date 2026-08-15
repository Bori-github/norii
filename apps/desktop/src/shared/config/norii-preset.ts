import { createNoriiPreset, GLASS_OPACITY_DEFAULT } from "@norii/ui/panda-preset";

/**
 * 앱이 쓰는 Panda preset 인스턴스
 *
 * @description
 * `panda.config`와 토큰을 읽는 테스트가 이 하나를 공유 — 각자 `createNoriiPreset`을 부르면
 * 인자가 달라져도 드러나지 않아 대비 게이트가 빌드에 없는 값을 검사하게 됨
 */
export const noriiPreset = createNoriiPreset({ glassOpacity: GLASS_OPACITY_DEFAULT });
