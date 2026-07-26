import { useEffect, useRef } from "react";
import { css } from "styled-system/css";

import { closeSettings, useSettingsDialogStore } from "@features/toggle-settings";
import { resolveOpacity, useGlassStore } from "@entities/glass";
import { useResolvedTheme, useThemeStore } from "@entities/theme";
import type { ThemePreference } from "@entities/theme";
import { BLUR_RADIUS_DEFAULT, BLUR_RADIUS_MAX, STRINGS } from "@shared/config";
import { hasWindowGlass } from "@shared/lib";
import { CloseIcon, ComputerIcon, MoonIcon, SunIcon } from "@shared/ui";

// 다이얼로그는 불투명하다 — 투명 창에서 backdrop-filter가 동작하지 않는다는 보고가 있고,
// 캔버스가 투명하면 흐릴 픽셀 자체가 없다(→ .claude/docs/design/decisions/glass.md).
const dialogClass = css({
  margin: "auto",
  width: "90vw",
  maxWidth: "md",
  padding: "0",
  overflow: "hidden",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "lg",
  background: "bg.paper",
  color: "text",
  boxShadow: "lg",
  animation: "dialogIn 0.16s ease",
  _motionReduce: { animation: "none" },
  _backdrop: { background: "bg.scrim" },
});

const headerClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "4",
  paddingX: "4",
  paddingY: "3",
  borderBottom: "1px solid",
  borderColor: "border",
});

const titleClass = css({ fontSize: "md", fontWeight: "semibold" });

const bodyClass = css({ paddingX: "4", paddingBottom: "4", maxHeight: "70vh", overflowY: "auto" });

const closeButtonClass = css({
  display: "flex",
  padding: "1",
  border: "none",
  borderRadius: "sm",
  background: "transparent",
  color: "text",
  cursor: "pointer",
  _hover: { background: "bg.hover" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
  "& svg": { width: "4", height: "4" },
});

const captionClass = css({
  paddingTop: "4",
  paddingBottom: "1",
  fontSize: "xs",
  fontWeight: "semibold",
  letterSpacing: "wide",
  color: "text.muted",
});

// 컨트롤은 설명 아래 한 줄을 통째로 쓴다 — 슬라이더가 좁으면 끝값을 집기 어렵다.
const rowClass = css({ display: "flex", flexDirection: "column", gap: "2", paddingY: "3" });

const rowTitleClass = css({ fontSize: "sm", fontWeight: "medium" });
const rowHintClass = css({ marginTop: "1", fontSize: "xs", color: "text.muted" });

// 값은 제목 옆에 붙인다. 액센트 색은 쓰지 않는다 — 글자에 쓰면 어느 한 테마에서 AA를 넘지
// 못한다(→ .claude/docs/design/decisions/color-palette.md).
const valueClass = css({
  marginLeft: "1",
  fontWeight: "semibold",
  fontVariantNumeric: "tabular-nums",
});

const separatorClass = css({ height: "1px", background: "border" });

const segmentClass = css({
  display: "flex",
  gap: "0.5",
  padding: "0.5",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "sm",
  background: "bg.hover",
});

// 고른 칸은 종이색으로 떠오르고 굵기로 굳는다 — 액센트 글자를 대신하는 표시다.
const segmentButtonClass = css({
  display: "flex",
  flex: "1",
  alignItems: "center",
  justifyContent: "center",
  gap: "1.5",
  paddingY: "1.5",
  border: "none",
  borderRadius: "sm",
  background: "transparent",
  color: "text.muted",
  fontSize: "xs",
  cursor: "pointer",
  "&[aria-pressed='true']": { background: "bg.paper", color: "text", fontWeight: "semibold" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
  "& svg": { width: "3.5", height: "3.5" },
});

// 트랙과 손잡이를 직접 그린다 — OS 기본 슬라이더는 굵기·손잡이 크기가 앱 스케일과 어긋난다.
// 손잡이는 액센트로 채운다: 글자가 아니라 표시라 비텍스트 기준이 적용된다
// (→ .claude/docs/design/decisions/color-palette.md).
const sliderClass = css({
  appearance: "none",
  width: "full",
  height: "1",
  borderRadius: "full",
  background: "border",
  outline: "none",
  cursor: "pointer",
  "&::-webkit-slider-thumb": {
    appearance: "none",
    width: "4",
    height: "4",
    borderRadius: "full",
    background: "accent",
    // 종이색 테두리가 손잡이를 트랙에서 떼어 놓는다.
    border: "2px solid",
    borderColor: "bg.paper",
    boxShadow: "sm",
  },
  "&:focus-visible::-webkit-slider-thumb": {
    outline: "2px solid",
    outlineColor: "accent",
    outlineOffset: "2px",
  },
});

const actionsClass = css({ display: "flex", justifyContent: "flex-end", paddingTop: "4" });

const ghostButtonClass = css({
  paddingX: "3",
  paddingY: "1.5",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "sm",
  background: "transparent",
  color: "text.muted",
  fontSize: "xs",
  cursor: "pointer",
  _hover: { background: "bg.hover", color: "text" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-1px" },
});

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof SunIcon }[] = [
  { value: "light", label: STRINGS.themeLightLabel, Icon: SunIcon },
  { value: "dark", label: STRINGS.themeDarkLabel, Icon: MoonIcon },
  { value: "system", label: STRINGS.themeSystemLabel, Icon: ComputerIcon },
];

export function SettingsDialog() {
  const open = useSettingsDialogStore((state) => state.open);
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const theme = useResolvedTheme();
  const opacity = useGlassStore((state) => state.opacity);
  const blurRadius = useGlassStore((state) => state.blurRadius);
  const setOpacity = useGlassStore((state) => state.setOpacity);
  const setBlurRadius = useGlassStore((state) => state.setBlurRadius);
  const dialogRef = useRef<HTMLDialogElement>(null);
  // 아직 고르지 않았으면 슬라이더가 그 테마의 기본 알파에 선다.
  const resolvedOpacity = resolveOpacity(opacity, theme);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function restoreDefaults(): void {
    setPreference("system");
    setOpacity(null);
    setBlurRadius(BLUR_RADIUS_DEFAULT);
  }

  if (!open) {
    return null;
  }
  return (
    <dialog
      ref={dialogRef}
      className={dialogClass}
      data-testid="settings-dialog"
      aria-label={STRINGS.settingsTitle}
      onCancel={closeSettings} // Esc.
    >
      <header className={headerClass}>
        <strong className={titleClass}>{STRINGS.settingsTitle}</strong>
        <button
          type="button"
          className={closeButtonClass}
          data-testid="settings-close"
          aria-label={STRINGS.settingsCloseLabel}
          onClick={closeSettings}
        >
          <CloseIcon />
        </button>
      </header>

      <div className={bodyClass}>
        <div className={rowClass}>
          <div>
            <div className={rowTitleClass}>{STRINGS.settingsThemeTitle}</div>
            <div className={rowHintClass}>{STRINGS.settingsThemeHint}</div>
          </div>
          <div className={segmentClass} role="group" aria-label={STRINGS.settingsThemeTitle}>
            {THEME_OPTIONS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className={segmentButtonClass}
                data-testid={`settings-theme-${value}`}
                aria-pressed={value === preference}
                onClick={() => setPreference(value)}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={separatorClass} />
        <div className={captionClass}>{STRINGS.settingsGlassCaption}</div>

        <div className={rowClass}>
          <div>
            <div className={rowTitleClass}>
              {STRINGS.settingsOpacityTitle}
              <span className={valueClass}>{Math.round(resolvedOpacity * 100)}%</span>
            </div>
            <div className={rowHintClass}>{STRINGS.settingsOpacityHint}</div>
          </div>
          <input
            type="range"
            className={sliderClass}
            data-testid="settings-opacity"
            aria-label={STRINGS.settingsOpacityTitle}
            min={0}
            max={1}
            step={0.01}
            value={resolvedOpacity}
            onChange={(event) => setOpacity(Number(event.target.value))}
          />
        </div>

        {hasWindowGlass && (
          <div className={rowClass}>
            <div>
              <div className={rowTitleClass}>
                {STRINGS.settingsBlurTitle}
                <span className={valueClass}>{blurRadius}px</span>
              </div>
              <div className={rowHintClass}>{STRINGS.settingsBlurHint}</div>
            </div>
            <input
              type="range"
              className={sliderClass}
              data-testid="settings-blur"
              aria-label={STRINGS.settingsBlurTitle}
              min={0}
              max={BLUR_RADIUS_MAX}
              step={1}
              value={blurRadius}
              onChange={(event) => setBlurRadius(Number(event.target.value))}
            />
          </div>
        )}

        <div className={actionsClass}>
          <button
            type="button"
            className={ghostButtonClass}
            data-testid="settings-reset"
            onClick={restoreDefaults}
          >
            {STRINGS.settingsResetLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
