import enCatalog from '../../../../src/lib/locales/en.json'

type MobileTextKey = keyof typeof enCatalog

export function mobileText(key: MobileTextKey) {
  return enCatalog[key]
}

export const mobileCopy = {
  allNotes: mobileText('sidebar.nav.allNotes'),
  archive: mobileText('sidebar.nav.archive'),
  createNote: mobileText('noteList.createNote'),
  favorites: mobileText('sidebar.group.favorites'),
  inbox: mobileText('sidebar.nav.inbox'),
  modified: mobileText('noteList.sort.modified'),
  properties: mobileText('inspector.title.properties'),
  searchNotes: mobileText('noteList.searchAction'),
  showSidebar: mobileText('sidebar.action.showSidebar'),
  types: mobileText('sidebar.group.types'),
  views: mobileText('sidebar.group.views'),
}
