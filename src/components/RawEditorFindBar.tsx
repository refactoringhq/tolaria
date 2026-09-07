import { CaretDown as ChevronDown, CaretRight as ChevronRight, CaretUp as ChevronUp, X } from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EditorView } from '@codemirror/view'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { translate, type AppLocale } from '../lib/i18n'
import type { FindControlsProps, ReplaceControlsProps } from './rawEditorFindControlTypes'
import type { ActiveEditorFindMatchSelection, RawEditorFindBarProps, RawEditorFindController, RawEditorFindRequest } from './rawEditorFindTypes'
import {
  buildEditorFindReplacementChange,
  buildEditorFindReplacementChanges,
  clampEditorFindIndex,
  findEditorMatches,
  nextEditorFindIndex,
  type EditorFindMatch,
  type EditorFindOptions,
} from '../utils/editorFind'

export type { RawEditorFindRequest } from './rawEditorFindTypes'

function selectMatch(view: EditorView, match: EditorFindMatch, focusEditor: boolean): void {
  view.dispatch({
    selection: { anchor: match.from, head: match.to },
    effects: EditorView.scrollIntoView(match.from, { y: 'center' }),
  })
  if (focusEditor) view.focus()
}

function matchStatusText(locale: AppLocale, error: string | null, activeIndex: number, matchCount: number): string {
  if (error === 'Invalid regex') return translate(locale, 'editor.find.invalidRegex')
  if (error) return translate(locale, 'editor.find.regexMustMatchText')
  if (matchCount === 0) return translate(locale, 'editor.find.noMatches')
  return translate(locale, 'editor.find.matchCount', {
    current: clampEditorFindIndex(activeIndex, matchCount) + 1,
    total: matchCount,
  })
}

function useRequestFocus({
  inputRef,
  onReplaceOpenChange,
  open,
  path,
  request,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>
  onReplaceOpenChange: (open: boolean) => void
  open: boolean
  path: string
  request?: RawEditorFindRequest | null
}) {
  useEffect(() => {
    if (!open || !request || request.path !== path) return
    if (request.replace) onReplaceOpenChange(true)

    const frameId = requestAnimationFrame(() => {
      inputRef.current?.focus()
      inputRef.current?.select()
    })
    return () => cancelAnimationFrame(frameId)
  }, [inputRef, onReplaceOpenChange, open, path, request])
}

function closeRawEditorFind(onClose: () => void, viewRef: React.MutableRefObject<EditorView | null>): void {
  onClose()
  requestAnimationFrame(() => viewRef.current?.focus())
}

function handleRawEditorFindKeyDown(
  event: React.KeyboardEvent<HTMLInputElement>,
  close: () => void,
  moveMatch: (direction: 1 | -1) => void,
): void {
  if (event.key === 'Escape') {
    event.preventDefault()
    close()
    return
  }
  if (event.key !== 'Enter') return

  event.preventDefault()
  moveMatch(event.shiftKey ? -1 : 1)
}

function useRequestedEditorFindMatchSelection(
  selection: ActiveEditorFindMatchSelection & { requestId: number },
): void {
  const { activeMatch, open, requestId, viewRef } = selection
  const handledRequestRef = useRef<number | null>(null)

  useEffect(() => {
    if (!open) {
      handledRequestRef.current = null
      return
    }
    if (handledRequestRef.current === requestId) return

    handledRequestRef.current = requestId
    const view = viewRef.current
    if (!view || !activeMatch) return
    selectMatch(view, activeMatch, false)
  }, [activeMatch, open, requestId, viewRef])
}

function replaceCurrentEditorFindMatch({
  activeMatch,
  options,
  query,
  replacement,
  viewRef,
}: {
  activeMatch?: EditorFindMatch
  options: EditorFindOptions
  query: string
  replacement: string
  viewRef: React.MutableRefObject<EditorView | null>
}): void {
  const view = viewRef.current
  if (!view || !activeMatch) return

  const change = buildEditorFindReplacementChange(activeMatch, query, replacement, options)
  view.dispatch({
    changes: change,
    selection: {
      anchor: change.from,
      head: change.from + change.insert.length,
    },
    effects: EditorView.scrollIntoView(change.from, { y: 'center' }),
  })
  view.focus()
}

function replaceAllEditorFindMatches({
  matches,
  options,
  query,
  replacement,
  viewRef,
}: {
  matches: readonly EditorFindMatch[]
  options: EditorFindOptions
  query: string
  replacement: string
  viewRef: React.MutableRefObject<EditorView | null>
}): boolean {
  const view = viewRef.current
  if (!view || matches.length === 0) return false

  const changes = buildEditorFindReplacementChanges(matches, query, replacement, options)
  view.dispatch({ changes })
  view.focus()
  return true
}

function useEditorFindNavigation(
  matchCount: number,
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>,
  requestSelection: () => void,
): { moveMatch: (direction: 1 | -1) => void; moveNext: () => void; movePrevious: () => void } {
  const moveMatch = useCallback((direction: 1 | -1) => {
    setActiveIndex((current) => nextEditorFindIndex(current, matchCount, direction))
    requestSelection()
  }, [matchCount, requestSelection, setActiveIndex])
  const movePrevious = useCallback(() => moveMatch(-1), [moveMatch])
  const moveNext = useCallback(() => moveMatch(1), [moveMatch])
  return { moveMatch, moveNext, movePrevious }
}

function useEditorFindOptionToggle(
  setOption: React.Dispatch<React.SetStateAction<boolean>>,
  requestSelection: () => void,
): () => void {
  return useCallback(() => {
    setOption((value) => !value)
    requestSelection()
  }, [requestSelection, setOption])
}

function useEditorFindState({
  activeIndex,
  doc,
  locale,
  options,
  query,
}: {
  activeIndex: number
  doc: string
  locale: AppLocale
  options: EditorFindOptions
  query: string
}) {
  const result = useMemo(() => findEditorMatches(doc, query, options), [doc, options, query])
  const currentIndex = clampEditorFindIndex(activeIndex, result.matches.length)
  return {
    activeMatch: result.matches.at(currentIndex),
    hasMatches: result.matches.length > 0 && !result.error,
    matches: result.matches,
    status: matchStatusText(locale, result.error, currentIndex, result.matches.length),
  }
}

function useRawEditorFindController(
  functionOptions: Omit<RawEditorFindBarProps, 'replaceOpen'>,
): RawEditorFindController {
  const { doc, locale = 'en', onClose, onReplaceOpenChange, open, path, request, viewRef } = functionOptions
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [replacement, setReplacement] = useState('')
  const [regex, setRegex] = useState(false)
  const [caseSensitive, setCaseSensitive] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [selectionRequestId, setSelectionRequestId] = useState(0)
  const options = useMemo<EditorFindOptions>(() => ({ caseSensitive, regex }), [caseSensitive, regex])
  const { activeMatch, hasMatches, matches, status } = useEditorFindState({ activeIndex, doc, locale, options, query })

  useRequestFocus({ inputRef, onReplaceOpenChange, open, path, request })

  useRequestedEditorFindMatchSelection({ activeMatch, open, requestId: selectionRequestId, viewRef })

  const requestSelection = useCallback(() => setSelectionRequestId((current) => current + 1), [])
  const { moveMatch, moveNext, movePrevious } = useEditorFindNavigation(matches.length, setActiveIndex, requestSelection)
  const handleFindChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(event.target.value)
    setActiveIndex(0)
    requestSelection()
  }, [requestSelection])

  const close = useCallback(() => closeRawEditorFind(onClose, viewRef), [onClose, viewRef])

  const handleFindKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      handleRawEditorFindKeyDown(event, close, moveMatch)
    },
    [close, moveMatch],
  )

  const replaceCurrent = useCallback(() => {
    replaceCurrentEditorFindMatch({
      activeMatch,
      options,
      query,
      replacement,
      viewRef,
    })
  }, [activeMatch, options, query, replacement, viewRef])

  const replaceAll = useCallback(() => {
    if (
      replaceAllEditorFindMatches({
      matches,
      options,
      query,
      replacement,
      viewRef,
      })
    ) {
      setActiveIndex(0)
    }
  }, [matches, options, query, replacement, viewRef])
  const toggleCaseSensitive = useEditorFindOptionToggle(setCaseSensitive, requestSelection)
  const toggleRegex = useEditorFindOptionToggle(setRegex, requestSelection)

  return {
    caseSensitive,
    close,
    findInputRef: inputRef,
    handleFindChange,
    handleFindKeyDown,
    hasMatches,
    moveNext,
    movePrevious,
    query,
    regex,
    replaceAll,
    replaceCurrent,
    replacement,
    setReplacement,
    status,
    toggleCaseSensitive,
    toggleRegex,
  }
}

function FindNavigationControls({
  hasMatches,
  locale,
  moveNext,
  movePrevious,
}: Pick<FindControlsProps, 'hasMatches' | 'locale' | 'moveNext' | 'movePrevious'>) {
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={translate(locale, 'editor.find.previousMatch')}
        title={translate(locale, 'editor.find.previousMatch')}
        disabled={!hasMatches}
        onClick={movePrevious}
      >
        <ChevronUp />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={translate(locale, 'editor.find.nextMatch')}
        title={translate(locale, 'editor.find.nextMatch')}
        disabled={!hasMatches}
        onClick={moveNext}
      >
        <ChevronDown />
      </Button>
    </>
  )
}

function FindModeControls({
  caseSensitive,
  close,
  locale,
  regex,
  toggleCaseSensitive,
  toggleRegex,
}: Pick<FindControlsProps, 'caseSensitive' | 'close' | 'locale' | 'regex' | 'toggleCaseSensitive' | 'toggleRegex'>) {
  return (
    <>
      <Button
        type="button"
        variant={regex ? 'secondary' : 'ghost'}
        size="xs"
        aria-label={translate(locale, 'editor.find.regex')}
        aria-pressed={regex}
        title={translate(locale, 'editor.find.regex')}
        onClick={toggleRegex}
      >
        .*
      </Button>
      <Button
        type="button"
        variant={caseSensitive ? 'secondary' : 'ghost'}
        size="xs"
        aria-label={translate(locale, 'editor.find.matchCase')}
        aria-pressed={caseSensitive}
        title={translate(locale, 'editor.find.matchCase')}
        onClick={toggleCaseSensitive}
      >
        Aa
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={translate(locale, 'editor.find.close')}
        title={translate(locale, 'editor.find.close')}
        onClick={close}
      >
        <X />
      </Button>
    </>
  )
}

function FindControls(options: FindControlsProps) {
  const { findInputRef, handleFindChange, handleFindKeyDown, locale, onReplaceOpenChange, query, replaceOpen, status } = options
  return (
    <div className="flex min-w-0 items-center gap-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        aria-label={
          replaceOpen ? translate(locale, 'editor.find.hideReplace') : translate(locale, 'editor.find.showReplace')
        }
        title={
          replaceOpen ? translate(locale, 'editor.find.hideReplace') : translate(locale, 'editor.find.showReplace')
        }
        onClick={() => onReplaceOpenChange(!replaceOpen)}
      >
        <ChevronRight className={cn('transition-transform', replaceOpen && 'rotate-90')} />
      </Button>
      <Input
        ref={findInputRef}
        type="search"
        aria-label={translate(locale, 'editor.find.findLabel')}
        placeholder={translate(locale, 'editor.find.findPlaceholder')}
        value={query}
        onChange={handleFindChange}
        onKeyDown={handleFindKeyDown}
        className="h-7 min-w-[12rem] flex-1 rounded px-2 text-xs"
        data-testid="raw-editor-find-input"
      />
      <span
        className="min-w-[4.75rem] text-right text-xs text-muted-foreground"
        aria-live="polite"
        data-testid="raw-editor-find-count"
      >
        {status}
      </span>
      <FindNavigationControls {...options} />
      <FindModeControls {...options} />
    </div>
  )
}

function ReplaceControls({
  hasMatches,
  locale,
  replaceAll,
  replaceCurrent,
  replacement,
  setReplacement,
}: ReplaceControlsProps) {
  return (
    <div className="ml-[1.875rem] flex min-w-0 items-center gap-1.5">
      <Input
        type="text"
        aria-label={translate(locale, 'editor.find.replaceLabel')}
        placeholder={translate(locale, 'editor.find.replacePlaceholder')}
        value={replacement}
        onChange={(event) => setReplacement(event.target.value)}
        className="h-7 min-w-[12rem] flex-1 rounded px-2 text-xs"
        data-testid="raw-editor-replace-input"
      />
      <Button type="button" variant="outline" size="xs" disabled={!hasMatches} onClick={replaceCurrent}>
        {translate(locale, 'editor.find.replace')}
      </Button>
      <Button type="button" variant="outline" size="xs" disabled={!hasMatches} onClick={replaceAll}>
        {translate(locale, 'editor.find.replaceAll')}
      </Button>
    </div>
  )
}

function RawEditorFindBarContent({
  controller,
  locale,
  onReplaceOpenChange,
  replaceOpen,
}: {
  controller: RawEditorFindController
  locale: AppLocale
  onReplaceOpenChange: (open: boolean) => void
  replaceOpen: boolean
}) {
  return (
    <>
      <FindControls
        {...controller}
        locale={locale}
        onReplaceOpenChange={onReplaceOpenChange}
        replaceOpen={replaceOpen}
      />
      {replaceOpen && <ReplaceControls {...controller} locale={locale} />}
    </>
  )
}

export function RawEditorFindBar(props: RawEditorFindBarProps) {
  const { locale = 'en', onReplaceOpenChange, open, replaceOpen } = props
  const barRef = useRef<HTMLDivElement>(null)
  const controller = useRawEditorFindController(props)
  const { close } = controller

  useEffect(() => {
    if (!open) return
    const bar = barRef.current
    if (!bar) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close()
    }

    bar.addEventListener('keydown', handleKeyDown)
    return () => bar.removeEventListener('keydown', handleKeyDown)
  }, [close, open])

  if (!open) return null

  return (
    <div
      ref={barRef}
      className="flex shrink-0 flex-col gap-1.5 border-b px-3 py-2"
      data-testid="raw-editor-find-bar"
      style={{
        background: 'var(--surface-editor)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <RawEditorFindBarContent
        controller={controller}
        locale={locale}
        onReplaceOpenChange={onReplaceOpenChange}
        replaceOpen={replaceOpen}
      />
    </div>
  )
}
