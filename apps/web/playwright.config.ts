import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, devices } from '@playwright/test'

// Static web bundle lane (TOL-3): serves apps/web/dist with `pnpm preview:web` and
// runs the same checks in desktop Chromium, desktop WebKit and iPhone/iPad
// emulation. Not part of the pre-push smoke lane; run `pnpm build:web` first.

const repoRoot = fileURLToPath(new URL('../..', import.meta.url))
/** A TCP port from the environment, refused unless it is one: it reaches the shell commands below. */
function portFrom(value: string | undefined, fallback: string): string {
  const port = value ?? fallback
  if (!/^\d{1,5}$/.test(port) || Number(port) > 65535) throw new Error(`not a TCP port: ${port}`)
  return port
}
const baseURL = process.env.BASE_URL ?? 'http://127.0.0.1:41760'
const port = new URL(baseURL).port || '41760'
// Collaboration lane (TOL-8): a Tolaria server on loopback with a throwaway vault, seeded
// fresh for every run, reached through the preview server's `/v1` proxy.
const remotePort = portFrom(process.env.TOLARIA_E2E_REMOTE_PORT, '41761')
/** The Tolaria server of the run; offline.spec.ts serves the bundle from its own origin in front of it. */
export const REMOTE_URL = `http://127.0.0.1:${remotePort}`
const remoteUrl = REMOTE_URL
const remoteDir = join(tmpdir(), `tolaria-web-collab-e2e-${remotePort}`)
export const COLLAB_TOKEN = 'e2e-token-not-a-secret-0123456789'
/** The seeded git remote the server pushes to: what the desktop app pulls. */
export const REMOTE_GIT_DIR = `${remoteDir}/remote.git`
// Specs that launch their own browsers, so they run once rather than in every device project.
const COLLAB_SPEC = /(collab|convergence)\.spec\.ts/
const storageState = {
  cookies: [],
  origins: [
    {
      origin: baseURL,
      localStorage: [
        { name: 'tolaria:claude-code-onboarding-dismissed', value: '1' },
      ],
    },
  ],
}

export default defineConfig({
  testDir: './tests',
  outputDir: '../../test-results/web',
  timeout: 45_000,
  retries: 1,
  workers: 1,
  use: {
    baseURL,
    headless: true,
    storageState,
  },
  projects: [
    { name: 'chromium', testIgnore: COLLAB_SPEC, use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', testIgnore: COLLAB_SPEC, use: { ...devices['Desktop Safari'] } },
    { name: 'iphone-15', testIgnore: COLLAB_SPEC, use: { ...devices['iPhone 15'] } },
    { name: 'ipad', testIgnore: COLLAB_SPEC, use: { ...devices['iPad Pro 11'] } },
    { name: 'ipad-landscape', testIgnore: COLLAB_SPEC, use: { ...devices['iPad Pro 11 landscape'] } },
    // collab.spec.ts launches Chromium, WebKit and an iPhone itself: they edit one note together.
    // convergence.spec.ts (TOL-239) times a desktop owner and an iPhone editor on a shared note.
    { name: 'collab', testMatch: COLLAB_SPEC },
  ],
  webServer: [
    {
      command: `rm -rf "${remoteDir}" && pnpm server:seed "${remoteDir}/remote.git" 0 && pnpm run server`,
      cwd: repoRoot,
      url: `${remoteUrl}/healthz`,
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: {
        TOLARIA_SERVER_TOKEN: COLLAB_TOKEN,
        TOLARIA_SERVER_PORT: remotePort,
        TOLARIA_SERVER_DATA_DIR: `${remoteDir}/data`,
        TOLARIA_VAULT_REMOTE_URL: `${remoteDir}/remote.git`,
        TOLARIA_COLLAB_IDLE_MS: '500',
        // No pull on a timer (TOL-234): remote-conflict-copy.spec.ts needs the server to see
        // a desktop push only when it pushes the web edit, as a 30 s fetch could pull it first.
        TOLARIA_VAULT_FETCH_INTERVAL_MS: '0',
      },
    },
    {
      command: `pnpm preview:web --port ${port}`,
      cwd: repoRoot,
      url: baseURL,
      reuseExistingServer: false,
      timeout: 30_000,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { TOLARIA_REMOTE_URL: remoteUrl },
    },
  ],
})
