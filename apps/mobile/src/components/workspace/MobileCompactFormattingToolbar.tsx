import { Check, DotsThree, ListBullets, Plus, Table, TextH } from 'phosphor-react-native'
import { ScrollView, StyleSheet, View } from 'react-native'
import type { ReactNode } from 'react'
import { Button } from '../ui/button'
import { Text } from '../ui/text'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu'
import { mobileText } from '../../i18n/mobileText'
import { probeProps, type MobileLayoutProbe } from '../../qa/mobileLayoutProbe'
import { mobileColors, mobileSpace } from '../../ui/tokens'
import type { MobileMarkdownFormatAction } from '../../workspace/mobileMarkdownFormatting'
import { formattingCommands, type FormattingCommand } from './mobileFormattingCommands'
import { formattingToolbarGroups, formattingToolbarTouchSize, type FormattingToolbarGroup } from './mobileFormattingToolbarModel'

type Props = {
  actions: readonly MobileMarkdownFormatAction[]
  selected: MobileMarkdownFormatAction[]
  inTable: boolean
  onFormat: (action: MobileMarkdownFormatAction) => void
  layoutProbe?: MobileLayoutProbe
  metricId?: string
}

const menus = {
  headings: { icon: TextH, label: 'editor.formatting.headings' },
  lists: { icon: ListBullets, label: 'editor.formatting.lists' },
  insert: { icon: Plus, label: 'editor.formatting.insert' },
  more: { icon: DotsThree, label: 'editor.formatting.more' },
  table: { icon: Table, label: 'editor.formatting.table' },
} as const
const commands = new Map(formattingCommands.map((command) => [command.action, command]))

export function MobileCompactFormattingToolbar(props: Props) {
  const groups = formattingToolbarGroups(props.actions, props.inTable)
  return (
    <ScrollView
      horizontal
      accessibilityLabel={mobileText('editor.formatting.toolbar')}
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.viewport}
      testID="editor-formatting-toolbar"
      {...metricProps(props)}
    >
      {groups.primary.map((action) => (
        <View key={action} {...metricProps(props, `action.${action}`)} style={styles.action}>
          <PrimaryAction command={commands.get(action)!} selected={props.selected.includes(action)} onFormat={props.onFormat} />
        </View>
      ))}
      {(Object.keys(menus) as (Exclude<FormattingToolbarGroup, 'primary'>)[]).map((group) => (
        groups[group].length ? <FormattingMenu key={group} group={group} actions={groups[group]} toolbar={props} /> : null
      ))}
    </ScrollView>
  )
}

function PrimaryAction({ command, selected, onFormat }: { command: FormattingCommand; selected: boolean; onFormat: Props['onFormat'] }) {
  return (
    <Button accessibilityLabel={command.label} accessibilityState={{ selected }} variant="ghost" size="icon"
      style={[styles.action, selected && styles.selected]} testID={command.testID} onPress={() => onFormat(command.action)}>
      {command.icon(selected ? mobileColors.primary : mobileColors.textMuted)}
    </Button>
  )
}

function FormattingMenu({ group, actions, toolbar }: { group: keyof typeof menus; actions: MobileMarkdownFormatAction[]; toolbar: Props }) {
  const menu = menus[group]
  const selected = actions.some((action) => toolbar.selected.includes(action))
  const Icon = menu.icon
  return (
    <View {...metricProps(toolbar, `group.${group}`)} style={styles.action}>
      <DropdownMenu>
        <DropdownMenuTrigger accessibilityLabel={mobileText(menu.label)} style={[styles.action, selected && styles.selected]} testID={`editor-format-menu-${group}`}>
          <Icon size={18} color={selected ? mobileColors.primary : mobileColors.textMuted} />
        </DropdownMenuTrigger>
        <DropdownMenuContent testID={`editor-format-options-${group}`}>
          {actions.map((action) => <FormattingMenuItem key={action} command={commands.get(action)!} selected={toolbar.selected.includes(action)} onFormat={toolbar.onFormat} />)}
        </DropdownMenuContent>
      </DropdownMenu>
    </View>
  )
}

function FormattingMenuItem({ command, selected, onFormat }: { command: FormattingCommand; selected: boolean; onFormat: Props['onFormat'] }) {
  return (
    <DropdownMenuItem textValue={command.label} accessibilityLabel={command.label} accessibilityState={{ selected }} testID={command.testID} onPress={() => onFormat(command.action)}>
      <IconSlot>{command.icon(mobileColors.textMuted)}</IconSlot>
      <Text style={styles.label}>{command.label}</Text>
      <IconSlot>{selected ? <Check size={16} color={mobileColors.primary} /> : null}</IconSlot>
    </DropdownMenuItem>
  )
}

function IconSlot({ children }: { children: ReactNode }) {
  return <View style={styles.icon}>{children}</View>
}

function metricProps(props: Props, segment?: string) {
  if (!props.layoutProbe || !props.metricId) return {}
  return probeProps(props.layoutProbe, segment ? `${props.metricId}.${segment}` : props.metricId)
}

const styles = StyleSheet.create({
  viewport: { flexGrow: 0 },
  row: { flexDirection: 'row', gap: mobileSpace.xs, paddingBottom: mobileSpace.xs },
  action: { width: formattingToolbarTouchSize, height: formattingToolbarTouchSize, borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  selected: { backgroundColor: mobileColors.primarySoft },
  label: { color: mobileColors.text, fontSize: 13, flexShrink: 1, flexGrow: 1 },
  icon: { width: 16, height: 16, alignItems: 'center', justifyContent: 'center' },
})
