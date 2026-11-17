import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const DOCKERFILE = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8')

/** Debian packages installed by `apt-get install` in the stage the container runs. */
function runtimePackages(): string[] {
  const runtimeStage = DOCKERFILE.split(/^FROM /m).at(-1) ?? ''
  const install = /apt-get install ([^&]+)/.exec(runtimeStage)?.[1] ?? ''
  return install.split(/[\s\\]+/).filter((word) => word !== '' && !word.startsWith('-'))
}

describe('the container image', () => {
  it('can reach a private vault remote over SSH or HTTPS', () => {
    // The slim base has no ssh client and no CA bundle, and --no-install-recommends adds neither with git.
    expect(runtimePackages()).toEqual(expect.arrayContaining(['git', 'openssh-client', 'ca-certificates']))
  })
})
