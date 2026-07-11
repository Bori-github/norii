import { needsNormalizationApproval, useDocumentStore } from "@entities/document";
import { REOPEN_ENCODINGS, reopenTabWithEncoding } from "@features/open-file";
import { approveTabNormalization } from "@features/save-file";
import { STRINGS } from "@shared/config";
import { bannerActionClass, bannerBodyClass, bannerClass } from "@shared/ui";

// 활성 탭의 정규화 승인 배너 — "저장 시 무엇이 바뀌는지"(인코딩 변환·개행 통일)를 알리고
// 승인을 받는다(→ file-lifecycle.md#자동-저장). 감지 오판의 구제로 재해석 메뉴를 함께 노출한다
// (→ file-lifecycle.md#인코딩-정책 수동 재해석). 승인·재해석이 서로 다른 feature에 속해
// 위젯에서 조합한다.
export function NormalizationBanner() {
  const activeTab = useDocumentStore((state) =>
    state.tabs.find((tab) => tab.id === state.activeTabId),
  );
  if (!activeTab || !needsNormalizationApproval(activeTab)) {
    return null;
  }

  const messages: string[] = [];
  if (activeTab.sourceEncoding !== "utf-8") {
    messages.push(STRINGS.normalizationEncodingBody(activeTab.sourceEncoding));
  }
  if (activeTab.eolMixed) {
    messages.push(STRINGS.normalizationEolBody(activeTab.eol));
  }

  return (
    <div className={bannerClass} role="alert" data-testid="normalization-banner">
      <span className={bannerBodyClass}>{messages.join("\n")}</span>
      <button
        type="button"
        className={bannerActionClass}
        onClick={() => approveTabNormalization(activeTab.id)}
      >
        {STRINGS.normalizationApproveLabel}
      </button>
      <select
        className={bannerActionClass}
        aria-label={STRINGS.reopenEncodingLabel}
        value=""
        onChange={(event) => {
          if (event.target.value !== "") {
            void reopenTabWithEncoding(activeTab.id, event.target.value);
          }
        }}
      >
        <option value="" disabled>
          {STRINGS.reopenEncodingLabel}
        </option>
        {REOPEN_ENCODINGS.map((label) => (
          <option key={label} value={label}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}
