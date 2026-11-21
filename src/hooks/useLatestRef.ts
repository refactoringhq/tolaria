import { type RefObject, useEffect, useRef } from 'react'

/** A ref that always holds the latest value, updated after render, for callbacks that outlive a render. */
export function useLatestRef<T>(value: T): RefObject<T> {
  const ref = useRef(value)
  useEffect(() => {
    ref.current = value
  }, [value])
  return ref
}
