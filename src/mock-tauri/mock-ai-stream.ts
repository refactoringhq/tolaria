import type { MockAiStreamChunk, MockAiStreamHook } from '../types/laputaTestBridge'

export function createMockAiStreamHook(): MockAiStreamHook {
  let chunks: MockAiStreamChunk[] = []
  let released = 0
  let scriptConfigured = false
  const subscribers = new Set<(chunk: MockAiStreamChunk) => void>()

  return {
    setScript(script) {
      scriptConfigured = true
      chunks = [...script]
      released = 0
    },
    hasScript() {
      return scriptConfigured
    },
    next() {
      const chunk = chunks.at(released)
      if (!chunk) return released
      released += 1
      subscribers.forEach((release) => {
        release(chunk)
      })
      return released
    },
    releaseUntil(chunkCount) {
      while (released < chunkCount && released < chunks.length) this.next()
      return released
    },
    subscribe(release) {
      subscribers.add(release)
      return () => subscribers.delete(release)
    },
  }
}
