import { parseLocalVaultDocument } from './localVaultFrontmatter'

export function toggleMobileTaskAtBodyLine(content: string, sourceLine: number): string | null {
	const { body } = parseLocalVaultDocument(content)
	const prefixLength = content.length - body.length
	const sourceLineOffset = prefixLength === 0
		? 0
		: content.slice(0, prefixLength).split(/\r\n|\n|\r/u).length - 1
	return toggleAtLine(content, sourceLine + sourceLineOffset)
}

export function createMobileTaskToggleHandler(
	content: string | undefined,
	noteId: string,
	onUpdateContent: (id: string, content: string) => void,
): ((sourceLine: number) => void) | undefined {
	if (content === undefined) return undefined
	return (sourceLine) => {
		const updated = toggleMobileTaskAtBodyLine(content, sourceLine)
		if (updated !== null) onUpdateContent(noteId, updated)
	}
}

function toggleAtLine(content: string, sourceLine: number): string | null {
	const lines = content.split(/(\r\n|\n|\r)/u)
	const contentIndex = sourceLine * 2
	const line = lines[contentIndex]
	if (line === undefined) return null

	const match = line.match(/^(\s*[-*]\s+\[)([ xX])(\]\s+.*)$/u)
	if (!match) return null
	lines[contentIndex] = `${match[1]}${match[2] === ' ' ? 'x' : ' '}${match[3]}`
	return lines.join('')
}
