import appCommandManifest from '../../../../src/shared/appCommandManifest.json'

type DesktopCommandKey = keyof typeof appCommandManifest.commands

export type MobileDesktopCommandParityStatus =
  | 'gap'
  | 'implemented'
  | 'mobile-adapted'
  | 'out-of-scope'

export type MobileDesktopCommandParityEntry = {
  command: DesktopCommandKey
  desktopId: string
  evidence: string
  status: MobileDesktopCommandParityStatus
}

type MobileDesktopCommandParityDefinition = Omit<MobileDesktopCommandParityEntry, 'command' | 'desktopId'>

const parityDefinitions = {
  appSettings: outOfScope('installation app settings are outside the mobile editing foundation'),
  appCheckForUpdates: outOfScope('desktop updater chrome is outside the Expo editing foundation'),
  fileNewNote: implemented('create-note action sheet and reducer write plan'),
  fileNewType: implemented('create-Type action sheet and Type document write plan'),
  fileQuickOpen: implemented('mobile quick-open/search sheet'),
  fileSave: implemented('idle editor save, explicit native repository write plans, and persistence probes'),
  editUndo: implemented('workspace undo history action'),
  editRedo: implemented('workspace redo history action'),
  editFindInNote: implemented('mobile Find in Note sheet'),
  editReplaceInNote: implemented('mobile Replace in Note sheet'),
  editFindInVault: implemented('mobile quick-open/search sheet with vault-wide candidates'),
  editPastePlainText: implemented('source and native WYSIWYG paste-without-formatting toolbar and command palette action'),
  editToggleRawEditor: implemented('editor toolbar source/WYSIWYG toggle'),
  editToggleDiff: outOfScope('desktop diff chrome is not part of the mobile editing foundation'),
  viewEditorOnly: adapted('tablet swipe chrome and phone editor screen replace desktop panel modes'),
  viewEditorList: adapted('tablet swipe chrome and phone list/editor navigation replace desktop panel modes'),
  viewAll: adapted('tablet full chrome and phone drawer/navigation replace desktop panel modes'),
  viewToggleProperties: adapted('tablet properties swipe rail and phone properties screen'),
  viewToggleAiChat: outOfScope('AI is explicitly excluded from the mobile editing foundation'),
  viewToggleTableOfContents: implemented('mobile Table of Contents sheet'),
  viewToggleBacklinks: adapted('mobile properties reference groups expose backlinks and inverse refs'),
  viewCommandPalette: implemented('mobile command palette opener is registered as the shared desktop command ID over tablet and phone callbacks'),
  viewZoomIn: outOfScope('desktop window zoom is installation chrome, not vault editing logic'),
  viewZoomOut: outOfScope('desktop window zoom is installation chrome, not vault editing logic'),
  viewZoomReset: outOfScope('desktop window zoom is installation chrome, not vault editing logic'),
  viewGoBack: implemented('mobile workspace history restores the previous sidebar, note-list filter, and note selection'),
  viewGoForward: implemented('mobile workspace history restores the next sidebar, note-list filter, and note selection'),
  goAllNotes: implemented('primary All Notes sidebar selection'),
  goArchived: implemented('Archive sidebar selection and section sub-filters'),
  goChanges: outOfScope('Git changes are explicitly excluded from this mobile batch'),
  goInbox: implemented('Inbox sidebar selection and shared inbox predicate'),
  noteToggleOrganized: implemented('More-sheet organized toggle and reducer write plan'),
  noteToggleFavorite: implemented('toolbar/More-sheet favorite toggle and reducer write plan'),
  noteArchive: implemented('More-sheet archive/unarchive action and reducer write plan'),
  noteDelete: implemented('More-sheet and bulk delete actions with reducer write plans'),
  noteOpenInNewWindow: outOfScope('desktop multi-window behavior has no direct mobile equivalent'),
  noteExportPdf: implemented('More-sheet PDF export action through mobile export boundary'),
  noteRestoreDeleted: outOfScope('desktop deleted-note restoration is outside the current mobile editing foundation'),
  vaultOpen: implemented('native vault picker from the mobile status bar'),
  vaultRemove: outOfScope('desktop registered-vault management is outside the mobile editing foundation'),
  vaultRestoreGettingStarted: outOfScope('desktop onboarding reset is outside the mobile editing foundation'),
  vaultAddRemote: outOfScope('Git remote setup is explicitly excluded from this mobile batch'),
  vaultCommitPush: outOfScope('Git sync is explicitly excluded from this mobile batch'),
  vaultPull: outOfScope('Git sync is explicitly excluded from this mobile batch'),
  vaultResolveConflicts: outOfScope('Git conflict handling is explicitly excluded from this mobile batch'),
  vaultViewChanges: outOfScope('Git changes are explicitly excluded from this mobile batch'),
  vaultInstallMcp: outOfScope('desktop external AI/MCP setup is outside the mobile editing foundation'),
  vaultReload: implemented('mobile command palette reloads the active repository snapshot through the workspace controller'),
  vaultRepair: outOfScope('desktop vault repair tooling is outside the mobile editing foundation'),
} satisfies Record<DesktopCommandKey, MobileDesktopCommandParityDefinition>

export function mobileDesktopCommandParityEntries(): MobileDesktopCommandParityEntry[] {
  return desktopCommandKeys().map((command) => {
    const definition = parityDefinitions[command]
    return {
      command,
      desktopId: appCommandManifest.commands[command].id,
      evidence: definition.evidence,
      status: definition.status,
    }
  })
}

export function mobileDesktopCommandParityGaps(): MobileDesktopCommandParityEntry[] {
  return mobileDesktopCommandParityEntries().filter((entry) => entry.status === 'gap')
}

export function mobileDesktopCommandParityImplementedCount(): number {
  return mobileDesktopCommandParityEntries()
    .filter((entry) => entry.status === 'implemented' || entry.status === 'mobile-adapted')
    .length
}

function desktopCommandKeys(): DesktopCommandKey[] {
  return Object.keys(appCommandManifest.commands) as DesktopCommandKey[]
}

function implemented(evidence: string): MobileDesktopCommandParityDefinition {
  return { evidence, status: 'implemented' }
}

function adapted(evidence: string): MobileDesktopCommandParityDefinition {
  return { evidence, status: 'mobile-adapted' }
}

function outOfScope(evidence: string): MobileDesktopCommandParityDefinition {
  return { evidence, status: 'out-of-scope' }
}
