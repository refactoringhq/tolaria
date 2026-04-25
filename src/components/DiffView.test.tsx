import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DiffView } from './DiffView'

describe('DiffView', () => {
  it('shows "No changes to display" when diff is empty', () => {
    render(<DiffView diff="" />)
    expect(screen.getByText('No changes to display')).toBeInTheDocument()
  })

  it('renders diff lines with line numbers', () => {
    const diff = 'diff --git a/test.md b/test.md\n--- a/test.md\n+++ b/test.md\n@@ -1,3 +1,3 @@\n-old line\n+new line\n context'
    render(<DiffView diff={diff} />)

    expect(screen.getByText('-old line')).toBeInTheDocument()
    expect(screen.getByText('+new line')).toBeInTheDocument()
    expect(screen.getByText('context')).toBeInTheDocument()
  })

  it('applies green styling to added lines', () => {
    const diff = '+added line'
    render(<DiffView diff={diff} />)
    const addedLine = screen.getByText('+added line').closest('div')
    expect(addedLine).toBeInTheDocument()
    expect(addedLine).toHaveClass('text-[var(--diff-added-text)]')
  })

  it('applies red styling to removed lines', () => {
    const diff = '-removed line'
    render(<DiffView diff={diff} />)
    const removedLine = screen.getByText('-removed line').closest('div')
    expect(removedLine).toBeInTheDocument()
    expect(removedLine).toHaveClass('text-[var(--diff-removed-text)]')
  })

  it('applies hunk header styling to @@ lines', () => {
    const diff = '@@ -1,3 +1,3 @@'
    const { container } = render(<DiffView diff={diff} />)
    const hunkLine = container.querySelector('.italic')
    expect(hunkLine).toBeInTheDocument()
  })

  it('applies header styling to diff/index/---/+++ lines', () => {
    const diff = 'diff --git a/test.md b/test.md\nindex abc123..def456\n--- a/test.md\n+++ b/test.md'
    const { container } = render(<DiffView diff={diff} />)
    const headerLines = container.querySelectorAll('.font-semibold')
    expect(headerLines.length).toBeGreaterThanOrEqual(3) // diff, index, --- and +++ are headers
  })

  it('handles new file mode header', () => {
    const diff = 'new file mode 100644'
    const { container } = render(<DiffView diff={diff} />)
    const headerLine = container.querySelector('.font-semibold')
    expect(headerLine).toBeInTheDocument()
  })

  it('renders line numbers sequentially', () => {
    const diff = 'line1\nline2\nline3'
    render(<DiffView diff={diff} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
