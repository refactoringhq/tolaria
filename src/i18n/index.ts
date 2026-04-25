import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import common_en from './locales/en/common.json'
import sidebar_en from './locales/en/sidebar.json'
import settings_en from './locales/en/settings.json'
import editor_en from './locales/en/editor.json'
import dialogs_en from './locales/en/dialogs.json'
import statusBar_en from './locales/en/statusBar.json'
import commands_en from './locales/en/commands.json'

import common_zhCN from './locales/zh-CN/common.json'
import sidebar_zhCN from './locales/zh-CN/sidebar.json'
import settings_zhCN from './locales/zh-CN/settings.json'
import editor_zhCN from './locales/zh-CN/editor.json'
import dialogs_zhCN from './locales/zh-CN/dialogs.json'
import statusBar_zhCN from './locales/zh-CN/statusBar.json'
import commands_zhCN from './locales/zh-CN/commands.json'

import common_ja from './locales/ja/common.json'
import sidebar_ja from './locales/ja/sidebar.json'
import settings_ja from './locales/ja/settings.json'
import editor_ja from './locales/ja/editor.json'
import dialogs_ja from './locales/ja/dialogs.json'
import statusBar_ja from './locales/ja/statusBar.json'
import commands_ja from './locales/ja/commands.json'

const resources = {
  en: { common: common_en, sidebar: sidebar_en, settings: settings_en, editor: editor_en, dialogs: dialogs_en, statusBar: statusBar_en, commands: commands_en },
  'zh-CN': { common: common_zhCN, sidebar: sidebar_zhCN, settings: settings_zhCN, editor: editor_zhCN, dialogs: dialogs_zhCN, statusBar: statusBar_zhCN, commands: commands_zhCN },
  ja: { common: common_ja, sidebar: sidebar_ja, settings: settings_ja, editor: editor_ja, dialogs: dialogs_ja, statusBar: statusBar_ja, commands: commands_ja },
}

export const NAMESPACES = ['common', 'sidebar', 'settings', 'editor', 'dialogs', 'statusBar', 'commands'] as const

let i18nInitialized = false

export function initI18n(lng: string): typeof i18next {
  if (!i18nInitialized) {
    i18next.use(initReactI18next).init({
      lng,
      fallbackLng: 'en',
      resources,
      defaultNS: 'common',
      ns: NAMESPACES as unknown as string[],
      interpolation: { escapeValue: false },
      returnNull: false,
      returnEmptyString: false,
    })
    i18nInitialized = true
  }
  return i18next
}

export function changeLanguage(lng: string): Promise<void> {
  return i18next.changeLanguage(lng)
}

export { i18next }
