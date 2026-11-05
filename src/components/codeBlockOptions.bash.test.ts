import { describe, expect, it } from 'vitest'
import { createTolariaCodeBlockOptions } from './codeBlockOptions'

async function highlightBash(source: string) {
  const highlighter = await createTolariaCodeBlockOptions().createHighlighter?.()
  await highlighter?.loadLanguage('bash')
  return highlighter?.codeToTokens(source, { lang: 'bash', theme: 'github-light' })
}

describe('Bash code block highlighting', () => {
  it('offers one canonical Bash picker option for common shell aliases', () => {
    const options = createTolariaCodeBlockOptions()

    expect(options.supportedLanguages?.bash).toMatchObject({
      name: 'Bash',
      aliases: ['bash', 'sh', 'shell', 'shellscript', 'zsh'],
    })
    expect(options.supportedLanguages?.shellscript).toBeUndefined()
  })

  it('loads and applies the Shiki shell grammar through the Bash alias', async () => {
    const highlighter = await createTolariaCodeBlockOptions().createHighlighter?.()

    await expect(highlighter?.loadLanguage('bash')).resolves.toBeUndefined()
    expect(highlighter?.getLoadedLanguages()).toContain('bash')

    const highlighted = await highlighter?.codeToTokens('echo "$HOME"', {
      lang: 'bash',
      theme: 'github-light',
    })
    expect(highlighted?.tokens[0]?.[0]).toMatchObject({
      color: '#005CC5',
      content: 'echo',
    })
  })

  it('highlights a full-line comment after a multiword command', async () => {
    const highlighted = await highlightBash('# setup\necho hello world again\n# later comment')
    expect(highlighted?.tokens[2]).toContainEqual(expect.objectContaining({ content: '# later comment', color: '#6A737D' }))
  })

  it('highlights a trailing comment after a multiword command', async () => {
    const highlighted = await highlightBash('# setup\necho hello world again\nls -la # list')
    expect(highlighted?.tokens[2]).toContainEqual(expect.objectContaining({ content: '# list', color: '#6A737D' }))
  })

  it('keeps quoted hashes and shell parameter markers out of comments', async () => {
    const highlighted = await highlightBash('echo "# quoted"\necho $#\necho $' + '{#var}')
    expect(highlighted?.tokens[0]).toContainEqual(expect.objectContaining({ content: '"# quoted"', color: '#032F62' }))
    expect(highlighted?.tokens[1]).toContainEqual(expect.objectContaining({ content: '$#', color: '#005CC5' }))
    expect(highlighted?.tokens[2]).toContainEqual(expect.objectContaining({ content: '#', color: '#D73A49' }))
  })

  it('keeps shebang lines highlighted as comments', async () => {
    const highlighted = await highlightBash('#!/bin/bash')
    expect(highlighted?.tokens[0]).toContainEqual(expect.objectContaining({ content: '#!/bin/bash', color: '#6A737D' }))
  })
})
