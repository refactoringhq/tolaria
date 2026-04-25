import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

import {
  buildStableDownloadRedirectPage,
  resolveStableDownloadTargets,
} from '../src/utils/releaseDownloadPage'

function getArg(flag: string): string {
  const index = process.argv.indexOf(flag)
  const value = index >= 0 ? process.argv[index + 1] : null

  if (!value) {
    throw new Error(`Missing required argument: ${flag}`)
  }

  return value
}

function readLatestReleasePayload(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'))
  } catch {
    return {}
  }
}

const latestJsonPath = resolve(getArg('--latest-json'))
const releasesJsonPath = resolve(getArg('--releases-json'))
const outputFilePath = resolve(getArg('--output-file'))
const latestPayload = readLatestReleasePayload(latestJsonPath)
const releasesPayload = readLatestReleasePayload(releasesJsonPath)
const downloads = resolveStableDownloadTargets(latestPayload, releasesPayload)
const html = buildStableDownloadRedirectPage(downloads)

mkdirSync(dirname(outputFilePath), { recursive: true })
writeFileSync(outputFilePath, html)

console.log(`Stable download page written to ${outputFilePath}`)
