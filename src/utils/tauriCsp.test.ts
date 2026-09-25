import { readFileSync } from 'node:fs'

const tauriConfigSource = readFileSync('src-tauri/tauri.conf.json', 'utf8')

describe('Tauri Content Security Policy', () => {
  it('allows runtime style elements and React style attributes', () => {
    const config = JSON.parse(tauriConfigSource)
    const csp = config.app.security.csp as Record<string, string>

    expect(csp['style-src']).toContain("'unsafe-inline'")
    expect(csp['style-src-elem']).not.toContain("'nonce-")
    expect(csp['style-src-elem']).toContain("'unsafe-inline'")
    expect(csp['style-src-attr']).toBe("'unsafe-inline'")
    expect(config.app.security.dangerousDisableAssetCspModification).toContain('style-src')
  })

  it('keeps startup font loading local and network independent', () => {
    const config = JSON.parse(tauriConfigSource)
    const appDocumentSource = readFileSync('index.html', 'utf8')
    const mainEntry = readFileSync('src/main.tsx', 'utf8')
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
    const csp = config.app.security.csp as Record<string, string>
    const devCsp = config.app.security.devCsp as string
    const hasRemoteFontEndpoint = /https:\/\/fonts\.(?:googleapis|gstatic)\.com/.test(appDocumentSource)

    expect(hasRemoteFontEndpoint).toBe(false)
    expect(packageJson.dependencies).toMatchObject({
      '@fontsource-variable/inter': expect.any(String),
      '@fontsource-variable/jetbrains-mono': expect.any(String),
      '@fontsource/ibm-plex-mono': expect.any(String),
    })
    expect(mainEntry).toContain("import '@fontsource-variable/inter/wght.css'")
    expect(mainEntry).toContain("import '@fontsource-variable/jetbrains-mono/wght.css'")
    expect(mainEntry).toContain("import '@fontsource/ibm-plex-mono/600.css'")
    expect(csp['style-src']).not.toContain('fonts.googleapis.com')
    expect(csp['style-src-elem']).not.toContain('fonts.googleapis.com')
    expect(csp['font-src']).not.toContain('fonts.gstatic.com')
    expect(devCsp).not.toMatch(/https:\/\/fonts\.(?:googleapis|gstatic)\.com/)
  })

  it('blocks legacy object-based PDF previews', () => {
    const config = JSON.parse(tauriConfigSource)
    const csp = config.app.security.csp as Record<string, string>

    expect(csp['object-src']).toBe("'none'")
  })

  it('allows the app-owned PDF renderer to fetch assets and start its bundled worker', () => {
    const config = JSON.parse(tauriConfigSource)
    const csp = config.app.security.csp as Record<string, string>
    const devCsp = config.app.security.devCsp as string

    expect(csp['connect-src']).toContain('asset:')
    expect(csp['connect-src']).toContain('http://asset.localhost')
    expect(csp['worker-src']).toBe("'self'")
    expect(devCsp).toContain('connect-src')
    expect(devCsp).toContain('asset: http://asset.localhost')
    expect(devCsp).toContain("worker-src 'self'")
  })

  it('allows packaged PDF and isolated scripted HTML preview frames', () => {
    const config = JSON.parse(tauriConfigSource)
    const csp = config.app.security.csp as Record<string, string>
    const devCsp = config.app.security.devCsp as string

    expect(csp['frame-src']).toBe(
      "'self' data: tolaria-html-block: http://tolaria-html-block.localhost",
    )
    expect(devCsp).toContain(
      "frame-src 'self' data: tolaria-html-block: http://tolaria-html-block.localhost",
    )
    expect(csp['script-src']).not.toContain("'unsafe-inline'")
  })

  it('allows audio and video media previews from scoped Tauri asset URLs', () => {
    const config = JSON.parse(tauriConfigSource)
    const csp = config.app.security.csp as Record<string, string>

    expect(csp['media-src']).toContain('asset:')
    expect(csp['media-src']).toContain('http://asset.localhost')
  })

  it('allows bundled tldraw translation JSON fetched from inlined data URLs', () => {
    const config = JSON.parse(tauriConfigSource)
    const csp = config.app.security.csp as Record<string, string>

    expect(csp['connect-src']).toContain('data:')
  })

  it('uses a dev-only CSP that permits Vite React Refresh without weakening production script policy', () => {
    const config = JSON.parse(tauriConfigSource)
    const productionCsp = config.app.security.csp as Record<string, string>
    const devCsp = config.app.security.devCsp as string

    expect(productionCsp['script-src']).not.toContain("'unsafe-inline'")
    expect(productionCsp['script-src']).not.toContain("'unsafe-eval'")
    expect(productionCsp['script-src']).toContain("'wasm-unsafe-eval'")
    expect(devCsp).toContain("'unsafe-inline'")
    expect(devCsp).toContain("'unsafe-eval'")
    expect(devCsp).toContain('ws://localhost:5202')
  })
})
