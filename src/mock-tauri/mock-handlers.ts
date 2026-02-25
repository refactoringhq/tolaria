/**
 * Mock command handlers for Tauri invoke calls.
 * Each handler simulates a Tauri backend command.
 */

import type { VaultEntry, ModifiedFile, Settings, DeviceFlowStart, DeviceFlowPollResult, GitHubUser } from '../types'
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
  github_token: 'gho_mock_token_for_testing',
  github_username: 'lucaong',
}

let mockDeviceFlowPollCount = 0

function handleAiChat(args: { request: { messages: { role: string; content: string }[]; model?: string; system?: string } }) {
  const lastMsg = args.request.messages[args.request.messages.length - 1]?.content ?? ''
  const lower = lastMsg.toLowerCase()
  let content = `I can help you with that. Could you provide more details about what you'd like to know?`
  if (lower.includes('summarize')) {
    content = `Here's a summary of the note:\n\n**Key Points:**\n- The note covers the main topic and its related concepts\n- It includes actionable items and references to other notes\n- Several wiki-links connect it to the broader knowledge base\n\nWould you like me to expand on any of these points?`
  } else if (lower.includes('expand')) {
    content = `Here are suggestions to expand this note:\n\n1. **Add context** — Include background information\n2. **Link related notes** — Connect to [[related topics]]\n3. **Add examples** — Include concrete examples\n4. **Update status** — Reflect current progress`
  } else if (lower.includes('grammar')) {
    content = `Grammar review complete. The writing is clear and well-structured. Minor suggestions:\n\n- Consider varying sentence lengths for better rhythm\n- A few passive constructions could be made active`
  }
  return { content, model: args.request.model ?? 'claude-3-5-haiku-20241022', stop_reason: 'end_turn' }
}

function handleRenameNote(args: { vault_path: string; old_path: string; new_title: string }) {
  const oldContent = MOCK_CONTENT[args.old_path] ?? ''
  const slug = args.new_title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  const parentDir = args.old_path.replace(/\/[^/]+$/, '')
  const newPath = `${parentDir}/${slug}.md`
  const newContent = oldContent.replace(/^# .+$/m, `# ${args.new_title}`)

  delete MOCK_CONTENT[args.old_path]
  MOCK_CONTENT[newPath] = newContent

  const oldEntry = MOCK_ENTRIES.find(e => e.path === args.old_path)
  const oldTitle = oldEntry?.title ?? ''
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
  git_push: () => 'Everything up-to-date',
  ai_chat: handleAiChat,
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
  get_settings: () => ({ ...mockSettings }),
  save_settings: (args: { settings: Settings }) => {
    const s = args.settings
    mockSettings = {
      anthropic_key: trimOrNull(s.anthropic_key),
      openai_key: trimOrNull(s.openai_key),
      google_key: trimOrNull(s.google_key),
      github_token: trimOrNull(s.github_token),
      github_username: trimOrNull(s.github_username),
    }
    return null
  },
  rename_note: handleRenameNote,
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
  migrate_is_a_to_type: () => 0,
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
}

export function addMockEntry(_entry: VaultEntry, content: string): void {
  MOCK_CONTENT[_entry.path] = content
  syncWindowContent()
}

export function updateMockContent(path: string, content: string): void {
  MOCK_CONTENT[path] = content
  syncWindowContent()
}
