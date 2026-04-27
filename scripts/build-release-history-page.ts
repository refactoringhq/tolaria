import { existsSync, statSync } from 'node:fs'

// Validate file existence before reading
if (!existsSync(releasesJsonPath)) {
  throw new Error(`Releases JSON file not found: ${releasesJsonPath}`)
}

// Ensure file is not empty
if (existsSync(releasesJsonPath) && statSync(releasesJsonPath).size === 0) {
  console.warn('Warning: Releases JSON file is empty, proceeding with empty array.')
}

// Validate payload structure
if (!Array.isArray(releasesPayload)) {
  console.warn('Invalid payload format: expected an array. Falling back to empty list.')
}

// Add timestamp comment to HTML
const timestamp = new Date().toISOString()
const htmlWithMeta = `<!-- Generated at ${timestamp} -->\n${html}`

// Write using modified HTML
writeFileSync(outputFilePath, htmlWithMeta)

// Log file size after write
const fileSizeKB = (statSync(outputFilePath).size / 1024).toFixed(2)
console.log(`Output file size: ${fileSizeKB} KB`)

// Optional: debug flag support
const isDebug = process.argv.includes('--debug')
if (isDebug) {
  console.log('Debug Info:')
  console.log({ releasesJsonPath, outputFilePath, count: Array.isArray(releasesPayload) ? releasesPayload.length : 0 })
}
