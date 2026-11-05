// @vitest-environment jsdom
import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useMobileBottomInset } from './useMobileBottomInset'

const keyboard = vi.hoisted(() => ({
  os: 'ios',
  visible: false,
  listeners: new Map<string, (event: { duration: number }) => void>(),
  scheduleLayoutAnimation: vi.fn(),
}))
vi.mock('react-native', () => ({ Keyboard: {
  isVisible: () => keyboard.visible,
  addListener: (name: string, callback: () => void) => {
    keyboard.listeners.set(name, callback)
    return { remove: () => keyboard.listeners.delete(name) }
  },
  scheduleLayoutAnimation: keyboard.scheduleLayoutAnimation,
}, Platform: { get OS() { return keyboard.os } } }))
vi.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 34 }) }))

function Probe() {
  return createElement('output', null, useMobileBottomInset())
}

describe('bottom control safe area', () => {
  beforeEach(() => {
    keyboard.os = 'ios'
    keyboard.visible = false
    keyboard.listeners.clear()
    keyboard.scheduleLayoutAnimation.mockReset()
  })

  it.each([false, true])('does not add a home-indicator band above a visible keyboard (initial: %s)', (visible) => {
    keyboard.visible = visible
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      flushSync(() => root.render(createElement(Probe)))
      expect(host.textContent).toBe(visible ? '0' : '34')
      const show = keyboard.listeners.get('keyboardWillShow')
      const hide = keyboard.listeners.get('keyboardWillHide')
      const event = { duration: 250 }
      flushSync(() => show?.(event))
      expect(host.textContent).toBe('0')
      flushSync(() => hide?.(event))
      expect(host.textContent).toBe('34')
      expect(keyboard.scheduleLayoutAnimation).toHaveBeenCalledTimes(2)
      expect(keyboard.scheduleLayoutAnimation).toHaveBeenLastCalledWith(event)
    } finally { root.unmount() }
    expect(keyboard.listeners.size).toBe(0)
  })

  it('uses completed keyboard events on Android', () => {
    keyboard.os = 'android'
    const host = document.createElement('div')
    const root = createRoot(host)
    try {
      flushSync(() => root.render(createElement(Probe)))
      expect(keyboard.listeners.has('keyboardWillShow')).toBe(false)
      flushSync(() => keyboard.listeners.get('keyboardDidShow')?.({ duration: 0 }))
      expect(host.textContent).toBe('0')
      flushSync(() => keyboard.listeners.get('keyboardDidHide')?.({ duration: 0 }))
      expect(host.textContent).toBe('34')
      expect(keyboard.scheduleLayoutAnimation).not.toHaveBeenCalled()
    } finally { root.unmount() }
  })
})
