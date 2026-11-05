import type { MobileNote, MobileSidebarIcon, MobileTone, MobileViewFilterGroup, MobileWorkspaceSnapshot } from '../workspace/mobileWorkspaceModel'
import type { MobileWorkspaceEdit } from '../workspace/mobileWorkspaceEditing'
import { emitMobileHaptic } from '../ui/mobileHaptics'
import { canMoveMobileSavedView, evaluateMobileSavedView } from '../workspace/mobileSavedViews'
import { mobileListPropertySuggestions, mobileSortablePropertySuggestions } from '../workspace/mobileWorkspaceSuggestions'
import type { TabletReadOnlyForm } from './tabletWorkspaceTypes'
import { createTypedWorkspaceNote, createWorkspaceNote, createWorkspaceView } from './tabletWorkspaceCreateActions'
import { favoriteWorkspaceActions } from './tabletWorkspaceFavoriteActions'
import { folderWorkspaceActions } from './tabletWorkspaceFolderActions'
import { primaryNoteListWorkspaceActions } from './tabletWorkspacePrimaryNoteListActions'
import { createTypeDefinitionEdit } from './tabletWorkspaceTypeDefinitionSave'
import { viewDefinitionSaveEdit } from './tabletWorkspaceViewDefinitionSave'
import { deleteViewEdit } from './tabletWorkspaceSidebarEditActions'
import type { WorkspaceActionsContext, TabletWorkspaceNavigation, ApplyWorkspaceEdit } from './tabletWorkspaceController.types'
import { applyNonEmptyStringEdit, moveWorkspaceSidebarItem, workspaceNotes } from './tabletWorkspaceActionForms'
import { typeSectionWorkspaceActions } from './tabletWorkspaceTypeActions'

export function createWorkspaceActions(context: WorkspaceActionsContext) {
  const {
    applyEdit,
    closeAction,
    navigation,
    openAction,
    readOnlyForm,
    repositoryRequest,
    setOpenAction,
    updateReadOnlyForm,
    workspaceSnapshot,
  } = context
  return {
    onCreateNote: (titleOverride?: string) => {
      createWorkspaceNote({
      applyEdit,
      closeAction,
      selection: navigation.sidebarSelection,
      title: titleOverride ?? readOnlyForm.createTitle,
      typeDefinitions: workspaceSnapshot.typeDefinitions,
      })
      emitMobileHaptic('success')
    },
    onCreateNoteOfType: (typeName: string) => {
      createTypedWorkspaceNote({
        applyEdit,
        closeAction,
        typeDefinitions: workspaceSnapshot.typeDefinitions,
        typeName,
      })
      emitMobileHaptic('success')
    },
    onCreateTitleChange: (value: string) => updateReadOnlyForm('createTitle', value),
    onCreateView: () => createWorkspaceView({
      applyEdit,
      closeAction,
      displayProperties: readOnlyForm.viewDisplayProperties,
      filters: readOnlyForm.viewFilters,
      icon: readOnlyForm.viewIcon,
      name: readOnlyForm.viewName,
      sort: readOnlyForm.viewSort,
      tone: readOnlyForm.viewTone,
    }),
    onCreateType: () => applyNonEmptyStringEdit({
      applyEdit,
      closeAction,
      toEdit: createTypeDefinitionEdit,
      value: readOnlyForm.typeName,
    }),
    onTypeNameChange: (value: string) => updateReadOnlyForm('typeName', value),
    ...folderWorkspaceActions({
      applyEdit,
      closeAction,
      readOnlyForm,
      selectFolder: navigation.selectFolder,
      setOpenAction,
      updateReadOnlyForm,
      vaultRootUri: repositoryRequest?.vaultRootUri,
    }),
    ...favoriteWorkspaceActions({ applyEdit, readOnlyForm, workspaceSnapshot }),
    ...primaryNoteListWorkspaceActions({ applyEdit, closeAction, readOnlyForm, suggestionsEnabled: openAction === 'editPrimaryListProperties', updateReadOnlyForm, workspaceSnapshot }),
    ...savedViewWorkspaceActions({ applyEdit, closeAction, openAction, readOnlyForm, updateReadOnlyForm, workspaceSnapshot }),
    ...typeSectionWorkspaceActions({ applyEdit, closeAction, openAction, readOnlyForm, updateReadOnlyForm, workspaceSnapshot }),
  }
}

export function selectedViewCommandActions({
  applyEdit,
  navigation,
  workspaceSnapshot,
}: Pick<WorkspaceActionsContext, 'applyEdit' | 'navigation' | 'workspaceSnapshot'>) {
  const viewId = selectedViewId(navigation.sidebarSelection)
  const views = workspaceSnapshot.views ?? []

  return {
    canMoveSelectedViewDown: viewId ? canMoveMobileSavedView(views, viewId, 'down') : false,
    canMoveSelectedViewUp: viewId ? canMoveMobileSavedView(views, viewId, 'up') : false,
    onMoveSelectedViewDown: () => moveSelectedView({ applyEdit, direction: 'down', viewId }),
    onMoveSelectedViewUp: () => moveSelectedView({ applyEdit, direction: 'up', viewId }),
  }
}

export function savedViewWorkspaceActions({
  applyEdit,
  closeAction,
  openAction,
  readOnlyForm,
  updateReadOnlyForm,
  workspaceSnapshot,
}: Pick<WorkspaceActionsContext, 'applyEdit' | 'closeAction' | 'openAction' | 'readOnlyForm' | 'updateReadOnlyForm' | 'workspaceSnapshot'>) {
  const suggestionsEnabled = openAction === 'createView' || openAction === 'editView'
  const views = workspaceSavedViews(workspaceSnapshot)
  const editableNotes = suggestionsEnabled ? editableViewPropertyNotes(readOnlyForm, workspaceSnapshot) : []
  return {
    canMoveViewDown: canMoveMobileSavedView(views, readOnlyForm.editingViewId, 'down'),
    canMoveViewUp: canMoveMobileSavedView(views, readOnlyForm.editingViewId, 'up'),
    onDeleteView: () => deleteView({ applyEdit, closeAction, viewId: readOnlyForm.editingViewId }),
    onMoveViewDown: () => moveWorkspaceSidebarItem({ applyEdit, direction: 'down', itemId: readOnlyForm.editingViewId, kind: 'view' }),
    onMoveViewUp: () => moveWorkspaceSidebarItem({ applyEdit, direction: 'up', itemId: readOnlyForm.editingViewId, kind: 'view' }),
    onSaveView: () => saveViewDefinition({
      applyEdit,
      closeAction,
      form: readOnlyForm,
      viewId: readOnlyForm.editingViewId,
      views,
    }),
    onViewDisplayPropertiesChange: (value: string[]) => updateReadOnlyForm('viewDisplayProperties', value),
    onViewFiltersChange: (value: MobileViewFilterGroup) => updateReadOnlyForm('viewFilters', value),
    onViewIconChange: (value: MobileSidebarIcon) => updateReadOnlyForm('viewIcon', value),
    onViewNameChange: (value: string) => updateReadOnlyForm('viewName', value),
    onViewPropertyQueryChange: (value: string) => updateReadOnlyForm('viewPropertyQuery', value),
    onViewSortChange: (value: string) => updateReadOnlyForm('viewSort', value),
    onViewToneChange: (value: MobileTone) => updateReadOnlyForm('viewTone', value),
    viewPropertyOptions: suggestionsEnabled ? mobileListPropertySuggestions(
      editableNotes,
      readOnlyForm.viewPropertyQuery,
      workspaceSnapshot.typeDefinitions,
    ) : [],
    viewSortPropertyOptions: suggestionsEnabled ? mobileSortablePropertySuggestions(
      editableNotes,
      '',
      workspaceSnapshot.typeDefinitions,
    ) : [],
  }
}

function workspaceSavedViews(snapshot: MobileWorkspaceSnapshot) {
  return snapshot.views ?? []
}

export function selectedViewId(selection: TabletWorkspaceNavigation['sidebarSelection']): string | null {
  if (selection.kind !== 'item' || selection.sectionId !== 'views') return null
  return selection.viewId ?? selection.id
}

export function moveSelectedView({
  applyEdit,
  direction,
  viewId,
}: {
  applyEdit: ApplyWorkspaceEdit
  direction: 'down' | 'up'
  viewId: string | null
}) {
  if (!viewId) return
  moveWorkspaceSidebarItem({ applyEdit, direction, itemId: viewId, kind: 'view' })
}

export function saveViewDefinition({
  applyEdit,
  closeAction,
  form,
  viewId,
  views,
}: {
  applyEdit: (edit: MobileWorkspaceEdit) => void
  closeAction: () => void
  form: TabletReadOnlyForm
  viewId: string
  views: NonNullable<MobileWorkspaceSnapshot['views']>
}) {
  const edit = viewDefinitionSaveEdit(form, viewId, views)
  if (!edit) return

  applyEdit(edit)
  closeAction()
}

export function editableViewPropertyNotes(
  form: TabletReadOnlyForm,
  snapshot: MobileWorkspaceSnapshot,
): MobileNote[] {
  const view = (snapshot.views ?? []).find((candidate) => candidate.id === form.editingViewId)
  if (!view) return workspaceNotes(snapshot)

  return evaluateMobileSavedView({
    ...view,
    definition: { ...view.definition, filters: form.viewFilters },
  }, workspaceNotes(snapshot))
}

export function deleteView({
  applyEdit,
  closeAction,
  viewId,
}: {
  applyEdit: (edit: MobileWorkspaceEdit) => void
  closeAction: () => void
  viewId: string
}) {
  applyNonEmptyStringEdit({
    applyEdit,
    closeAction,
    toEdit: deleteViewEdit,
    value: viewId,
  })
}
