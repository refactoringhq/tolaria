import { useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { isUntitledPath, pathStem, slugifyPathStem } from '../hooks/editorTabContent'
import { requestEditorFocus } from '../hooks/useEditorFocus'
import type { VaultEntry } from '../types'
import { isActiveElementInsideEditorSurface } from '../utils/appOrchestration'
import { extractH1TitleFromContent } from '../utils/noteTitle'
import { noteDisplaysAsSheet } from '../utils/noteFormat'
import {
  applyPendingRawExitContent,
  type PendingRawExitContent,
} from './editorRawModeSync'

type SheetTransitionTab = {
  entry: VaultEntry
  content: string
}

interface RichEditorSheetSwapParams<Tab extends SheetTransitionTab> {
  activeTab: Tab | null
  activeTabPath: string | null
  tabs: Tab[]
  pendingRawExitContent: PendingRawExitContent | null
}

interface RichEditorReadinessParams<Tab extends SheetTransitionTab> {
  activeTab: Tab | null
  activeTabIsSheet: boolean
  editorContentPath: string | null
}

function isTitlePathTransition<Tab extends SheetTransitionTab>(
  activeTab: Tab | null,
  editorContentPath: string | null,
  editorOwnsFocus: boolean,
): boolean {
  if (!activeTab || !editorContentPath || activeTab.entry.path === editorContentPath) return false
  if (!editorOwnsFocus && !isUntitledPath(editorContentPath)) return false

  const title = extractH1TitleFromContent(activeTab.content)
  return title !== null && slugifyPathStem(title) === pathStem(activeTab.entry.path)
}

function tabDisplaysAsSheet(tab: SheetTransitionTab | null): boolean {
  if (!tab) return false
  return noteDisplaysAsSheet({
    content: tab.content,
    display: tab.entry.display,
    fileKind: tab.entry.fileKind,
  })
}

function useEditorFocusOwnership() {
  const [editorOwnsFocus, setEditorOwnsFocus] = useState(false)
  useEffect(() => {
    const updateFocusOwnership = () => setEditorOwnsFocus(isActiveElementInsideEditorSurface())
    document.addEventListener('focusin', updateFocusOwnership, true)
    document.addEventListener('focusout', updateFocusOwnership, true)
    return () => {
      document.removeEventListener('focusin', updateFocusOwnership, true)
      document.removeEventListener('focusout', updateFocusOwnership, true)
    }
  }, [])
  return editorOwnsFocus
}

function useTitlePathTransitionFocus(
  activePath: string | null,
  preservesTitlePathTransition: boolean,
  editorOwnsFocus: boolean,
) {
  useLayoutEffect(() => {
    if (!preservesTitlePathTransition) return
    if (!editorOwnsFocus) return
    if (!activePath) return
    requestEditorFocus({ path: activePath })
  }, [activePath, editorOwnsFocus, preservesTitlePathTransition])
}

function richEditorContentIsReady(
  activePath: string | null,
  activeTabIsSheet: boolean,
  editorContentPath: string | null,
  preservesTitlePathTransition: boolean,
) {
  if (!activePath || activeTabIsSheet || editorContentPath === null) return true
  return preservesTitlePathTransition || editorContentPath === activePath
}

export function useRichEditorSheetSwapState<Tab extends SheetTransitionTab>({
  activeTab,
  activeTabPath,
  tabs,
  pendingRawExitContent,
}: RichEditorSheetSwapParams<Tab>) {
  const activeTabIsSheet = tabDisplaysAsSheet(activeTab)
  const richEditorActiveTabPath = activeTabIsSheet ? null : activeTabPath
  const tabsForEditorSwap = useMemo(
    () => activeTabIsSheet ? [] : applyPendingRawExitContent(tabs, pendingRawExitContent),
    [activeTabIsSheet, pendingRawExitContent, tabs],
  )

  return {
    activeTabIsSheet,
    richEditorActiveTabPath,
    tabsForEditorSwap,
  }
}

export function useRichEditorContentReadiness<Tab extends SheetTransitionTab>({
  activeTab,
  activeTabIsSheet,
  editorContentPath,
}: RichEditorReadinessParams<Tab>) {
  const editorOwnsFocus = useEditorFocusOwnership()
  const preservesTitlePathTransition = isTitlePathTransition(
    activeTab,
    editorContentPath,
    editorOwnsFocus,
  )
  const activePath = activeTab?.entry.path ?? null
  useTitlePathTransitionFocus(activePath, preservesTitlePathTransition, editorOwnsFocus)
  return richEditorContentIsReady(
    activePath,
    activeTabIsSheet,
    editorContentPath,
    preservesTitlePathTransition,
  )
}
