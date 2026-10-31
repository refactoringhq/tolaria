// @vitest-environment jsdom
import { act, createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { Switch } from './switch'

const nativeSwitch = vi.hoisted(() => vi.fn())

vi.mock('react-native', () => ({ Switch: (props: Record<string, unknown>) => {
  nativeSwitch(props)
  return createElement('button', {
    type: 'button',
    'data-testid': props.testID as string,
    'aria-checked': props.value as boolean,
    disabled: props.disabled as boolean,
    onClick: () => (props.onValueChange as ((value: boolean) => void) | undefined)?.(!(props.value as boolean)),
  })
} }))
vi.mock('../../ui/theme/useMobileTheme', () => ({ useMobileColors: () => ({
  primary: '#123456', borderStrong: '#778899', textInverse: '#ffffff',
}) }))

it('maps the checked API to the native Switch and forwards state changes', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const changed = vi.fn()
  const host = document.createElement('div')
  const root = createRoot(host)
  await act(async () => root.render(createElement(Switch, {
    checked: false,
    disabled: false,
    accessibilityLabel: 'Auto Git',
    testID: 'auto-git',
    onCheckedChange: changed,
  })))

  const props = nativeSwitch.mock.lastCall?.[0]
  expect(props?.value).toBe(false)
  expect(props?.trackColor).toEqual({ false: '#778899', true: '#123456' })
  expect(props?.ios_backgroundColor).toBe('#778899')
  expect(props?.thumbColor).toBe('#ffffff')
  await act(async () => host.querySelector('button')?.click())
  expect(changed).toHaveBeenCalledExactlyOnceWith(true)
  await act(async () => root.unmount())
  vi.unstubAllGlobals()
})
