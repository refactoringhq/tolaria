#!/usr/bin/env node
/* global console, process, fetch, AbortSignal */
import { spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(`${command} failed with exit ${result.status}`)
}

async function main() {
  const [device, artifactDirectory] = process.argv.slice(2)
  if (!device) throw new Error('Usage: node test-ios-panel-gestures.mjs SIMULATOR_UDID [ARTIFACT_DIRECTORY]')
  const status = await fetch('http://127.0.0.1:8081/status', { signal: AbortSignal.timeout(3000), credentials: 'omit', redirect: 'error' })
  if (!status.ok || !(await status.text()).includes('packager-status:running')) throw new Error('Start the mobile Metro server on port 8081 first')
  run('xcrun', ['simctl', 'get_app_container', device, 'com.tolaria.mobile.dev', 'app'])
  const output = resolve(artifactDirectory ?? join(tmpdir(), 'tolaria-native-panel-tests'))
  const projectDirectory = join(output, 'project')
  mkdirSync(output, { recursive: true })
  run('ruby', [fileURLToPath(new URL('../native-ui-tests/create-project.rb', import.meta.url)), projectDirectory])
  // Unsigned runner installs can be cached by Xcode even after the test code changes.
  run('xcrun', ['simctl', 'uninstall', device, 'com.tolaria.mobile.tablet-gesture-tests.xctrunner'])
  run('xcodebuild', [
    '-project', join(projectDirectory, 'TabletPanelGestureTests.xcodeproj'),
    '-scheme', 'TabletPanelGestureTests', '-destination', `id=${device}`,
    '-derivedDataPath', join(output, 'derived'),
    '-resultBundlePath', join(output, `panels-${Date.now()}.xcresult`),
    '-parallel-testing-enabled', 'NO', '-jobs', '2', 'CODE_SIGNING_ALLOWED=NO', 'test',
  ])
}

main().catch((error) => { console.error(error); process.exitCode = 1 })
