import { test, expect, type Page } from '@playwright/test'

interface MockEntry {
  path: string
  filename: string
  title: string
  isA: string
  aliases: string[]
  belongsTo: string[]
  relatedTo: string[]
  status: string | null
  archived: boolean
  modifiedAt: number | null
  createdAt: number | null
  fileSize: number
  snippet: string
  wordCount: number
  relationships: Record<string, string[]>
  outgoingLinks: string[]
  properties: Record<string, unknown>
  template: null
  sort: null
}

interface VaultSwitcherPaths {
  gettingStartedPath: string
  personalVaultPath: string
  workVaultPath: string
}

interface VaultSwitcherInitData {
  allContent: Record<string, string>
  defaultVaultExists: boolean
  entriesByVault: Record<string, MockEntry[]>
  paths: VaultSwitcherPaths
}

interface InstallVaultSwitcherMocksOptions {
  defaultVaultExists?: boolean
}

interface OpenedVaultWindow {
  vaultPath: string
  vaultColor: string | null
}

function createVaultSwitcherPaths(): VaultSwitcherPaths {
  return {
    gettingStartedPath: '/Users/mock/Documents/Getting Started',
    personalVaultPath: '/Users/mock/Personal',
    workVaultPath: '/Users/mock/Work',
  }
}

function createMockEntry(vaultPath: string, filename: string, title: string, snippet: string): MockEntry {
  return {
    path: `${vaultPath}/${filename}`,
    filename,
    title,
    isA: 'Note',
    aliases: [],
    belongsTo: [],
    relatedTo: [],
    status: null,
    archived: false,
    modifiedAt: 1700000000,
    createdAt: null,
    fileSize: 256,
    snippet,
    wordCount: 12,
    relationships: {},
    outgoingLinks: [],
    properties: {},
    template: null,
    sort: null,
  }
}

function buildEntriesByVault(paths: VaultSwitcherPaths): Record<string, MockEntry[]> {
  return {
    [paths.gettingStartedPath]: [createMockEntry(paths.gettingStartedPath, 'getting-started.md', 'Getting Started Note', 'Getting Started snippet')],
    [paths.workVaultPath]: [createMockEntry(paths.workVaultPath, 'work-home.md', 'Work Home', 'Work Home snippet')],
    [paths.personalVaultPath]: [createMockEntry(paths.personalVaultPath, 'personal-home.md', 'Personal Home', 'Personal Home snippet')],
  }
}

function buildAllContent(entriesByVault: Record<string, MockEntry[]>): Record<string, string> {
  return Object.fromEntries(
    Object.values(entriesByVault)
      .flat()
      .map((entry) => [entry.path, `# ${entry.title}\n\n${entry.snippet}`]),
  )
}

function buildVaultSwitcherInitData(defaultVaultExists: boolean): VaultSwitcherInitData {
  const paths = createVaultSwitcherPaths()
  const entriesByVault = buildEntriesByVault(paths)

  return {
    allContent: buildAllContent(entriesByVault),
    defaultVaultExists,
    entriesByVault,
    paths,
  }
}

async function installVaultSwitcherMocks(
  page: Page,
  options: InstallVaultSwitcherMocksOptions = {},
) {
  const initData = buildVaultSwitcherInitData(options.defaultVaultExists ?? true)

  await page.addInitScript((data: VaultSwitcherInitData) => {
    localStorage.clear()
    localStorage.setItem('tolaria:claude-code-onboarding-dismissed', '1')
    const openedVaultWindows: OpenedVaultWindow[] = []
    Object.assign(window, { __openedVaultWindows: openedVaultWindows })

    let ref: Record<string, unknown> | null = null

    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = value as Record<string, unknown>
        ref.load_vault_list = () => ({
          vaults: [
            { label: 'Work Vault', path: data.paths.workVaultPath },
            { label: 'Personal Vault', path: data.paths.personalVaultPath },
          ],
          active_vault: data.paths.workVaultPath,
          hidden_defaults: [],
        })
        ref.get_default_vault_path = () => data.paths.gettingStartedPath
        ref.check_vault_exists = (args: { path?: string }) => {
          if (!args?.path) {
            return false
          }

          if (args.path === data.paths.gettingStartedPath) {
            return data.defaultVaultExists
          }

          return data.defaultVaultExists
            || args.path === data.paths.workVaultPath
            || args.path === data.paths.personalVaultPath
        }
        ref.list_vault = (args: { path?: string }) => data.entriesByVault[args?.path ?? ''] ?? []
        ref.list_vault_folders = () => []
        ref.list_views = () => []
        ref.get_all_content = () => data.allContent
        ref.get_note_content = (args: { path?: string }) => data.allContent[args?.path ?? ''] ?? ''
        ref.get_modified_files = () => []
        ref.get_file_history = () => []
        ref.open_vault_in_new_window = (args: OpenedVaultWindow) => {
          openedVaultWindows.push(args)
        }
      },
      get() {
        return ref
      },
    })
  }, initData)
}

test('bottom bar vault switching works with keyboard and mouse @smoke', async ({ page }) => {
  await installVaultSwitcherMocks(page)

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const trigger = page.getByTestId('status-vault-trigger')
  const noteList = page.getByTestId('note-list-container')

  await expect(trigger).toContainText('Work Vault')
  await expect(noteList.getByText('Work Home', { exact: true })).toBeVisible()

  await trigger.focus()
  await expect(trigger).toBeFocused()
  await page.keyboard.press('Enter')
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('vault-menu-item-label-Getting Started')).toBeFocused()
  await page.getByTestId('vault-menu-item-label-Personal Vault').focus()
  await expect(page.getByTestId('vault-menu-item-label-Personal Vault')).toBeFocused()
  await page.keyboard.press('Enter')

  await expect(trigger).toContainText('Personal Vault')
  await expect(noteList.getByText('Personal Home', { exact: true })).toBeVisible()
  await expect(noteList.getByText('Work Home', { exact: true })).toHaveCount(0)

  await trigger.click()
  await page.getByTestId('vault-menu-item-label-Work Vault').click()

  await expect(trigger).toContainText('Work Vault')
  await expect(noteList.getByText('Work Home', { exact: true })).toBeVisible()
  await expect(noteList.getByText('Personal Home', { exact: true })).toHaveCount(0)

  await trigger.click()
  const openPersonalWindow = page.getByRole('button', { name: 'Open Personal Vault in a new window' })
  await page.getByTestId('vault-menu-item-Personal Vault').hover()
  await expect(openPersonalWindow).toHaveCSS('opacity', '1')
  await openPersonalWindow.click()
  await expect.poll(() => page.evaluate(() => (
    (window as typeof window & { __openedVaultWindows?: OpenedVaultWindow[] })
      .__openedVaultWindows ?? []
  ))).toEqual([{
    vaultPath: '/Users/mock/Personal',
    vaultColor: null,
  }])
})

test('missing Getting Started vault stays hidden while remove actions still work @smoke', async ({ page }) => {
  await installVaultSwitcherMocks(page, { defaultVaultExists: false })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  const trigger = page.getByTestId('status-vault-trigger')
  await expect(trigger).toContainText('Work Vault')

  await trigger.click()
  await expect(page.getByTestId('vault-menu-item-Getting Started')).toHaveCount(0)

  const personalVaultItem = page.getByTestId('vault-menu-item-Personal Vault')
  const removeButton = page.getByRole('button', { name: 'Remove Personal Vault from list' })

  await expect(removeButton).toHaveCSS('opacity', '0')
  await personalVaultItem.hover()
  await expect(removeButton).toHaveCSS('opacity', '1')

  const itemBounds = await personalVaultItem.boundingBox()
  const removeBounds = await removeButton.boundingBox()

  expect(itemBounds).not.toBeNull()
  expect(removeBounds).not.toBeNull()
  expect(removeBounds!.x).toBeGreaterThanOrEqual(itemBounds!.x - 1)
  expect(removeBounds!.y).toBeGreaterThanOrEqual(itemBounds!.y - 1)
  expect(removeBounds!.x + removeBounds!.width).toBeLessThanOrEqual(itemBounds!.x + itemBounds!.width + 1)
  expect(removeBounds!.y + removeBounds!.height).toBeLessThanOrEqual(itemBounds!.y + itemBounds!.height + 1)

  await removeButton.click()
  await page.getByRole('button', { name: 'Remove vault', exact: true }).click()

  await trigger.click()
  await expect(page.getByTestId('vault-menu-item-Personal Vault')).toHaveCount(0)
  await expect(page.getByTestId('vault-menu-item-Getting Started')).toHaveCount(0)
})
