import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { desktopThemeEntry, parseDesktopThemes, readDesktopThemeCss } from '../src/ui/theme/parseDesktopTheme.ts'

const repositoryRoot = new URL('../../../', import.meta.url)
const target = new URL('../src/ui/theme/desktopThemes.generated.json', import.meta.url)
const themes = parseDesktopThemes(readDesktopThemeCss((path) => readFileSync(new URL(path, repositoryRoot), 'utf8')))
await writeFile(target, `${JSON.stringify(themes, null, 2)}\n`)
console.log(`Updated mobile light/dark palettes from desktop ${desktopThemeEntry} and its local imports`)
