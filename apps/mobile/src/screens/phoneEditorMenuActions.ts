import type { MenuAction } from '@expo/ui/community/menu'
import { mobileText } from '../i18n/mobileText'

export type PhoneEditorMenuCallbacks = {
  favorite: () => void
  toggleSourceMode: () => void
  openProperties: () => void
  rename: () => void
  move: () => void
  find: () => void
  exportPdf: () => void
  delete: () => void
}

export function phoneEditorMenuActions(favorite: boolean, rawMode: boolean): MenuAction[] {
  return [favoriteAction(favorite), sourceAction(rawMode), propertiesAction(), renameAction(), moveAction(), findAction(), pdfAction(), deleteAction()]
}

function favoriteAction(favorite: boolean): MenuAction {
  return {
    id: 'favorite',
    title: mobileText(favorite ? 'command.note.removeFavorite' : 'command.note.addFavorite'),
    image: 'star',
    state: favorite ? 'on' : 'off',
  }
}

function sourceAction(rawMode: boolean): MenuAction {
  return {
    id: 'source',
    title: mobileText(rawMode ? 'editor.toolbar.rawReturn' : 'editor.toolbar.rawOpen'),
    image: 'chevron.left.forwardslash.chevron.right',
  }
}

function propertiesAction(): MenuAction {
  return { id: 'properties', title: mobileText('editor.toolbar.openProperties'), image: 'slider.horizontal.3' }
}

function renameAction(): MenuAction {
  return { id: 'rename', title: mobileText('editor.filename.rename'), image: 'pencil' }
}

function moveAction(): MenuAction {
  return { id: 'move', title: mobileText('command.note.moveToFolder'), image: 'folder' }
}

function findAction(): MenuAction {
  return { id: 'find', title: mobileText('command.note.findInNote'), image: 'magnifyingglass' }
}

function pdfAction(): MenuAction {
  return { id: 'pdf', title: mobileText('command.note.exportPdf'), image: 'doc.richtext' }
}

function deleteAction(): MenuAction {
  return { id: 'delete', title: mobileText('command.note.deleteNote'), image: 'trash', attributes: { destructive: true } }
}

export function runPhoneEditorMenuAction(action: string, callbacks: PhoneEditorMenuCallbacks): void {
  switch (action) {
    case 'favorite': callbacks.favorite(); break
    case 'source': callbacks.toggleSourceMode(); break
    case 'properties': callbacks.openProperties(); break
    case 'rename': callbacks.rename(); break
    case 'move': callbacks.move(); break
    case 'find': callbacks.find(); break
    default: runSecondaryPhoneEditorMenuAction(action, callbacks)
  }
}

function runSecondaryPhoneEditorMenuAction(action: string, callbacks: PhoneEditorMenuCallbacks): void {
  switch (action) {
    case 'pdf': callbacks.exportPdf(); break
    case 'delete': callbacks.delete(); break
    default: break
  }
}
