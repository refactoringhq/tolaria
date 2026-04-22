import {
  APP_STORAGE_KEYS,
  LEGACY_APP_STORAGE_KEYS,
  getAppStorageItem,
} from '../constants/appStorage'
import {
  DEFAULT_THEME_ID,
  getThemeById,
  isThemeId,
  type ThemeId,
} from './appThemes'

export type ResolvedAppearance = 'light' | 'dark'
export type SurfaceMode = 'solid' | 'glass'

export interface AppearancePreferences {
  themeId: ThemeId
  surfaceMode: SurfaceMode
}

type LegacyAppearanceMode = 'system' | 'light' | 'dark'

export const DEFAULT_APPEARANCE_PREFERENCES: AppearancePreferences = {
  themeId: DEFAULT_THEME_ID,
  surfaceMode: 'glass',
}

function isSurfaceMode(value: unknown): value is SurfaceMode {
  return value === 'solid' || value === 'glass'
}

function isLegacyAppearanceMode(value: unknown): value is LegacyAppearanceMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

function prefersDarkColorScheme(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function mapLegacyAppearanceModeToThemeId(value: LegacyAppearanceMode): ThemeId {
  if (value === 'light') return 'tolariaDawn'
  if (value === 'dark') return DEFAULT_THEME_ID
  return prefersDarkColorScheme() ? DEFAULT_THEME_ID : 'tolariaDawn'
}

function normalizeParsedPreferences(value: unknown): AppearancePreferences | null {
  if (isThemeId(value)) {
    return {
      themeId: value,
      surfaceMode: DEFAULT_APPEARANCE_PREFERENCES.surfaceMode,
    }
  }

  if (isLegacyAppearanceMode(value)) {
    return {
      themeId: mapLegacyAppearanceModeToThemeId(value),
      surfaceMode: DEFAULT_APPEARANCE_PREFERENCES.surfaceMode,
    }
  }

  if (typeof value !== 'object' || value === null) return null

  const candidate = value as Partial<AppearancePreferences> & {
    colorMode?: LegacyAppearanceMode
  }

  return {
    themeId: isThemeId(candidate.themeId)
      ? candidate.themeId
      : isLegacyAppearanceMode(candidate.colorMode)
        ? mapLegacyAppearanceModeToThemeId(candidate.colorMode)
        : DEFAULT_APPEARANCE_PREFERENCES.themeId,
    surfaceMode: isSurfaceMode(candidate.surfaceMode)
      ? candidate.surfaceMode
      : DEFAULT_APPEARANCE_PREFERENCES.surfaceMode,
  }
}

export function readStoredAppearancePreferences(): AppearancePreferences {
  const rawValue = getAppStorageItem('theme')
  if (!rawValue) return DEFAULT_APPEARANCE_PREFERENCES

  try {
    const parsed = JSON.parse(rawValue)
    return normalizeParsedPreferences(parsed) ?? DEFAULT_APPEARANCE_PREFERENCES
  } catch {
    return normalizeParsedPreferences(rawValue.trim()) ?? DEFAULT_APPEARANCE_PREFERENCES
  }
}

export function writeStoredAppearancePreferences(preferences: AppearancePreferences): void {
  try {
    const serialized = JSON.stringify(preferences)
    localStorage.setItem(APP_STORAGE_KEYS.theme, serialized)
    localStorage.removeItem(LEGACY_APP_STORAGE_KEYS.theme)
  } catch {
    // Ignore unavailable or restricted localStorage implementations.
  }
}

export function resolveAppearanceMode(themeId: ThemeId): ResolvedAppearance {
  return getThemeById(themeId).appearance
}

interface RgbaColor {
  r: number
  g: number
  b: number
  a: number
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value))
}

function parseHexColor(value: string): RgbaColor | null {
  const normalized = value.trim().replace('#', '')
  if (normalized.length !== 6 && normalized.length !== 8) return null

  const int = Number.parseInt(normalized, 16)
  if (!Number.isFinite(int)) return null

  if (normalized.length === 6) {
    return {
      r: (int >> 16) & 255,
      g: (int >> 8) & 255,
      b: int & 255,
      a: 1,
    }
  }

  return {
    r: (int >> 24) & 255,
    g: (int >> 16) & 255,
    b: (int >> 8) & 255,
    a: (int & 255) / 255,
  }
}

function toCssColor(value: string): string {
  const parsed = parseHexColor(value)
  if (!parsed) return value

  const alpha = Number.parseFloat(parsed.a.toFixed(3))
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${alpha})`
}

function toOpaqueRgb(value: string): [number, number, number] {
  const parsed = parseHexColor(value)
  if (!parsed) return [255, 255, 255]
  return [parsed.r, parsed.g, parsed.b]
}

function mixColors(left: string, right: string, rightWeight: number): string {
  const [leftR, leftG, leftB] = toOpaqueRgb(left)
  const [rightR, rightG, rightB] = toOpaqueRgb(right)
  const weight = clamp(rightWeight)
  const inverse = 1 - weight

  const r = Math.round(leftR * inverse + rightR * weight)
  const g = Math.round(leftG * inverse + rightG * weight)
  const b = Math.round(leftB * inverse + rightB * weight)
  return `rgb(${r}, ${g}, ${b})`
}

function withAlpha(value: string, alpha: number): string {
  const parsed = parseHexColor(value)
  if (!parsed) return value
  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${clamp(alpha)})`
}

function relativeLuminance(value: string): number {
  const [r, g, b] = toOpaqueRgb(value).map((channel) => {
    const normalized = channel / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(left: string, right: string): number {
  const leftLuminance = relativeLuminance(left)
  const rightLuminance = relativeLuminance(right)
  const lighter = Math.max(leftLuminance, rightLuminance)
  const darker = Math.min(leftLuminance, rightLuminance)
  return (lighter + 0.05) / (darker + 0.05)
}

function pickReadableForeground(background: string, darkCandidate: string, lightCandidate: string): string {
  return contrastRatio(background, darkCandidate) >= contrastRatio(background, lightCandidate)
    ? darkCandidate
    : lightCandidate
}

function applyThemeVariables(root: HTMLElement, preferences: AppearancePreferences): void {
  const theme = getThemeById(preferences.themeId)
  const { tokens } = theme
  const gradientMidpoint = mixColors(tokens.buttonGradient[0], tokens.buttonGradient[1], 0.5)
  const primaryForeground = pickReadableForeground(
    gradientMidpoint,
    theme.appearance === 'dark' ? '#071321' : '#0D1726',
    '#FFFFFF',
  )
  const dangerForeground = pickReadableForeground(tokens.danger, '#19080B', '#FFFFFF')

  const themeVars = {
    '--theme-app-background': tokens.appBackground,
    '--theme-gradient-start': tokens.backgroundGradient[0],
    '--theme-gradient-mid': tokens.backgroundGradient[1],
    '--theme-gradient-end': tokens.backgroundGradient[2],
    '--theme-blob-1': tokens.ambientBlobColors[0],
    '--theme-blob-2': tokens.ambientBlobColors[1],
    '--theme-blob-3': tokens.ambientBlobColors[2],
    '--theme-glass-material': tokens.glassMaterial,
    '--theme-glass-fill': toCssColor(tokens.glassFill),
    '--theme-glass-fill-strong': toCssColor(tokens.glassFillStrong),
    '--theme-glass-stroke': toCssColor(tokens.glassStroke),
    '--theme-glass-highlight': toCssColor(tokens.glassHighlight),
    '--theme-glass-shadow': toCssColor(tokens.glassShadow),
    '--theme-text-primary': tokens.textPrimary,
    '--theme-text-secondary': tokens.textSecondary,
    '--theme-text-muted': tokens.textMuted,
    '--theme-text-disabled': tokens.textDisabled,
    '--theme-accent-primary': tokens.accentPrimary,
    '--theme-accent-secondary': tokens.accentSecondary,
    '--theme-success': tokens.success,
    '--theme-warning': tokens.warning,
    '--theme-danger': tokens.danger,
    '--theme-selection': toCssColor(tokens.selection),
    '--theme-focus-ring': tokens.focusRing,
    '--theme-button-gradient-start': tokens.buttonGradient[0],
    '--theme-button-gradient-end': tokens.buttonGradient[1],
    '--theme-primary-foreground': primaryForeground,
    '--theme-danger-foreground': dangerForeground,
    '--font-display': tokens.fontDisplay,
    '--font-body': tokens.fontBody,
    '--font-caption': tokens.fontCaption,
    '--font-mono': tokens.fontMono,
    '--radius': `${tokens.cornerRadiusButton}px`,
    '--panel-radius': `${tokens.cornerRadiusCard}px`,
    '--panel-radius-lg': `${tokens.cornerRadiusPanel}px`,
    '--panel-highlight': toCssColor(tokens.glassHighlight),
    '--panel-shadow': `0 24px 80px ${toCssColor(tokens.glassShadow)}`,
    '--panel-shadow-soft': `0 18px 48px ${withAlpha(tokens.glassShadow, 0.58)}`,
    '--panel-shadow-strong': `0 32px 96px ${withAlpha(tokens.glassShadow, 0.84)}`,
    '--overlay-scrim': withAlpha(tokens.appBackground, theme.appearance === 'dark' ? 0.74 : 0.42),
    '--warning-bg': withAlpha(tokens.warning, theme.appearance === 'dark' ? 0.16 : 0.18),
    '--warning-border': withAlpha(tokens.warning, 0.34),
    '--warning-text': pickReadableForeground(tokens.warning, '#2A1600', tokens.textPrimary),
    '--button-gradient': `linear-gradient(135deg, ${tokens.buttonGradient[0]} 0%, ${tokens.buttonGradient[1]} 100%)`,
    '--button-border': withAlpha(tokens.glassHighlight, theme.appearance === 'dark' ? 0.28 : 0.4),
    '--button-shadow': `0 20px 48px ${withAlpha(tokens.glassShadow, 0.58)}`,
  } as const

  for (const [name, value] of Object.entries(themeVars)) {
    root.style.setProperty(name, value)
  }
}

export function applyAppearanceToDocument(
  preferences: AppearancePreferences,
  resolvedAppearance: ResolvedAppearance,
): void {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.dataset.themeId = preferences.themeId
  root.dataset.appearance = resolvedAppearance
  root.dataset.surfaceMode = preferences.surfaceMode
  root.classList.toggle('dark', resolvedAppearance === 'dark')
  root.style.colorScheme = resolvedAppearance

  applyThemeVariables(root, preferences)
}

export function applyStoredAppearanceToDocument(): AppearancePreferences {
  const preferences = readStoredAppearancePreferences()
  applyAppearanceToDocument(
    preferences,
    resolveAppearanceMode(preferences.themeId),
  )
  return preferences
}
