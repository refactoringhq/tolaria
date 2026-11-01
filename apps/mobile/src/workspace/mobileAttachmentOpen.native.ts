import type { SharingOptions } from 'expo-sharing'
import { useCallback } from 'react'
import { Linking } from 'react-native'
import { mobileAttachmentUriForHref } from './mobileAttachmentUris'

type ExpoSharingModule = {
  isAvailableAsync: () => Promise<boolean>
  shareAsync: (url: string, options?: SharingOptions) => Promise<void>
}

declare const require: (moduleName: string) => ExpoSharingModule

export type MobileAttachmentLinkOpener = (href: string) => void

export function useMobileAttachmentLinkOpener(vaultRootUri?: string | null): MobileAttachmentLinkOpener {
  return useCallback((href: string) => {
    void openMobileAttachmentOrHref(href, vaultRootUri)
  }, [vaultRootUri])
}

async function openMobileAttachmentOrHref(href: string, vaultRootUri?: string | null): Promise<void> {
  const attachmentUri = mobileAttachmentUriForHref(href, vaultRootUri)
  if (attachmentUri) {
    await shareMobileAttachment(attachmentUri)
    return
  }

  if (/^(?:https?|mailto|tel|file):/iu.test(href) || href.startsWith('tolaria://')) await Linking.openURL(href)
}

async function shareMobileAttachment(uri: string): Promise<void> {
  const sharing = require('expo-sharing')
  if (await sharing.isAvailableAsync()) {
    await sharing.shareAsync(uri, {
      dialogTitle: fileNameFromUri(uri),
    })
    return
  }

  await Linking.openURL(uri)
}

function fileNameFromUri(uri: string): string {
  const fileName = uri.split(/[/?#]/u).filter(Boolean).at(-1)
  return fileName ? decodeURIComponent(fileName) : 'attachment'
}
