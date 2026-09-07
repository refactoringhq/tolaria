import { useCallback } from 'react'
import {
  GridSuggestionMenuController,
  LinkToolbarController,
  SideMenuController,
  SuggestionMenuController,
  type FormattingToolbarProps,
  type SideMenuProps,
} from '@blocknote/react'
import type { AppLocale } from '../lib/i18n'
import { TolariaFilePanelController } from './TolariaFilePanel'
import { TolariaLinkToolbar } from './TolariaLinkToolbar'
import { TolariaSlashMenu } from './TolariaSlashMenu'
import { WikilinkSuggestionMenu, type WikilinkSuggestionItem } from './WikilinkSuggestionMenu'
import { TolariaCollapsedHeadingsController, TolariaSideMenu } from './tolariaBlockNoteSideMenu'
import { TolariaFormattingToolbar, TolariaFormattingToolbarController } from './tolariaEditorFormatting'
import type { SuggestionAction } from './singleEditorSuggestionItems'
import type { useSuggestionMenuItems } from './singleEditorSuggestionItems'

type EditorInteractionControllersProps = ReturnType<typeof useSuggestionMenuItems> & {
  locale: AppLocale
  onToolbarMouseDown: (event: Pick<React.MouseEvent<HTMLElement>, 'target' | 'preventDefault'>) => void
  runEditorAction: (action: SuggestionAction) => void
  vaultPath?: string
}

function EditorToolbarControllers({
  locale,
  onToolbarMouseDown,
  vaultPath,
}: Pick<EditorInteractionControllersProps, 'locale' | 'onToolbarMouseDown' | 'vaultPath'>) {
  const sideMenu = useCallback((props: SideMenuProps) => <TolariaSideMenu {...props} locale={locale} />, [locale])
  const formattingToolbar = useCallback(
    (props: FormattingToolbarProps) => (
      <TolariaFormattingToolbar {...props} locale={locale} vaultPath={vaultPath} />
    ),
    [locale, vaultPath],
  )
  const linkToolbar = useCallback(
    (props: React.ComponentProps<typeof TolariaLinkToolbar>) => (
      <TolariaLinkToolbar {...props} vaultPath={vaultPath} />
    ),
    [vaultPath],
  )
  const floatingUIOptions = { elementProps: { onMouseDownCapture: onToolbarMouseDown } }

  return (
    <>
      <TolariaCollapsedHeadingsController />
      <SideMenuController sideMenu={sideMenu} />
      <TolariaFormattingToolbarController
        formattingToolbar={formattingToolbar}
        floatingUIOptions={floatingUIOptions}
      />
      <LinkToolbarController linkToolbar={linkToolbar} floatingUIOptions={floatingUIOptions} />
      <TolariaFilePanelController />
    </>
  )
}

function EditorSuggestionControllers({
  getAtWikilinkItems,
  getEmojiItems,
  getSlashMenuItems,
  getWikilinkItems,
  runEditorAction,
}: Pick<
  EditorInteractionControllersProps,
  'getAtWikilinkItems' | 'getEmojiItems' | 'getSlashMenuItems' | 'getWikilinkItems' | 'runEditorAction'
>) {
  const handleItemClick = useCallback(
    (item: WikilinkSuggestionItem) => runEditorAction(item.onItemClick),
    [runEditorAction],
  )

  return (
    <>
      <SuggestionMenuController
        triggerCharacter="/"
        getItems={getSlashMenuItems}
        suggestionMenuComponent={TolariaSlashMenu}
      />
      <GridSuggestionMenuController triggerCharacter=":" columns={10} minQueryLength={1} getItems={getEmojiItems} />
      <SuggestionMenuController
        triggerCharacter="[["
        getItems={getWikilinkItems}
        suggestionMenuComponent={WikilinkSuggestionMenu}
        onItemClick={handleItemClick}
      />
      <SuggestionMenuController
        triggerCharacter="@"
        getItems={getAtWikilinkItems}
        suggestionMenuComponent={WikilinkSuggestionMenu}
        onItemClick={handleItemClick}
      />
    </>
  )
}

export function EditorInteractionControllers(props: EditorInteractionControllersProps) {
  return (
    <>
      <EditorToolbarControllers {...props} />
      <EditorSuggestionControllers {...props} />
    </>
  )
}
