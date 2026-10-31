import { ArrowSquareOut, CheckCircle, ClipboardText, FilePlus, FolderOpen, Trash } from 'phosphor-react-native'
import { type ReactNode, useEffect } from 'react'
import { Keyboard, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native'
import { mobileText } from '../../i18n/mobileText'
import { desktopToolbarActionParity } from '../../ui/desktopParity'
import { MobileButton } from '../../ui/MobileButton'
import { MobileKeyboardAvoidingView } from '../../ui/MobileKeyboardAvoidingView'
import { MobilePanel, MobileToolbar, MobileToolbarSpacer, MobileToolbarTitle } from '../../ui/MobilePanel'
import { MobileTextInput } from '../../ui/MobileTextInput'
import { useMobileStyles } from '../../ui/theme/useMobileTheme'
import { useMobileDeviceLayout } from '../../ui/useMobileDeviceLayout'
import { useMobileModalDismiss } from '../../workspace/useMobileModalDismiss'
import { showNativeConfirmation } from '../ui/mobileNativeDialogs'
import { Text } from '../ui/text'
import { MobileEditorFindSheet } from './MobileEditorFindSheet'
import { MobileQuickOpenSheet } from './MobileQuickOpenSheet'
import { MobileTableOfContentsSheet } from './MobileTableOfContentsSheet'
import { MobileTypeSectionEditor } from './MobileTypeSectionEditor'
import { MobileTypeVisibilityEditor } from './MobileTypeVisibilityEditor'
import { MobileViewDisplayPropertiesPicker } from './MobileViewDisplayPropertiesPicker'
import type { ActionContentProps, MobileWorkspaceAction, MobileWorkspaceActionSheetProps } from './MobileWorkspaceActionSheet.types'
import { mobileActionSheetLongFormHeight, mobileActionSheetUsesCompactForm, mobileWorkspaceFormSheetAutoFocus } from './MobileWorkspaceActionSheetModel'
import { showNativeFolderRenamePrompt } from './MobileWorkspaceFolderPrompt'
import { MoreActionsContent } from './MobileWorkspaceMoreActionsContent'
import { MobileFavoriteActions, MobileTypeSectionActions } from './MobileWorkspaceMoveActions'
import { NativeSingleFieldPrompt } from './MobileWorkspaceNativePrompt'
import { AddPropertyContent, AddRelationshipContent } from './MobileWorkspacePropertyForms'
import { ActionRow, SheetFooter } from './MobileWorkspaceSheetChrome'
import { RetargetNoteContent, ViewFormContent, WorkspaceSingleTextFieldContent } from './MobileWorkspaceTextFieldForms'
import { createMobileWorkspaceSheetStyles as createThemeStyles } from './mobileWorkspaceActionSheetStyles'
import { actionTitle, phoneSheetStyles } from './mobileWorkspaceSheetPresentation'

export function MobileWorkspaceActionSheet(props: MobileWorkspaceActionSheetProps) {
  useMobileModalDismiss(props.onClose)
  const { styles, sheetStyles } = useMobileStyles(createThemeStyles)
  const phone = useMobileDeviceLayout() === 'phone'
  useEffect(() => {
    if (props.action !== 'search') Keyboard.dismiss()
  }, [props.action])
  const { height: windowHeight, width: windowWidth } = useWindowDimensions()
  const compactForm = mobileActionSheetUsesCompactForm({
    action: props.action, phone, width: windowWidth, height: windowHeight,
  })
  const longFormSheetHeight = mobileActionSheetLongFormHeight(windowHeight)
  const longFormSheetStyle = usesLongFormSheet(props.action) || compactForm
    ? { height: longFormSheetHeight, maxHeight: longFormSheetHeight }
    : null

  if (Platform.OS === 'ios' && isNativePromptAction(props.action)) return <NativeSingleFieldPrompt {...props} compactForm={compactForm} />

  return (
    <MobileKeyboardAvoidingView style={styles.overlay} testID="workspace-action-sheet">
      <Pressable accessibilityLabel={mobileText('common.cancel')} style={styles.backdrop} testID="workspace-action-sheet-backdrop" onPress={props.onClose} />
      <View style={[styles.sheetContainer, phone && phoneSheetStyles.container]} pointerEvents="box-none">
        <MobilePanel
          accessibilityViewIsModal
          style={[sheetStyles.sheet, longFormSheetStyle, phone && phoneSheetStyles.sheet]}
          testID={`workspace-action-sheet-${props.action}`}
        >
          <WorkspaceSheetHeader {...props} compactForm={compactForm} />
          <ActionContent {...props} compactForm={compactForm} />
        </MobilePanel>
      </View>
    </MobileKeyboardAvoidingView>
  )
}

function WorkspaceSheetHeader(props: ActionContentProps) {
  if (props.compactForm) return null
  return (
    <MobileToolbar testID="workspace-action-sheet-toolbar">
      <MobileToolbarTitle title={actionTitle(props.action, props.propertyName)} />
      <MobileToolbarSpacer />
      <MobileButton label={mobileText('common.cancel')} variant="ghost" onPress={props.onClose} />
    </MobileToolbar>
  )
}

function ActionContent(props: ActionContentProps) {
  const Content = Object.hasOwn(actionContentByAction, props.action) ? actionContentByAction[props.action] : null
  return Content ? <Content {...props} /> : null
}

function isNativePromptAction(action: MobileWorkspaceAction) {
  return action === 'createFolder' || action === 'createType' || action === 'renameNoteFile'
}

function usesLongFormSheet(action: MobileWorkspaceAction) {
  return action === 'createView'
    || action === 'editView'
    || action === 'editTypeSection'
    || action === 'editPrimaryListProperties'
}

const actionContentByAction: Record<MobileWorkspaceAction, (props: ActionContentProps) => ReactNode> = {
  addProperty: (props) => <AddPropertyContent {...props} />,
  addRelationship: (props) => <AddRelationshipContent {...props} />,
  changeNoteType: (props) => <RetargetNoteContent {...props} retargetAction="changeType" />,
  createFolder: (props) => <WorkspaceSingleTextFieldContent {...props} />,
  createType: (props) => <WorkspaceSingleTextFieldContent {...props} />,
  createView: (props) => <ViewFormContent {...props} />,
  editFolder: (props) => <FolderActionsContent {...props} />,
  editFavorite: (props) => <FavoriteActionsContent {...props} />,
  editProperty: (props) => <AddPropertyContent {...props} />,
  editPrimaryListProperties: (props) => <PrimaryListPropertiesContent {...props} />,
  editTypeSection: (props) => <TypeSectionContent {...props} />,
  editTypeVisibility: (props) => <MobileTypeVisibilityEditor typeDefinitions={props.typeDefinitions} onToggleTypeVisibility={props.onToggleTypeVisibility} />,
  editView: (props) => <ViewFormContent {...props} />,
  findInNote: (props) => <MobileEditorFindSheet editorBlocks={props.editorBlocks} editorBullets={props.editorBullets} note={props.selectedNote} replace={false} onClose={props.onClose} onUpdateContent={props.onUpdateNoteContent} />,
  moreActions: (props) => <MoreActionsContent {...props} />,
  moveNoteToFolder: (props) => <RetargetNoteContent {...props} retargetAction="moveFolder" />,
  renameNoteFile: (props) => <WorkspaceSingleTextFieldContent {...props} />,
  replaceInNote: (props) => <MobileEditorFindSheet editorBlocks={props.editorBlocks} editorBullets={props.editorBullets} note={props.selectedNote} replace onClose={props.onClose} onUpdateContent={props.onUpdateNoteContent} />,
  search: (props) => <SearchContent {...props} />,
  setNoteIcon: (props) => <WorkspaceSingleTextFieldContent {...props} />,
  tableOfContents: (props) => (
    <MobileTableOfContentsSheet
      blocks={props.editorBlocks}
      bullets={props.editorBullets}
      note={props.selectedNote}
      onClose={props.onClose}
      onSelectTarget={props.onSelectTableOfContentsTarget}
    />
  ),
}

function SearchContent(props: MobileWorkspaceActionSheetProps) {
  return (
    <MobileQuickOpenSheet
      notes={props.notes}
      typeDefinitions={props.typeDefinitions}
      onClearWorkspaceSearch={() => props.onSearchQueryChange('')}
      onClose={props.onClose}
      onCreateNote={props.onCreateNote}
      onSelectNote={props.onSelectNote}
    />
  )
}

function FolderActionsContent(props: MobileWorkspaceActionSheetProps) {
  const { styles, mobileColors } = useMobileStyles(createThemeStyles)
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.scrollArea}>
      {Platform.OS === 'ios' ? <ActionRow
        icon={<FolderOpen color={mobileColors.textMuted} size={desktopToolbarActionParity.iconSize} />}
        label={mobileText('sidebar.action.renameFolder')}
        testID="workspace-rename-folder-prompt"
        onPress={() => showNativeFolderRenamePrompt(props)}
      /> : <MobileTextInput
        autoFocus={mobileWorkspaceFormSheetAutoFocus}
        label={mobileText('sidebar.folder.newName')}
        placeholder={mobileText('sidebar.folder.newName')}
        testID="workspace-rename-folder-input"
        value={props.folderName}
        onChangeText={props.onFolderNameChange}
      />}
      <ActionRow
        icon={<FilePlus color={mobileColors.textMuted} size={desktopToolbarActionParity.iconSize} />}
        label={mobileText('sidebar.action.createNodeInFolderMenu')}
        testID="workspace-action-create-note-in-folder"
        onPress={props.onOpenCreateNoteInFolder}
      />
      <ActionRow
        icon={<FolderOpen color={mobileColors.textMuted} size={desktopToolbarActionParity.iconSize} />}
        label={mobileText('sidebar.action.createFolder')}
        testID="workspace-action-create-child-folder"
        onPress={props.onOpenCreateChildFolder}
      />
      <ActionRow
        icon={<ClipboardText color={mobileColors.textMuted} size={desktopToolbarActionParity.iconSize} />}
        label={mobileText('sidebar.action.copyFolderPathMenu')}
        testID="workspace-action-copy-folder-path"
        onPress={props.onCopyFolderPath}
      />
      <ActionRow
        icon={<ArrowSquareOut color={mobileColors.textMuted} size={desktopToolbarActionParity.iconSize} />}
        label={mobileText('sidebar.action.revealFolderMenu')}
        testID="workspace-action-reveal-folder"
        onPress={props.onRevealFolder}
      />
      <ActionRow
        destructive
        icon={<Trash color={mobileColors.red} size={desktopToolbarActionParity.iconSize} />}
        label={mobileText('sidebar.action.deleteFolder')}
        testID="workspace-action-delete-folder"
        onPress={() => showNativeConfirmation({
          cancelLabel: mobileText('common.cancel'),
          confirmLabel: mobileText('sidebar.action.deleteFolder'),
          message: props.folderPath,
          onConfirm: props.onDeleteFolder,
          title: mobileText('sidebar.action.deleteFolder'),
        })}
      />
      <SheetFooter>
        <MobileButton label={mobileText('common.cancel')} variant="ghost" onPress={props.onClose} />
        <MobileButton disabled={props.folderName.trim().length === 0} label={mobileText('common.save')} variant="primary" onPress={props.onRenameFolder} />
      </SheetFooter>
    </ScrollView>
  )
}

function FavoriteActionsContent(props: MobileWorkspaceActionSheetProps) {
  const { styles } = useMobileStyles(createThemeStyles)
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.scrollArea}>
      <MobileFavoriteActions
        canMoveDown={props.canMoveFavoriteDown}
        canMoveUp={props.canMoveFavoriteUp}
        onMoveDown={props.onMoveFavoriteDown}
        onMoveUp={props.onMoveFavoriteUp}
      />
      <SheetFooter>
        <MobileButton label={mobileText('common.cancel')} variant="ghost" onPress={props.onClose} />
      </SheetFooter>
    </ScrollView>
  )
}

function TypeSectionContent(props: MobileWorkspaceActionSheetProps) {
  const { styles } = useMobileStyles(createThemeStyles)
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.scrollArea}>
      <MobileTypeSectionActions
        canDelete={props.canDeleteType}
        canMoveDown={props.canMoveTypeDown}
        canMoveUp={props.canMoveTypeUp}
        onDelete={props.onDeleteType}
        onMoveDown={props.onMoveTypeDown}
        onMoveUp={props.onMoveTypeUp}
      />
      <TypeSectionEditorContent {...props} />
      <SheetFooter>
        <MobileButton label={mobileText('common.cancel')} variant="ghost" onPress={props.onClose} />
        <MobileButton disabled={props.typeRenameName.trim().length === 0} label={mobileText('common.save')} variant="primary" onPress={props.onSaveTypeDefinition} />
      </SheetFooter>
    </ScrollView>
  )
}

function TypeSectionEditorContent(props: MobileWorkspaceActionSheetProps) {
  return (
    <MobileTypeSectionEditor
        displayProperties={props.typeDisplayProperties}
        notes={props.notes}
        propertyOptions={props.typePropertyOptions}
        propertyQuery={props.typePropertyQuery}
        relationshipTargetOptions={props.typeRelationshipTargetOptions}
        schemaProperties={props.typeSchemaProperties}
        schemaPropertyName={props.typeSchemaPropertyName}
        schemaPropertyNameOptions={props.typeSchemaPropertyNameOptions}
        schemaPropertyValue={props.typeSchemaPropertyValue}
        schemaRelationships={props.typeSchemaRelationships}
        schemaRelationshipName={props.typeSchemaRelationshipName}
        schemaRelationshipNameOptions={props.typeSchemaRelationshipNameOptions}
        schemaRelationshipTarget={props.typeSchemaRelationshipTarget}
        sectionLabel={props.typeSectionLabel}
        sort={props.typeSort}
        sortPropertyOptions={props.typeSortPropertyOptions}
        template={props.typeTemplate}
        typeIcon={props.typeIcon}
        tone={props.typeTone}
        typeName={props.typeName}
        typeRenameName={props.typeRenameName}
        visible={props.typeVisible}
        onDisplayPropertiesChange={props.onTypeDisplayPropertiesChange}
        onPropertyQueryChange={props.onTypePropertyQueryChange}
        onSchemaPropertyAdd={props.onTypeSchemaPropertyAdd}
        onSchemaPropertyNameChange={props.onTypeSchemaPropertyNameChange}
        onSchemaPropertyRemove={props.onTypeSchemaPropertyRemove}
        onSchemaPropertyValueChange={props.onTypeSchemaPropertyValueChange}
        onSchemaRelationshipAdd={props.onTypeSchemaRelationshipAdd}
        onSchemaRelationshipNameChange={props.onTypeSchemaRelationshipNameChange}
        onSchemaRelationshipRemove={props.onTypeSchemaRelationshipRemove}
        onSchemaRelationshipTargetSelect={props.onTypeSchemaRelationshipTargetSelect}
        onSchemaRelationshipTargetChange={props.onTypeSchemaRelationshipTargetChange}
        onSectionLabelChange={props.onTypeSectionLabelChange}
        onSortChange={props.onTypeSortChange}
        onTemplateChange={props.onTypeTemplateChange}
        onTypeIconChange={props.onTypeIconChange}
        onTypeRenameNameChange={props.onTypeRenameNameChange}
        onToneChange={props.onTypeToneChange}
        onVisibleChange={props.onTypeVisibleChange}
      />
  )
}

function PrimaryListPropertiesContent(props: MobileWorkspaceActionSheetProps) {
  const { styles } = useMobileStyles(createThemeStyles)
  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" style={styles.scrollArea}>
      <MobileViewDisplayPropertiesPicker
        options={props.primaryPropertyOptions}
        query={props.primaryPropertyQuery}
        selectedProperties={props.primaryDisplayProperties}
        testIDPrefix="workspace-primary-property"
        onQueryChange={props.onPrimaryPropertyQueryChange}
        onSelectedPropertiesChange={props.onPrimaryDisplayPropertiesChange}
      />
      {props.primaryItemId === 'all-notes' ? <AllNotesFileVisibilityContent {...props} /> : null}
      <SheetFooter>
        <MobileButton label={mobileText('common.cancel')} variant="ghost" onPress={props.onClose} />
        <MobileButton label={mobileText('common.save')} variant="primary" onPress={props.onSavePrimaryNoteListProperties} />
      </SheetFooter>
    </ScrollView>
  )
}

function AllNotesFileVisibilityContent({
  allNotesShowImages,
  allNotesShowPdfs,
  allNotesShowUnsupported,
  onPrimaryAllNotesShowImagesChange,
  onPrimaryAllNotesShowPdfsChange,
  onPrimaryAllNotesShowUnsupportedChange,
}: MobileWorkspaceActionSheetProps) {
  const { styles } = useMobileStyles(createThemeStyles)
  return (
    <View style={styles.visibilitySection} testID="workspace-all-notes-file-visibility">
      <View style={styles.visibilityHeader}>
        <Text style={styles.visibilityTitle}>{mobileText('settings.allNotesVisibility.title')}</Text>
        <Text style={styles.visibilityDescription}>{mobileText('settings.allNotesVisibility.description')}</Text>
      </View>
      <VisibilitySwitchRow
        active={allNotesShowPdfs}
        description={mobileText('settings.allNotesVisibility.pdfsDescription')}
        label={mobileText('settings.allNotesVisibility.pdfs')}
        testID="workspace-all-notes-show-pdfs"
        onChange={onPrimaryAllNotesShowPdfsChange}
      />
      <VisibilitySwitchRow
        active={allNotesShowImages}
        description={mobileText('settings.allNotesVisibility.imagesDescription')}
        label={mobileText('settings.allNotesVisibility.images')}
        testID="workspace-all-notes-show-images"
        onChange={onPrimaryAllNotesShowImagesChange}
      />
      <VisibilitySwitchRow
        active={allNotesShowUnsupported}
        description={mobileText('settings.allNotesVisibility.unsupportedDescription')}
        label={mobileText('settings.allNotesVisibility.unsupported')}
        testID="workspace-all-notes-show-unsupported"
        onChange={onPrimaryAllNotesShowUnsupportedChange}
      />
    </View>
  )
}

function VisibilitySwitchRow({
  active,
  description,
  label,
  onChange,
  testID,
}: {
  active: boolean
  description: string
  label: string
  onChange: (value: boolean) => void
  testID: string
}) {
  const { styles, mobileColors } = useMobileStyles(createThemeStyles)
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="switch"
      accessibilityState={{ checked: active }}
      aria-checked={active}
      style={({ pressed }) => [styles.visibilityRow, pressed ? styles.visibilityRowPressed : null]}
      testID={testID}
      onPress={() => onChange(!active)}
    >
      <CheckCircle color={active ? mobileColors.primary : mobileColors.textFaint} size={16} weight={active ? 'fill' : 'regular'} />
      <View style={styles.visibilityText}>
        <Text style={styles.visibilityLabel}>{label}</Text>
        <Text style={styles.visibilityDescription}>{description}</Text>
      </View>
    </Pressable>
  )
}

export type { MobileWorkspaceAction, MobileWorkspaceActionSheetProps } from './MobileWorkspaceActionSheet.types'
