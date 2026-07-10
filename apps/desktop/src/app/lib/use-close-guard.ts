import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect } from "react";

import { useDocumentStore } from "@entities/document";
import { saveTabNow } from "@features/save-file";
import { STRINGS } from "@shared/config";
import { logger } from "@shared/lib";
import { useNoticeStore } from "@shared/ui";

import { planCloseDefense } from "./close-defense";

// 종료 방어 — 정책의 단일 출처: file-lifecycle.md#종료-방어. 데이터 유실 방지 최우선.
// 창 닫기 요청을 가로채 저장 대기분을 플러시하고, 플러시로 해소되지 않는 탭
// (Untitled dirty·저장 실패)이 있으면 확인을 받은 뒤에만 종료한다.
export function useCloseGuard(): void {
  useEffect(() => {
    let defending = false;

    const unlistenPromise = getCurrentWindow().onCloseRequested(async (event) => {
      const plan = planCloseDefense(useDocumentStore.getState().tabs);
      if (plan.flushTabIds.length === 0 && plan.blockingTabIds.length === 0) {
        return; // 저장 대기분 없음 — 그대로 종료.
      }
      // preventDefault는 비동기 작업 전에(동기적으로) 걸어야 한다.
      event.preventDefault();
      if (defending) {
        return; // 이미 플러시·확인이 진행 중 — 중복 처리하지 않는다.
      }
      defending = true;
      try {
        const outcomes = await Promise.all(plan.flushTabIds.map((tabId) => saveTabNow(tabId)));
        const failedCount = outcomes.filter(
          (outcome) => outcome !== "saved" && outcome !== "skipped",
        ).length;
        if (failedCount === 0 && plan.blockingTabIds.length === 0) {
          // 플러시 완료 — 다이얼로그 없이 종료한다(자동 저장 세계의 기본 동작).
          await getCurrentWindow().destroy();
          return;
        }
        if (failedCount > 0) {
          logger.warn(`종료 방어: 플러시 실패 ${failedCount}건 — 종료 보류`);
        }
        // Untitled dirty 또는 플러시 실패 — 사용자 확인 없이 종료하면 유실이다.
        useNoticeStore.getState().pushNotice(STRINGS.quitDirtyBody, [
          {
            label: STRINGS.quitDiscardLabel,
            onPress: () => {
              void getCurrentWindow().destroy();
            },
          },
          { label: STRINGS.closeCancelLabel, onPress: () => {} },
        ]);
      } finally {
        defending = false;
      }
    });

    return () => {
      void unlistenPromise.then((unlisten) => unlisten());
    };
  }, []);
}
