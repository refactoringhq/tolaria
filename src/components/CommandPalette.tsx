import { useState, useRef, useEffect, useMemo } from 'react'
import { cn } from '@/lib/utils'
import { fuzzyMatch } from '../utils/fuzzyMatch'
import type { CommandAction, CommandGroup } from '../hooks/useCommandRegistry'
import { groupSortKey } from '../hooks/useCommandRegistry'

interface CommandPaletteProps {
  open: boolean
  commands: CommandAction[]
  onClose: () => void
}

interface ScoredCommand {
  command: CommandAction
  score: number
}

function matchCommand(query: string, cmd: CommandAction): ScoredCommand | null {
  const labelResult = fuzzyMatch(query, cmd.label)
  if (labelResult.match) return { command: cmd, score: labelResult.score }

  for (const kw of cmd.keywords ?? []) {
    const kwResult = fuzzyMatch(query, kw)
    if (kwResult.match) return { command: cmd, score: kwResult.score - 1 }
  }

  const groupResult = fuzzyMatch(query, cmd.group)
  if (groupResult.match) return { command: cmd, score: groupResult.score - 2 }

  return null
}

function groupResults(commands: CommandAction[]): { group: CommandGroup; items: CommandAction[] }[] {
  const map = new Map<CommandGroup, CommandAction[]>()
  for (const cmd of commands) {
    const list = map.get(cmd.group)
    if (list) list.push(cmd)
    else map.set(cmd.group, [cmd])
  }
  return Array.from(map.entries())
    .sort((a, b) => groupSortKey(a[0]) - groupSortKey(b[0]))
    .map(([group, items]) => ({ group, items }))
}

export function CommandPalette({ open, commands, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('') // eslint-disable-line react-hooks/set-state-in-effect -- reset on open
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const enabledCommands = useMemo(
    () => commands.filter(c => c.enabled),
    [commands],
  )

  const filtered = useMemo(() => {
    if (!query.trim()) return enabledCommands
    return enabledCommands
      .map(cmd => matchCommand(query, cmd))
      .filter((r): r is ScoredCommand => r !== null)
      .sort((a, b) => b.score - a.score)
      .map(r => r.command)
  }, [enabledCommands, query])

  const groups = useMemo(() => groupResults(filtered), [filtered])
  const flatList = useMemo(() => groups.flatMap(g => g.items), [groups])

  useEffect(() => {
    setSelectedIndex(0) // eslint-disable-line react-hooks/set-state-in-effect -- reset on query change
  }, [query])

  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector('[data-selected="true"]') as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault(); onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault(); setSelectedIndex(i => Math.min(i + 1, flatList.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault(); setSelectedIndex(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = flatList[selectedIndex]
        if (cmd) { onClose(); cmd.execute() }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, flatList, selectedIndex, onClose])

  if (!open) return null

  let runningIndex = 0

  return (
    <div
      className="fixed inset-0 z-[1000] flex justify-center bg-[var(--shadow-dialog)] pt-[15vh]"
      onClick={onClose}
    >
      <div
        className="flex w-[520px] max-w-[90vw] max-h-[440px] flex-col self-start overflow-hidden rounded-xl border border-[var(--border-dialog)] bg-popover shadow-[0_8px_32px_var(--shadow-dialog)]"
        onClick={e => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="border-b border-border bg-transparent px-4 py-3 text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          type="text"
          placeholder="Type a command..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <div className="flex-1 overflow-y-auto py-1" ref={listRef}>
          {flatList.length === 0 ? (
            <div className="px-4 py-6 text-center text-[13px] text-muted-foreground">
              No matching commands
            </div>
          ) : (
            groups.map(({ group, items }) => {
              const startIndex = runningIndex
              runningIndex += items.length
              return (
                <div key={group}>
                  <div className="px-4 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </div>
                  {items.map((cmd, i) => {
                    const globalIdx = startIndex + i
                    return (
                      <CommandRow
                        key={cmd.id}
                        command={cmd}
                        selected={globalIdx === selectedIndex}
                        onHover={() => setSelectedIndex(globalIdx)}
                        onSelect={() => { onClose(); cmd.execute() }}
                      />
                    )
                  })}
                </div>
              )
            })
          )}
        </div>
        <div className="flex items-center gap-4 border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  )
}

interface CommandRowProps {
  command: CommandAction
  selected: boolean
  onHover: () => void
  onSelect: () => void
}

function CommandRow({ command, selected, onHover, onSelect }: CommandRowProps) {
  return (
    <div
      data-selected={selected}
      className={cn(
        'mx-1 flex cursor-pointer items-center justify-between rounded-md px-3 py-1.5 transition-colors',
        selected ? 'bg-accent' : 'hover:bg-secondary',
      )}
      onClick={onSelect}
      onMouseEnter={onHover}
    >
      <span className="text-sm text-foreground">{command.label}</span>
      {command.shortcut && (
        <span className="text-[11px] text-muted-foreground">{command.shortcut}</span>
      )}
    </div>
  )
}
