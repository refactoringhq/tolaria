import {
  AI_AGENT_DEFINITIONS,
  createMissingAiAgentsStatus,
  getAiAgentDefinition,
  resolveDefaultAiAgent,
  type AiAgentId,
  type AiAgentsStatus,
} from '../lib/aiAgents'
import {
  useState,
  useRef,
  useCallback,
  useEffect,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react'
import { Moon, Sun, X } from '@phosphor-icons/react'
import type { Settings } from '../types'
import {
  DEFAULT_THEME_MODE,
  readStoredThemeMode,
  type ThemeMode,
} from '../lib/themeMode'
import { normalizeReleaseChannel, serializeReleaseChannel, type ReleaseChannel } from '../lib/releaseChannel'
import { trackEvent } from '../lib/telemetry'
import { Button } from './ui/button'
import { Checkbox, type CheckedState } from './ui/checkbox'
import { Input } from './ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select'
import { Switch } from './ui/switch'

interface SettingsPanelProps {
  open: boolean
  settings: Settings
  aiAgentsStatus?: AiAgentsStatus
  onSave: (settings: Settings) => void
  isGitVault?: boolean
  explicitOrganizationEnabled?: boolean
  onSaveExplicitOrganization?: (enabled: boolean) => void
  onClose: () => void
}

interface SettingsDraft {
  pullInterval: number
  autoGitEnabled: boolean
  autoGitIdleThresholdSeconds: number
  autoGitInactiveThresholdSeconds: number
  autoAdvanceInboxAfterOrganize: boolean
  defaultAiAgent: AiAgentId
  releaseChannel: ReleaseChannel
  themeMode: ThemeMode
  initialH1AutoRename: boolean
  crashReporting: boolean
  analytics: boolean
  explicitOrganization: boolean
}

interface SettingsBodyProps {
  pullInterval: number
  setPullInterval: (value: number) => void
  isGitVault: boolean
  autoGitEnabled: boolean
  setAutoGitEnabled: (value: boolean) => void
  autoGitIdleThresholdSeconds: number
  setAutoGitIdleThresholdSeconds: (value: number) => void
  autoGitInactiveThresholdSeconds: number
  setAutoGitInactiveThresholdSeconds: (value: number) => void
  autoAdvanceInboxAfterOrganize: boolean
  setAutoAdvanceInboxAfterOrganize: (value: boolean) => void
  aiAgentsStatus: AiAgentsStatus
  defaultAiAgent: AiAgentId
  setDefaultAiAgent: (value: AiAgentId) => void
  releaseChannel: ReleaseChannel
  setReleaseChannel: (value: ReleaseChannel) => void
  themeMode: ThemeMode
  setThemeMode: (value: ThemeMode) => void
  initialH1AutoRename: boolean
  setInitialH1AutoRename: (value: boolean) => void
  explicitOrganization: boolean
  setExplicitOrganization: (value: boolean) => void
  crashReporting: boolean
  setCrashReporting: (value: boolean) => void
  analytics: boolean
  setAnalytics: (value: boolean) => void
}

const PULL_INTERVAL_OPTIONS = [1, 2, 5, 10, 15, 30] as const
const DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS = 90
const DEFAULT_AUTOGIT_INACTIVE_THRESHOLD_SECONDS = 30

function isSaveShortcut(event: ReactKeyboardEvent): boolean {
  return event.key === 'Enter' && (event.metaKey || event.ctrlKey)
}

function createSettingsDraft(
  settings: Settings,
  explicitOrganizationEnabled: boolean,
): SettingsDraft {
  return {
    pullInterval: settings.auto_pull_interval_minutes ?? 5,
    autoGitEnabled: settings.autogit_enabled ?? false,
    autoGitIdleThresholdSeconds: sanitizePositiveInteger(
      settings.autogit_idle_threshold_seconds,
      DEFAULT_AUTOGIT_IDLE_THRESHOLD_SECONDS,
    ),
    autoGitInactiveThresholdSeconds: sanitizePositiveInteger(
      settings.autogit_inactive_threshold_seconds,
      DEFAULT_AUTOGIT_INACTIVE_THRESHOLD_SECONDS,
    ),
    autoAdvanceInboxAfterOrganize: settings.auto_advance_inbox_after_organize ?? false,
    defaultAiAgent: resolveDefaultAiAgent(settings.default_ai_agent),
    releaseChannel: normalizeReleaseChannel(settings.release_channel),
    themeMode: resolveSettingsDraftThemeMode(settings.theme_mode),
    initialH1AutoRename: settings.initial_h1_auto_rename_enabled ?? true,
    crashReporting: settings.crash_reporting_enabled ?? false,
    analytics: settings.analytics_enabled ?? false,
    explicitOrganization: explicitOrganizationEnabled,
  }
}

function resolveSettingsDraftThemeMode(themeMode: Settings['theme_mode']): ThemeMode {
  if (themeMode) return themeMode
  if (typeof window === 'undefined') return DEFAULT_THEME_MODE
  return readStoredThemeMode(window.localStorage) ?? DEFAULT_THEME_MODE
}

function resolveTelemetryConsent(settings: Settings, draft: SettingsDraft): boolean | null {
  if (draft.crashReporting || draft.analytics) return true
  return settings.telemetry_consent === null ? null : false
}

function resolveAnonymousId(settings: Settings, draft: SettingsDraft): string | null {
  if (draft.crashReporting || draft.analytics) {
    return settings.anonymous_id ?? crypto.randomUUID()
  }

  return settings.anonymous_id
}

function buildSettingsFromDraft(settings: Settings, draft: SettingsDraft): Settings {
  return {
    auto_pull_interval_minutes: draft.pullInterval,
    autogit_enabled: draft.autoGitEnabled,
    autogit_idle_threshold_seconds: draft.autoGitIdleThresholdSeconds,
    autogit_inactive_threshold_seconds: draft.autoGitInactiveThresholdSeconds,
    auto_advance_inbox_after_organize: draft.autoAdvanceInboxAfterOrganize,
    telemetry_consent: resolveTelemetryConsent(settings, draft),
    crash_reporting_enabled: draft.crashReporting,
    analytics_enabled: draft.analytics,
    anonymous_id: resolveAnonymousId(settings, draft),
    release_channel: serializeReleaseChannel(draft.releaseChannel),
    theme_mode: draft.themeMode,
    initial_h1_auto_rename_enabled: draft.initialH1AutoRename,
    default_ai_agent: draft.defaultAiAgent,
  }
}

function trackTelemetryConsentChange(previousAnalytics: boolean, nextAnalytics: boolean): void {
  if (!previousAnalytics && nextAnalytics) trackEvent('telemetry_opted_in')
  if (previousAnalytics && !nextAnalytics) trackEvent('telemetry_opted_out')
}

function isChecked(checked: CheckedState): boolean {
  return checked === true
}

function sanitizePositiveInteger(value: number | null | undefined, fallback: number): number {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 1) return fallback
  return Math.round(value)
}

export function SettingsPanel({
  open,
  settings,
  aiAgentsStatus = createMissingAiAgentsStatus(),
  onSave,
  isGitVault = true,
  explicitOrganizationEnabled = true,
  onSaveExplicitOrganization,
  onClose,
}: SettingsPanelProps) {
  if (!open) return null

  return (
    <SettingsPanelInner
      settings={settings}
      aiAgentsStatus={aiAgentsStatus}
      onSave={onSave}
      isGitVault={isGitVault}
      explicitOrganizationEnabled={explicitOrganizationEnabled}
      onSaveExplicitOrganization={onSaveExplicitOrganization}
      onClose={onClose}
    />
  )
}

type SettingsPanelInnerProps = Omit<SettingsPanelProps, 'open' | 'explicitOrganizationEnabled' | 'aiAgentsStatus' | 'isGitVault'> & {
  aiAgentsStatus: AiAgentsStatus
  isGitVault: boolean
  explicitOrganizationEnabled: boolean
}

function SettingsPanelInner({
  settings,
  aiAgentsStatus,
  onSave,
  isGitVault,
  explicitOrganizationEnabled,
  onSaveExplicitOrganization,
  onClose,
}: SettingsPanelInnerProps) {
  const [draft, setDraft] = useState(() => createSettingsDraft(settings, explicitOrganizationEnabled))
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      const focusTarget = panelRef.current?.querySelector<HTMLElement>('[data-settings-autofocus="true"]')
      focusTarget?.focus()
    }, 50)
    return () => clearTimeout(timer)
  }, [])

  const updateDraft = useCallback(
    <Key extends keyof SettingsDraft>(key: Key, value: SettingsDraft[Key]) => {
      setDraft((current) => ({ ...current, [key]: value }))
    },
    [],
  )

  const handleSave = useCallback(() => {
    trackTelemetryConsentChange(settings.analytics_enabled === true, draft.analytics)
    onSave(buildSettingsFromDraft(settings, draft))
    onSaveExplicitOrganization?.(draft.explicitOrganization)
    onClose()
  }, [draft, onClose, onSave, onSaveExplicitOrganization, settings])

  const handleBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) onClose()
    },
    [onClose],
  )

  const handleKeyDown = useCallback(
    (event: ReactKeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        onClose()
        return
      }

      if (isSaveShortcut(event)) {
        event.preventDefault()
        handleSave()
      }
    },
    [handleSave, onClose],
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'var(--shadow-overlay)' }}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      data-testid="settings-panel"
    >
      <div
        ref={panelRef}
        className="rounded-lg border border-border bg-background shadow-[0_18px_55px_var(--shadow-dialog)]"
        style={{ width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
      >
        <SettingsHeader onClose={onClose} />
        <SettingsBody
          pullInterval={draft.pullInterval}
          setPullInterval={(value) => updateDraft('pullInterval', value)}
          isGitVault={isGitVault}
          autoGitEnabled={draft.autoGitEnabled}
          setAutoGitEnabled={(value) => updateDraft('autoGitEnabled', value)}
          autoGitIdleThresholdSeconds={draft.autoGitIdleThresholdSeconds}
          setAutoGitIdleThresholdSeconds={(value) => updateDraft('autoGitIdleThresholdSeconds', value)}
          autoGitInactiveThresholdSeconds={draft.autoGitInactiveThresholdSeconds}
          setAutoGitInactiveThresholdSeconds={(value) => updateDraft('autoGitInactiveThresholdSeconds', value)}
          autoAdvanceInboxAfterOrganize={draft.autoAdvanceInboxAfterOrganize}
          setAutoAdvanceInboxAfterOrganize={(value) => updateDraft('autoAdvanceInboxAfterOrganize', value)}
          aiAgentsStatus={aiAgentsStatus}
          defaultAiAgent={draft.defaultAiAgent}
          setDefaultAiAgent={(value) => updateDraft('defaultAiAgent', value)}
          releaseChannel={draft.releaseChannel}
          setReleaseChannel={(value) => updateDraft('releaseChannel', value)}
          themeMode={draft.themeMode}
          setThemeMode={(value) => updateDraft('themeMode', value)}
          initialH1AutoRename={draft.initialH1AutoRename}
          setInitialH1AutoRename={(value) => updateDraft('initialH1AutoRename', value)}
          explicitOrganization={draft.explicitOrganization}
          setExplicitOrganization={(value) => updateDraft('explicitOrganization', value)}
          crashReporting={draft.crashReporting}
          setCrashReporting={(value) => updateDraft('crashReporting', value)}
          analytics={draft.analytics}
          setAnalytics={(value) => updateDraft('analytics', value)}
        />
        <SettingsFooter onClose={onClose} onSave={handleSave} />
      </div>
    </div>
  )
}

function SettingsHeader({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{ height: 56, padding: '0 24px', borderBottom: '1px solid var(--border)' }}
    >
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--foreground)' }}>Settings</span>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onClose}
        title="Close settings"
        aria-label="Close settings"
      >
        <X size={16} />
      </Button>
    </div>
  )
}

function SettingsBody({
  pullInterval,
  setPullInterval,
  isGitVault,
  autoGitEnabled,
  setAutoGitEnabled,
  autoGitIdleThresholdSeconds,
  setAutoGitIdleThresholdSeconds,
  autoGitInactiveThresholdSeconds,
  setAutoGitInactiveThresholdSeconds,
  autoAdvanceInboxAfterOrganize,
  setAutoAdvanceInboxAfterOrganize,
  aiAgentsStatus,
  defaultAiAgent,
  setDefaultAiAgent,
  releaseChannel,
  setReleaseChannel,
  themeMode,
  setThemeMode,
  initialH1AutoRename,
  setInitialH1AutoRename,
  explicitOrganization,
  setExplicitOrganization,
  crashReporting,
  setCrashReporting,
  analytics,
  setAnalytics,
}: SettingsBodyProps) {
  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 0, overflow: 'auto' }}>
      <SettingsSection showDivider={false}>
        <SyncAndUpdatesSection
          pullInterval={pullInterval}
          setPullInterval={setPullInterval}
          releaseChannel={releaseChannel}
          setReleaseChannel={setReleaseChannel}
        />
      </SettingsSection>

      <SettingsSection>
        <AutoGitSettingsSection
          isGitVault={isGitVault}
          autoGitEnabled={autoGitEnabled}
          setAutoGitEnabled={setAutoGitEnabled}
          autoGitIdleThresholdSeconds={autoGitIdleThresholdSeconds}
          setAutoGitIdleThresholdSeconds={setAutoGitIdleThresholdSeconds}
          autoGitInactiveThresholdSeconds={autoGitInactiveThresholdSeconds}
          setAutoGitInactiveThresholdSeconds={setAutoGitInactiveThresholdSeconds}
        />
      </SettingsSection>

      <SettingsSection>
        <AppearanceSettingsSection
          themeMode={themeMode}
          setThemeMode={setThemeMode}
        />
      </SettingsSection>

      <SettingsSection>
        <TitleSettingsSection
          initialH1AutoRename={initialH1AutoRename}
          setInitialH1AutoRename={setInitialH1AutoRename}
        />
      </SettingsSection>

      <SettingsSection>
        <AiAgentSettingsSection
          aiAgentsStatus={aiAgentsStatus}
          defaultAiAgent={defaultAiAgent}
          setDefaultAiAgent={setDefaultAiAgent}
        />
      </SettingsSection>

      <SettingsSection>
        <OrganizationWorkflowSection
          checked={explicitOrganization}
          onChange={setExplicitOrganization}
          autoAdvanceInboxAfterOrganize={autoAdvanceInboxAfterOrganize}
          onChangeAutoAdvanceInboxAfterOrganize={setAutoAdvanceInboxAfterOrganize}
        />
      </SettingsSection>

      <SettingsSection>
        <PrivacySettingsSection
          crashReporting={crashReporting}
          setCrashReporting={setCrashReporting}
          analytics={analytics}
          setAnalytics={setAnalytics}
        />
      </SettingsSection>
    </div>
  )
}

function SyncAndUpdatesSection({
  pullInterval,
  setPullInterval,
  releaseChannel,
  setReleaseChannel,
}: Pick<SettingsBodyProps, 'pullInterval' | 'setPullInterval' | 'releaseChannel' | 'setReleaseChannel'>) {
  return (
    <>
      <SectionHeading
        title="Sync & Updates"
        description="Configure background pulling and which update feed Tolaria follows. Stable only receives manually promoted releases, while Alpha follows every push to main."
      />

      <LabeledSelect
        label="Pull interval (minutes)"
        value={`${pullInterval}`}
        onValueChange={(value) => setPullInterval(Number(value))}
        options={PULL_INTERVAL_OPTIONS.map((value) => ({
          value: `${value}`,
          label: `${value}`,
        }))}
        testId="settings-pull-interval"
        autoFocus={true}
      />

      <LabeledSelect
        label="Release channel"
        value={releaseChannel}
        onValueChange={(value) => setReleaseChannel(value as ReleaseChannel)}
        options={[
          { value: 'stable', label: 'Stable' },
          { value: 'alpha', label: 'Alpha' },
        ]}
        testId="settings-release-channel"
      />
    </>
  )
}

function AppearanceSettingsSection({
  themeMode,
  setThemeMode,
}: Pick<SettingsBodyProps, 'themeMode' | 'setThemeMode'>) {
  return (
    <>
      <SectionHeading
        title="Appearance"
        description="Choose the app color mode used for Tolaria chrome, editor surfaces, menus, and dialogs."
      />

      <ThemeModeControl value={themeMode} onChange={setThemeMode} />
    </>
  )
}

function ThemeModeControl({
  value,
  onChange,
}: {
  value: ThemeMode
  onChange: (value: ThemeMode) => void
}) {
  return (
    <div
      className="inline-flex w-full rounded-md border border-border bg-muted p-1"
      role="radiogroup"
      aria-label="Theme"
      data-testid="settings-theme-mode"
    >
      <ThemeModeButton label="Light" selected={value === 'light'} value="light" onSelect={onChange}>
        <Sun size={14} />
      </ThemeModeButton>
      <ThemeModeButton label="Dark" selected={value === 'dark'} value="dark" onSelect={onChange}>
        <Moon size={14} />
      </ThemeModeButton>
    </div>
  )
}

function ThemeModeButton({
  children,
  label,
  selected,
  value,
  onSelect,
}: {
  children: ReactNode
  label: string
  selected: boolean
  value: ThemeMode
  onSelect: (value: ThemeMode) => void
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      role="radio"
      aria-checked={selected}
      aria-label={label}
      data-testid={`settings-theme-${value}`}
      className={
        selected
          ? 'h-7 flex-1 border border-border bg-background text-foreground shadow-xs hover:bg-background'
          : 'h-7 flex-1 text-muted-foreground hover:text-foreground'
      }
      onClick={() => onSelect(value)}
    >
      {children}
      {label}
    </Button>
  )
}

function autoGitSectionDescription(isGitVault: boolean): string {
  return isGitVault
    ? 'Automatically create conservative Git checkpoints after editing pauses or when the app is no longer active.'
    : 'AutoGit is unavailable until the current vault is Git-enabled. Initialize Git for this vault first.'
}

function AutoGitSettingsSection({
  isGitVault,
  autoGitEnabled,
  setAutoGitEnabled,
  autoGitIdleThresholdSeconds,
  setAutoGitIdleThresholdSeconds,
  autoGitInactiveThresholdSeconds,
  setAutoGitInactiveThresholdSeconds,
}: Pick<
  SettingsBodyProps,
  | 'isGitVault'
  | 'autoGitEnabled'
  | 'setAutoGitEnabled'
  | 'autoGitIdleThresholdSeconds'
  | 'setAutoGitIdleThresholdSeconds'
  | 'autoGitInactiveThresholdSeconds'
  | 'setAutoGitInactiveThresholdSeconds'
>) {
  return (
    <>
      <SectionHeading
        title="AutoGit"
        description={autoGitSectionDescription(isGitVault)}
      />

      <SettingsSwitchRow
        label="Enable AutoGit"
        description="When enabled, Tolaria will commit and push saved local changes automatically after an idle pause or after the app becomes inactive."
        checked={autoGitEnabled}
        onChange={setAutoGitEnabled}
        disabled={!isGitVault}
        testId="settings-autogit-enabled"
      />

      <LabeledNumberInput
        label="Idle threshold (seconds)"
        value={autoGitIdleThresholdSeconds}
        onValueChange={setAutoGitIdleThresholdSeconds}
        testId="settings-autogit-idle-threshold"
        disabled={!isGitVault}
      />

      <LabeledNumberInput
        label="Inactive-app grace period (seconds)"
        value={autoGitInactiveThresholdSeconds}
        onValueChange={setAutoGitInactiveThresholdSeconds}
        testId="settings-autogit-inactive-threshold"
        disabled={!isGitVault}
      />
    </>
  )
}

function TitleSettingsSection({
  initialH1AutoRename,
  setInitialH1AutoRename,
}: Pick<SettingsBodyProps, 'initialH1AutoRename' | 'setInitialH1AutoRename'>) {
  return (
    <>
      <SectionHeading
        title="Titles & Filenames"
        description="Choose whether Tolaria automatically syncs untitled note filenames from the first H1 title."
      />

      <SettingsSwitchRow
        label="Auto-rename untitled notes from first H1"
        description="When enabled, Tolaria renames untitled-note files as soon as the first H1 becomes a real title. Turn this off to keep the filename unchanged until you rename it manually from the breadcrumb bar."
        checked={initialH1AutoRename}
        onChange={setInitialH1AutoRename}
        testId="settings-initial-h1-auto-rename"
      />
    </>
  )
}

function buildDefaultAiAgentOptions(aiAgentsStatus: AiAgentsStatus): Array<{ value: string; label: string }> {
  return AI_AGENT_DEFINITIONS.map((definition) => {
    const status = aiAgentsStatus[definition.id]
    const suffix = status.status === 'installed'
      ? ` (installed${status.version ? ` ${status.version}` : ''})`
      : ' (missing)'
    return {
      value: definition.id,
      label: `${definition.label}${suffix}`,
    }
  })
}

function AiAgentSettingsSection({
  aiAgentsStatus,
  defaultAiAgent,
  setDefaultAiAgent,
}: Pick<SettingsBodyProps, 'aiAgentsStatus' | 'defaultAiAgent' | 'setDefaultAiAgent'>) {
  return (
    <>
      <SectionHeading
        title="AI Agents"
        description="Choose which CLI AI agent Tolaria uses in the AI panel and command palette."
      />

      <LabeledSelect
        label="Default AI agent"
        value={defaultAiAgent}
        onValueChange={(value) => setDefaultAiAgent(value as AiAgentId)}
        options={buildDefaultAiAgentOptions(aiAgentsStatus)}
        testId="settings-default-ai-agent"
      />

      <div style={{ fontSize: 11, color: 'var(--muted-foreground)', lineHeight: 1.5 }}>
        {renderDefaultAiAgentSummary(defaultAiAgent, aiAgentsStatus)}
      </div>
    </>
  )
}

function PrivacySettingsSection({
  crashReporting,
  setCrashReporting,
  analytics,
  setAnalytics,
}: Pick<SettingsBodyProps, 'crashReporting' | 'setCrashReporting' | 'analytics' | 'setAnalytics'>) {
  return (
    <>
      <SectionHeading
        title="Privacy & Telemetry"
        description="Anonymous data helps us fix bugs and improve Tolaria. No vault content, note titles, or file paths are ever sent."
      />

      <TelemetryToggle
        label="Crash reporting"
        description="Send anonymous error reports"
        checked={crashReporting}
        onChange={setCrashReporting}
        testId="settings-crash-reporting"
      />
      <TelemetryToggle
        label="Usage analytics"
        description="Share anonymous usage patterns"
        checked={analytics}
        onChange={setAnalytics}
        testId="settings-analytics"
      />
    </>
  )
}

function SettingsSection({
  children,
  showDivider = true,
}: {
  children: ReactNode
  showDivider?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '18px 0' }}>
      {showDivider ? <Divider /> : null}
      {children}
    </div>
  )
}

function SectionHeading({
  title,
  description,
}: {
  title: string
  description: string
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--muted-foreground)',
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--muted-foreground)', lineHeight: 1.55, maxWidth: 420 }}>
        {description}
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'color-mix(in srgb, var(--border) 82%, transparent)' }} />
}

function renderDefaultAiAgentSummary(defaultAiAgent: AiAgentId, aiAgentsStatus: AiAgentsStatus): string {
  const definition = getAiAgentDefinition(defaultAiAgent)
  const status = aiAgentsStatus[defaultAiAgent]
  if (status.status === 'installed') {
    return `${definition.label}${status.version ? ` ${status.version}` : ''} is ready to use.`
  }
  return `${definition.label} is not installed yet. You can still select it now and install it later.`
}

function LabeledSelect({
  label,
  value,
  onValueChange,
  options,
  testId,
  autoFocus = false,
}: {
  label: string
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  testId: string
  autoFocus?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }}>{label}</label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          className="w-full bg-transparent"
          data-testid={testId}
          data-value={value}
          data-settings-autofocus={autoFocus ? 'true' : undefined}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent position="popper" data-anchor-strategy="popper">
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function LabeledNumberInput({
  label,
  value,
  onValueChange,
  testId,
  disabled = false,
}: {
  label: string
  value: number
  onValueChange: (value: number) => void
  testId: string
  disabled?: boolean
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--foreground)' }} htmlFor={testId}>{label}</label>
      <Input
        id={testId}
        type="number"
        min={1}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(sanitizePositiveInteger(Number(event.target.value), value))}
        data-testid={testId}
        className="w-full bg-transparent"
      />
    </div>
  )
}

function OrganizationWorkflowSection({
  checked,
  onChange,
  autoAdvanceInboxAfterOrganize,
  onChangeAutoAdvanceInboxAfterOrganize,
}: {
  checked: boolean
  onChange: (value: boolean) => void
  autoAdvanceInboxAfterOrganize: boolean
  onChangeAutoAdvanceInboxAfterOrganize: (value: boolean) => void
}) {
  return (
    <>
      <SectionHeading
        title="Workflow"
        description="Choose whether Tolaria shows the Inbox workflow, plus how it moves through items while you triage them."
      />

      <SettingsSwitchRow
        label="Organize notes explicitly"
        description="When enabled, an Inbox section shows unorganized notes, and a toggle lets you mark notes as organized."
        checked={checked}
        onChange={onChange}
        testId="settings-explicit-organization"
      />

      <SettingsSwitchRow
        label="Auto-advance to next Inbox item"
        description="When enabled, marking an Inbox note as organized immediately opens the next visible Inbox note."
        checked={autoAdvanceInboxAfterOrganize}
        onChange={onChangeAutoAdvanceInboxAfterOrganize}
        testId="settings-auto-advance-inbox-after-organize"
      />
    </>
  )
}

function SettingsSwitchRow({
  label,
  description,
  checked,
  onChange,
  disabled = false,
  testId,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  disabled?: boolean
  testId?: string
}) {
  return (
    <label
      className="flex items-start justify-between gap-3"
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1 }}
      data-testid={testId}
    >
      <div className="space-y-1">
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} disabled={disabled} />
    </label>
  )
}

function TelemetryToggle({
  label,
  description,
  checked,
  onChange,
  testId,
}: {
  label: string
  description: string
  checked: boolean
  onChange: (value: boolean) => void
  testId: string
}) {
  return (
    <label className="flex items-center gap-3" style={{ cursor: 'pointer' }} data-testid={testId}>
      <Checkbox checked={checked} onCheckedChange={(value) => onChange(isChecked(value))} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--foreground)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{description}</div>
      </div>
    </label>
  )
}

function SettingsFooter({ onClose, onSave }: { onClose: () => void; onSave: () => void }) {
  return (
    <div
      className="flex items-center justify-between shrink-0"
      style={{ height: 56, padding: '0 24px', borderTop: '1px solid var(--border)' }}
    >
      <span style={{ fontSize: 11, color: 'var(--muted-foreground)' }}>{'\u2318'}, to open settings</span>
      <div className="flex gap-2">
        <Button variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={onSave} data-testid="settings-save">
          Save
        </Button>
      </div>
    </div>
  )
}
