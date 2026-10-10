import { Buffer } from 'buffer'
import { CryptoDigestAlgorithm, digest } from 'expo-crypto'
import { createGitDigest, installGitDigest } from './gitDigest'

if (typeof globalThis.Buffer === 'undefined') {
  Object.defineProperty(globalThis, 'Buffer', { configurable: true, writable: true, value: Buffer })
}

const algorithms = {
  'SHA-1': CryptoDigestAlgorithm.SHA1,
  'SHA-256': CryptoDigestAlgorithm.SHA256,
  'SHA-384': CryptoDigestAlgorithm.SHA384,
  'SHA-512': CryptoDigestAlgorithm.SHA512,
}

// Only fills the missing digest capability; other crypto APIs retain ownership.
installGitDigest(globalThis, createGitDigest((algorithm, bytes) => digest(algorithms[algorithm], bytes)))
