import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { addedLinesFromDiff, biomeGateFailures, codacyExcludePatterns, eslintGateFailures, matchesCodacyGlob, withoutExcludedPaths } from './codacy-gate-lib.mjs'
import { isAuditedRustUnsafe, sarifGateFailures, scannerOutputFailures, scannerProcessFailures } from './codacy-sarif.mjs'

test('reports findings only on added lines', () => {
  const root = '/repo'
  const additions = addedLinesFromDiff([
    '+++ b/src/example.ts',
    '@@ -2,2 +2,3 @@',
    ' unchanged',
    '+new issue',
    ' existing issue',
  ].join('\n'), root)
  const sarif = { runs: [{
    tool: { driver: { name: 'Example' } },
    results: [3, 4].map((line) => ({
      locations: [{ physicalLocation: { artifactLocation: { uri: 'src/example.ts' }, region: { startLine: line } } }],
      message: { text: `line ${line}` },
      ruleId: 'rule',
    })),
  }] }

  assert.deepEqual(sarifGateFailures(sarif, additions, root).map((failure) => failure.line), [3])
})

test('fails closed when a scanner does not complete', () => {
  const failures = sarifGateFailures({ runs: [{
    invocations: [{ executionSuccessful: false }],
    tool: { driver: { name: 'Broken scanner' } },
  }] }, new Map())

  assert.equal(failures[0]?.message, 'Broken scanner did not complete successfully')
})

test('fails closed when the legacy CLI returns an empty merged report', () => {
  assert.equal(sarifGateFailures({ version: '2.1.0', runs: [] }, new Map()).length, 1)
})

test('fails closed when a wrapper swallows its scanner SIGTERM', () => {
  const wrapper = spawnSync(process.execPath, ['-e', `
    const { spawnSync } = require('node:child_process')
    const scanner = spawnSync(process.execPath, ['-e', 'process.kill(process.pid, "SIGTERM")'])
    if (scanner.signal !== 'SIGTERM') process.exit(2)
    console.error('Tool failed to run: failed to run Trivy: signal: terminated')
    console.log(JSON.stringify({ version: '2.1.0', runs: [] }))
  `], { encoding: 'utf8', timeout: 5000 })

  assert.equal(wrapper.status, 0)
  assert.match(wrapper.stderr, /signal: terminated/u)
  assert.equal(scannerProcessFailures(wrapper, 'trivy').length, 1)
  assert.equal(scannerOutputFailures(wrapper, new Map(), '', 'trivy').length, 1)
  assert.equal(sarifGateFailures(JSON.parse(wrapper.stdout), new Map()).length, 1)
})

test('a success-shaped report cannot hide the scanner failure diagnostic', () => {
  const stdout = JSON.stringify({ version: '2.1.0', runs: [{ tool: { driver: { name: 'Trivy' } }, results: [] }] })
  const result = { status: 0, stdout, stderr: 'Tool failed to run: context deadline exceeded' }
  assert.equal(scannerProcessFailures(result, 'trivy').length, 1)
  assert.equal(scannerOutputFailures(result, new Map(), '', 'trivy').length, 1)
})

test('rejects missing, truncated and malformed structured scanner output', () => {
  for (const stdout of [undefined, '', '{"runs":', 'null', '{}', '{"runs":[]}']) {
    assert.equal(scannerOutputFailures({ status: 0, stdout }, new Map(), '', 'trivy').length, 1)
  }
})

test('accepts complete structured output from each expected scanner', () => {
  for (const [tool, name] of [['trivy', 'Trivy'], ['opengrep', 'Opengrep OSS']]) {
    const stdout = JSON.stringify({ version: '2.1.0', runs: [{ tool: { driver: { name } }, results: [] }] })
    assert.deepEqual(scannerOutputFailures({ status: 0, stdout }, new Map(), '', tool), [])
  }
})

test('rejects nonzero, signaled, timed-out and failed-to-spawn processes', () => {
  for (const result of [{ status: 1 }, { status: 0, signal: 'SIGTERM' },
    { status: null, error: { code: 'ETIMEDOUT' } }, { status: null, error: { code: 'ENOENT' } }]) {
    assert.equal(scannerProcessFailures(result, 'trivy').length, 1)
  }
  assert.deepEqual(scannerProcessFailures({ status: 0, stderr: 'INFO scanning enabled' }, 'trivy'), [])
})

test('requires the expected scanner and its complete results array', () => {
  const run = { tool: { driver: { name: 'Trivy' } }, results: [] }
  const report = { version: '2.1.0', runs: [run] }
  assert.deepEqual(sarifGateFailures(report, new Map(), '', 'trivy'), [])
  assert.equal(sarifGateFailures(report, new Map(), '', 'opengrep').length, 1)
  assert.equal(sarifGateFailures({ ...report, runs: [run, run] }, new Map(), '', 'trivy').length, 1)
  assert.equal(sarifGateFailures({ ...report, version: 'wrong' }, new Map(), '', 'trivy').length, 1)
  assert.equal(sarifGateFailures({ runs: [{}] }, new Map()).length, 1)
  for (const partial of [null, {}, { runs: null }, { runs: [null] }]) {
    assert.equal(sarifGateFailures(partial, new Map()).length, 1)
  }
})

test('rejects errors in successful-looking SARIF invocations', () => {
  for (const invocation of [{}, { executionSuccessful: true, exitCode: 2 },
    { executionSuccessful: true, toolExecutionNotifications: [{ level: 'error' }] }]) {
    assert.equal(sarifGateFailures({ runs: [{ invocations: [invocation], results: [] }] }, new Map()).length, 1)
  }
})

test('recognizes only explicitly audited Rust unsafe findings', () => {
  const additions = addedLinesFromDiff([
    '+++ b/src/example.rs',
    '@@ -0,0 +1,2 @@',
    '+// SAFETY: callback pointer is non-null.',
    '+let event = unsafe { pointer.as_ref() };',
  ].join('\n'), '/repo')
  const finding = {
    line: 2,
    path: '/repo/src/example.rs',
    rule: 'codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage',
  }

  assert.equal(isAuditedRustUnsafe(finding, additions), true)
  assert.equal(isAuditedRustUnsafe({ ...finding, line: 1 }, additions), false)
  assert.equal(isAuditedRustUnsafe({ ...finding, rule: 'different-rule' }, additions), false)
})

test('reports Biome diagnostics on added lines at every severity', () => {
  const additions = new Map([['/repo/src/example.ts', new Set([7])]])
  const report = { diagnostics: [{
    category: 'lint/style/example',
    location: { path: 'src/example.ts', start: { line: 7 } },
    message: 'minor issue',
    severity: 'info',
  }] }

  assert.equal(biomeGateFailures(report, additions, '/repo').length, 1)
})

test('reports security ESLint findings only on added lines at every severity', () => {
  const additions = new Map([['/repo/src/example.ts', new Set([7])]])
  const report = [{ filePath: '/repo/src/example.ts', messages: [
    { line: 6, message: 'existing issue', ruleId: 'security/existing', severity: 2 },
    { line: 7, message: 'new warning', ruleId: 'security/new', severity: 1 },
  ] }]

  assert.deepEqual(eslintGateFailures(report, additions), [{
    line: 7,
    message: 'new warning',
    path: '/repo/src/example.ts',
    rule: 'security/new',
    tool: 'Codacy ESLint security rules',
  }])
})

test('reads exclude_paths from .codacy.yaml', () => {
  const yaml = ['---', 'exclude_paths:', '  - "dist/**"', '  # imported code', "  - 'site/landing/**'  # mirrored", '  - plain/path/**', '  - "**/package-lock.json"', 'engines:', '  - "not/an/exclude"'].join('\n')
  assert.deepEqual(codacyExcludePatterns(yaml), ['dist/**', 'site/landing/**', 'plain/path/**', '**/package-lock.json'])
})

test('matches Codacy globs on repository-relative paths', () => {
  assert.ok(matchesCodacyGlob('site/landing/**', 'site/landing/src/App.tsx'))
  assert.ok(!matchesCodacyGlob('site/landing/**', 'site/landingx/App.tsx'))
  assert.ok(!matchesCodacyGlob('site/landing/**', 'site/.vitepress/theme/tolaria/Layout.vue'))
  assert.ok(matchesCodacyGlob('**/package-lock.json', 'package-lock.json'))
  assert.ok(matchesCodacyGlob('**/package-lock.json', 'apps/web/package-lock.json'))
  assert.ok(!matchesCodacyGlob('dist/**', 'apps/web/dist/index.js'))
  assert.ok(matchesCodacyGlob('src/*.test.ts', 'src/a.test.ts'))
  assert.ok(!matchesCodacyGlob('src/*.test.ts', 'src/nested/a.test.ts'))
})

test('drops excluded files before findings are matched to added lines', () => {
  const root = '/repo'
  const additions = addedLinesFromDiff([
    '+++ b/site/landing/src/App.tsx', '@@ -0,0 +1 @@', '+Math.random()',
    '+++ b/site/.vitepress/theme/tolaria/Layout.vue', '@@ -0,0 +1 @@', '+x',
  ].join('\n'), root)
  assert.deepEqual([...withoutExcludedPaths(additions, ['site/landing/**'], root).keys()], ['/repo/site/.vitepress/theme/tolaria/Layout.vue'])
})

// The local gate skips exactly what hosted Codacy skips. Pin the list so widening it is a reviewed change:
// everything main already excluded, plus the imported landing.
const EXPECTED_CODACY_EXCLUDES = [
  'apps/web/dist/**', 'apps/web/tests/**', '.chunk/**', 'coverage/**', 'dist/**', 'node_modules/**',
  'site/.vitepress/cache/**', 'site/.vitepress/dist/**', 'site/landing/**', 'src-tauri/gen/**',
  'src-tauri/resources/agent-docs/**', 'src-tauri/resources/mcp-server/**', 'src-tauri/target/**',
  'target/**', 'test-results/**', '**/package-lock.json',
]

test('repository .codacy.yaml excludes only the pinned paths', () => {
  const config = spawnSync('git', ['show', 'HEAD:.codacy.yaml'], { encoding: 'utf8' })
  assert.equal(config.status, 0)
  assert.deepEqual(codacyExcludePatterns(config.stdout), EXPECTED_CODACY_EXCLUDES)
})

test('findings outside the excluded paths still fail the gate', () => {
  const root = '/repo'
  const files = [
    'site/landing/src/App.tsx',
    'site/.vitepress/theme/tolaria/Layout.vue',
    'site/landing.md',
    'scripts/codacy-gate.mjs',
    'src/App.tsx',
    'apps/web/src/main.ts',
  ]
  const diff = files.flatMap((file) => [`+++ b/${file}`, '@@ -0,0 +1 @@', '+Math.random()']).join('\n')
  const additions = withoutExcludedPaths(addedLinesFromDiff(diff, root), EXPECTED_CODACY_EXCLUDES, root)
  const expected = files.filter((file) => !file.startsWith('site/landing/')).map((file) => `${root}/${file}`)

  const biome = { diagnostics: files.map((file) => ({ category: 'lint/example', location: { path: `${root}/${file}`, start: { line: 1 } } })) }
  assert.deepEqual(biomeGateFailures(biome, additions, root).map((failure) => failure.path), expected)

  const eslint = files.map((file) => ({ filePath: `${root}/${file}`, messages: [{ line: 1, ruleId: 'security/example', severity: 2 }] }))
  assert.deepEqual(eslintGateFailures(eslint, additions).map((failure) => failure.path), expected)

  const sarif = { runs: [{ tool: { driver: { name: 'opengrep' } }, results: files.map((file) => ({
    locations: [{ physicalLocation: { artifactLocation: { uri: file }, region: { startLine: 1 } } }],
    message: { text: 'insecure random' },
    ruleId: 'insecure-random',
  })) }] }
  assert.deepEqual(sarifGateFailures(sarif, additions, root).map((failure) => failure.path), expected)
})
