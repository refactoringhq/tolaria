import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const DOCKERFILE = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8')
const STAGES = DOCKERFILE.split(/^FROM /m).slice(1)
const BUILD_STAGE = STAGES[0] ?? ''
const RUNTIME_STAGE = STAGES.at(-1) ?? ''

/** Debian packages installed by `apt-get install` in the stage the container runs. */
function runtimePackages(): string[] {
  const install = /apt-get install ([^&]+)/.exec(RUNTIME_STAGE)?.[1] ?? ''
  return install.split(/[\s\\]+/).filter((word) => word !== '' && !word.startsWith('-'))
}

/** The sources of every `COPY` into the runtime stage. */
function runtimeCopies(): string[] {
  return [...RUNTIME_STAGE.matchAll(/^COPY (?:--\S+ )*(\S+) \S+$/gm)].map((match) => match[1])
}

describe('the container image', () => {
  it('can reach a private vault remote over SSH or HTTPS', () => {
    // The slim base has no ssh client and no CA bundle, and --no-install-recommends adds neither with git.
    expect(runtimePackages()).toEqual(expect.arrayContaining(['git', 'openssh-client', 'ca-certificates']))
  })

  it('builds the bundles in the build stage', () => {
    expect(BUILD_STAGE).toContain('pnpm install --frozen-lockfile')
    expect(BUILD_STAGE).toMatch(/node --experimental-strip-types apps\/server\/scripts\/build-image\.ts \/out/)
  })

  it('ships the bundles and the token launcher, never the repository or its node_modules', () => {
    expect(runtimeCopies()).toEqual(['/out/node_modules', '/out/dist', '/out/bin/tolaria-token'])
    expect(RUNTIME_STAGE).toMatch(/^COPY --from=build \/out\/bin\/tolaria-token \/usr\/local\/bin\/tolaria-token$/m)
  })

  it('runs the server bundle under node itself, so node is PID 1 and gets SIGTERM', () => {
    expect(RUNTIME_STAGE).toMatch(/^CMD \["node", "--enable-source-maps", "dist\/main\.mjs"\]$/m)
    expect(RUNTIME_STAGE).not.toMatch(/^ENTRYPOINT/m)
  })

  it('runs as the non-root node user, in production, with a health check', () => {
    expect(RUNTIME_STAGE).toMatch(/^USER node$/m)
    expect(RUNTIME_STAGE).toContain('NODE_ENV=production')
    expect(RUNTIME_STAGE).toContain('TOLARIA_SERVER_DATA_DIR=/app/data')
    expect(RUNTIME_STAGE).toMatch(/^HEALTHCHECK .*\n.*\/healthz/m)
  })
})
