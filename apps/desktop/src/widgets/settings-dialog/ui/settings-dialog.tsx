import { useEffect, useRef, useState } from "react";
import { css } from "styled-system/css";

import {
  AUTOSAVE_INTERVAL_DEFAULT_MS,
  AUTOSAVE_INTERVALS_MS,
  setAutosaveInterval,
  useAutosaveStore,
} from "@features/save-file";
import type { AutosaveInterval } from "@features/save-file";
import { closeSettings, useSettingsDialogStore } from "@features/toggle-settings";
import { resolveOpacity, useGlassStore } from "@entities/glass";
import { useResolvedTheme, useThemeStore } from "@entities/theme";
import type { ThemePreference } from "@entities/theme";
import { BLUR_RADIUS_DEFAULT, BLUR_RADIUS_MAX, STRINGS } from "@shared/config";
import { hasWindowGlass } from "@shared/lib";
import { CloseIcon, ComputerIcon, MoonIcon, SunIcon } from "@shared/ui";

// 다이얼로그는 불투명하다(→ .claude/docs/design/decisions/glass.md).
const dialogClass = css({
  margin: "auto",
  width: "90vw",
  maxWidth: "2xl",
  padding: "0",
  overflow: "hidden",
  borderWidth: "1px",
  borderStyle: "solid",
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
  borderBottomWidth: "1px",
  borderBottomStyle: "solid",
  borderBottomColor: "border",
});

const titleClass = css({ fontSize: "md", fontWeight: "semibold" });

const bodyClass = css({ display: "flex", minHeight: "sm", maxHeight: "70vh" });

const navClass = css({
  display: "flex",
  flexDirection: "column",
  gap: "0.5",
  flexShrink: 0,
  width: "40",
  padding: "2",
  borderRightWidth: "1px",
  borderRightStyle: "solid",
  borderRightColor: "border",
  background: "bg.hover",
});

const navItemClass = css({
  paddingX: "2.5",
  paddingY: "1.5",
  border: "none",
  borderRadius: "sm",
  background: "transparent",
  color: "text.muted",
  fontSize: "sm",
  textAlign: "left",
  cursor: "pointer",
  _hover: { color: "text" },
  "&[aria-selected='true']": { background: "bg.paper", color: "text", fontWeight: "medium" },
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-2px" },
});

const panelClass = css({
  flex: 1,
  minWidth: 0,
  paddingX: "4",
  paddingBottom: "4",
  overflowY: "auto",
});

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

// 폭을 쓰지 않는 컨트롤은 설명 오른쪽에 둔다.
const rowInlineClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "4",
  paddingY: "3",
});

const rowTitleClass = css({ fontSize: "sm", fontWeight: "medium" });
const rowHintClass = css({ marginTop: "1", fontSize: "xs", color: "text.muted" });

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
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "border",
  borderRadius: "sm",
  background: "bg.hover",
});

// 액센트는 글자에 쓰지 않는다(→ .claude/docs/design/decisions/color-palette.md).
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

const selectWrapClass = css({
  position: "relative",
  display: "inline-flex",
  _after: {
    content: '""',
    position: "absolute",
    top: "50%",
    right: "3",
    width: "6px",
    height: "6px",
    borderRightWidth: "1.5px",
    borderRightStyle: "solid",
    borderRightColor: "text.muted",
    borderBottomWidth: "1.5px",
    borderBottomStyle: "solid",
    borderBottomColor: "text.muted",
    transform: "translateY(-70%) rotate(45deg)",
    pointerEvents: "none",
  },
});

const selectClass = css({
  appearance: "none",
  minWidth: "32",
  paddingLeft: "2.5",
  paddingRight: "7",
  paddingY: "1.5",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "border",
  borderRadius: "sm",
  background: "bg.hover",
  color: "text",
  fontFamily: "ui",
  fontSize: "xs",
  cursor: "pointer",
  _focusVisible: { outline: "2px solid", outlineColor: "accent", outlineOffset: "-1px" },
});

// 트랙과 손잡이를 직접 그린다 — OS 기본 슬라이더는 굵기·손잡이 크기가 앱 스케일과 어긋난다.
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
    borderWidth: "2px",
    borderStyle: "solid",
    borderColor: "bg.paper",
    boxShadow: "sm",
  },
  "&:focus-visible::-webkit-slider-thumb": {
    outline: "2px solid",
    outlineColor: "accent",
    outlineOffset: "2px",
  },
});

const actionsClass = css({
  display: "flex",
  justifyContent: "flex-end",
  paddingX: "4",
  paddingY: "3",
  borderTopWidth: "1px",
  borderTopStyle: "solid",
  borderTopColor: "border",
});

const ghostButtonClass = css({
  paddingX: "3",
  paddingY: "1.5",
  borderWidth: "1px",
  borderStyle: "solid",
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

/** 왼쪽 메뉴 (→ .claude/docs/design/decisions/settings-screen.md). */
const SECTIONS = [
  { id: "general", label: STRINGS.settingsSectionGeneral },
  { id: "appearance", label: STRINGS.settingsSectionAppearance },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

// select 값은 문자열이라 간격으로 되돌릴 id가 필요하다.
function autosaveOptionId(interval: AutosaveInterval): string {
  return interval === null ? "off" : `${String(interval / 1000)}s`;
}

function autosaveLabel(interval: AutosaveInterval): string {
  if (interval === null) {
    return STRINGS.settingsAutosaveOffLabel;
  }
  const seconds = interval / 1000;
  return seconds % 60 === 0
    ? STRINGS.durationMinutesLabel(seconds / 60)
    : STRINGS.durationSecondsLabel(seconds);
}

const AUTOSAVE_OPTIONS = AUTOSAVE_INTERVALS_MS.map((value) => ({
  value,
  id: autosaveOptionId(value),
  label: autosaveLabel(value),
}));

function autosaveIntervalOf(id: string): AutosaveInterval {
  return AUTOSAVE_OPTIONS.find((option) => option.id === id)?.value ?? null;
}

function autosaveHint(interval: AutosaveInterval): string {
  return STRINGS.settingsAutosaveHint(interval === null ? null : autosaveLabel(interval));
}

export function SettingsDialog() {
  const open = useSettingsDialogStore((state) => state.open);
  const preference = useThemeStore((state) => state.preference);
  const setPreference = useThemeStore((state) => state.setPreference);
  const theme = useResolvedTheme();
  const opacity = useGlassStore((state) => state.opacity);
  const blurRadius = useGlassStore((state) => state.blurRadius);
  const setOpacity = useGlassStore((state) => state.setOpacity);
  const setBlurRadius = useGlassStore((state) => state.setBlurRadius);
  const autosaveInterval = useAutosaveStore((state) => state.intervalMs);
  const [section, setSection] = useState<SectionId>("general");
  const dialogRef = useRef<HTMLDialogElement>(null);
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

  /** 세로 탭의 방향키 이동 — 옮긴 칸으로 포커스도 따라간다(roving tabindex 계약). */
  function moveSection(event: React.KeyboardEvent<HTMLDivElement>): void {
    const delta = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (delta === 0) {
      return;
    }
    event.preventDefault();
    const index = SECTIONS.findIndex(({ id }) => id === section);
    const next = SECTIONS[(index + delta + SECTIONS.length) % SECTIONS.length];
    if (next) {
      setSection(next.id);
      dialogRef.current?.querySelector<HTMLButtonElement>(`#settings-tab-${next.id}`)?.focus();
    }
  }

  function restoreDefaults(): void {
    setPreference("system");
    setOpacity(null);
    setBlurRadius(BLUR_RADIUS_DEFAULT);
    setAutosaveInterval(AUTOSAVE_INTERVAL_DEFAULT_MS);
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
        <div
          className={navClass}
          role="tablist"
          aria-orientation="vertical"
          aria-label={STRINGS.settingsNavLabel}
          onKeyDown={moveSection}
        >
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              role="tab"
              id={`settings-tab-${id}`}
              className={navItemClass}
              data-testid={`settings-nav-${id}`}
              aria-selected={id === section}
              aria-controls={`settings-panel-${id}`}
              tabIndex={id === section ? 0 : -1}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </div>

        <div
          className={panelClass}
          role="tabpanel"
          id="settings-panel-general"
          aria-labelledby="settings-tab-general"
          hidden={section !== "general"}
        >
          <div className={rowInlineClass}>
            <div>
              <div className={rowTitleClass}>{STRINGS.settingsAutosaveTitle}</div>
              <div className={rowHintClass}>{autosaveHint(autosaveInterval)}</div>
            </div>
            <div className={selectWrapClass}>
              <select
                className={selectClass}
                data-testid="settings-autosave"
                aria-label={STRINGS.settingsAutosaveTitle}
                value={autosaveOptionId(autosaveInterval)}
                onChange={(event) => {
                  setAutosaveInterval(autosaveIntervalOf(event.target.value));
                }}
              >
                {AUTOSAVE_OPTIONS.map(({ id, label }) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div
          className={panelClass}
          role="tabpanel"
          id="settings-panel-appearance"
          aria-labelledby="settings-tab-appearance"
          hidden={section !== "appearance"}
        >
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
        </div>
      </div>

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
    </dialog>
  );
}
