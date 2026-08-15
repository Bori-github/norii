import { useRef, useState } from "react";
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
import {
  Button,
  CloseIcon,
  ComputerIcon,
  Dialog,
  DialogFooter,
  DialogHeader,
  IconButton,
  MoonIcon,
  Select,
  SunIcon,
} from "@shared/ui";

const titleClass = css({ fontSize: "md", fontWeight: "semibold" });

const bodyClass = css({ display: "flex", minHeight: "sm", maxHeight: "70vh" });

const navClass = css({
  display: "flex",
  flexDirection: "column",
  gap: "1",
  flexShrink: 0,
  width: "40",
  padding: "3",
  borderRightWidth: "1px",
  borderRightStyle: "solid",
  borderRightColor: "border",
  background: "bg.hover",
});

const navItemClass = css({
  paddingX: "3",
  paddingY: "2",
  border: "none",
  borderRadius: "sm",
  background: "transparent",
  color: "text.muted",
  fontSize: "sm",
  textAlign: "left",
  cursor: "pointer",
  _hover: { color: "text" },
  "&[aria-selected='true']": { background: "bg.paper", color: "text", fontWeight: "medium" },
  layerStyle: "focusOutside",
});

const panelClass = css({
  flex: 1,
  minWidth: 0,
  paddingX: "5",
  paddingBottom: "5",
  overflowY: "auto",
});

const captionClass = css({
  paddingTop: "5",
  paddingBottom: "1.5",
  fontSize: "xs",
  fontWeight: "semibold",
  letterSpacing: "wide",
  color: "text.muted",
});

// 컨트롤은 설명 아래 한 줄을 통째로 쓴다 — 슬라이더가 좁으면 끝값을 집기 어렵다.
const rowClass = css({ display: "flex", flexDirection: "column", gap: "3", paddingY: "4" });

const selectMinWidthClass = css({ minWidth: "32" });

// 폭을 쓰지 않는 컨트롤은 설명 오른쪽에 둔다.
const rowInlineClass = css({
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "5",
  paddingY: "4",
});

const rowTitleClass = css({ fontSize: "sm", fontWeight: "medium" });
const rowHintClass = css({ marginTop: "1.5", fontSize: "xs", color: "text.muted" });

const valueClass = css({
  marginLeft: "1.5",
  fontWeight: "semibold",
  fontVariantNumeric: "tabular-nums",
});

const separatorClass = css({ height: "1px", background: "border" });

const segmentClass = css({
  display: "flex",
  gap: "1",
  padding: "1",
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
  gap: "2",
  paddingY: "2",
  border: "none",
  borderRadius: "sm",
  background: "transparent",
  color: "text.muted",
  fontSize: "sm",
  cursor: "pointer",
  "&[aria-pressed='true']": { background: "bg.paper", color: "text", fontWeight: "semibold" },
  layerStyle: "focusInside",
  "& svg": { width: "3.5", height: "3.5" },
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
    outlineColor: "text",
    outlineOffset: "2px",
  },
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

  // 방향키로 옮긴 분류에 포커스도 옮긴다 — 브라우저는 방향키로 포커스를 옮기지 않는다.
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

  return (
    <Dialog
      open={open}
      width="lg"
      dialogRef={dialogRef}
      data-testid="settings-dialog"
      aria-label={STRINGS.settingsTitle}
      onCancel={closeSettings} // Esc.
    >
      <DialogHeader divider>
        <strong className={titleClass}>{STRINGS.settingsTitle}</strong>
        <IconButton
          data-testid="settings-close"
          label={STRINGS.settingsCloseLabel}
          onClick={closeSettings}
        >
          <CloseIcon />
        </IconButton>
      </DialogHeader>

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
            <Select
              wrapClassName={selectMinWidthClass}
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
            </Select>
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

      <DialogFooter divider>
        <Button size="sm" data-testid="settings-reset" onClick={restoreDefaults}>
          {STRINGS.settingsResetLabel}
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
