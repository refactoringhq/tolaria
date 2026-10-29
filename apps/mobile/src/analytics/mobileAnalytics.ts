import type { MobileTelemetryContext } from './mobileTelemetryContext'

export type MobileAnalyticsEvent =
  | { name: 'mobile_startup_preview_used' }
  | { name: 'mobile_editor_recovery_requested'; reason: 'contentProcessTerminated' | 'renderProcessGone' | 'initialContentSyncFailed' }
  | { name: 'mobile_update_channel_selected'; channel: 'stable' | 'alpha'; outcome: 'idle' | 'checking' | 'downloading' | 'ready' | 'current' | 'unavailable' | 'failed' | 'restarting' }
  | { name: 'note_created' | 'note_deleted' | 'vault_opened' | 'vault_switched' | 'search_used' | 'commit_made' }
  | { name: 'mobile_git_clone_cancel_requested' }
  | { name: 'mobile_folder_open_failed'; stage: 'picker' | 'import' | 'catalog' | 'prepare' }
  | { name: 'file_preview_opened' | 'file_preview_failed'; preview_kind: 'image' | 'pdf' }
  | { name: 'theme_mode_changed'; mode: 'system' | 'light' | 'dark' }
  | { name: 'mobile_note_swipe_used'; action: 'favorite' | 'archive' | 'delete' }
  | { name: 'mobile_setting_changed'; setting: 'theme' | 'uiScale' | 'autoGit' }
  | { name: 'mobile_git_operation_requested'; operation: 'commit' | 'sync' | 'autoSync' | 'resolveConflicts' }
  | { name: 'mobile_folder_sync_requested'; operation: 'sync' | 'resolveConflicts' }
  | { name: 'mobile_editor_tool_opened'; tool: 'find' | 'replace' | 'slash' | 'filename' }
  | { name: 'mobile_note_link_activated'; kind: 'external' | 'wikilink' }
  | { name: 'mobile_vault_catalog_used'; action: 'add' | 'switch' | 'forget'; kind: 'local' | 'git' }

export type MobileAnalyticsBody = { event: MobileAnalyticsEvent['name']; distinct_id: string; properties: Record<string, string | boolean> }
type Dependencies = {
  configured: boolean
  createId: () => string
  platform: string
  context?: MobileTelemetryContext
  send: (body: MobileAnalyticsBody, signal: AbortSignal) => Promise<void>
}

export function createMobileAnalytics({ configured, createId, platform, context, send }: Dependencies) {
  let enabled = false
  let id: string | null = null
  const requests = new Set<AbortController>()
  const setEnabled = (value: boolean) => {
    enabled = configured && value
    if (enabled) return
    id = null
    for (const request of requests) request.abort()
    requests.clear()
  }
  const capture = (event: MobileAnalyticsEvent) => {
    if (!enabled || requests.size >= 8) return
    id ??= createId()
    const request = new AbortController()
    requests.add(request)
    const timeout = setTimeout(() => request.abort(), 5_000)
    const body = { event: event.name, distinct_id: id, properties: {
      $process_person_profile: false, $geoip_disable: true,
      platform, ...context, ...eventProperties(event),
    } }
    void send(body, request.signal).catch(() => {}).finally(() => {
      clearTimeout(timeout)
      requests.delete(request)
    })
  }
  return { capture, setEnabled }
}

// Select properties explicitly: never spread caller objects into telemetry.
function eventProperties(event: MobileAnalyticsEvent): Record<string, string> {
  if (event.name === 'mobile_note_link_activated') return { kind: event.kind }
  if (event.name === 'mobile_editor_recovery_requested') return { reason: event.reason }
  if (event.name === 'mobile_folder_open_failed') return { stage: event.stage }
  if (event.name === 'mobile_update_channel_selected') return { channel: event.channel, outcome: event.outcome }
  return workspaceEventProperties(event)
}

function workspaceEventProperties(event: MobileAnalyticsEvent): Record<string, string> {
  if (event.name === 'theme_mode_changed') return { mode: event.mode }
  if (event.name === 'mobile_note_swipe_used') return { action: event.action }
  if (event.name === 'mobile_setting_changed') return { setting: event.setting }
  if (event.name === 'mobile_editor_tool_opened') return { tool: event.tool }
  if ('preview_kind' in event) return { preview_kind: event.preview_kind }
  if (event.name === 'mobile_vault_catalog_used') return { action: event.action, kind: event.kind }
  if ('operation' in event) return { operation: event.operation }
  return {}
}
