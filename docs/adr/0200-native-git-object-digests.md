# 0200: Native hashing for mobile Git objects

Date: 2026-10-10
Status: Accepted for the mobile foundation branch

## Context

The 6,000-file native Git fixture exposed a CPU bottleneck not visible in the
small round-trip test. A Hermes sampling profile showed substantial JavaScript
SHA-1 and garbage-collection work. isomorphic-git uses WebCrypto's digest when
available and falls back to a JavaScript implementation otherwise.

## Decision

- Add the Expo SDK 54 compatible `expo-crypto` module and provide the missing
  `crypto.subtle.digest` operation on native platforms before Git runs.
- Preserve existing cryptography APIs, including an existing digest implementation.
  Do not claim to implement the rest of SubtleCrypto.
- Delegate supported SHA digests to the native module. Reject other algorithms.
  Preserve typed-array offsets and lengths when crossing the native boundary.
- SHA-1 is required for these Git object identifiers, not used for passwords,
  signatures, or a new security design. Git protocol and repository operations
  remain owned by isomorphic-git; there is no custom Git implementation.
- Keep web and Node runtimes on their own WebCrypto implementation.
- Reuse isomorphic-git's supported cache within one sync operation, including
  checkpoint, graph checks, fetch, checkout, and push. Discard it afterwards;
  never keep a global pack cache across vaults or accumulate history indefinitely.
- Retain a native, disposable 6,000-file benchmark alongside the fast correctness
  fixture. Measure identical workloads before and after optimizations.

## Consequences

The standalone native app must be rebuilt after adding Expo Crypto. Expo Go also
includes the module. This improves one measured hot path, not the whole sync
architecture: pack processing, checkout, release-device timings, and crash
recovery still require separate verification.

## References

- https://docs.expo.dev/versions/v54.0.0/sdk/crypto/
- isomorphic-git 1.43.3 `shasum` / `testSubtleSHA1` implementation
- https://cdpstatus.reactnative.dev/devtools-protocol/react-native-hermes/Profiler
