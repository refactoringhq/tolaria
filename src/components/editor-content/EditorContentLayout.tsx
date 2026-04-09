import type React from 'react'
import { DiffView } from '../DiffView'
import { BreadcrumbBar } from '../BreadcrumbBar'
import { TitleField } from '../TitleField'
import { NoteIcon } from '../NoteIcon'
import { ArchivedNoteBanner } from '../ArchivedNoteBanner'
import { ConflictNoteBanner } from '../ConflictNoteBanner'
import { RawEditorView } from '../RawEditorView'
import { SingleEditorView } from '../SingleEditorView'
import type { useEditorContentModel } from './useEditorContentModel'

type EditorContentModel = ReturnType<typeof useEditorContentModel>

type BreadcrumbActions = Pick<
  EditorContentModel,
  | 'diffMode'
  | 'diffLoading'
  | 'onToggleDiff'
  | 'effectiveRawMode'
  | 'onToggleRaw'
  | 'forceRawMode'
  | 'showAIChat'
  | 'onToggleAIChat'
  | 'inspectorCollapsed'
  | 'onToggleInspector'
  | 'showDiffToggle'
  | 'onToggleFavorite'
  | 'onToggleOrganized'
  | 'onDeleteNote'
  | 'onArchiveNote'
  | 'onUnarchiveNote'
>

function EditorLoadingSkeleton() {
  return (
    <div className="flex flex-1 flex-col gap-3 p-8 animate-pulse" style={{ minHeight: 0 }}>
      <div className="h-6 w-2/5 rounded bg-muted" />
      <div className="h-4 w-4/5 rounded bg-muted" />
      <div className="h-4 w-3/5 rounded bg-muted" />
      <div className="h-4 w-4/5 rounded bg-muted" />
      <div className="h-4 w-2/5 rounded bg-muted" />
    </div>
  )
}

function DiffModeView({ diffContent, onToggleDiff }: { diffContent: string | null; onToggleDiff: () => void }) {
  return (
    <div className="flex-1 overflow-auto">
      <button
        className="flex items-center gap-1.5 px-4 py-2 text-xs text-primary bg-muted border-b border-border cursor-pointer hover:bg-accent transition-colors w-full border-t-0 border-l-0 border-r-0"
        onClick={onToggleDiff}
        title="Back to editor"
      >
        <span style={{ fontSize: 14, lineHeight: 1 }}>&larr;</span>
        Back to editor
      </button>
      <DiffView diff={diffContent ?? ''} />
    </div>
  )
}

function RawModeEditorSection({
  activeTab,
  entries,
  rawMode,
  onRawContentChange,
  onSave,
  rawLatestContentRef,
  vaultPath,
}: Pick<
  EditorContentModel,
  'activeTab' | 'entries' | 'onRawContentChange' | 'onSave' | 'rawLatestContentRef' | 'vaultPath'
> & {
  rawMode: boolean
}) {
  if (!rawMode || !activeTab) return null

  return (
    <RawEditorView
      key={activeTab.entry.path}
      content={activeTab.content}
      path={activeTab.entry.path}
      entries={entries}
      onContentChange={onRawContentChange ?? (() => {})}
      onSave={onSave ?? (() => {})}
      latestContentRef={rawLatestContentRef}
      vaultPath={vaultPath}
    />
  )
}

function bindPath(cb: ((path: string) => void) | undefined, path: string) {
  return cb ? () => cb(path) : undefined
}

function ActiveTabBreadcrumb({
  activeTab,
  barRef,
  wordCount,
  path,
  actions,
}: {
  activeTab: NonNullable<EditorContentModel['activeTab']>
  barRef: React.RefObject<HTMLDivElement | null>
  wordCount: number
  path: string
  actions: BreadcrumbActions
}) {
  return (
    <BreadcrumbBar
      entry={activeTab.entry}
      wordCount={wordCount}
      barRef={barRef}
      showDiffToggle={actions.showDiffToggle}
      diffMode={actions.diffMode}
      diffLoading={actions.diffLoading}
      onToggleDiff={actions.onToggleDiff}
      rawMode={actions.effectiveRawMode}
      onToggleRaw={actions.onToggleRaw}
      forceRawMode={actions.forceRawMode}
      showAIChat={actions.showAIChat}
      onToggleAIChat={actions.onToggleAIChat}
      inspectorCollapsed={actions.inspectorCollapsed}
      onToggleInspector={actions.onToggleInspector}
      onToggleFavorite={bindPath(actions.onToggleFavorite, path)}
      onToggleOrganized={bindPath(actions.onToggleOrganized, path)}
      onDelete={bindPath(actions.onDeleteNote, path)}
      onArchive={bindPath(actions.onArchiveNote, path)}
      onUnarchive={bindPath(actions.onUnarchiveNote, path)}
    />
  )
}

function TitleSection({
  activeTab,
  entryIcon,
  hasDisplayIcon,
  path,
  showTitleSection,
  titleSectionRef,
  vaultPath,
  onTitleChange,
}: Pick<
  EditorContentModel,
  'activeTab' | 'entryIcon' | 'hasDisplayIcon' | 'path' | 'showTitleSection' | 'titleSectionRef' | 'vaultPath' | 'onTitleChange'
>) {
  if (!activeTab) return null

  return (
    <div ref={titleSectionRef} className="title-section" data-title-ui-visible={showTitleSection || undefined}>
      {showTitleSection && (
        <>
          <div className="title-section__heading">
            {!hasDisplayIcon && (
              <div className="title-section__inline-add-icon">
                <NoteIcon icon={null} editable />
              </div>
            )}
            <div className={`title-section__row${hasDisplayIcon ? '' : ' title-section__row--no-icon'}`}>
              {hasDisplayIcon && <NoteIcon icon={entryIcon} editable />}
              <TitleField
                title={activeTab.entry.title}
                filename={activeTab.entry.filename}
                editable
                notePath={path}
                vaultPath={vaultPath}
                onTitleChange={(newTitle) => onTitleChange?.(path, newTitle)}
              />
            </div>
          </div>
          <div className="title-section__separator" />
        </>
      )}
    </div>
  )
}

function EditorChrome({
  isArchived,
  onUnarchiveNote,
  path,
  isConflicted,
  onKeepMine,
  onKeepTheirs,
  diffMode,
  diffContent,
  onToggleDiff,
}: Pick<
  EditorContentModel,
  'isArchived' | 'onUnarchiveNote' | 'path' | 'isConflicted' | 'onKeepMine' | 'onKeepTheirs' | 'diffMode' | 'diffContent' | 'onToggleDiff'
>) {
  return (
    <>
      {isArchived && onUnarchiveNote && (
        <ArchivedNoteBanner onUnarchive={() => onUnarchiveNote(path)} />
      )}
      {isConflicted && (
        <ConflictNoteBanner
          onKeepMine={() => onKeepMine?.(path)}
          onKeepTheirs={() => onKeepTheirs?.(path)}
        />
      )}
      {diffMode && <DiffModeView diffContent={diffContent} onToggleDiff={onToggleDiff} />}
    </>
  )
}

function EditorCanvas({
  showEditor,
  cssVars,
  activeTab,
  entryIcon,
  hasDisplayIcon,
  path,
  showTitleSection,
  titleSectionRef,
  vaultPath,
  onTitleChange,
  editor,
  entries,
  onNavigateWikilink,
  onEditorChange,
  isDeletedPreview,
}: Pick<
  EditorContentModel,
  | 'showEditor'
  | 'cssVars'
  | 'activeTab'
  | 'entryIcon'
  | 'hasDisplayIcon'
  | 'path'
  | 'showTitleSection'
  | 'titleSectionRef'
  | 'vaultPath'
  | 'onTitleChange'
  | 'editor'
  | 'entries'
  | 'onNavigateWikilink'
  | 'onEditorChange'
  | 'isDeletedPreview'
>) {
  if (!showEditor) return null

  return (
    <div className="editor-scroll-area" style={cssVars as React.CSSProperties}>
      <div className="editor-content-wrapper">
        <TitleSection
          activeTab={activeTab}
          entryIcon={entryIcon}
          hasDisplayIcon={hasDisplayIcon}
          path={path}
          showTitleSection={showTitleSection}
          titleSectionRef={titleSectionRef}
          vaultPath={vaultPath}
          onTitleChange={onTitleChange}
        />
        <SingleEditorView
          editor={editor}
          entries={entries}
          onNavigateWikilink={onNavigateWikilink}
          onChange={onEditorChange}
          vaultPath={vaultPath}
          editable={!isDeletedPreview}
        />
      </div>
    </div>
  )
}

export function EditorContentLayout(model: EditorContentModel) {
  const {
    activeTab,
    isLoadingNewTab,
    entries,
    editor,
    diffMode,
    diffContent,
    onToggleDiff,
    effectiveRawMode,
    onRawContentChange,
    onSave,
    showEditor,
    isArchived,
    onUnarchiveNote,
    path,
    isConflicted,
    onKeepMine,
    onKeepTheirs,
    breadcrumbBarRef,
    wordCount,
    titleSectionRef,
    showTitleSection,
    hasDisplayIcon,
    entryIcon,
    vaultPath,
    onTitleChange,
    cssVars,
    onNavigateWikilink,
    onEditorChange,
    isDeletedPreview,
    rawLatestContentRef,
  } = model

  if (!activeTab) {
    return (
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        {isLoadingNewTab && showEditor && <EditorLoadingSkeleton />}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col min-w-0 min-h-0">
      <ActiveTabBreadcrumb
        activeTab={activeTab}
        barRef={breadcrumbBarRef}
        wordCount={wordCount}
        path={path}
        actions={{
          diffMode: model.diffMode,
          diffLoading: model.diffLoading,
          onToggleDiff: model.onToggleDiff,
          effectiveRawMode: model.effectiveRawMode,
          onToggleRaw: model.onToggleRaw,
          forceRawMode: model.forceRawMode,
          showAIChat: model.showAIChat,
          onToggleAIChat: model.onToggleAIChat,
          inspectorCollapsed: model.inspectorCollapsed,
          onToggleInspector: model.onToggleInspector,
          showDiffToggle: model.showDiffToggle,
          onToggleFavorite: model.onToggleFavorite,
          onToggleOrganized: model.onToggleOrganized,
          onDeleteNote: model.onDeleteNote,
          onArchiveNote: model.onArchiveNote,
          onUnarchiveNote: model.onUnarchiveNote,
        }}
      />
      <EditorChrome
        isArchived={isArchived}
        onUnarchiveNote={onUnarchiveNote}
        path={path}
        isConflicted={isConflicted}
        onKeepMine={onKeepMine}
        onKeepTheirs={onKeepTheirs}
        diffMode={diffMode}
        diffContent={diffContent}
        onToggleDiff={onToggleDiff}
      />
      <RawModeEditorSection
        activeTab={activeTab}
        entries={entries}
        rawMode={effectiveRawMode}
        onRawContentChange={onRawContentChange}
        onSave={onSave}
        rawLatestContentRef={rawLatestContentRef}
        vaultPath={vaultPath}
      />
      <EditorCanvas
        showEditor={showEditor}
        cssVars={cssVars}
        activeTab={activeTab}
        entryIcon={entryIcon}
        hasDisplayIcon={hasDisplayIcon}
        path={path}
        showTitleSection={showTitleSection}
        titleSectionRef={titleSectionRef}
        vaultPath={vaultPath}
        onTitleChange={onTitleChange}
        editor={editor}
        entries={entries}
        onNavigateWikilink={onNavigateWikilink}
        onEditorChange={onEditorChange}
        isDeletedPreview={isDeletedPreview}
      />
      {isLoadingNewTab && showEditor && <EditorLoadingSkeleton />}
    </div>
  )
}
