export type CommandGroup = 'Navigation' | 'Note' | 'Git' | 'View' | 'Settings'

export interface CommandAction {
  id: string
  label: string
  displayLabel?: string
  group: CommandGroup
  displayGroup?: string
  shortcut?: string
  keywords?: string[]
  enabled: boolean
  execute: () => void
}

const GROUP_ORDER: CommandGroup[] = ['Navigation', 'Note', 'Git', 'View', 'Settings']

export function groupSortKey(group: CommandGroup): number {
  return GROUP_ORDER.indexOf(group)
}

export function getCommandLabel(command: CommandAction): string {
  return command.displayLabel ?? command.label
}

export function getCommandGroupLabel(command: CommandAction): string {
  return command.displayGroup ?? command.group
}
