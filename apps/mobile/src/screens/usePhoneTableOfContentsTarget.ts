import { useCallback, useRef, useState } from 'react'

import type { MobileTableOfContentsTarget } from '../workspace/mobileTableOfContents'

import type { PhoneTableOfContentsTargetRequest } from './phoneWorkspaceScreenSupport'

import type { PhoneWorkspaceState } from './phoneWorkspaceTransitions'

export function usePhoneTableOfContentsTarget(setPhoneState: (nextState: PhoneWorkspaceState) => void) {
  const [target, setTarget] = useState<PhoneTableOfContentsTargetRequest | null>(null)
  const requestId = useRef(0)
  const select = useCallback((nextTarget: MobileTableOfContentsTarget) => {
    requestId.current += 1
    setTarget({ ...nextTarget, requestId: requestId.current })
    setPhoneState('editor')
  }, [setPhoneState])

  return { select, target }
}
