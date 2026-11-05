import { describe, expect, it, vi } from 'vitest'
import { createMobileTaskToggleHandler, toggleMobileTaskAtBodyLine } from './mobileTaskCheckbox'

describe('toggleMobileTaskAtLine', () => {
	it('changes only the requested task marker and preserves CRLF content', () => {
		const source = '# Tasks\r\n\r\n  - [ ] Keep indentation\r\n- [x] Leave this alone\r\n'

		expect(toggleMobileTaskAtBodyLine(source, 2)).toBe(
			'# Tasks\r\n\r\n  - [x] Keep indentation\r\n- [x] Leave this alone\r\n',
		)
	})

	it('returns null for a stale source line or a non-task block', () => {
		expect(toggleMobileTaskAtBodyLine('A paragraph', 0)).toBeNull()
		expect(toggleMobileTaskAtBodyLine('- [ ] task', 1)).toBeNull()
	})

	it('accounts for raw frontmatter before the parsed markdown body', () => {
		const content = '---\ntype: Note\n---\n- [ ] Task\n'
		expect(toggleMobileTaskAtBodyLine(content, 0)).toBe('---\ntype: Note\n---\n- [x] Task\n')
	})

	it('writes a toggled task only when the source line changes', () => {
		const update = vi.fn()
		const toggle = createMobileTaskToggleHandler('# Tasks\n- [ ] Ship', 'note-1', update)
		expect(toggle).toBeDefined()
		toggle?.(1)
		expect(update).toHaveBeenCalledWith('note-1', '# Tasks\n- [x] Ship')
		update.mockClear()
		toggle?.(0)
		expect(update).not.toHaveBeenCalled()
		expect(createMobileTaskToggleHandler(undefined, 'note-1', update)).toBeUndefined()
	})
})
