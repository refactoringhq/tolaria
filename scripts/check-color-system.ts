// Color system gate (TOL-406). Fails when a raw or opacity-invented color
// appears outside the palette, or when a token pairing misses its contrast floor.
//   node --experimental-strip-types scripts/check-color-system.ts [--report <file>]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { findColorViolations, formatColorViolation, isColorLintTarget } from '../src/lib/colorSystem/colorLint.ts'
import { buildContrastReport, formatContrastReport } from '../src/lib/colorSystem/contrast.ts'

const root = process.cwd()
const THEME_SOURCES = ['src/styles/palette.css', 'src/index.css']

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(path) : [relative(root, path)]
  })
}

const violations = listFiles(join(root, 'src'))
  .filter(isColorLintTarget)
  .flatMap((path) => findColorViolations(path, readFileSync(join(root, path), 'utf8')))

const report = buildContrastReport(THEME_SOURCES.map((path) => readFileSync(join(root, path), 'utf8')))
const contrastFailures = report.filter((result) => !result.pass)
const reportPath = process.argv.indexOf('--report')
if (reportPath > 0) writeFileSync(process.argv[reportPath + 1], `${formatContrastReport(report)}\n`)

for (const violation of violations) console.error(formatColorViolation(violation))
for (const failure of contrastFailures) {
  console.error(`contrast ${failure.theme}: ${failure.label} ${failure.ratio.toFixed(2)}:1 < ${failure.minimum}:1`)
}
console.log(`Color lint: ${violations.length} raw or opacity-invented colors outside the palette.`)
console.log(`Contrast: ${report.length - contrastFailures.length}/${report.length} token pairings pass.`)
process.exit(violations.length + contrastFailures.length > 0 ? 1 : 0)
