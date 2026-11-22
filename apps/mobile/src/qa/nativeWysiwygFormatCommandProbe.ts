import { mobileColors } from '../ui/tokens'
import type { MobileMarkdownFormatAction } from '../workspace/mobileMarkdownFormatting'

type ProbeLogText = string
type ProbeLine = string
type ProbeJsonNode = {
  attrs?: Record<string, unknown>
  content?: ProbeJsonNode[]
  marks?: { type?: string }[]
  text?: string
  type?: string
}

export type NativeWysiwygFormatCommandProof = {
  action: MobileMarkdownFormatAction
  args: readonly (number | string)[]
  effectApplied?: boolean
  effectMarkdown?: string
  forwarded: boolean
  method: string
}

export type NativeWysiwygFormatCommandAssertionFailure = {
  id: string
  message: string
}

type NativeWysiwygFormatCommandProbeSpec = {
  action: MobileMarkdownFormatAction
  args: readonly (number | string)[]
  method: string
}
type NativeWysiwygFormatEffectSpec = {
  action: MobileMarkdownFormatAction
  markdown: string
}

export const nativeWysiwygFormatCommandLogPrefix = 'TOLARIA_MOBILE_WYSIWYG_FORMAT_COMMAND_PROBE'
export const nativeWysiwygFormatCommandHighlightColor = mobileColors.yellowSoft
export const nativeWysiwygFormatCommandEffectText = 'Format me'

export const nativeWysiwygFormatCommandProbeActions = [
  'bold',
  'italic',
  'strike',
  'code',
  'highlight',
  'heading1',
  'heading2',
  'heading3',
  'heading4',
  'heading5',
  'heading6',
  'bulletList',
  'orderedList',
  'taskList',
  'indent',
  'outdent',
  'quote',
  'tableAddColumnAfter',
  'tableAddRowAfter',
  'tableDeleteColumn',
  'tableDeleteRow',
] as const satisfies readonly MobileMarkdownFormatAction[]

const nativeWysiwygFormatCommandProbeSpecs = [
  { action: 'bold', args: [], method: 'toggleBold' },
  { action: 'italic', args: [], method: 'toggleItalic' },
  { action: 'strike', args: [], method: 'toggleStrike' },
  { action: 'code', args: [], method: 'toggleCode' },
  { action: 'highlight', args: [nativeWysiwygFormatCommandHighlightColor], method: 'toggleHighlight' },
  { action: 'heading1', args: [1], method: 'toggleHeading' },
  { action: 'heading2', args: [2], method: 'toggleHeading' },
  { action: 'heading3', args: [3], method: 'toggleHeading' },
  { action: 'heading4', args: [4], method: 'toggleHeading' },
  { action: 'heading5', args: [5], method: 'toggleHeading' },
  { action: 'heading6', args: [6], method: 'toggleHeading' },
  { action: 'bulletList', args: [], method: 'toggleBulletList' },
  { action: 'orderedList', args: [], method: 'toggleOrderedList' },
  { action: 'taskList', args: [], method: 'toggleTaskList' },
  { action: 'indent', args: [], method: 'sink' },
  { action: 'outdent', args: [], method: 'lift' },
  { action: 'quote', args: [], method: 'toggleBlockquote' },
  { action: 'tableAddColumnAfter', args: [], method: 'addColumnAfter' },
  { action: 'tableAddRowAfter', args: [], method: 'addRowAfter' },
  { action: 'tableDeleteColumn', args: [], method: 'deleteColumn' },
  { action: 'tableDeleteRow', args: [], method: 'deleteRow' },
] as const satisfies readonly NativeWysiwygFormatCommandProbeSpec[]

export const nativeWysiwygFormatCommandEffectProbeActions = [
  'bold',
  'italic',
  'strike',
  'code',
  'highlight',
  'heading2',
  'bulletList',
  'orderedList',
  'taskList',
  'quote',
] as const satisfies readonly MobileMarkdownFormatAction[]

const nativeWysiwygFormatCommandEffectSpecs = [
  { action: 'bold', markdown: '**Format me**' },
  { action: 'italic', markdown: '*Format me*' },
  { action: 'strike', markdown: '~~Format me~~' },
  { action: 'code', markdown: '`Format me`' },
  { action: 'highlight', markdown: '==Format me==' },
  { action: 'heading2', markdown: '## Format me' },
  { action: 'bulletList', markdown: '- Format me' },
  { action: 'orderedList', markdown: '1. Format me' },
  { action: 'taskList', markdown: '- [ ] Format me' },
  { action: 'quote', markdown: '> Format me' },
] as const satisfies readonly NativeWysiwygFormatEffectSpec[]

export function nativeWysiwygFormatCommandProof({
  action,
  editor,
  effectMarkdown,
}: {
  action: MobileMarkdownFormatAction
  editor: unknown
  effectMarkdown?: string
}): NativeWysiwygFormatCommandProof {
  const spec = nativeWysiwygFormatCommandSpec(action)
  const effectSpec = nativeWysiwygFormatEffectSpec(action)

  return {
    action,
    args: spec.args,
    ...(effectMarkdown === undefined || effectSpec === null ? {} : {
      effectApplied: effectMarkdown === effectSpec.markdown,
      effectMarkdown,
    }),
    forwarded: typeof (editor as Record<string, unknown> | null)?.[spec.method] === 'function',
    method: spec.method,
  }
}

export function nativeWysiwygFormatCommandEffectContent(): ProbeJsonNode {
  return {
    content: [
      {
        content: [{ text: nativeWysiwygFormatCommandEffectText, type: 'text' }],
        type: 'paragraph',
      },
    ],
    type: 'doc',
  }
}

export function nativeWysiwygFormatCommandEffectSelection(): { from: number; to: number } {
  return {
    from: 1,
    to: nativeWysiwygFormatCommandEffectText.length + 1,
  }
}

export function nativeWysiwygFormatCommandEffectMarkdown(json: unknown): string {
  return probeMarkdownFromJson(json).trim()
}

export function nativeWysiwygFormatCommandExpectedEffectMarkdown(
  action: MobileMarkdownFormatAction,
): string | null {
  return nativeWysiwygFormatEffectSpec(action)?.markdown ?? null
}

export function nativeWysiwygFormatCommandLogLine(
  proof: NativeWysiwygFormatCommandProof,
): ProbeLine {
  return `${nativeWysiwygFormatCommandLogPrefix} ${JSON.stringify(proof)}`
}

export function parseNativeWysiwygFormatCommandProofs(
  logText: ProbeLogText,
): NativeWysiwygFormatCommandProof[] {
  return logText
    .split('\n')
    .map(parseProofLine)
    .filter((proof): proof is NativeWysiwygFormatCommandProof => proof !== null)
}

export function assertNativeWysiwygFormatCommandProofs(
  proofs: NativeWysiwygFormatCommandProof[],
): NativeWysiwygFormatCommandAssertionFailure[] {
  if (proofs.length === 0) {
    return [{ id: 'editor.wysiwyg.formatCommands', message: 'Native WYSIWYG format command proof was not logged' }]
  }

  return nativeWysiwygFormatCommandProbeSpecs
    .map((spec) => proofFailure(
      hasFormatCommandProof(proofs, spec),
      `editor.wysiwyg.formatCommands.${spec.action}`,
      `Native WYSIWYG forwards ${spec.action} to TenTap ${spec.method}`,
    ))
    .concat(nativeWysiwygFormatCommandEffectSpecs.map((spec) => proofFailure(
      hasFormatEffectProof(proofs, spec),
      `editor.wysiwyg.formatCommands.effect.${spec.action}`,
      `Native WYSIWYG ${spec.action} command serializes back to desktop Markdown`,
    )))
    .filter((failure): failure is NativeWysiwygFormatCommandAssertionFailure => failure !== null)
}

export function formatNativeWysiwygFormatCommandFailures(
  failures: NativeWysiwygFormatCommandAssertionFailure[],
): string {
  return failures.map((failure) => `${failure.id}: ${failure.message}`).join('\n')
}

export function nativeWysiwygFormatCommandProbeEnabled(searchParams: URLSearchParams): boolean {
  return searchParams.get('wysiwygFormatCommandProbe') === '1'
}

function nativeWysiwygFormatCommandSpec(
  action: MobileMarkdownFormatAction,
): NativeWysiwygFormatCommandProbeSpec {
  return nativeWysiwygFormatCommandProbeSpecs.find((spec) => spec.action === action) ?? {
    action,
    args: [],
    method: '',
  }
}

function parseProofLine(line: ProbeLine): NativeWysiwygFormatCommandProof | null {
  const prefixIndex = line.indexOf(nativeWysiwygFormatCommandLogPrefix)
  if (prefixIndex === -1) return null

  const rawJson = line.slice(prefixIndex + nativeWysiwygFormatCommandLogPrefix.length).trim()
  try {
    return parsedProof(JSON.parse(rawJson))
  } catch {
    return null
  }
}

function parsedProof(value: unknown): NativeWysiwygFormatCommandProof | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<NativeWysiwygFormatCommandProof>
  if (!isFormatProbeAction(candidate.action)) return null
  if (!Array.isArray(candidate.args)) return null
  if (typeof candidate.forwarded !== 'boolean') return null
  if (typeof candidate.method !== 'string') return null

  return {
    action: candidate.action,
    args: candidate.args.filter(isFormatProbeArg),
    ...formatEffectFields(candidate),
    forwarded: candidate.forwarded,
    method: candidate.method,
  }
}

function formatEffectFields(candidate: Partial<NativeWysiwygFormatCommandProof>) {
  return {
    ...(typeof candidate.effectApplied === 'boolean' ? { effectApplied: candidate.effectApplied } : {}),
    ...(typeof candidate.effectMarkdown === 'string' ? { effectMarkdown: candidate.effectMarkdown } : {}),
  }
}

function hasFormatCommandProof(
  proofs: NativeWysiwygFormatCommandProof[],
  expected: NativeWysiwygFormatCommandProbeSpec,
): boolean {
  return proofs.some((proof) => (
    proof.action === expected.action
    && proof.forwarded
    && proof.method === expected.method
    && sameArgs(proof.args, expected.args)
  ))
}

function hasFormatEffectProof(
  proofs: NativeWysiwygFormatCommandProof[],
  expected: NativeWysiwygFormatEffectSpec,
): boolean {
  return proofs.some((proof) => (
    proof.action === expected.action
    && proof.forwarded
    && proof.effectApplied === true
    && proof.effectMarkdown === expected.markdown
  ))
}

function nativeWysiwygFormatEffectSpec(
  action: MobileMarkdownFormatAction,
): NativeWysiwygFormatEffectSpec | null {
  return nativeWysiwygFormatCommandEffectSpecs.find((spec) => spec.action === action) ?? null
}

function sameArgs(actual: readonly (number | string)[], expected: readonly (number | string)[]): boolean {
  return actual.length === expected.length
    && actual.every((arg, index) => arg === expected[index])
}

function isFormatProbeAction(value: unknown): value is MobileMarkdownFormatAction {
  return typeof value === 'string'
    && (nativeWysiwygFormatCommandProbeActions as readonly string[]).includes(value)
}

function isFormatProbeArg(value: unknown): value is number | string {
  return typeof value === 'number' || typeof value === 'string'
}

const probeNodeRenderers = new Map<string, (node: ProbeJsonNode) => string>([
  ['text', markedProbeText],
  ['heading', (node) => `${'#'.repeat(headingLevel(node))} ${probeChildMarkdown(node)}`],
  ['paragraph', probeChildMarkdown],
  ['blockquote', (node) => quoteProbeMarkdown(probeChildMarkdown(node))],
  ['bulletList', (node) => listProbeMarkdown(node, '- ')],
  ['orderedList', (node) => listProbeMarkdown(node, '1. ')],
  ['taskList', taskListProbeMarkdown],
  ['doc', (node) => (node.content ?? []).map(probeMarkdownFromJson).filter(Boolean).join('\n\n')],
])

function probeMarkdownFromJson(value: unknown): string {
  if (!value || typeof value !== 'object') return ''
  const node = value as ProbeJsonNode
  const render = probeNodeRenderers.get(node.type ?? '') ?? probeChildMarkdown
  return render(node)
}

function probeChildMarkdown(node: ProbeJsonNode): string {
  return (node.content ?? []).map(probeMarkdownFromJson).join('')
}

function markedProbeText(node: ProbeJsonNode): string {
  return (node.marks ?? []).reduce((text, mark) => {
    if (mark.type === 'bold') return `**${text}**`
    if (mark.type === 'italic') return `*${text}*`
    if (mark.type === 'strike') return `~~${text}~~`
    if (mark.type === 'code') return `\`${text}\``
    if (mark.type === 'highlight') return `==${text}==`
    return text
  }, node.text ?? '')
}

function headingLevel(node: ProbeJsonNode): number {
  const level = node.attrs?.level
  return typeof level === 'number' && level >= 1 && level <= 6 ? level : 1
}

function quoteProbeMarkdown(markdown: string): string {
  return markdown.split('\n').map((line) => `> ${line}`).join('\n')
}

function listProbeMarkdown(node: ProbeJsonNode, marker: string): string {
  return (node.content ?? [])
    .map((item) => `${marker}${probeChildMarkdown(item)}`)
    .join('\n')
}

function taskListProbeMarkdown(node: ProbeJsonNode): string {
  return (node.content ?? [])
    .map((item) => {
      const checked = item.attrs?.checked === true ? 'x' : ' '
      return `- [${checked}] ${probeChildMarkdown(item)}`
    })
    .join('\n')
}

function proofFailure(
  passed: boolean,
  id: string,
  message: string,
): NativeWysiwygFormatCommandAssertionFailure | null {
  return passed ? null : { id, message }
}
