import { beforeEach, describe, expect, it, vi } from 'vitest'

const nativeAlert = vi.hoisted(() => ({ alert: vi.fn(), prompt: vi.fn() }))
vi.mock('react-native', () => ({ Alert: { alert: nativeAlert.alert, prompt: nativeAlert.prompt } }))

import { showNativeConfirmation, showNativeTextPrompt, submitPromptValueAfterStateUpdate } from './mobileNativeDialogs'

describe('mobile native dialogs', () => {
  beforeEach(() => {
    nativeAlert.alert.mockReset()
    nativeAlert.prompt.mockReset()
  })

  it('marks irreversible confirmation as destructive and cancel as cancel', () => {
    const onConfirm = vi.fn()
    showNativeConfirmation({ cancelLabel: 'Cancel', confirmLabel: 'Remove', message: 'Vault', onConfirm, title: 'Remove vault' })
    const buttons = nativeAlert.alert.mock.calls[0]?.[2]
    expect(buttons).toEqual([
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: onConfirm },
    ])
    buttons?.[1]?.onPress?.()
    expect(onConfirm).toHaveBeenCalledOnce()
  })

  it('reopens a native prompt with the submitted value and validation message', () => {
    const onSubmit = vi.fn()
    showNativeTextPrompt({
      cancelLabel: 'Cancel', defaultValue: 'Draft', onCancel: vi.fn(), onSubmit,
      submitLabel: 'Save', title: 'Rename', validate: () => 'Already exists',
    })
    const buttons = nativeAlert.prompt.mock.calls[0]?.[2]
    buttons?.[1]?.onPress?.('Taken')
    expect(nativeAlert.prompt).toHaveBeenCalledTimes(2)
    expect(nativeAlert.prompt.mock.calls[1]?.[1]).toBe('Already exists')
    expect(nativeAlert.prompt.mock.calls[1]?.[4]).toBe('Taken')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('updates the existing field state before invoking its existing submit callback', () => {
    const onChange = vi.fn()
    const onSubmit = vi.fn()
    const frame = vi.fn((callback: FrameRequestCallback) => { callback(0); return 1 })
    vi.stubGlobal('requestAnimationFrame', frame)
    submitPromptValueAfterStateUpdate('New name', onChange, onSubmit)
    expect(onChange).toHaveBeenCalledWith('New name')
    expect(frame).toHaveBeenCalledOnce()
    expect(onSubmit).toHaveBeenCalledOnce()
    vi.unstubAllGlobals()
  })
})
