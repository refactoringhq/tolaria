import type { MobileMarkdownFormatAction } from '../../workspace/mobileMarkdownFormatting'

const groups = {
  primary: ['bold', 'italic', 'link', 'wikilink'],
  headings: ['heading1', 'heading2', 'heading3', 'heading4', 'heading5', 'heading6'],
  lists: ['bulletList', 'orderedList', 'taskList', 'indent', 'outdent'],
  insert: ['attachment', 'table', 'codeBlock', 'mathBlock', 'mermaid', 'whiteboard', 'divider'],
  more: ['strike', 'code', 'highlight', 'quote', 'pastePlainText'],
  table: ['tableAddRowAfter', 'tableAddColumnAfter', 'tableDeleteRow', 'tableDeleteColumn'],
} as const satisfies Record<string, readonly MobileMarkdownFormatAction[]>

export type FormattingToolbarGroup = keyof typeof groups
export const formattingToolbarTouchSize = 44

export function formattingToolbarGroups(allowed: readonly MobileMarkdownFormatAction[], inTable: boolean) {
  const available = new Set(allowed)
  return Object.fromEntries(Object.entries(groups).map(([group, actions]) => [
    group, group === 'table' && !inTable ? [] : actions.filter((action) => available.has(action)),
  ])) as Record<FormattingToolbarGroup, MobileMarkdownFormatAction[]>
}

const activeStates = {
  bold: 'isBoldActive', italic: 'isItalicActive', strike: 'isStrikeActive',
  code: 'isCodeActive', highlight: 'isHighlightActive', link: 'isLinkActive',
  bulletList: 'isBulletListActive', orderedList: 'isOrderedListActive',
  taskList: 'isTaskListActive', quote: 'isBlockquoteActive',
} as const

type FormattingState = Partial<Record<typeof activeStates[keyof typeof activeStates], boolean>> & { headingLevel?: number }

export function formattingToolbarSelection(state: FormattingState): MobileMarkdownFormatAction[] {
  const selected = Object.entries(activeStates).filter(([, key]) => state[key]).map(([action]) => action as MobileMarkdownFormatAction)
  const heading = groups.headings.find((_, index) => state.headingLevel === index + 1)
  if (heading) selected.push(heading)
  return selected
}
