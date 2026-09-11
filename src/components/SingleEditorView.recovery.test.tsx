import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { isRecoveredBlockNoteRenderError } from './blockNoteRenderRecovery'
import {
  createEditor,
  getSingleEditorViewTestState,
  makeEntry,
} from './SingleEditorView.testUtils'
import { SingleEditorView } from './SingleEditorView'
import { TooltipProvider } from './ui/tooltip'

const state = getSingleEditorViewTestState()

describe('SingleEditorView render recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.blockNoteViewError = null
    state.blockNoteViewErrorOnce = false
  })

  it('contains a persistent BlockNote update loop without unmounting the vault shell', async () => {
    const error = new Error('Minified React error #185; visit https://react.dev/errors/185')
    const caughtRecoveryMarks: boolean[] = []
    state.blockNoteViewError = error

    render(
      <>
        <div data-testid="vault-shell">Vault remains usable</div>
        <SingleEditorView
          editor={createEditor() as never}
          entries={[makeEntry()]}
          onNavigateWikilink={vi.fn()}
        />
      </>,
      {
        onCaughtError: (caughtError) => {
          caughtRecoveryMarks.push(isRecoveredBlockNoteRenderError(caughtError, ''))
        },
        wrapper: TooltipProvider,
      },
    )

    await waitFor(() => expect(caughtRecoveryMarks).toHaveLength(2))

    expect(caughtRecoveryMarks).toEqual([true, true])
    expect(screen.getByTestId('vault-shell')).toBeInTheDocument()
    expect(screen.queryByTestId('blocknote-view')).not.toBeInTheDocument()
  })

  it('contains a persistent render-time invalid array length without unmounting the vault shell', async () => {
    const error = new RangeError('Invalid array length')
    const caughtRecoveryMarks: boolean[] = []
    state.blockNoteViewError = error

    render(
      <>
        <div data-testid="vault-shell">Vault remains usable</div>
        <SingleEditorView
          editor={createEditor() as never}
          entries={[makeEntry()]}
          onNavigateWikilink={vi.fn()}
        />
      </>,
      {
        onCaughtError: (caughtError) => {
          caughtRecoveryMarks.push(isRecoveredBlockNoteRenderError(caughtError, ''))
        },
        wrapper: TooltipProvider,
      },
    )

    await waitFor(() => expect(caughtRecoveryMarks).toHaveLength(2))

    expect(caughtRecoveryMarks).toEqual([true, true])
    expect(screen.getByTestId('vault-shell')).toBeInTheDocument()
    expect(screen.queryByTestId('blocknote-view')).not.toBeInTheDocument()
  })
})
