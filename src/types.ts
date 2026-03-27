export interface VaultEntry {
  path: string
  filename: string
  title: string
  isA: string | null
  aliases: string[]
  belongsTo: string[]
  relatedTo: string[]
  status: string | null
  // Note: owner and cadence are now stored in the generic `properties` map,
  // accessed via entry.properties?.Owner and entry.properties?.Cadence
  archived: boolean
  trashed: boolean
  trashedAt: number | null
  modifiedAt: number | null
  createdAt: number | null
  fileSize: number
  snippet: string
  wordCount: number
  /** Generic relationship fields: any frontmatter key whose value contains wikilinks. */
  relationships: Record<string, string[]>
  /** Phosphor icon name (kebab-case) for Type entries, e.g. "cooking-pot" */
  icon: string | null
  /** Accent color key for Type entries: "red" | "purple" | "blue" | "green" | "yellow" | "orange" */
  color: string | null
  /** Display order for Type entries in sidebar (lower = higher). null = use default order. */
  order: number | null
  /** Custom sidebar section label for Type entries, overriding auto-pluralization. */
  sidebarLabel: string | null
  /** Markdown template for Type entries. Pre-fills new notes created with this type. */
  template: string | null
  /** Default sort preference for the note list of this Type. Format: "option:direction". */
  sort: string | null
  /** Default view mode for the note list of this Type: "all", "editor-list", or "editor-only". */
  view: string | null
  /** Whether this Type is visible in the sidebar. Defaults to true when absent. */
  visible: boolean | null
  /** All wikilink targets found in the note content. Extracted from [[target]] patterns. */
  outgoingLinks: string[]
  /** Custom scalar frontmatter properties (non-relationship, non-structural). */
  properties: Record<string, string | number | boolean | null>
}

export type NoteStatus = 'new' | 'modified' | 'clean' | 'pendingSave' | 'unsaved'

export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: number // unix timestamp
}

export interface LastCommitInfo {
  shortHash: string
  commitUrl: string | null
}

export interface ModifiedFile {
  path: string
  relativePath: string
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'renamed'
}

export interface Settings {
  anthropic_key: string | null
  openai_key: string | null
  google_key: string | null
  github_token: string | null
  github_username: string | null
  auto_pull_interval_minutes: number | null
  telemetry_consent: boolean | null
  crash_reporting_enabled: boolean | null
  analytics_enabled: boolean | null
  anonymous_id: string | null
  update_channel: string | null
}

export interface GitPullResult {
  status: 'up_to_date' | 'updated' | 'conflict' | 'no_remote' | 'error'
  message: string
  updatedFiles: string[]
  conflictFiles: string[]
}

export interface GitPushResult {
  status: 'ok' | 'rejected' | 'auth_error' | 'network_error' | 'error'
  message: string
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict' | 'pull_required'

export interface GitRemoteStatus {
  branch: string
  ahead: number
  behind: number
  hasRemote: boolean
}

export interface DeviceFlowStart {
  device_code: string
  user_code: string
  verification_uri: string
  expires_in: number
  interval: number
}

export interface DeviceFlowPollResult {
  status: 'pending' | 'complete' | 'expired' | 'error'
  access_token: string | null
  error: string | null
}

export interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
}

export interface GithubRepo {
  name: string
  full_name: string
  description: string | null
  private: boolean
  clone_url: string
  html_url: string
  updated_at: string | null
}

export interface SearchResult {
  title: string
  path: string
  snippet: string
  score: number
  noteType: string | null
}

export interface SearchResponse {
  results: SearchResult[]
  elapsedMs: number
  query: string
  mode: string
}

export type SearchMode = 'keyword' | 'semantic' | 'hybrid'

/** Vault-wide UI configuration stored in ui.config.md at vault root. */
export interface VaultConfig {
  zoom: number | null
  view_mode: string | null
  editor_mode: string | null
  tag_colors: Record<string, string> | null
  status_colors: Record<string, string> | null
  property_display_modes: Record<string, string> | null
}

export interface PulseFile {
  path: string
  status: 'added' | 'modified' | 'deleted'
  title: string
}

export interface PulseCommit {
  hash: string
  shortHash: string
  message: string
  date: number
  githubUrl: string | null
  files: PulseFile[]
  added: number
  modified: number
  deleted: number
}

export type SidebarFilter = 'all' | 'archived' | 'trash' | 'changes' | 'pulse' | 'inbox'

export type InboxPeriod = 'week' | 'month' | 'quarter' | 'all'

export type SidebarSelection =
  | { kind: 'filter'; filter: SidebarFilter }
  | { kind: 'sectionGroup'; type: string }
  | { kind: 'entity'; entry: VaultEntry }
