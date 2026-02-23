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
  /** Generic relationship fields: any frontmatter key whose value contains wikilinks. */
  relationships: Record<string, string[]>
  /** Phosphor icon name (kebab-case) for Type entries, e.g. "cooking-pot" */
  icon: string | null
  /** Accent color key for Type entries: "red" | "purple" | "blue" | "green" | "yellow" | "orange" */
  color: string | null
  /** Display order for Type entries in sidebar (lower = higher). null = use default order. */
  order: number | null
}

export interface GitCommit {
  hash: string
  shortHash: string
  message: string
  author: string
  date: number // unix timestamp
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

export type SidebarSelection =
  | { kind: 'filter'; filter: 'all' | 'favorites' | 'archived' | 'trash' }
  | { kind: 'sectionGroup'; type: string }
  | { kind: 'entity'; entry: VaultEntry }
  | { kind: 'topic'; entry: VaultEntry }
