import { describe, expect, it } from 'vitest'
import { mobileSheetPresentation } from './mobileSheetPresentation'

describe('mobile sheet presentation', () => {
  it('uses a native page sheet on iOS', () => {
    expect(mobileSheetPresentation('ios')).toEqual({
      animationType: 'slide',
      presentationStyle: 'pageSheet',
      transparent: false,
    })
  })

  it('keeps Android modal presentation full-screen and transparent for its existing card layout', () => {
    expect(mobileSheetPresentation('android')).toEqual({
      animationType: 'slide',
      presentationStyle: 'fullScreen',
      transparent: true,
    })
  })
})
