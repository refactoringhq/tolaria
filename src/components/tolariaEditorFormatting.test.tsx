import { Children, isValidElement, type ReactElement } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { getFormattingToolbarItems } from '@blocknote/react'

vi.mock('../lib/telemetry', () => ({
  trackEvent: vi.fn(),
}))

import {
  addItemsToMediaGroup,
  createCalloutSlashMenuItem,
  createDateTimeSlashMenuItems,
  createSandboxBlockSlashMenuItem,
  createMathSlashMenuItem,
  filterTolariaFormattingToolbarItems,
  filterTolariaSlashMenuItems,
  getTolariaBlockTypeSelectItems,
  HTML_SLASH_COMMAND_SOURCE,
  MATH_SLASH_COMMAND_LATEX,
  MERMAID_SLASH_COMMAND_DIAGRAM,
} from './tolariaEditorFormattingConfig'
import { HTML_BLOCK_DEFAULT_HEIGHT, HTML_BLOCK_TYPE } from '../utils/htmlBlockMarkdown'
import { trackEvent } from '../lib/telemetry'
import { MATH_BLOCK_TYPE } from '../utils/mathMarkdown'
import { mermaidFenceSource } from '../utils/mermaidMarkdown'
import { CALLOUT_BLOCK_TYPE } from '../utils/calloutMarkdown'
import type { ObsidianCalloutType } from '../utils/calloutCatalog'
import { calloutIconForType } from './calloutIcons'

function createSlashCommandEditorFixture() {
  const block = { id: 'active-block' }
  const editor = {
    getTextCursorPosition: () => ({ block }),
    insertInlineContent: () => {},
    replaceBlocks: () => {},
    updateBlock: () => {},
  }

  return {
    block,
    editor: editor as never,
    insertInlineContent: vi.spyOn(editor, 'insertInlineContent'),
    replaceBlocks: vi.spyOn(editor, 'replaceBlocks'),
    updateBlock: vi.spyOn(editor, 'updateBlock'),
  }
}

describe('tolariaEditorFormatting', () => {
  it('keeps the markdown-safe toolbar controls and block type select', () => {
    const itemKeys = filterTolariaFormattingToolbarItems(
      getFormattingToolbarItems(getTolariaBlockTypeSelectItems()),
    ).map((item) => String(item.key))

    expect(itemKeys).toContain('blockTypeSelect')
    expect(itemKeys).toContain('boldStyleButton')
    expect(itemKeys).toContain('italicStyleButton')
    expect(itemKeys).toContain('strikeStyleButton')
    expect(itemKeys).toContain('createLinkButton')
    expect(itemKeys).toContain('nestBlockButton')
    expect(itemKeys).toContain('unnestBlockButton')
    // Text and background colors stay available: markdown highlights round-trip through `==`.
    expect(itemKeys).toContain('colorStyleButton')

    expect(itemKeys).not.toContain('underlineStyleButton')
    expect(itemKeys).not.toContain('textAlignLeftButton')
    expect(itemKeys).not.toContain('textAlignCenterButton')
    expect(itemKeys).not.toContain('textAlignRightButton')
  })

  it('returns the audited markdown-safe block types for the toolbar select', () => {
    expect(getTolariaBlockTypeSelectItems()).toEqual([
      expect.objectContaining({ name: 'Paragraph', type: 'paragraph' }),
      expect.objectContaining({ name: 'Heading 1', type: 'heading', props: { level: 1 } }),
      expect.objectContaining({ name: 'Heading 2', type: 'heading', props: { level: 2 } }),
      expect.objectContaining({ name: 'Heading 3', type: 'heading', props: { level: 3 } }),
      expect.objectContaining({ name: 'Heading 4', type: 'heading', props: { level: 4 } }),
      expect.objectContaining({ name: 'Heading 5', type: 'heading', props: { level: 5 } }),
      expect.objectContaining({ name: 'Heading 6', type: 'heading', props: { level: 6 } }),
      expect.objectContaining({ name: 'Quote', type: 'quote' }),
      expect.objectContaining({ name: 'Bullet List', type: 'bulletListItem' }),
      expect.objectContaining({ name: 'Numbered List', type: 'numberedListItem' }),
      expect.objectContaining({ name: 'Checklist', type: 'checkListItem' }),
      expect.objectContaining({ name: 'Code Block', type: 'codeBlock' }),
    ])
  })

  it('filters unsupported toggle slash-menu variants and removes command descriptions', () => {
    type TolariaSlashMenuTestItem = {
      key: string
      title: string
      onItemClick: () => void
      subtext?: string
      icon?: ReactElement
    }

    const items = filterTolariaSlashMenuItems([
      { key: 'toggle_heading', title: 'Toggle heading', onItemClick: () => {} },
      { key: 'toggle_list', title: 'Toggle list', onItemClick: () => {} },
      { key: 'heading', title: 'Heading', subtext: 'Default heading copy', onItemClick: () => {} },
      { key: 'heading_4', title: 'Heading 4', onItemClick: () => {} },
      { key: 'bullet_list', title: 'Bullet List', subtext: 'Default list copy', onItemClick: () => {} },
      { key: 'code_block', title: 'Code Block', subtext: 'Default code copy', onItemClick: () => {} },
      { key: 'heading_5', title: 'Heading 5', onItemClick: () => {} },
      { key: 'heading_6', title: 'Heading 6', onItemClick: () => {} },
    ] satisfies TolariaSlashMenuTestItem[])

    expect(items.map((item) => item.key)).toEqual([
      'heading',
      'heading_4',
      'bullet_list',
      'code_block',
    ])
    expect(items.map((item) => item.subtext)).toEqual([
      undefined,
      undefined,
      undefined,
      undefined,
    ])
  })

  it('wraps slash-menu icons so hover can swap Phosphor weights', () => {
    type TolariaSlashMenuTestItem = {
      key: string
      title: string
      onItemClick: () => void
      icon?: ReactElement
    }

    const items = filterTolariaSlashMenuItems([
      { key: 'heading', title: 'Heading', onItemClick: () => {} },
    ] satisfies TolariaSlashMenuTestItem[])
    const icon = items[0]?.icon

    expect(isValidElement(icon)).toBe(true)
    if (!isValidElement<{ className?: string; children?: ReactElement[] }>(icon)) return

    const iconChildren = Children.toArray(icon.props.children) as Array<
      ReactElement<{ className?: string; weight?: string }>
    >
    expect(icon.props.className).toBe('tolaria-slash-menu-icon')
    expect(iconChildren.map((child) => child.props.className)).toEqual([
      'tolaria-slash-menu-icon__regular',
      'tolaria-slash-menu-icon__fill',
    ])
    expect(iconChildren.map((child) => child.props.weight)).toEqual([
      'regular',
      'fill',
    ])
  })

  it('keeps custom media slash-menu commands searchable', () => {
    const expectedCommands = [
      { key: 'mermaid', title: 'Mermaid', aliases: ['diagram', 'flowchart', 'graph', 'chart'] },
      { key: 'math', title: 'Math', aliases: ['equation', 'latex', 'formula', 'sqrt'] },
      { key: 'html', title: 'HTML block', aliases: ['embed', 'iframe', 'sandbox', 'html'] },
      { key: 'whiteboard', title: 'Whiteboard', aliases: ['tldraw', 'drawing', 'canvas', 'sketch'] },
    ]
    const items = filterTolariaSlashMenuItems(expectedCommands.map((item) => ({
      ...item,
      onItemClick: () => {},
    })))

    expect(items.map(({ aliases, key, title }) => ({ aliases, key, title }))).toEqual(
      expectedCommands,
    )
    expect(items.map((item) => isValidElement(item.icon))).toEqual([true, true, true, true])
  })

  it('uses a valid placeholder diagram for new Mermaid blocks', () => {
    expect(MERMAID_SLASH_COMMAND_DIAGRAM).toBe([
      'flowchart TD',
      '    edit["Switch to the raw editor to edit"]',
    ].join('\n'))
    expect(mermaidFenceSource({ diagram: MERMAID_SLASH_COMMAND_DIAGRAM })).toBe([
      '```mermaid',
      'flowchart TD',
      '    edit["Switch to the raw editor to edit"]',
      '```',
    ].join('\n'))
  })

  it('places custom media commands before the existing non-media slash-menu group', () => {
    type TolariaSlashMenuTestItem = {
      key: string
      title: string
      group: string
      onItemClick: () => void
    }

    const items = addItemsToMediaGroup([
      { key: 'image', title: 'Image', group: 'Media', onItemClick: () => {} },
      { key: 'file', title: 'File', group: 'Media', onItemClick: () => {} },
      { key: 'emoji', title: 'Emoji', group: 'Others', onItemClick: () => {} },
    ] satisfies TolariaSlashMenuTestItem[], [
      {
        key: 'mermaid',
        title: 'Mermaid',
        group: 'Media',
        onItemClick: () => {},
      },
      {
        key: 'math',
        title: 'Math',
        group: 'Media',
        onItemClick: () => {},
      },
      {
        key: 'html',
        title: 'HTML block',
        group: 'Media',
        onItemClick: () => {},
      },
      {
        key: 'whiteboard',
        title: 'Whiteboard',
        group: 'Media',
        onItemClick: () => {},
      },
    ])

    expect(items.map(item => item.key)).toEqual([
      'image',
      'file',
      'mermaid',
      'math',
      'html',
      'whiteboard',
      'emoji',
    ])
  })

  it('creates an empty HTML block slash command for immediate source editing', () => {
    const { block, editor, replaceBlocks, updateBlock } = createSlashCommandEditorFixture()

    const sandboxItem = createSandboxBlockSlashMenuItem(editor, {
      sandboxBlockTitle: 'HTML block',
    })

    expect(sandboxItem).toEqual(expect.objectContaining({
      key: 'html',
      title: 'HTML block',
      aliases: ['embed', 'iframe', 'sandbox', 'html'],
    }))

    sandboxItem?.onItemClick()

    expect(replaceBlocks).toHaveBeenCalledWith([block], [{
      type: HTML_BLOCK_TYPE,
      props: {
        height: HTML_BLOCK_DEFAULT_HEIGHT,
        html: HTML_SLASH_COMMAND_SOURCE,
      },
    }])
    expect(updateBlock).not.toHaveBeenCalled()
    expect(trackEvent).toHaveBeenCalledWith('editor_html_block_slash_command_used')
  })

  it('creates a math slash command with a default display equation', () => {
    const { block, editor, replaceBlocks, updateBlock } = createSlashCommandEditorFixture()

    const mathItem = createMathSlashMenuItem(editor)

    expect(mathItem).toEqual(expect.objectContaining({
      key: 'math',
      title: 'Math',
      aliases: ['equation', 'latex', 'formula', 'sqrt'],
    }))

    mathItem?.onItemClick()

    expect(replaceBlocks).toHaveBeenCalledWith([block], [{
      type: MATH_BLOCK_TYPE,
      props: { latex: MATH_SLASH_COMMAND_LATEX },
    }])
    expect(updateBlock).not.toHaveBeenCalled()
    expect(trackEvent).toHaveBeenCalledWith('editor_math_slash_command_used')
  })

  it('creates a callout parent command with every default style in its submenu', () => {
    const { block, editor, replaceBlocks } = createSlashCommandEditorFixture()
    const calloutTypeTitles = Object.fromEntries([
      'note',
      'abstract',
      'info',
      'todo',
      'tip',
      'success',
      'question',
      'warning',
      'failure',
      'danger',
      'bug',
      'example',
      'quote',
    ].map(type => [type, type])) as Record<ObsidianCalloutType, string>
    const calloutItem = createCalloutSlashMenuItem(editor, {
      calloutTitle: 'Callout',
      calloutTypeTitles,
    })

    expect(calloutItem).toEqual(expect.objectContaining({
      key: 'callout',
      title: 'Callout',
      aliases: ['admonition', 'alert', 'aside'],
    }))
    expect(calloutItem.submenuItems?.map(item => item.key)).toEqual(
      Object.keys(calloutTypeTitles).map(type => `callout_${type}`),
    )

    calloutItem.submenuItems?.find(item => item.key === 'callout_tip')?.onItemClick()

    expect(replaceBlocks).toHaveBeenCalledWith([block], [{
      type: CALLOUT_BLOCK_TYPE,
      props: { calloutType: 'tip', title: '' },
    }])
    expect(trackEvent).toHaveBeenCalledWith('editor_callout_slash_command_used', {
      type: 'tip',
    })
  })

  it('uses a distinct Phosphor icon for every default callout type', () => {
    const types: ObsidianCalloutType[] = [
      'note', 'abstract', 'info', 'todo', 'tip', 'success', 'question',
      'warning', 'failure', 'danger', 'bug', 'example', 'quote',
    ]

    expect(new Set(types.map(calloutIconForType)).size).toBe(types.length)
  })

  it('renders one Phosphor icon node for each callout submenu item', () => {
    const { editor } = createSlashCommandEditorFixture()
    const submenuItems = createCalloutSlashMenuItem(editor).submenuItems ?? []

    submenuItems.forEach((item) => {
      const type = item.key.replace('callout_', '')
      expect(isValidElement(item.icon)).toBe(true)
      expect((item.icon as ReactElement).type).toBe(calloutIconForType(type))
    })
  })

  it('inserts resolved local date and time values from slash commands', () => {
    const { editor, insertInlineContent, replaceBlocks } = createSlashCommandEditorFixture()
    const currentDate = new Date(2026, 6, 19, 14, 5)
    const items = createDateTimeSlashMenuItems(editor, {
      dateTitle: 'Date',
      datetimeTitle: 'Date and time',
      timeTitle: 'Time',
    }, () => currentDate)

    expect(items).toEqual([
      expect.objectContaining({ key: 'date', title: 'Date', aliases: ['today'] }),
      expect.objectContaining({ key: 'time', title: 'Time', aliases: ['clock'] }),
      expect.objectContaining({
        key: 'datetime',
        title: 'Date and time',
        aliases: ['datetime', 'timestamp', 'date time'],
      }),
    ])

    items.forEach((item) => {
      item.onItemClick()
    })

    expect(insertInlineContent).toHaveBeenNthCalledWith(1, '2026-07-19', {
      updateSelection: true,
    })
    expect(insertInlineContent).toHaveBeenNthCalledWith(2, '14:05', {
      updateSelection: true,
    })
    expect(insertInlineContent).toHaveBeenNthCalledWith(3, '2026-07-19 14:05', {
      updateSelection: true,
    })
    expect(replaceBlocks).not.toHaveBeenCalled()
    expect(trackEvent).toHaveBeenCalledWith('editor_timestamp_slash_command_used', {
      kind: 'date',
    })
    expect(trackEvent).toHaveBeenCalledWith('editor_timestamp_slash_command_used', {
      kind: 'time',
    })
    expect(trackEvent).toHaveBeenCalledWith('editor_timestamp_slash_command_used', {
      kind: 'datetime',
    })
  })
})
