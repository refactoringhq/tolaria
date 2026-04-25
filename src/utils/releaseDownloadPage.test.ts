import {
  buildStableDownloadRedirectPage,
  extractStableDownloadTargets,
  extractStableDownloadTargetsFromReleases,
  resolveStableDownloadTargets,
} from './releaseDownloadPage'

describe('extractStableDownloadTargets', () => {
  it('returns stable downloads for each supported desktop platform when present', () => {
    expect(
      extractStableDownloadTargets({
        platforms: {
          'darwin-aarch64': {
            download_url: 'https://example.com/Tolaria.dmg',
          },
          'linux-x86_64': {
            download_url: 'https://example.com/Tolaria.AppImage',
          },
          'windows-x86_64': {
            url: 'https://example.com/Tolaria-setup.exe',
          },
        },
      }),
    ).toMatchObject({
      'darwin-aarch64': {
        label: 'macOS',
        url: 'https://example.com/Tolaria.dmg',
      },
      'linux-x86_64': {
        label: 'Linux',
        url: 'https://example.com/Tolaria.AppImage',
      },
      'windows-x86_64': {
        label: 'Windows',
        url: 'https://example.com/Tolaria-setup.exe',
      },
    })
  })
})

describe('buildStableDownloadRedirectPage', () => {
  it('builds a redirect page with platform-specific download links', () => {
    const html = buildStableDownloadRedirectPage({
      'darwin-aarch64': {
        buttonLabel: 'Download Tolaria for macOS',
        label: 'macOS',
        url: 'https://example.com/Tolaria.dmg',
      },
      'windows-x86_64': {
        buttonLabel: 'Download Tolaria for Windows',
        label: 'Windows',
        url: 'https://example.com/Tolaria-setup.exe',
      },
    })

    expect(html).toContain('Tolaria Stable Download')
    expect(html).toContain('DOWNLOAD_TARGETS')
    expect(html).toContain('Download Tolaria for Windows')
    expect(html).toContain('Download Tolaria for macOS')
    expect(html).toContain('window.location.replace')
    expect(html).toContain('color-scheme: light dark')
    expect(html).toContain('@media (prefers-color-scheme: dark)')
    expect(html).toContain('background: var(--download-surface-page)')
  })

  it('builds a fallback page when no stable downloads exist yet', () => {
    const html = buildStableDownloadRedirectPage({})

    expect(html).toContain('Tolaria Stable Download Unavailable')
    expect(html).toContain('View release history')
    expect(html).toContain('https://refactoringhq.github.io/tolaria/')
    expect(html).not.toContain('DOWNLOAD_TARGETS')
  })
})

describe('resolveStableDownloadTargets', () => {
  it('falls back to stable release assets when latest.json is incomplete', () => {
    const latestPayload = {
      platforms: {
        'darwin-aarch64': {
          download_url: 'https://example.com/Tolaria.dmg',
        },
      },
    }
    const releasesPayload = [
      {
        prerelease: false,
        assets: [
          {
            name: 'Tolaria-setup.exe',
            browser_download_url: 'https://example.com/Tolaria-setup.exe',
          },
          {
            name: 'Tolaria.AppImage',
            browser_download_url: 'https://example.com/Tolaria.AppImage',
          },
        ],
      },
    ]

    expect(extractStableDownloadTargetsFromReleases(releasesPayload)).toMatchObject({
      'linux-x86_64': {
        url: 'https://example.com/Tolaria.AppImage',
      },
      'windows-x86_64': {
        url: 'https://example.com/Tolaria-setup.exe',
      },
    })
    expect(resolveStableDownloadTargets(latestPayload, releasesPayload)).toMatchObject({
      'darwin-aarch64': {
        url: 'https://example.com/Tolaria.dmg',
      },
      'linux-x86_64': {
        url: 'https://example.com/Tolaria.AppImage',
      },
      'windows-x86_64': {
        url: 'https://example.com/Tolaria-setup.exe',
      },
    })
  })
})
