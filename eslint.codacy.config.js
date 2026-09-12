import tseslint from 'typescript-eslint'
import security from 'eslint-plugin-security'
import securityNode from 'eslint-plugin-security-node'
import xss from 'eslint-plugin-xss'

function eslintNinePlugin(plugin) {
  return {
    ...plugin,
    rules: Object.fromEntries(Object.entries(plugin.rules).map(([name, rule]) => [
      name,
      typeof rule === 'function' ? { create: rule } : rule,
    ])),
  }
}

export default [
  {
    files: ['src/**/*.{js,jsx,ts,tsx}', 'scripts/**/*.{js,mjs}'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: { ecmaFeatures: { jsx: true }, ecmaVersion: 'latest', sourceType: 'module' },
    },
    plugins: {
      security,
      'security-node': eslintNinePlugin(securityNode),
      xss: eslintNinePlugin(xss),
    },
    rules: {
      ...security.configs.recommended.rules,
      ...securityNode.configs.recommended.rules,
      ...xss.configs.recommended.rules,
      'xss/no-mixed-html': ['error', {
        functions: {
          'renderMermaidHtml': { htmlInput: true, htmlOutput: true, safe: true },
          'inputAsHtml': { htmlInput: true, htmlOutput: true },
          'svgAsHtml': { htmlInput: true, htmlOutput: true },
          'preMermaidAsHtml': { htmlInput: true, htmlOutput: true },
          'codeMermaidAsHtml': { htmlInput: true, htmlOutput: true },
          'readFixture': { htmlOutput: true },
          'fs.readFileSync': { htmlOutput: true },
          'countingRenderAsHtml': { htmlInput: true, htmlOutput: true },
          'emptyRenderAsHtml': { htmlInput: true, htmlOutput: true },
          'collectedDiagramsHtml.push': { htmlInput: true, safe: true },
          'collectedIdsHtml.push': { htmlInput: true, safe: true },
          'collectedResultsHtml.push': { htmlInput: true, safe: true },
          'expect': { htmlInput: true, htmlOutput: true, safe: true },
          'useMemo': { htmlOutput: true },
          'useEffect': { htmlInput: true, safe: true },
          'onRenderedHtml': { htmlInput: true },
          'scheduleMermaidHtmlRender': { htmlInput: true },
          'htmlWithWikilinkLiterals': { htmlInput: true, htmlOutput: true, safe: true },
          'clipboardData.setData': { htmlInput: true, htmlOutput: true, safe: true },
          'restoreWikilinkMarkdownFromMarkup': { htmlInput: true, safe: true },
          'cleanHTMLToMarkdown': { htmlInput: true, safe: true },
          'editor.blocksToHTMLLossy': { htmlOutput: true },
          'editor.pasteHTML': { htmlInput: true, safe: true },
          'fullNoteClipboardPayload': { htmlOutput: true, safe: true },
          'hostHtml.appendChild': { htmlInput: true, safe: true },
          'writeFullNoteClipboard': { htmlInput: true, safe: true },
          'writeRichEditorClipboardPayload': { htmlInput: true, safe: true },
          // Member calls whose receiver is not a plain identifier (e.g.
          // expect(x).toContain) resolve to these dotted candidate names.
          '.toContain': { htmlInput: true, safe: true },
          '.toBe': { htmlInput: true, safe: true },
          '.toHaveBeenCalledWith': { htmlInput: true, safe: true },
        },
      }],
    },
  },
]
