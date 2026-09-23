import { describe, expect, it } from 'vitest'
import { translate } from './i18n'
import { localizedStreamErrorMessage } from './localizedStreamError'

describe('localizedStreamErrorMessage', () => {
  it('localizes the legacy Claude authentication error', () => {
    const message = 'Claude CLI is not authenticated. Run `claude auth login` in your terminal.'

    expect(localizedStreamErrorMessage({ message, locale: 'it-IT' })).toBe(
      translate('it-IT', 'ai.error.claude.notAuthenticated'),
    )
  })
})
