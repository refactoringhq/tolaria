import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { computeAlphaRelease, computeStableRelease, formatReleaseEnv } from './release-version.mjs'

const today = '2026-08-02'
const alphaReleaseCases = [
  {
    name: 'same-day stable safeguard',
    input: { alphaTags: [], stableTags: ['v2026-08-02'], tagsAtHead: [], today },
    expected: {
      channel: 'alpha',
      displayVersion: 'Alpha 2026.8.3.1',
      tag: 'alpha-v2026.8.3-alpha.0001',
      version: '2026.8.3-alpha.1',
    },
  },
  {
    name: 'monotonic poisoned-version bridge',
    input: {
      alphaTags: ['alpha-v2027.8.1-alpha.0017'],
      stableTags: ['v2027-07-31', 'v2026-07-22'],
      tagsAtHead: [],
      today,
    },
    expected: {
      channel: 'alpha',
      displayVersion: 'Alpha 2026.8.2.0',
      tag: 'alpha-v2027.8.2-alpha.0001',
      version: '2027.8.2-alpha.1',
    },
  },
  {
    name: 'return to the real calendar series',
    input: {
      alphaTags: ['alpha-v2027.8.1-alpha.0017', 'alpha-v2027.8.2-alpha.0001'],
      stableTags: ['v2027-07-31', 'v2026-07-22'],
      tagsAtHead: [],
      today,
    },
    expected: {
      channel: 'alpha',
      displayVersion: 'Alpha 2026.8.2.1',
      tag: 'alpha-v2026.8.2-alpha.0001',
      version: '2026.8.2-alpha.1',
    },
  },
]

describe('release build configuration', () => {
  it('keeps Tauri devtools out of release builds', () => {
    const cargoManifest = readFileSync('src-tauri/Cargo.toml', 'utf8')
    const tauriDependency = cargoManifest.split('\n').find((line) => line.startsWith('tauri = '))

    assert.ok(tauriDependency, 'Tauri dependency declaration must remain present')
    assert.doesNotMatch(tauriDependency, /"devtools"/)
  })
})

describe('release version computation', () => {
  it('formats the shared release result for GitHub Actions outputs', () => {
    assert.equal(
      formatReleaseEnv(
        {
          channel: 'alpha',
          displayVersion: 'Alpha 2026.8.2.1',
          tag: 'alpha-v2026.8.2-alpha.0001',
          version: '2026.8.2-alpha.1',
        },
        false,
        'github',
      ),
      [
        'version=2026.8.2-alpha.1',
        'display_version=Alpha 2026.8.2.1',
        'tag=alpha-v2026.8.2-alpha.0001',
        'channel=alpha',
        'skip_release=false',
        '',
      ].join('\n'),
    )
  })

  it('rejects future-dated stable tags', () => {
    assert.throws(
      () => computeStableRelease({ tag: 'v2027-07-31', today }),
      /cannot be later than the current UTC date 2026-08-02/,
    )
  })

  it('allows the one-shot poisoned-stable bridge tag on its operator date', () => {
    assert.deepEqual(
      computeStableRelease({ tag: 'v2027-08-28', today: '2026-08-28' }),
      {
        channel: 'stable',
        displayVersion: 'v2027-08-28',
        tag: 'v2027-08-28',
        version: '2027.8.28',
      },
    )
  })

  it('rejects future stable tags other than the one-shot bridge', () => {
    assert.throws(
      () => computeStableRelease({ tag: 'v2027-09-01', today: '2026-08-28' }),
      /cannot be later than the current UTC date 2026-08-28/,
    )
    assert.throws(
      () => computeStableRelease({ tag: 'v2027-08-28', today: '2026-08-29' }),
      /cannot be later than the current UTC date 2026-08-29/,
    )
  })

  it('preserves alpha sequencing and poisoned-version recovery', () => {
    for (const { name, input, expected } of alphaReleaseCases) {
      assert.deepEqual(computeAlphaRelease(input), expected, name)
    }
  })
})
