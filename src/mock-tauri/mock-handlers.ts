/**
 * Mock command handlers for Tauri invoke calls.
 * Each handler simulates a Tauri backend command.
 */

import type { VaultEntry, VaultConfig, ModifiedFile, Settings, DeviceFlowStart, DeviceFlowPollResult, GitHubUser, GitPullResult, GitPushResult, LastCommitInfo, ThemeFile, VaultSettings, PulseCommit } from '../types'
import { MOCK_CONTENT } from './mock-content'
import { MOCK_ENTRIES } from './mock-entries'

function syncWindowContent(): void {
  if (typeof window !== 'undefined') {
    window.__mockContent = MOCK_CONTENT
  }
}

function mockFileHistory(path: string) {
  const filename = path.split('/').pop()?.replace('.md', '') ?? 'unknown'
  const ts = Math.floor(Date.now() / 1000)
  return [
    { hash: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0', shortHash: 'a1b2c3d', message: `Update ${filename} with latest changes`, author: 'Luca Rossi', date: ts - 86400 * 2 },
    { hash: 'e4f5g6h7i8j9k0l1m2n3o4p5q6r7s8t9u0v1w2x3', shortHash: 'e4f5g6h', message: `Add new section to ${filename}`, author: 'Luca Rossi', date: ts - 86400 * 5 },
    { hash: 'i7j8k9l0m1n2o3p4q5r6s7t8u9v0w1x2y3z4a5b6', shortHash: 'i7j8k9l', message: `Fix formatting in ${filename}`, author: 'Luca Rossi', date: ts - 86400 * 12 },
    { hash: 'm0n1o2p3q4r5s6t7u8v9w0x1y2z3a4b5c6d7e8f9', shortHash: 'm0n1o2p', message: `Create ${filename}`, author: 'Luca Rossi', date: ts - 86400 * 30 },
  ]
}

function mockModifiedFiles(): ModifiedFile[] {
  return [
    { path: '/Users/luca/Laputa/project/26q1-laputa-app.md', relativePath: 'project/26q1-laputa-app.md', status: 'modified' },
    { path: '/Users/luca/Laputa/note/facebook-ads-strategy.md', relativePath: 'note/facebook-ads-strategy.md', status: 'modified' },
    { path: '/Users/luca/Laputa/essay/ai-agents-primer.md', relativePath: 'essay/ai-agents-primer.md', status: 'added' },
  ]
}

function mockFileDiff(path: string): string {
  const filename = path.split('/').pop() ?? 'unknown'
  return `diff --git a/${filename} b/${filename}
index abc1234..def5678 100644
--- a/${filename}
+++ b/${filename}
@@ -1,8 +1,10 @@
 ---
 title: Example Note
 type: Note
+status: Active
 ---

 # Example Note

-This is the original content.
+This is the updated content.
+
+A new paragraph has been added.`
}

function mockFileDiffAtCommit(path: string, commitHash: string): string {
  const filename = path.split('/').pop() ?? 'unknown'
  const shortHash = commitHash.slice(0, 7)
  return `diff --git a/${filename} b/${filename}
index abc1234..${shortHash} 100644
--- a/${filename}
+++ b/${filename}
@@ -5,3 +5,5 @@
 ---

 # Example Note
-Old paragraph from before ${shortHash}.
+Updated paragraph at commit ${shortHash}.
+
+New content added in this commit.`
}

let mockHasChanges = true
const mockSavedSinceCommit = new Set<string>()

let mockSettings: Settings = {
  anthropic_key: null,
  openai_key: null,
  google_key: null,
  github_token: null,
  github_username: null,
  auto_pull_interval_minutes: 5,
}

let mockLastVaultPath: string | null = null

let mockVaultSettings: VaultSettings = { theme: null }

let mockVaultList: { vaults: Array<{ label: string; path: string }>; active_vault: string | null } = {
  vaults: [],
  active_vault: null,
}

const mockThemes: ThemeFile[] = [
  {
    id: 'default', name: 'Default', description: 'Light theme with warm, paper-like tones',
    colors: { background: '#FFFFFF', foreground: '#37352F', primary: '#155DFF', 'sidebar-background': '#F7F6F3', border: '#E9E9E7', muted: '#F0F0EF' },
    typography: { 'font-family': "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", 'font-size-base': '14px' },
    spacing: { 'sidebar-width': '250px' },
  },
  {
    id: 'dark', name: 'Dark', description: 'Dark variant with deep navy tones',
    colors: { background: '#0f0f1a', foreground: '#e0e0e0', primary: '#155DFF', 'sidebar-background': '#1a1a2e', border: '#2a2a4a', muted: '#1e1e3a' },
    typography: { 'font-family': "'Inter', -apple-system, BlinkMacSystemFont, sans-serif", 'font-size-base': '14px' },
    spacing: { 'sidebar-width': '250px' },
  },
  {
    id: 'minimal', name: 'Minimal', description: 'High contrast, minimal chrome',
    colors: { background: '#FAFAFA', foreground: '#111111', primary: '#000000', 'sidebar-background': '#F5F5F5', border: '#E0E0E0', muted: '#F5F5F5' },
    typography: { 'font-family': "'SF Mono', 'Menlo', monospace", 'font-size-base': '13px' },
    spacing: { 'sidebar-width': '220px' },
  },
]

let mockDeviceFlowPollCount = 0

function handleRenameNote(args: { vault_path: string; old_path: string; new_title: string; old_title?: string | null }) {
  const oldEntry = MOCK_ENTRIES.find(e => e.path === args.old_path)
  const oldTitle = args.old_title ?? oldEntry?.title ?? ''
  if (oldTitle === args.new_title) {
    return { new_path: args.old_path, updated_files: 0 }
  }

  const oldContent = MOCK_CONTENT[args.old_path] ?? ''
  const slug = args.new_title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const parentDir = args.old_path.replace(/\/[^/]+$/, '')
  const newPath = `${parentDir}/${slug}.md`
  const newContent = oldContent.replace(/^# .+$/m, `# ${args.new_title}`)

  delete MOCK_CONTENT[args.old_path]
  MOCK_CONTENT[newPath] = newContent
  let updatedFiles = 0
  if (oldTitle) {
    const pattern = new RegExp(`\\[\\[${oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\|[^\\]]*?)?\\]\\]`, 'g')
    for (const [path, content] of Object.entries(MOCK_CONTENT)) {
      if (path === newPath) continue
      const replaced = content.replace(pattern, (_m: string, pipe: string | undefined) =>
        pipe ? `[[${args.new_title}${pipe}]]` : `[[${args.new_title}]]`
      )
      if (replaced !== content) {
        MOCK_CONTENT[path] = replaced
        updatedFiles++
      }
    }
  }

  syncWindowContent()
  return { new_path: newPath, updated_files: updatedFiles }
}

const trimOrNull = (v: string | null | undefined): string | null => v?.trim() || null

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock handler map accepts heterogeneous arg types
export const mockHandlers: Record<string, (args: any) => any> = {
  list_vault: () => MOCK_ENTRIES,
  reload_vault: () => MOCK_ENTRIES,
  reload_vault_entry: (args: { path: string }) => MOCK_ENTRIES.find(e => e.path === args.path) ?? { path: args.path, title: 'Unknown', filename: 'unknown.md', aliases: [], belongsTo: [], relatedTo: [], archived: false, trashed: false, snippet: '', wordCount: 0, fileSize: 0, relationships: {}, outgoingLinks: [], properties: {} },
  get_note_content: (args: { path: string }) => MOCK_CONTENT[args.path] ?? '',
  get_all_content: () => MOCK_CONTENT,
  get_file_history: (args: { path: string }) => mockFileHistory(args.path),
  get_modified_files: () => {
    const base = mockHasChanges ? mockModifiedFiles() : []
    const basePaths = new Set(base.map(f => f.path))
    const extra: ModifiedFile[] = [...mockSavedSinceCommit]
      .filter(p => !basePaths.has(p))
      .map(p => ({ path: p, relativePath: p.replace(/^.*?\/Laputa\//, ''), status: 'modified' as const }))
    return [...base, ...extra]
  },
  get_file_diff: (args: { path: string }) => mockFileDiff(args.path),
  get_file_diff_at_commit: (args: { path: string; commitHash: string }) => mockFileDiffAtCommit(args.path, args.commitHash),
  git_commit: (args: { message: string }) => {
    const count = (mockHasChanges ? mockModifiedFiles().length : 0) + mockSavedSinceCommit.size
    mockHasChanges = false
    mockSavedSinceCommit.clear()
    return `[main abc1234] ${args.message}\n ${count} files changed`
  },
  get_build_number: () => 'bDEV',
  get_last_commit_info: (): LastCommitInfo => ({ shortHash: 'a1b2c3d', commitUrl: 'https://github.com/lucaong/laputa-vault/commit/a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0' }),
  git_pull: (): GitPullResult => ({ status: 'up_to_date', message: 'Already up to date', updatedFiles: [], conflictFiles: [] }),
  git_push: (): GitPushResult => ({ status: 'ok', message: 'Pushed to remote' }),
  get_vault_pulse: (args: { limit?: number }): PulseCommit[] => {
    const limit = args.limit ?? 30
    const ts = Math.floor(Date.now() / 1000)
    const commits: PulseCommit[] = [
      { hash: 'a1b2c3d4e5f6', shortHash: 'a1b2c3d', message: 'Update project notes and add new experiment', date: ts - 3600, githubUrl: 'https://github.com/lucaong/laputa-vault/commit/a1b2c3d4e5f6', files: [{ path: 'project/26q1-laputa-app.md', status: 'modified', title: '26q1 laputa app' }, { path: 'experiment/ai-search.md', status: 'added', title: 'ai search' }], added: 1, modified: 1, deleted: 0 },
      { hash: 'b2c3d4e5f6g7', shortHash: 'b2c3d4e', message: 'Reorganize people notes', date: ts - 86400, githubUrl: 'https://github.com/lucaong/laputa-vault/commit/b2c3d4e5f6g7', files: [{ path: 'person/alice-johnson.md', status: 'modified', title: 'alice johnson' }, { path: 'person/bob-smith.md', status: 'modified', title: 'bob smith' }, { path: 'person/old-contact.md', status: 'deleted', title: 'old contact' }], added: 0, modified: 2, deleted: 1 },
      { hash: 'c3d4e5f6g7h8', shortHash: 'c3d4e5f', message: 'Add daily journal entry', date: ts - 172800, githubUrl: null, files: [{ path: 'note/2026-03-03.md', status: 'added', title: '2026 03 03' }], added: 1, modified: 0, deleted: 0 },
    ]
    return commits.slice(0, limit)
  },
  get_conflict_files: (): string[] => [],
  get_conflict_mode: () => 'none',
  check_claude_cli: () => ({ installed: false, version: null }),
  stream_claude_chat: () => 'mock-session',
  stream_claude_agent: () => null,
  save_note_content: (args: { path: string; content: string }) => {
    MOCK_CONTENT[args.path] = args.content
    mockSavedSinceCommit.add(args.path)
    syncWindowContent()
    return null
  },
  save_image: (args: { vault_path?: string; filename: string; data: string }) => {
    const vault = args.vault_path ?? '/Users/luca/Laputa'
    return `${vault}/attachments/${Date.now()}-${args.filename}`
  },
  copy_image_to_vault: (args: { vault_path?: string; source_path: string }) => {
    const vault = args.vault_path ?? '/Users/luca/Laputa'
    const filename = args.source_path.split('/').pop() ?? 'image.png'
    return `${vault}/attachments/${Date.now()}-${filename}`
  },
  get_settings: () => ({ ...mockSettings }),
  save_settings: (args: { settings: Settings }) => {
    const s = args.settings
    mockSettings = {
      anthropic_key: trimOrNull(s.anthropic_key),
      openai_key: trimOrNull(s.openai_key),
      google_key: trimOrNull(s.google_key),
      github_token: trimOrNull(s.github_token),
      github_username: trimOrNull(s.github_username),
      auto_pull_interval_minutes: s.auto_pull_interval_minutes ?? 5,
    }
    return null
  },
  load_vault_list: () => ({ ...mockVaultList, vaults: [...mockVaultList.vaults] }),
  save_vault_list: (args: { list: typeof mockVaultList }) => { mockVaultList = { ...args.list }; return null },
  rename_note: handleRenameNote,
  move_note_to_type_folder: (args: { vault_path: string; note_path: string; new_type: string }) => {
    const slug = args.new_type.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const currentFolder = args.note_path.replace(/\/[^/]+$/, '').split('/').pop() ?? ''
    if (currentFolder === slug) return { new_path: args.note_path, updated_links: 0, moved: false }
    const filename = args.note_path.split('/').pop() ?? ''
    const vaultPath = args.vault_path.replace(/\/$/, '')
    // Handle collisions: append -2, -3, etc. if the target path already exists
    // (mirrors the Rust unique_dest_path logic).
    let newPath = `${vaultPath}/${slug}/${filename}`
    if (newPath in MOCK_CONTENT && newPath !== args.note_path) {
      const stem = filename.replace(/\.md$/, '')
      const ext = filename.endsWith('.md') ? '.md' : ''
      let counter = 2
      while (`${vaultPath}/${slug}/${stem}-${counter}${ext}` in MOCK_CONTENT) counter++
      newPath = `${vaultPath}/${slug}/${stem}-${counter}${ext}`
    }
    const content = MOCK_CONTENT[args.note_path] ?? ''
    delete MOCK_CONTENT[args.note_path]
    MOCK_CONTENT[newPath] = content
    syncWindowContent()
    return { new_path: newPath, updated_links: 0, moved: true }
  },
  github_list_repos: () => [
    { name: 'laputa-vault', full_name: 'lucaong/laputa-vault', description: 'Personal knowledge vault — markdown + YAML frontmatter', private: true, clone_url: 'https://github.com/lucaong/laputa-vault.git', html_url: 'https://github.com/lucaong/laputa-vault', updated_at: '2026-02-20T10:30:00Z' },
    { name: 'laputa-app', full_name: 'lucaong/laputa-app', description: 'Laputa desktop app — Tauri + React + CodeMirror 6', private: false, clone_url: 'https://github.com/lucaong/laputa-app.git', html_url: 'https://github.com/lucaong/laputa-app', updated_at: '2026-02-19T15:00:00Z' },
    { name: 'dotfiles', full_name: 'lucaong/dotfiles', description: 'My macOS dotfiles and config', private: false, clone_url: 'https://github.com/lucaong/dotfiles.git', html_url: 'https://github.com/lucaong/dotfiles', updated_at: '2026-01-15T08:00:00Z' },
    { name: 'notes-archive', full_name: 'lucaong/notes-archive', description: 'Archived notes from 2024', private: true, clone_url: 'https://github.com/lucaong/notes-archive.git', html_url: 'https://github.com/lucaong/notes-archive', updated_at: '2025-12-01T12:00:00Z' },
    { name: 'obsidian-vault', full_name: 'lucaong/obsidian-vault', description: null, private: true, clone_url: 'https://github.com/lucaong/obsidian-vault.git', html_url: 'https://github.com/lucaong/obsidian-vault', updated_at: '2025-11-05T09:00:00Z' },
  ],
  github_create_repo: (args: { name: string; private: boolean }) => ({
    name: args.name, full_name: `lucaong/${args.name}`, description: 'Laputa vault', private: args.private,
    clone_url: `https://github.com/lucaong/${args.name}.git`, html_url: `https://github.com/lucaong/${args.name}`,
    updated_at: new Date().toISOString(),
  }),
  clone_repo: (args: { url: string; local_path: string }) => `Cloned to ${args.local_path}`,
  purge_trash: () => [],
  delete_note: (args: { path: string }) => args.path,
  migrate_is_a_to_type: () => 0,
  batch_archive_notes: (args: { paths: string[] }) => args.paths.length,
  batch_trash_notes: (args: { paths: string[] }) => args.paths.length,
  github_device_flow_start: (): DeviceFlowStart => {
    mockDeviceFlowPollCount = 0
    return { device_code: 'mock_device_code_abc123', user_code: 'ABCD-1234', verification_uri: 'https://github.com/login/device', expires_in: 900, interval: 5 }
  },
  github_device_flow_poll: (): DeviceFlowPollResult => {
    mockDeviceFlowPollCount++
    if (mockDeviceFlowPollCount <= 1) {
      return { status: 'pending', access_token: null, error: 'authorization_pending' }
    }
    return { status: 'complete', access_token: 'gho_mock_oauth_token_xyz', error: null }
  },
  github_get_user: (): GitHubUser => ({ login: 'lucaong', name: 'Luca Ongaro', avatar_url: 'https://avatars.githubusercontent.com/u/123456?v=4' }),
  search_vault: (args: { query: string; mode: string }) => {
    const q = (args.query ?? '').toLowerCase()
    if (!q) return { results: [], elapsed_ms: 0, query: q, mode: args.mode }
    const matches = MOCK_ENTRIES
      .filter(e => {
        if (e.trashed) return false
        const content = MOCK_CONTENT[e.path] ?? ''
        return e.title.toLowerCase().includes(q) || content.toLowerCase().includes(q)
      })
      .slice(0, 20)
      .map((e, i) => ({
        title: e.title,
        path: e.path,
        snippet: e.snippet || '',
        score: 1.0 - i * 0.05,
        note_type: e.isA,
      }))
    return { results: matches, elapsed_ms: 42, query: q, mode: args.mode }
  },
  get_last_vault_path: () => mockLastVaultPath,
  set_last_vault_path: (args: { path: string }) => { mockLastVaultPath = args.path; return null },
  get_default_vault_path: () => '/Users/mock/Documents/Getting Started',
  check_vault_exists: (args: { path: string }) => {
    // In mock mode, the demo-vault-v2 path always "exists"
    return args.path.includes('demo-vault-v2')
  },
  create_getting_started_vault: () => '/Users/mock/Documents/Getting Started',
  register_mcp_tools: () => 'registered',
  check_mcp_status: () => 'installed',
  get_index_status: () => ({ available: true, qmd_installed: true, collection_exists: true, indexed_count: 100, embedded_count: 80, pending_embed: 0, last_indexed_commit: 'abc123', last_indexed_at: Math.floor(Date.now() / 1000) - 3600 }),
  start_indexing: () => null,
  trigger_incremental_index: () => null,
  list_themes: (): ThemeFile[] => [...mockThemes],
  get_theme: (args: { themeId: string }): ThemeFile => {
    const t = mockThemes.find(t => t.id === args.themeId)
    if (!t) throw new Error(`Theme not found: ${args.themeId}`)
    return { ...t }
  },
  get_vault_settings: (): VaultSettings => ({ ...mockVaultSettings }),
  save_vault_settings: (args: { settings: VaultSettings }) => { mockVaultSettings = { ...args.settings }; return null },
  set_active_theme: (args: { themeId: string }) => { mockVaultSettings.theme = args.themeId; return null },
  create_theme: (args: { sourceId?: string }): string => {
    const sourceId = args.sourceId ?? 'default'
    const source = mockThemes.find(t => t.id === sourceId) ?? mockThemes[0]
    const newId = `untitled-${mockThemes.length}`
    mockThemes.push({ ...source, id: newId, name: 'Untitled Theme' })
    return newId
  },
  create_vault_theme: (args: { vaultPath: string; name?: string | null }): string => {
    const displayName = args.name ?? 'Untitled Theme'
    const slug = displayName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'untitled-theme'
    const path = `${args.vaultPath}/theme/${slug}.md`
    MOCK_CONTENT[path] = `---
type: Theme
title: ${displayName}
primary: "#155DFF"
background: "#FFFFFF"
foreground: "#37352F"
sidebar: "#F7F6F3"
border: "#E9E9E7"
muted: "#F0F0EF"
muted-foreground: "#9B9A97"
accent: "#F0F7FF"
accent-foreground: "#0A3B8F"
font-family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif"
font-size-base: 14
line-height-base: 1.6
---

# ${displayName}
`
    const now = Date.now() / 1000
    MOCK_ENTRIES.push({
      path, filename: `${slug}.md`, title: displayName, isA: 'Theme',
      aliases: [], belongsTo: [], relatedTo: [], status: null, owner: null,
      cadence: null, archived: false, trashed: false, trashedAt: null,
      modifiedAt: now, createdAt: now, fileSize: 512, snippet: `A custom ${displayName} theme.`,
      wordCount: 10, relationships: {}, icon: null, color: null, order: null,
      sidebarLabel: null, template: null, sort: null, view: null, visible: null,
      outgoingLinks: [], properties: {},
    })
    syncWindowContent()
    return path
  },
  ensure_vault_themes: (): null => null,
  restore_default_themes: (): string => 'Default themes restored',
  repair_vault: (): string => 'Vault repaired',
  get_vault_config: (): VaultConfig => ({ zoom: null, view_mode: null, tag_colors: null, status_colors: null, property_display_modes: null }),
  save_vault_config: (): null => null,
}

export function addMockEntry(_entry: VaultEntry, content: string): void {
  MOCK_CONTENT[_entry.path] = content
  syncWindowContent()
}

export function updateMockContent(path: string, content: string): void {
  MOCK_CONTENT[path] = content
  syncWindowContent()
}

export function trackMockChange(path: string): void {
  mockSavedSinceCommit.add(path)
}
