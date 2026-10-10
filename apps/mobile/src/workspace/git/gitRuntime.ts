import { Buffer } from 'buffer'

// isomorphic-git's ESM build expects Buffer in browser/native runtimes.
if (typeof globalThis.Buffer === 'undefined') {
  Object.defineProperty(globalThis, 'Buffer', { configurable: true, writable: true, value: Buffer })
}
