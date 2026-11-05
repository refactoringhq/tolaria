import { mobileNoteIdForWikilinkTarget } from './mobileWikilinks'
import type { MobileNote } from './mobileWorkspaceModel'

export function createMobileWikilinkNavigator(
	notes: MobileNote[],
	onNavigate: (target: string) => void,
	onMissing: () => void,
) {
	return (target: string) => {
		if (mobileNoteIdForWikilinkTarget(notes, target)) onNavigate(target)
		else onMissing()
	}
}
