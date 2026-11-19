/**
 * Feature flag hook backed by PostHog + release channels.
 *
 * Flags are resolved in order:
 *   1. localStorage override (`ff_<name>`) — for dev/QA testing
 *   2. PostHog feature flags (evaluated by release channel)
 *   3. Alpha channel always returns true (sees all features)
 */

import { isFeatureEnabled } from '../lib/telemetry'

export type FeatureFlagName = 'example_flag' | 'graph_layout'

function storedOverride(flag: FeatureFlagName): boolean | null {
  try {
    const override = localStorage.getItem(`ff_${flag}`)
    return override === null ? null : override === 'true'
  } catch {
    // localStorage may be unavailable in some contexts
    return null
  }
}

/** Reads a flag outside React (registries, command builders); the hook below is the React entry point. */
export function readFeatureFlag(flag: FeatureFlagName): boolean {
  const override = storedOverride(flag)
  if (override !== null) return override
  try {
    return isFeatureEnabled(flag)
  } catch {
    // Telemetry not initialised (tests, early boot): unreleased features stay off.
    return false
  }
}

export function useFeatureFlag(flag: FeatureFlagName): boolean {
  return readFeatureFlag(flag)
}
