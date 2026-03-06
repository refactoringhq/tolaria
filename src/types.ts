export interface VaultEntry {
  path: string
  filename: string
  title: string
  isA: string | null
  aliases: string[]
  belongsTo: string[]
  relatedTo: string[]
  status: string | null
  owner: string | null
  cadence: string | null
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
}

export interface GitPullResult {
  status: 'up_to_date' | 'updated' | 'conflict' | 'no_remote' | 'error'
  message: string
  updatedFiles: string[]
  conflictFiles: string[]
}

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'conflict'

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

export interface ThemeFile {
  /** For vault-based themes: absolute note path. For legacy JSON themes: filename stem. */
  id: string
  name: string
  description: string
  /** Absolute path to the vault note (vault-based themes only). */
  path?: string
  colors: Record<string, string>
  typography: Record<string, string>
  spacing: Record<string, string>
}

export interface VaultSettings {
  theme: string | null
}

/** Vault-wide UI configuration stored in config/ui.config.md. */
export interface VaultConfig {
  zoom: number | null
  view_mode: string | null
  tag_colors: Record<string, string> | null
  status_colors: Record<string, string> | null
  property_display_modes: Record<string, string> | null
  hidden_sections: string[] | null
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

export type SidebarFilter = 'all' | 'favorites' | 'archived' | 'trash' | 'changes' | 'pulse'

export type SidebarSelection =
  | { kind: 'filter'; filter: SidebarFilter }
  | { kind: 'sectionGroup'; type: string }
  | { kind: 'entity'; entry: VaultEntry }
  | { kind: 'topic'; entry: VaultEntry }
