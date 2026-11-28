import { vaultPathForEntry } from '../utils/workspaces'
import { useLayoutPanels } from './useLayoutPanels'
import { useMacosTrafficLights } from './useMacosTrafficLights'
import { useNoteListPdfExport } from './useNoteListPdfExport'
import { useNoteWidthMode } from './useNoteWidthMode'
import { useStartupScreenState } from './useStartupScreenState'
import { useStartupStateMilestones } from './useStartupStateMilestones'

export function useAppWorkspaceLayout(secondaryWindow: boolean, desktopSidebar: boolean) {
  const layout = useLayoutPanels(secondaryWindow ? { initialInspectorCollapsed: true } : undefined)
  return { layout, showPrimaryDesktopChrome: desktopSidebar && !secondaryWindow }
}

export function useAppActiveEditor(
  widthOptions: Parameters<typeof useNoteWidthMode>[0],
  pdfOptions: Omit<Parameters<typeof useNoteListPdfExport>[0], 'activeEntry'>,
) {
  const width = useNoteWidthMode(widthOptions)
  const { activeTab } = width
  const activeTabEntry = activeTab?.entry ?? null
  const activeTabContent = activeTab?.content ?? null
  const activeEditorVaultPath = activeTabEntry
    ? vaultPathForEntry(activeTabEntry, widthOptions.vaultPath)
    : widthOptions.vaultPath
  const handleExportNotePdfFromList = useNoteListPdfExport({ ...pdfOptions, activeEntry: activeTabEntry })
  return { ...width, activeTabEntry, activeTabContent, activeEditorVaultPath, handleExportNotePdfFromList }
}

export function useAppWorkspaceStartupState(
  startup: Parameters<typeof useStartupScreenState>[0],
  trafficLights: Omit<Parameters<typeof useMacosTrafficLights>[0], 'ready'>,
) {
  const state = useStartupScreenState(startup)
  const { isVaultContentLoading, shouldShowStartupScreen } = state
  useMacosTrafficLights({ ...trafficLights, ready: !isVaultContentLoading && !shouldShowStartupScreen })
  useStartupStateMilestones({
    isVaultContentLoading,
    onboardingStatus: startup.onboardingState.status,
    settingsLoaded: startup.settingsLoaded,
    vaultListLoaded: startup.vaultSwitcher.loaded,
  })
  return state
}
