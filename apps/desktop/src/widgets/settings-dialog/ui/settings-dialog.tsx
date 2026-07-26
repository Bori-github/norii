import { useEffect, useRef } from "react";
import { css } from "styled-system/css";

import { resolveOpacity, useGlassStore } from "@entities/glass";
import { useResolvedTheme, useThemeStore } from "@entities/theme";
import type { ThemePreference } from "@entities/theme";
import { BLUR_RADIUS_MAX, STRINGS } from "@shared/config";
import { hasWindowGlass } from "@shared/lib";
import { CloseIcon } from "@shared/ui";

import type { SettingsSection } from "../model/settings-dialog-store";
import { closeSettings, useSettingsDialogStore } from "../model/settings-dialog-store";

// 다이얼로그는 불투명하다 — 투명 창에서 backdrop-filter가 동작하지 않는다는 보고가 있고,
// 캔버스가 투명하면 흐릴 픽셀 자체가 없다(→ .claude/docs/design/decisions/glass.md).
const dialogClass = css({
  margin: "auto",
  width: "90vw",
  maxWidth: "3xl",
  height: "70vh",
  padding: "0",
  overflow: "hidden",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "lg",
  background: "bg.paper",
  color: "text",
  boxShadow: "lg",
  _backdrop: { background: "bg.scrim" },
});

const layoutClass = css({ display: "flex", height: "full" });

const navClass = css({
  flexShrink: 0,
  width: "44",
  paddingY: "4",
  paddingX: "2",
  borderRight: "1px solid",
  borderColor: "border",
  overflowY: "auto",
});

// 고른 갈래와 호버는 같은 상태 배경을 쓰되, 고른 쪽만 굵기로 굳힌다 — 텍스트 선택색(bg.selection)은
// 사용자가 **고른 글자**의 것이라 여기 쓰지 않는다(→ .claude/docs/design/design-system.md#표면-토큰).
const navItemClass = css({
  display: "block",
  width: "full",
  paddingX: "3",
  paddingY: "1.5",
  border: "none",
  borderRadius: "sm",
  background: "transparent",
  color: "text",
  fontSize: "sm",
  textAlign: "left",
  cursor: "pointer",
  _hover: { background: "bg.hover" },
  "&[aria-current='true']": { background: "bg.hover", fontWeight: "semibold" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
});

const panelClass = css({ flex: "1", overflowY: "auto", paddingX: "8", paddingY: "6" });

const headerClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "4",
  marginBottom: "2",
});

const headerTitleClass = css({ fontSize: "lg", fontWeight: "semibold" });

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

// 행 사이에만 선을 둔다 — 첫 행 위에 선이 있으면 제목의 밑줄로 읽힌다.
const rowClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "6",
  paddingY: "4",
  "& + &": { borderTop: "1px solid", borderColor: "border" },
});

const rowTitleClass = css({ fontSize: "sm", fontWeight: "medium" });
const rowHintClass = css({ marginTop: "1", fontSize: "xs", color: "text.muted" });

const controlClass = css({ display: "flex", alignItems: "center", gap: "3" });

// 값은 슬라이더 옆에 숫자로 둔다 — 손잡이 위치만으로는 지금 값을 말할 수 없다.
const valueClass = css({
  minWidth: "10",
  fontSize: "xs",
  color: "text.muted",
  textAlign: "right",
  fontVariantNumeric: "tabular-nums",
});

// 손잡이·채움은 표시라 액센트를 쓴다 — 글자가 아니므로 비텍스트 기준이 적용된다
// (→ .claude/docs/design/decisions/color-palette.md).
const sliderClass = css({
  width: "40",
  accentColor: "accent",
  cursor: "pointer",
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "2px" },
});

const selectClass = css({
  paddingX: "2",
  paddingY: "1",
  border: "1px solid",
  borderColor: "border",
  borderRadius: "sm",
  background: "bg.paper",
  color: "text",
  fontSize: "sm",
  cursor: "pointer",
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-1px" },
});

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "appearance", label: STRINGS.settingsSectionAppearance },
];

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: STRINGS.themeSystemLabel },
  { value: "light", label: STRINGS.themeLightLabel },
  { value: "dark", label: STRINGS.themeDarkLabel },
];

export function SettingsDialog() {
  const open = useSettingsDialogStore((state) => state.open);
  const section = useSettingsDialogStore((state) => state.section);
  const setSection = useSettingsDialogStore((state) => state.setSection);
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
      <div className={layoutClass}>
        <nav className={navClass} aria-label={STRINGS.settingsTitle}>
          {SECTIONS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={navItemClass}
              aria-current={item.id === section}
              onClick={() => setSection(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className={panelClass}>
          <div className={headerClass}>
            <strong className={headerTitleClass}>{STRINGS.settingsSectionAppearance}</strong>
            <button
              type="button"
              className={closeButtonClass}
              data-testid="settings-close"
              aria-label={STRINGS.settingsCloseLabel}
              onClick={closeSettings}
            >
              <CloseIcon />
            </button>
          </div>

          <div className={rowClass}>
            <div>
              <div className={rowTitleClass}>{STRINGS.settingsThemeTitle}</div>
              <div className={rowHintClass}>{STRINGS.settingsThemeHint}</div>
            </div>
            <select
              className={selectClass}
              data-testid="settings-theme"
              aria-label={STRINGS.settingsThemeTitle}
              value={preference}
              onChange={(event) => setPreference(event.target.value as ThemePreference)}
            >
              {THEME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className={rowClass}>
            <div>
              <div className={rowTitleClass}>{STRINGS.settingsOpacityTitle}</div>
              <div className={rowHintClass}>{STRINGS.settingsOpacityHint}</div>
            </div>
            <div className={controlClass}>
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
              <span className={valueClass}>{Math.round(resolvedOpacity * 100)}%</span>
            </div>
          </div>

          {hasWindowGlass && (
            <div className={rowClass}>
              <div>
                <div className={rowTitleClass}>{STRINGS.settingsBlurTitle}</div>
                <div className={rowHintClass}>{STRINGS.settingsBlurHint}</div>
              </div>
              <div className={controlClass}>
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
                <span className={valueClass}>{blurRadius}px</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}
