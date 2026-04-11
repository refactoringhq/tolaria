import { expect, type Page } from '@playwright/test'
import fs from 'fs'
import os from 'os'
import path from 'path'

const FIXTURE_VAULT = path.resolve('tests/fixtures/test-vault')
const FIXTURE_VAULT_READY_TIMEOUT = 30_000
const FIXTURE_VAULT_REMOVE_RETRIES = 10
const FIXTURE_VAULT_REMOVE_RETRY_DELAY_MS = 100

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true })
  for (const item of fs.readdirSync(src, { withFileTypes: true })) {
    const sourcePath = path.join(src, item.name)
    const destinationPath = path.join(dest, item.name)
    if (item.isDirectory()) {
      copyDirSync(sourcePath, destinationPath)
      continue
    }
    fs.copyFileSync(sourcePath, destinationPath)
  }
}

export function createFixtureVaultCopy(): string {
  const tempVaultDir = fs.mkdtempSync(path.join(os.tmpdir(), 'laputa-test-vault-'))
  copyDirSync(FIXTURE_VAULT, tempVaultDir)
  return tempVaultDir
}

export function removeFixtureVaultCopy(tempVaultDir: string | null | undefined): void {
  if (!tempVaultDir) return
  fs.rmSync(tempVaultDir, {
    recursive: true,
    force: true,
    maxRetries: FIXTURE_VAULT_REMOVE_RETRIES,
    retryDelay: FIXTURE_VAULT_REMOVE_RETRY_DELAY_MS,
  })
}

export async function openFixtureVault(
  page: Page,
  vaultPath: string,
): Promise<void> {
  await page.addInitScript((resolvedVaultPath: string) => {
    localStorage.clear()

    const nativeFetch = window.fetch.bind(window)
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const requestUrl = typeof input === 'string'
        ? input
        : input instanceof Request
          ? input.url
          : input.toString()

      if (requestUrl.endsWith('/api/vault/ping') || requestUrl.includes('/api/vault/ping?')) {
        return Promise.resolve(new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }))
      }

      return nativeFetch(input, init)
    }

    const applyFixtureVaultOverrides = (
      handlers: Record<string, ((args?: unknown) => unknown)> | null | undefined,
    ) => {
      if (!handlers) return handlers
      handlers.load_vault_list = () => ({
        vaults: [{ label: 'Test Vault', path: resolvedVaultPath }],
        active_vault: resolvedVaultPath,
        hidden_defaults: [],
      })
      handlers.check_vault_exists = () => true
      handlers.get_last_vault_path = () => resolvedVaultPath
      handlers.get_default_vault_path = () => resolvedVaultPath
      handlers.save_vault_list = () => null
      return handlers
    }

    let ref = applyFixtureVaultOverrides(
      (window.__mockHandlers as Record<string, ((args?: unknown) => unknown)> | undefined),
    ) ?? null

    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = applyFixtureVaultOverrides(
          value as Record<string, ((args?: unknown) => unknown)> | undefined,
        ) ?? null
      },
      get() {
        return applyFixtureVaultOverrides(ref) ?? ref
      },
    })
  }, vaultPath)

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => Boolean(window.__mockHandlers))
  await page.evaluate((resolvedVaultPath: string) => {
    const handlers = window.__mockHandlers
    if (!handlers) {
      throw new Error('Mock handlers unavailable for fixture vault override')
    }

    handlers.load_vault_list = () => ({
      vaults: [{ label: 'Test Vault', path: resolvedVaultPath }],
      active_vault: resolvedVaultPath,
      hidden_defaults: [],
    })
    handlers.check_vault_exists = () => true
    handlers.get_last_vault_path = () => resolvedVaultPath
    handlers.get_default_vault_path = () => resolvedVaultPath
    handlers.save_vault_list = () => null
  }, vaultPath)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.locator('[data-testid="note-list-container"]').waitFor({ timeout: FIXTURE_VAULT_READY_TIMEOUT })
  await expect(page.getByText('Alpha Project', { exact: true }).first()).toBeVisible({
    timeout: FIXTURE_VAULT_READY_TIMEOUT,
  })
}

export async function openFixtureVaultTauri(
  page: Page,
  vaultPath: string,
): Promise<void> {
  await openFixtureVault(page, vaultPath)
  await page.evaluate((resolvedVaultPath: string) => {
    const jsonHeaders = { 'Content-Type': 'application/json' }
    const nativeFetch = window.fetch.bind(window)

    const FRONTMATTER_OPEN = '---\n'
    const FRONTMATTER_CLOSE = '\n---\n'

    const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

    const splitFrontmatter = (content: string) => {
      if (!content.startsWith(FRONTMATTER_OPEN)) {
        return { frontmatter: null as string | null, body: content }
      }

      const closeIndex = content.indexOf(FRONTMATTER_CLOSE, FRONTMATTER_OPEN.length)
      if (closeIndex === -1) {
        return { frontmatter: null as string | null, body: content }
      }

      return {
        frontmatter: content.slice(FRONTMATTER_OPEN.length, closeIndex),
        body: content.slice(closeIndex + FRONTMATTER_CLOSE.length),
      }
    }

    const splitFrontmatterEntries = (frontmatter: string) => {
      const lines = frontmatter.split('\n')
      const entries: Array<{ key: string; lines: string[] }> = []
      let current: { key: string; lines: string[] } | null = null

      for (const line of lines) {
        const match = line.match(/^([^:\n]+):(.*)$/)
        if (match && !line.startsWith(' ')) {
          if (current) entries.push(current)
          current = { key: match[1].trim(), lines: [line] }
          continue
        }

        if (current) {
          current.lines.push(line)
        } else if (line.trim() !== '') {
          current = { key: '', lines: [line] }
        }
      }

      if (current) entries.push(current)
      return entries
    }

    const serializeFrontmatterValue = (value: unknown): string[] => {
      if (Array.isArray(value)) {
        if (value.length === 0) return ['[]']
        return [''].concat(value.map((item) => `  - ${JSON.stringify(String(item))}`))
      }
      if (typeof value === 'boolean' || typeof value === 'number') {
        return [String(value)]
      }
      return [JSON.stringify(String(value ?? ''))]
    }

    const replaceFrontmatterEntry = (content: string, key: string, value: unknown) => {
      const { frontmatter, body } = splitFrontmatter(content)
      const entryLines = serializeFrontmatterValue(value)
      const nextEntryLines =
        entryLines[0] === ''
          ? [`${key}:`, ...entryLines.slice(1)]
          : [`${key}: ${entryLines[0]}`]

      if (frontmatter === null) {
        return `${FRONTMATTER_OPEN}${nextEntryLines.join('\n')}${FRONTMATTER_CLOSE}${body}`
      }

      const entries = splitFrontmatterEntries(frontmatter).filter((entry) => entry.key !== '')
      const keyPattern = new RegExp(`^${escapeRegExp(key)}$`)
      let replaced = false
      const nextEntries = entries.map((entry) => {
        if (!keyPattern.test(entry.key)) return entry
        replaced = true
        return { key, lines: nextEntryLines }
      })

      if (!replaced) {
        nextEntries.push({ key, lines: nextEntryLines })
      }

      return `${FRONTMATTER_OPEN}${nextEntries.flatMap((entry) => entry.lines).join('\n')}${FRONTMATTER_CLOSE}${body}`
    }

    const removeFrontmatterEntry = (content: string, key: string) => {
      const { frontmatter, body } = splitFrontmatter(content)
      if (frontmatter === null) return content

      const keyPattern = new RegExp(`^${escapeRegExp(key)}$`)
      const nextEntries = splitFrontmatterEntries(frontmatter)
        .filter((entry) => entry.key !== '' && !keyPattern.test(entry.key))

      if (nextEntries.length === 0) {
        return body
      }

      return `${FRONTMATTER_OPEN}${nextEntries.flatMap((entry) => entry.lines).join('\n')}${FRONTMATTER_CLOSE}${body}`
    }

    const persistFrontmatterChange = async (path: string, transform: (content: string) => string) => {
      const current = await readJson(`/api/vault/content?path=${encodeURIComponent(path)}`) as { content: string }
      const updatedContent = transform(current.content)
      await readJson('/api/vault/save', {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify({ path, content: updatedContent }),
      })
      return updatedContent
    }

    const readJson = async (url: string, init?: RequestInit) => {
      const response = await nativeFetch(url, init)
      if (!response.ok) {
        let message = `HTTP ${response.status}`
        try {
          const body = await response.json() as { error?: string }
          message = body.error ?? message
        } catch {
          // Keep the HTTP status fallback when the body is not JSON.
        }
        throw new Error(message)
      }
      return response.json()
    }

    const invoke = async (command: string, args?: Record<string, unknown>) => {
      switch (command) {
        case 'trigger_menu_command': {
          const commandId = String(args?.id ?? '')
          const bridge = window.__laputaTest?.dispatchBrowserMenuCommand
          if (!bridge) throw new Error('Laputa test bridge is missing dispatchBrowserMenuCommand')
          bridge(commandId)
          return null
        }
        case 'load_vault_list':
          return {
            vaults: [{ label: 'Test Vault', path: resolvedVaultPath }],
            active_vault: resolvedVaultPath,
            hidden_defaults: [],
          }
        case 'check_vault_exists':
        case 'is_git_repo':
          return true
        case 'get_last_vault_path':
        case 'get_default_vault_path':
          return resolvedVaultPath
        case 'save_vault_list':
        case 'save_settings':
        case 'register_mcp_tools':
        case 'reinit_telemetry':
        case 'update_menu_state':
          return null
        case 'get_settings':
          return {
            github_token: null,
            github_username: null,
            auto_pull_interval_minutes: 5,
            telemetry_consent: false,
            crash_reporting_enabled: null,
            analytics_enabled: null,
            anonymous_id: null,
            release_channel: null,
          }
        case 'list_vault':
        case 'reload_vault': {
          const path = String(args?.path ?? resolvedVaultPath)
          return readJson(`/api/vault/list?path=${encodeURIComponent(path)}&reload=${command === 'reload_vault' ? '1' : '0'}`)
        }
        case 'list_vault_folders':
        case 'list_views':
        case 'get_modified_files':
        case 'detect_renames':
          return []
        case 'reload_vault_entry':
          return readJson(`/api/vault/entry?path=${encodeURIComponent(String(args?.path ?? ''))}`)
        case 'get_note_content': {
          const data = await readJson(`/api/vault/content?path=${encodeURIComponent(String(args?.path ?? ''))}`) as { content: string }
          return data.content
        }
        case 'get_all_content':
          return readJson(`/api/vault/all-content?path=${encodeURIComponent(String(args?.path ?? resolvedVaultPath))}`)
        case 'save_note_content':
          return readJson('/api/vault/save', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({ path: args?.path, content: args?.content }),
          })
        case 'update_frontmatter':
          return persistFrontmatterChange(
            String(args?.path ?? ''),
            (content) => replaceFrontmatterEntry(content, String(args?.key ?? ''), args?.value),
          )
        case 'delete_frontmatter_property':
          return persistFrontmatterChange(
            String(args?.path ?? ''),
            (content) => removeFrontmatterEntry(content, String(args?.key ?? '')),
          )
        case 'rename_note':
          return readJson('/api/vault/rename', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              vault_path: args?.vaultPath ?? resolvedVaultPath,
              old_path: args?.oldPath,
              new_title: args?.newTitle,
              old_title: args?.oldTitle ?? null,
            }),
          })
        case 'rename_note_filename':
          return readJson('/api/vault/rename-filename', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              vault_path: args?.vaultPath ?? resolvedVaultPath,
              old_path: args?.oldPath,
              new_filename_stem: args?.newFilenameStem,
            }),
          })
        case 'search_vault': {
          const path = String(args?.path ?? args?.vaultPath ?? resolvedVaultPath)
          const query = encodeURIComponent(String(args?.query ?? ''))
          const mode = encodeURIComponent(String(args?.mode ?? 'all'))
          return readJson(`/api/vault/search?vault_path=${encodeURIComponent(path)}&query=${query}&mode=${mode}`)
        }
        case 'auto_rename_untitled': {
          const notePath = String(args?.notePath ?? '')
          const contentData = await readJson(`/api/vault/content?path=${encodeURIComponent(notePath)}`) as { content: string }
          const match = contentData.content.match(/^#\s+(.+)$/m)
          if (!match) return null
          return readJson('/api/vault/rename', {
            method: 'POST',
            headers: jsonHeaders,
            body: JSON.stringify({
              vault_path: args?.vaultPath ?? resolvedVaultPath,
              old_path: notePath,
              new_title: match[1].trim(),
            }),
          })
        }
        default: {
          const handler = window.__mockHandlers?.[command]
          if (!handler) throw new Error(`Unhandled invoke: ${command}`)
          return handler(args)
        }
      }
    }

    Object.defineProperty(window, '__TAURI__', {
      configurable: true,
      value: {},
    })
    Object.defineProperty(window, '__TAURI_INTERNALS__', {
      configurable: true,
      value: { invoke },
    })
  }, vaultPath)

  await page.waitForFunction(() => Boolean(window.__TAURI_INTERNALS__))
}
