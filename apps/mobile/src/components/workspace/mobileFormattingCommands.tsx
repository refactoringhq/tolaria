import {
  Code,
  CodeBlock,
  Columns,
  ColumnsPlusRight,
  ClipboardText,
  FlowArrow,
  Link,
  LinkSimple,
  ListBullets,
  ListChecks,
  ListNumbers,
  Minus,
  Paperclip,
  Pi,
  Quotes,
  Rows,
  RowsPlusBottom,
  ScribbleLoop,
  Table,
  TextB,
  TextHFive,
  TextHFour,
  TextHOne,
  TextHSix,
  TextHThree,
  TextHTwo,
  TextIndent,
  TextItalic,
  TextOutdent,
  TextStrikethrough,
} from 'phosphor-react-native'
import type { ReactNode } from 'react'
import { mobileText } from '../../i18n/mobileText'
import { desktopToolbarActionParity } from '../../ui/desktopParity'
import type { MobileMarkdownFormatAction } from '../../workspace/mobileMarkdownFormatting'

export type FormattingCommand = {
  action: MobileMarkdownFormatAction
  icon: (color: string) => ReactNode
  label: string
  testID: string
}

export const formattingCommands: FormattingCommand[] = [
  {
    action: 'attachment',
    icon: (color) => <Paperclip color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.attachment'),
    testID: 'editor-format-attachment',
  },
  {
    action: 'pastePlainText',
    icon: (color) => <ClipboardText color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('command.note.pastePlainText'),
    testID: 'editor-format-paste-plain-text',
  },
  {
    action: 'bold',
    icon: (color) => <TextB color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.bold'),
    testID: 'editor-format-bold',
  },
  {
    action: 'italic',
    icon: (color) => <TextItalic color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.italic'),
    testID: 'editor-format-italic',
  },
  {
    action: 'strike',
    icon: (color) => <TextStrikethrough color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.strikethrough'),
    testID: 'editor-format-strike',
  },
  {
    action: 'code',
    icon: (color) => <Code color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.code'),
    testID: 'editor-format-code',
  },
  {
    action: 'highlight',
    icon: (color) => <TextB color={color} size={desktopToolbarActionParity.iconSize} weight="fill" />,
    label: mobileText('editor.formatting.highlight'),
    testID: 'editor-format-highlight',
  },
  {
    action: 'link',
    icon: (color) => <Link color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.link'),
    testID: 'editor-format-link',
  },
  {
    action: 'wikilink',
    icon: (color) => <LinkSimple color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.wikilink'),
    testID: 'editor-format-wikilink',
  },
  {
    action: 'heading1',
    icon: (color) => <TextHOne color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.heading1'),
    testID: 'editor-format-heading-1',
  },
  {
    action: 'heading2',
    icon: (color) => <TextHTwo color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.heading2'),
    testID: 'editor-format-heading-2',
  },
  {
    action: 'heading3',
    icon: (color) => <TextHThree color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.heading3'),
    testID: 'editor-format-heading-3',
  },
  {
    action: 'heading4',
    icon: (color) => <TextHFour color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.heading4'),
    testID: 'editor-format-heading-4',
  },
  {
    action: 'heading5',
    icon: (color) => <TextHFive color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.heading5'),
    testID: 'editor-format-heading-5',
  },
  {
    action: 'heading6',
    icon: (color) => <TextHSix color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.heading6'),
    testID: 'editor-format-heading-6',
  },
  {
    action: 'bulletList',
    icon: (color) => <ListBullets color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.bulletList'),
    testID: 'editor-format-bullet-list',
  },
  {
    action: 'orderedList',
    icon: (color) => <ListNumbers color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.orderedList'),
    testID: 'editor-format-ordered-list',
  },
  {
    action: 'taskList',
    icon: (color) => <ListChecks color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.taskList'),
    testID: 'editor-format-task-list',
  },
  {
    action: 'indent',
    icon: (color) => <TextIndent color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.indent'),
    testID: 'editor-format-indent',
  },
  {
    action: 'outdent',
    icon: (color) => <TextOutdent color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.outdent'),
    testID: 'editor-format-outdent',
  },
  {
    action: 'quote',
    icon: (color) => <Quotes color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.quote'),
    testID: 'editor-format-quote',
  },
  {
    action: 'divider',
    icon: (color) => <Minus color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.divider'),
    testID: 'editor-format-divider',
  },
  {
    action: 'codeBlock',
    icon: (color) => <CodeBlock color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.codeBlock'),
    testID: 'editor-format-code-block',
  },
  {
    action: 'mathBlock',
    icon: (color) => <Pi color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.mathBlock'),
    testID: 'editor-format-math-block',
  },
  {
    action: 'mermaid',
    icon: (color) => <FlowArrow color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.mermaid'),
    testID: 'editor-format-mermaid',
  },
  {
    action: 'whiteboard',
    icon: (color) => <ScribbleLoop color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.whiteboard'),
    testID: 'editor-format-whiteboard',
  },
  {
    action: 'table',
    icon: (color) => <Table color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.formatting.table'),
    testID: 'editor-format-table',
  },
  {
    action: 'tableAddRowAfter',
    icon: (color) => <RowsPlusBottom color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.table.addRow'),
    testID: 'editor-format-table-add-row-after',
  },
  {
    action: 'tableAddColumnAfter',
    icon: (color) => <ColumnsPlusRight color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.table.addColumn'),
    testID: 'editor-format-table-add-column-after',
  },
  {
    action: 'tableDeleteRow',
    icon: (color) => <Rows color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.table.removeRow'),
    testID: 'editor-format-table-delete-row',
  },
  {
    action: 'tableDeleteColumn',
    icon: (color) => <Columns color={color} size={desktopToolbarActionParity.iconSize} />,
    label: mobileText('editor.table.removeColumn'),
    testID: 'editor-format-table-delete-column',
  },
]
