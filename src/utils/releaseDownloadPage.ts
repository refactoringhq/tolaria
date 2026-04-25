const RELEASE_HISTORY_URL = 'https://refactoringhq.github.io/tolaria/'

type StablePlatformKey = 'darwin-aarch64' | 'linux-x86_64' | 'windows-x86_64'

type PlatformPayload = {
  dmg_url?: unknown
  download_url?: unknown
  installer_url?: unknown
  url?: unknown
}

type LatestReleasePayload = {
  platforms?: Record<string, PlatformPayload | undefined>
}

type ReleaseAssetPayload = {
  browser_download_url?: unknown
  name?: unknown
}

type GitHubReleasePayload = {
  assets?: ReleaseAssetPayload[]
  draft?: unknown
  prerelease?: unknown
}

export type StableDownloadTarget = {
  buttonLabel: string
  label: string
  url: string
}

export type StableDownloadTargets = Partial<Record<StablePlatformKey, StableDownloadTarget>>

type DownloadPageContent = {
  helperText: string
  message: string
  shouldRedirect: boolean
  title: string
}

const PLATFORM_METADATA: Record<StablePlatformKey, { buttonLabel: string; label: string }> = {
  'darwin-aarch64': {
    buttonLabel: 'Download Tolaria for macOS',
    label: 'macOS',
  },
  'linux-x86_64': {
    buttonLabel: 'Download Tolaria for Linux',
    label: 'Linux',
  },
  'windows-x86_64': {
    buttonLabel: 'Download Tolaria for Windows',
    label: 'Windows',
  },
}

const PLATFORM_ORDER: StablePlatformKey[] = [
  'darwin-aarch64',
  'windows-x86_64',
  'linux-x86_64',
]

const REDIRECT_PAGE_STYLES = `
    :root {
      color-scheme: light dark;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      --download-surface-page: #f7f6f3;
      --download-surface-card: #ffffff;
      --download-text-primary: #37352f;
      --download-border-default: #e9e9e7;
      --download-accent: #155dff;
      --download-accent-hover: #1248cc;
      --download-secondary-bg: #eef2ff;
      --download-secondary-hover-bg: #dbe4ff;
      --download-secondary-text: #1d4ed8;
      --download-text-on-accent: #ffffff;
      --download-shadow-card: rgba(15, 23, 42, 0.08);
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --download-surface-page: #1f1e1b;
        --download-surface-card: #23221f;
        --download-text-primary: #e6e1d8;
        --download-border-default: #34322d;
        --download-accent: #78a4ff;
        --download-accent-hover: #9bbeff;
        --download-secondary-bg: #34322d;
        --download-secondary-hover-bg: #46433b;
        --download-secondary-text: #e6e1d8;
        --download-text-on-accent: #151411;
        --download-shadow-card: rgba(0, 0, 0, 0.35);
      }
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      background: var(--download-surface-page);
      color: var(--download-text-primary);
    }

    main {
      width: min(100%, 520px);
      background: var(--download-surface-card);
      border: 1px solid var(--download-border-default);
      border-radius: 16px;
      padding: 24px;
      box-shadow: 0 16px 40px var(--download-shadow-card);
    }

    h1 {
      margin: 0 0 12px;
      font-size: 1.5rem;
      line-height: 1.2;
    }

    p {
      margin: 0 0 12px;
      line-height: 1.5;
    }

    .button-list {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 16px;
    }

    a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      padding: 0 16px;
      border-radius: 10px;
      background: var(--download-accent);
      color: var(--download-text-on-accent);
      text-decoration: none;
      font-weight: 600;
    }

    a[data-secondary="true"] {
      background: var(--download-secondary-bg);
      color: var(--download-secondary-text);
    }

    a:hover,
    a:focus-visible {
      background: var(--download-accent-hover);
    }

    a[data-secondary="true"]:hover,
    a[data-secondary="true"]:focus-visible {
      background: var(--download-secondary-hover-bg);
    }
`

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function normalizeUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function buildStableDownloadTarget(
  platform: StablePlatformKey,
  url: string,
): StableDownloadTarget {
  return {
    ...PLATFORM_METADATA[platform],
    url,
  }
}

function extractPlatformDownloadUrl(
  platform: StablePlatformKey,
  payload: PlatformPayload | undefined,
): string | null {
  if (!payload || typeof payload !== 'object') return null

  switch (platform) {
    case 'darwin-aarch64':
      return (
        normalizeUrl(payload.download_url)
        ?? normalizeUrl(payload.dmg_url)
        ?? normalizeUrl(payload.url)
      )
    case 'windows-x86_64':
      return (
        normalizeUrl(payload.download_url)
        ?? normalizeUrl(payload.installer_url)
        ?? normalizeUrl(payload.url)
      )
    case 'linux-x86_64':
      return normalizeUrl(payload.download_url) ?? normalizeUrl(payload.url)
  }
}

export function extractStableDownloadTargets(payload: unknown): StableDownloadTargets {
  if (!payload || typeof payload !== 'object') return {}

  const { platforms } = payload as LatestReleasePayload
  if (!platforms || typeof platforms !== 'object') return {}

  const downloads: StableDownloadTargets = {}
  for (const platform of PLATFORM_ORDER) {
    const url = extractPlatformDownloadUrl(platform, platforms[platform])
    if (url) downloads[platform] = buildStableDownloadTarget(platform, url)
  }

  return downloads
}

function isPublicStableRelease(release: GitHubReleasePayload): boolean {
  return release.draft !== true && release.prerelease !== true
}

function classifyReleaseAsset(name: string): {
  platform: StablePlatformKey
  preference: number
} | null {
  if (name.endsWith('.dmg')) {
    return { platform: 'darwin-aarch64', preference: 2 }
  }
  if (name.endsWith('.app.tar.gz')) {
    return { platform: 'darwin-aarch64', preference: 1 }
  }
  if (name.endsWith('-setup.exe')) {
    return { platform: 'windows-x86_64', preference: 2 }
  }
  if (name.endsWith('.msi')) {
    return { platform: 'windows-x86_64', preference: 1 }
  }
  if (name.endsWith('.AppImage')) {
    return { platform: 'linux-x86_64', preference: 2 }
  }
  if (name.endsWith('.deb')) {
    return { platform: 'linux-x86_64', preference: 1 }
  }

  return null
}

type ReleaseAssetSelectionState = {
  downloads: StableDownloadTargets
  preferences: Partial<Record<StablePlatformKey, number>>
}

type ReleaseAssetSelection = {
  platform: StablePlatformKey
  preference: number
  url: string
}

function updateDownloadPreference(
  state: ReleaseAssetSelectionState,
  selection: ReleaseAssetSelection,
) {
  const currentPreference = state.preferences[selection.platform] ?? Number.NEGATIVE_INFINITY
  if (selection.preference < currentPreference) return

  state.preferences[selection.platform] = selection.preference
  state.downloads[selection.platform] = buildStableDownloadTarget(selection.platform, selection.url)
}

function selectReleaseAsset(asset: ReleaseAssetPayload): ReleaseAssetSelection | null {
  const name = typeof asset.name === 'string' ? asset.name.trim() : ''
  const url = normalizeUrl(asset.browser_download_url)
  const classification = classifyReleaseAsset(name)
  if (!classification || !url) return null

  return {
    ...classification,
    url,
  }
}

function extractStableDownloadTargetsFromAssets(
  assets: ReleaseAssetPayload[],
): StableDownloadTargets {
  const state: ReleaseAssetSelectionState = {
    downloads: {},
    preferences: {},
  }

  for (const asset of assets) {
    const selection = selectReleaseAsset(asset)
    if (!selection) continue
    updateDownloadPreference(state, selection)
  }

  return state.downloads
}

function findPublicStableRelease(
  payload: unknown[],
): GitHubReleasePayload | null {
  for (const release of payload) {
    if (!release || typeof release !== 'object') continue

    const typedRelease = release as GitHubReleasePayload
    if (!isPublicStableRelease(typedRelease) || !Array.isArray(typedRelease.assets)) continue
    return typedRelease
  }

  return null
}

export function extractStableDownloadTargetsFromReleases(
  payload: unknown,
): StableDownloadTargets {
  if (!Array.isArray(payload)) return {}

  const stableRelease = findPublicStableRelease(payload)
  return stableRelease && Array.isArray(stableRelease.assets)
    ? extractStableDownloadTargetsFromAssets(stableRelease.assets)
    : {}
}

export function resolveStableDownloadTargets(
  latestPayload: unknown,
  releasesPayload: unknown,
): StableDownloadTargets {
  return {
    ...extractStableDownloadTargetsFromReleases(releasesPayload),
    ...extractStableDownloadTargets(latestPayload),
  }
}

function buildStableDownloadPageContent(
  downloads: StableDownloadTargets,
): DownloadPageContent {
  if (Object.keys(downloads).length > 0) {
    return {
      helperText: 'If the download does not start automatically, use one of the platform links below.',
      message: 'Preparing the latest stable Tolaria download for your platform.',
      shouldRedirect: true,
      title: 'Tolaria Stable Download',
    }
  }

  return {
    helperText: 'Use the button below to check the latest release history.',
    message: 'No stable Tolaria downloads are available yet.',
    shouldRedirect: false,
    title: 'Tolaria Stable Download Unavailable',
  }
}

function buildDownloadsMarkup(downloads: StableDownloadTargets): string {
  const targets = PLATFORM_ORDER
    .map((platform) => downloads[platform])
    .filter((target): target is StableDownloadTarget => Boolean(target))

  if (targets.length === 0) {
    return `<div class="button-list"><a id="download-link" href="${RELEASE_HISTORY_URL}" data-secondary="true">View release history</a></div>`
  }

  const primaryTarget = targets[0]
  const secondaryLinks = targets
    .map((target) => (
      `<a href="${escapeHtml(target.url)}" data-secondary="true">${escapeHtml(target.label)}</a>`
    ))
    .join('')

  return `
    <div class="button-list">
      <a id="download-link" href="${escapeHtml(primaryTarget.url)}">${escapeHtml(primaryTarget.buttonLabel)}</a>
    </div>
    <div class="button-list">${secondaryLinks}</div>
    <div class="button-list">
      <a href="${RELEASE_HISTORY_URL}" data-secondary="true">View release history</a>
    </div>`
}

function buildRedirectMarkup(downloads: StableDownloadTargets): string {
  if (Object.keys(downloads).length === 0) return ''

  const serializedTargets = JSON.stringify(downloads)

  return `
    <script>
      const DOWNLOAD_TARGETS = ${serializedTargets};
      const PLATFORM_ORDER = ${JSON.stringify(PLATFORM_ORDER)};

      function detectPlatform(userAgent) {
        if (/Windows/i.test(userAgent)) return 'windows-x86_64';
        if (/Mac OS X|Macintosh/i.test(userAgent)) return 'darwin-aarch64';
        if (/Linux/i.test(userAgent) && !/Android/i.test(userAgent)) return 'linux-x86_64';
        return null;
      }

      const detectedPlatform = detectPlatform(navigator.userAgent);
      const resolvedTarget = (
        detectedPlatform && DOWNLOAD_TARGETS[detectedPlatform]
      ) || DOWNLOAD_TARGETS[PLATFORM_ORDER.find((platform) => DOWNLOAD_TARGETS[platform])] || null;

      if (resolvedTarget) {
        const link = document.getElementById('download-link');
        const message = document.getElementById('download-message');
        if (link) {
          link.href = resolvedTarget.url;
          link.textContent = resolvedTarget.buttonLabel;
        }
        if (message) {
          message.textContent = 'Redirecting to the latest stable Tolaria download for ' + resolvedTarget.label + '.';
        }
        window.location.replace(resolvedTarget.url);
      }
    </script>`
}

export function buildStableDownloadRedirectPage(
  downloads: StableDownloadTargets,
): string {
  const page = buildStableDownloadPageContent(downloads)

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${page.title}</title>${page.shouldRedirect ? buildRedirectMarkup(downloads) : ''}
  <style>${REDIRECT_PAGE_STYLES}
  </style>
</head>
<body>
  <main>
    <h1>${page.title}</h1>
    <p id="download-message">${page.message}</p>
    <p>${page.helperText}</p>
    ${buildDownloadsMarkup(downloads)}
  </main>
</body>
</html>
`
}
