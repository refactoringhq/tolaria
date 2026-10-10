export type GitDigestAlgorithm = 'SHA-1' | 'SHA-256' | 'SHA-384' | 'SHA-512'
type Digest = (algorithm: AlgorithmIdentifier, data: BufferSource) => Promise<ArrayBuffer>
type NativeDigest = (algorithm: GitDigestAlgorithm, data: Uint8Array<ArrayBuffer>) => Promise<ArrayBuffer>
export type GitCryptoHost = { crypto?: { subtle?: { digest?: Digest } } }

export function installGitDigest(host: GitCryptoHost, digest: Digest) {
  if (host.crypto?.subtle?.digest) return
  const crypto = host.crypto ?? {}
  const subtle = crypto.subtle ?? {}
  Object.defineProperty(subtle, 'digest', { configurable: true, writable: true, value: digest })
  if (!crypto.subtle) Object.defineProperty(crypto, 'subtle', { configurable: true, writable: true, value: subtle })
  if (!host.crypto) Object.defineProperty(host, 'crypto', { configurable: true, writable: true, value: crypto })
}

/** Native byte conversion must preserve a Buffer view's offset and length. */
export function createGitDigest(nativeDigest: NativeDigest): Digest {
  return async (algorithm, data) => {
    const name = (typeof algorithm === 'string' ? algorithm : algorithm.name).toUpperCase()
    if (!isDigestAlgorithm(name)) {
      const error = new Error('Unsupported digest algorithm')
      error.name = 'NotSupportedError'
      throw error
    }
    const bytes = ArrayBuffer.isView(data)
      ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
      : new Uint8Array(data)
    return nativeDigest(name, bytes)
  }
}

function isDigestAlgorithm(name: string): name is GitDigestAlgorithm {
  return name === 'SHA-1' || name === 'SHA-256' || name === 'SHA-384' || name === 'SHA-512'
}
