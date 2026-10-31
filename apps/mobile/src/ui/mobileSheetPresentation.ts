import type { ModalProps, PlatformOSType } from 'react-native'

export function mobileSheetPresentation(platform: PlatformOSType): Pick<ModalProps, 'animationType' | 'presentationStyle' | 'transparent'> {
  return {
    animationType: 'slide',
    presentationStyle: platform === 'ios' ? 'pageSheet' : 'fullScreen',
    transparent: platform !== 'ios',
  }
}
