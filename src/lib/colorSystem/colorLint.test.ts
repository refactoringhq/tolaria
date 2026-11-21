import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'
import { COLOR_LINT_ALLOWLIST, findColorViolations, formatColorViolation, isColorLintTarget } from './colorLint'

const root = process.cwd()

function rules(source: string): string[] {
  return findColorViolations('src/example.tsx', source).map((violation) => `${violation.rule}:${violation.match}`)
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(path) : [relative(root, path)]
  })
}

describe('color lint', () => {
  it('flags raw hex colors', () => {
    expect(rules("color: '#fff'")).toEqual(['raw-hex:#fff'])
    expect(rules('background: #155DFF;')).toEqual(['raw-hex:#155DFF'])
    expect(rules("'#00000000'")).toEqual(['raw-hex:#00000000'])
  })

  it('flags raw color functions and color-mix', () => {
    expect(rules('box-shadow: 0 1px 2px rgb(0 0 0 / 0.4);')).toEqual(['raw-color-function:rgb('])
    expect(rules("'rgba(21, 93, 255, 0.12)'")).toEqual(['raw-color-function:rgba('])
    expect(rules('color: oklch(0.6 0.1 20);')).toEqual(['raw-color-function:oklch('])
    expect(rules('background: color-mix(in srgb, var(--primary) 10%, transparent);')).toEqual(['color-mix:color-mix('])
  })

  it('flags opacity-invented Tailwind colors', () => {
    expect(rules('className="bg-primary/10 text-muted-foreground/40"')).toEqual([
      'tailwind-opacity-modifier:bg-primary/10',
      'tailwind-opacity-modifier:text-muted-foreground/40',
    ])
    expect(rules('className="hover:bg-[var(--accent-blue)]/20"')).toEqual([
      'tailwind-opacity-modifier:bg-[var(--accent-blue)]/20',
    ])
  })

  it('flags Tailwind palette colors that bypass the Tolaria palette', () => {
    expect(rules('className="text-emerald-700 bg-white border-slate-200"')).toEqual([
      'tailwind-raw-palette:text-emerald-700',
      'tailwind-raw-palette:bg-white',
      'tailwind-raw-palette:border-slate-200',
    ])
  })

  it('passes semantic roles, sizes and non-color hashes', () => {
    expect(rules('className="bg-primary text-primary-foreground hover:bg-primary-hover text-sm/6 w-1/2"')).toEqual([])
    expect(rules("background: var(--accent-blue-light); href='#root'")).toEqual([])
    expect(rules("const id = prefix + '#' + index")).toEqual([])
  })

  it('reports file and line', () => {
    const [violation] = findColorViolations('src/a.css', 'a {}\nb { color: #123456; }')
    expect(formatColorViolation(violation)).toBe('src/a.css:2  raw-hex  #123456')
  })

  it('skips tests and allowlisted files, but lints product code', () => {
    expect(isColorLintTarget('src/components/Foo.tsx')).toBe(true)
    expect(isColorLintTarget('src/index.css')).toBe(true)
    expect(isColorLintTarget('src/components/Foo.test.tsx')).toBe(false)
    expect(isColorLintTarget('src/styles/palette.css')).toBe(false)
    expect(isColorLintTarget('src/assets/logo.svg')).toBe(false)
  })

  it('gives every allowlisted file a reason and keeps it pointing at a real file', () => {
    for (const [path, reason] of COLOR_LINT_ALLOWLIST) {
      expect(reason.length).toBeGreaterThan(10)
      expect(() => readFileSync(join(root, path), 'utf8')).not.toThrow()
    }
  })

  it('passes on the shipped desktop source', () => {
    const violations = listFiles(join(root, 'src'))
      .filter(isColorLintTarget)
      .flatMap((path) => findColorViolations(path, readFileSync(join(root, path), 'utf8')))
    expect(violations.map(formatColorViolation)).toEqual([])
  })
})
