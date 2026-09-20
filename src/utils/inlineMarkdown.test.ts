import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { describe, expect, it } from 'vitest'
import inlineMarkdownContract from '../shared/inlineMarkdownContract.json'
import { extractSnippet } from './wikilinks'

describe('inline markdown contract', () => {
  it.each(inlineMarkdownContract.fixtures)('matches snippet behavior: $name', ({ input, expected }) => {
    expect(extractSnippet(`# Contract\n\n${input}`)).toBe(expected)
  })

  it('keeps the Safari 13 production build usable when WebKit rejects lookbehind', async () => {
    const BrowserUint8Array = globalThis.Uint8Array
    globalThis.Uint8Array = new TextEncoder().encode('').constructor as Uint8ArrayConstructor
    let output = ''
    try {
      const { build } = await import('esbuild')
      const bundle = await build({
        bundle: true,
        entryPoints: [resolve('src/utils/inlineMarkdown.ts')],
        format: 'iife',
        globalName: 'InlineMarkdown',
        target: 'safari13',
        write: false,
      })
      output = bundle.outputFiles[0]?.text ?? ''
    } finally {
      globalThis.Uint8Array = BrowserUint8Array
    }
    const NativeRegExp = RegExp
    class RejectingRegExp extends NativeRegExp {
      constructor(pattern?: string | RegExp, flags?: string) {
        const source = pattern instanceof NativeRegExp ? pattern.source : String(pattern ?? '')
        if (source.includes('(?<')) {
          throw new SyntaxError('Invalid regular expression: invalid group specifier name')
        }
        super(pattern, flags)
      }
    }
    const inlineMarkdown = runInNewContext(`${output}\nInlineMarkdown`, {
      RegExp: RejectingRegExp,
    }) as { stripInlineMarkdown: (value: string) => string }

    expect(() => inlineMarkdown.stripInlineMarkdown('Escaped \\*star\\* and foo_bar')).not.toThrow()
  })
})
