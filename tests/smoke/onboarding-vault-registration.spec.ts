import { test, expect, type Page } from '@playwright/test'

interface MockConfig {
  availablePaths: string[]
  promptPath: string
}

interface PersistedState {
  active_vault: string | null
  availablePaths: string[]
  hidden_defaults: string[]
  vaults: Array<{ label: string; path: string }>
}

const GETTING_STARTED_PATH = '/Users/mock/Documents/Getting Started'
const STATE_KEY = 'tolaria:test-vault-state'

async function installOnboardingVaultMocks(page: Page, config: MockConfig) {
  await page.addInitScript((mockConfig) => {
    const stateKey = 'tolaria:test-vault-state'
    const defaultSettings = {
      auto_pull_interval_minutes: null,
      telemetry_consent: true,
      crash_reporting_enabled: null,
      analytics_enabled: null,
      anonymous_id: null,
      release_channel: null,
    }
    const buildEntries = (vaultPath: string) => {
      if (!vaultPath) {
        return []
      }

      return [{
        path: `${vaultPath}/welcome.md`,
        filename: 'welcome.md',
        title: 'Welcome',
        isA: 'Note',
        aliases: [],
        belongsTo: [],
        relatedTo: [],
        status: null,
        archived: false,
        modifiedAt: 1700000000,
        createdAt: null,
        fileSize: 256,
        snippet: 'Welcome note',
        wordCount: 3,
        relationships: {},
        properties: {},
        template: null,
        sort: null,
        outgoingLinks: [],
      }]
    }
    const defaultState = {
      vaults: [],
      active_vault: null,
      hidden_defaults: [],
      availablePaths: [...mockConfig.availablePaths],
    }

    const readState = (): PersistedState => {
      const raw = localStorage.getItem(stateKey)
      return raw ? JSON.parse(raw) as PersistedState : defaultState
    }

    const writeState = (state: PersistedState) => {
      localStorage.setItem(stateKey, JSON.stringify(state))
    }

    localStorage.setItem('tolaria:ai-agents-onboarding-dismissed', '1')
    localStorage.setItem('tolaria:claude-code-onboarding-dismissed', '1')
    if (!localStorage.getItem(stateKey)) {
      writeState(defaultState)
    }

    Object.defineProperty(window, 'prompt', {
      configurable: true,
      value: () => mockConfig.promptPath,
    })

    let ref: Record<string, unknown> | null = null

    Object.defineProperty(window, '__mockHandlers', {
      configurable: true,
      set(value) {
        ref = value as Record<string, unknown>
        ref.load_vault_list = () => {
          const state = readState()
          return {
            vaults: [...state.vaults],
            active_vault: state.active_vault,
            hidden_defaults: [...state.hidden_defaults],
          }
        }
        ref.save_vault_list = (args: { list: PersistedState }) => {
          const state = readState()
          writeState({
            ...state,
            vaults: [...args.list.vaults],
            active_vault: args.list.active_vault,
            hidden_defaults: [...(args.list.hidden_defaults ?? [])],
          })
          return null
        }
        ref.get_default_vault_path = () => '/Users/mock/Documents/Getting Started'
        ref.check_vault_exists = (args: { path?: string | null }) => {
          const state = readState()
          return !!args.path && state.availablePaths.includes(args.path)
        }
        ref.create_getting_started_vault = (args: { targetPath?: string | null }) => {
          if (!args.targetPath) {
            throw new Error('Target path is required')
          }

          const state = readState()
          writeState({
            ...state,
            availablePaths: [...new Set([...state.availablePaths, args.targetPath])],
          })
          return args.targetPath
        }
        ref.list_vault = (args: { path?: string | null }) => buildEntries(args.path ?? readState().active_vault ?? '')
        ref.list_vault_folders = () => []
        ref.list_views = () => []
        ref.get_all_content = () => {
          const activeVault = readState().active_vault ?? ''
          return Object.fromEntries(
            buildEntries(activeVault).map((entry) => [entry.path, '# Welcome\n\nWelcome note']),
          )
        }
        ref.get_note_content = () => '# Welcome\n\nWelcome note'
        ref.get_modified_files = () => []
        ref.get_file_history = () => []
        ref.get_settings = () => defaultSettings
        ref.save_settings = () => null
      },
      get() {
        return ref
      },
    })
  }, config)
}

async function readPersistedState(page: Page): Promise<PersistedState> {
  return page.evaluate((stateKey) => (
    JSON.parse(localStorage.getItem(stateKey) ?? 'null') as PersistedState
  ), STATE_KEY)
}

test('opening an existing vault from onboarding persists the selection and survives reload @smoke', async ({ page }) => {
  const vaultPath = '/Users/mock/Work'
  const vaultUrl = 'file:///Users/mock/Work'

  await installOnboardingVaultMocks(page, {
    availablePaths: [vaultPath],
    promptPath: vaultUrl,
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('welcome-screen')).toBeVisible()
  await page.getByTestId('welcome-open-folder').click()

  await expect(page.getByTestId('note-list-container')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('status-vault-trigger')).toContainText('Work')

  await expect.poll(() => readPersistedState(page)).toEqual({
    vaults: [{ label: 'Work', path: vaultPath }],
    active_vault: vaultPath,
    hidden_defaults: [],
    availablePaths: [vaultPath],
  })

  await page.reload({ waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('welcome-screen')).not.toBeVisible()
  await expect(page.getByTestId('status-vault-trigger')).toContainText('Work')
  await expect(page.getByTestId('note-list-container')).toBeVisible()
})

test('cloning Getting Started from onboarding persists the default vault and survives reload @smoke', async ({ page }) => {
  await installOnboardingVaultMocks(page, {
    availablePaths: [],
    promptPath: 'file:///Users/mock/Documents',
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('welcome-screen')).toBeVisible()
  await page.getByTestId('welcome-create-vault').click()

  await expect(page.getByTestId('note-list-container')).toBeVisible({ timeout: 5_000 })
  await expect(page.getByTestId('status-vault-trigger')).toContainText('Getting Started')

  await expect.poll(async () => (await readPersistedState(page)).active_vault).toBe(GETTING_STARTED_PATH)
  await expect.poll(async () => (await readPersistedState(page)).availablePaths).toEqual([GETTING_STARTED_PATH])

  await page.reload({ waitUntil: 'domcontentloaded' })

  await expect(page.getByTestId('welcome-screen')).not.toBeVisible()
  await expect(page.getByTestId('status-vault-trigger')).toContainText('Getting Started')
  await expect(page.getByTestId('note-list-container')).toBeVisible()
})
