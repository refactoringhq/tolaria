import postcss from 'postcss'

type Variables = Record<string, string>

// Desktop theme entry, relative to the repository root. Its local `@import`s (the raw
// `:root` palette, syntax colors) are inlined so every role resolves.
export const desktopThemeEntry = 'src/index.css'

export function readDesktopThemeCss(read: (path: string) => string, path: string = desktopThemeEntry): string {
  const directory = path.slice(0, path.lastIndexOf('/') + 1)
  return read(path).replace(/@import\s+["']\.\/([^"']+\.css)["'];/g, (_match, file: string) =>
    readDesktopThemeCss(read, `${directory}${file}`))
}

// Build/test only. The native runtime imports the generated JSON, never CSS parsers.
export function parseDesktopThemes(css: string) {
  const root = postcss.parse(css)
  const palette = readPalette(root)
  const light = new Map([...palette, ...readTheme(root, 'light')])
  const dark = new Map([...light, ...readTheme(root, 'dark')])
  return {
    light: resolveTheme(light),
    dark: resolveTheme(dark),
  }
}

function readPalette(root: postcss.Root) {
  return readVariables(root, (selectors) => selectors.length === 1 && selectors[0] === ':root')
}

function readTheme(root: postcss.Root, mode: 'light' | 'dark') {
  const variables = readVariables(root, (selectors) => selectors.includes(`[data-theme="${mode}"]`))
  if (variables.size === 0) throw new Error(`Missing desktop ${mode} theme`)
  return variables
}

function readVariables(root: postcss.Root, matches: (selectors: string[]) => boolean) {
  const variables = new Map<string, string>()
  root.walkRules((rule) => {
    if (!matches(rule.selectors)) return
    rule.walkDecls((declaration) => {
      if (declaration.prop.startsWith('--')) variables.set(declaration.prop, declaration.value)
    })
  })
  return variables
}

function resolveTheme(variables: Map<string, string>): Variables {
  return Object.fromEntries([...variables.keys()].sort().map((key) => [key, resolveVariable(key, variables)]))
}

function resolveVariable(key: string, variables: Map<string, string>, visited = new Set<string>()): string {
  if (visited.has(key)) throw new Error(`Cyclic theme variable ${key}`)
  const value = variables.get(key)
  if (value === undefined) throw new Error(`Missing theme variable ${key}`)
  const chain = new Set([...visited, key])
  return value.replace(/var\(\s*(--[\w-]+)\s*\)/g, (_match, alias: string) => resolveVariable(alias, variables, chain))
}
