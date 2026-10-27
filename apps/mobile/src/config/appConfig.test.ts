import { createRequire } from 'node:module'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { ExpoConfig } from 'expo/config'
import manifest from '../../app.json'

const require = createRequire(import.meta.url)
const configure: (context: { config: typeof manifest.expo }) => ExpoConfig = require('../../app.config.js')

beforeEach(() => {
  vi.stubEnv('TOLARIA_BUILD_PROFILE', undefined)
  vi.stubEnv('TOLARIA_IOS_BUILD_NUMBER', undefined)
  vi.stubEnv('TOLARIA_UPDATE_CHANNEL', undefined)
  vi.stubEnv('EXPO_PUBLIC_POSTHOG_HOST', undefined)
  vi.stubEnv('VITE_POSTHOG_HOST', undefined)
  vi.stubEnv('EXPO_PUBLIC_DISTRIBUTION', 'testflight')
  vi.stubEnv('EXPO_PUBLIC_RELEASE_CHANNEL', 'alpha')
})

afterEach(() => vi.unstubAllEnvs())

function configuredApp() {
  return configure({ config: structuredClone(manifest.expo) })
}

function testFlight(build = '1') {
  vi.stubEnv('TOLARIA_BUILD_PROFILE', 'testflight')
  vi.stubEnv('TOLARIA_IOS_BUILD_NUMBER', build)
  return configuredApp()
}

it('enables the supported scene lifecycle for native builds', () => {
  expect(configuredApp().plugins).toContainEqual(['expo-build-properties', {
    ios: { enableSceneSupport: true },
  }])
  expect(testFlight().plugins).toContainEqual(['expo-build-properties', {
    ios: { enableSceneSupport: true },
  }])
})

it('preserves other config plugins when enabling scene support', () => {
  const config = { ...structuredClone(manifest.expo), plugins: ['expo-asset'] }
  expect(configure({ config }).plugins).toContain('expo-asset')
})

it('defaults mobile PostHog ingestion to the desktop US project region', () => {
  expect(configuredApp().extra?.telemetry?.posthogHost).toBe('https://us.i.posthog.com')
})

it('prefers the explicit Expo host and falls back to the Vite host', () => {
  vi.stubEnv('VITE_POSTHOG_HOST', 'https://vite.example.com')
  expect(configuredApp().extra?.telemetry?.posthogHost).toBe('https://vite.example.com')

  vi.stubEnv('EXPO_PUBLIC_POSTHOG_HOST', 'https://expo.example.com')
  expect(configuredApp().extra?.telemetry?.posthogHost).toBe('https://expo.example.com')
})

it.each([undefined, 'development'])('preserves the development sandbox for profile %s', (profile) => {
  vi.stubEnv('TOLARIA_BUILD_PROFILE', profile)
  vi.stubEnv('TOLARIA_IOS_BUILD_NUMBER', '99')
  const app = configuredApp()
  expect(app.ios).toEqual(manifest.expo.ios)
  expect(app.android).toEqual(manifest.expo.android)
})

it('uses the approved production identity without losing native settings', () => {
  const app = testFlight('42')
  expect(app.ios).toEqual({
    ...manifest.expo.ios,
    bundleIdentifier: 'md.tolaria.mobile',
    appleTeamId: 'D84V3C272P',
    buildNumber: '42',
  })
  expect(app.name).toBe('Tolaria')
  expect(app.android).toEqual(manifest.expo.android)
  expect(manifest.expo.ios.bundleIdentifier).toBe('com.tolaria.mobile.dev')
})

it.each([undefined, '', '0', '-1', '01', '1.2', '1e2', ' 1 ', '10000'])('rejects invalid TestFlight build number %s', (build) => {
  vi.stubEnv('TOLARIA_BUILD_PROFILE', 'testflight')
  vi.stubEnv('TOLARIA_IOS_BUILD_NUMBER', build)
  expect(configuredApp).toThrow('TOLARIA_IOS_BUILD_NUMBER')
})

it('refuses unknown profiles instead of silently building the development app', () => {
  vi.stubEnv('TOLARIA_BUILD_PROFILE', 'testfligth')
  expect(configuredApp).toThrow('TOLARIA_BUILD_PROFILE')
})

it.each(['EXPO_PUBLIC_DISTRIBUTION', 'EXPO_PUBLIC_RELEASE_CHANNEL'])('refuses incorrect TestFlight attribution in %s', (key) => {
  vi.stubEnv(key, 'internal')
  expect(() => testFlight()).toThrow(key)
})

it('keeps signing and upload secrets out of the public application manifest', () => {
  vi.stubEnv('SENTRY_AUTH_TOKEN', 'private-upload-placeholder')
  vi.stubEnv('ASC_API_KEY', 'private-signing-placeholder')
  const serialized = JSON.stringify(testFlight())
  expect(serialized).not.toContain('private-upload-placeholder')
  expect(serialized).not.toContain('private-signing-placeholder')
})

it('links the approved EAS project without activating updates in development', () => {
  const app = configuredApp()
  expect(app.owner).toBe('refactoring')
  expect(app.extra?.eas?.projectId).toBe('ec8f7035-5dea-4264-8e40-8cdf0d5cb377')
  expect(app.updates?.enabled).toBe(false)
  expect(app.runtimeVersion).toEqual({ policy: 'fingerprint' })
})

it('downloads alpha updates without blocking launch or disabling embedded recovery', () => {
  expect(testFlight().updates).toEqual({
    enabled: true,
    url: 'https://u.expo.dev/ec8f7035-5dea-4264-8e40-8cdf0d5cb377',
    requestHeaders: { 'expo-channel-name': 'alpha' },
    checkAutomatically: 'ON_LOAD',
    fallbackToCacheTimeout: 0,
    useEmbeddedUpdate: true,
    disableAntiBrickingMeasures: false,
  })
})

it('isolates OTA acceptance from every existing development and release vault container', () => {
  vi.stubEnv('TOLARIA_BUILD_PROFILE', 'ota-validation')
  vi.stubEnv('TOLARIA_UPDATE_CHANNEL', 'ota-validation')
  const app = configuredApp()
  expect(app.ios?.bundleIdentifier).toBe('md.tolaria.mobile.ota-validation')
  expect(app.android?.package).toBe('md.tolaria.mobile.ota_validation')
  expect(app.updates?.requestHeaders).toEqual({ 'expo-channel-name': 'ota-validation' })
})

it('rejects accidental cross-channel publishing from a TestFlight build profile', () => {
  vi.stubEnv('TOLARIA_UPDATE_CHANNEL', 'stable')
  expect(() => testFlight()).toThrow('TOLARIA_UPDATE_CHANNEL')
})

it('keeps JavaScript-only validation markers out of the native fingerprint configuration', () => {
  vi.stubEnv('TOLARIA_BUILD_PROFILE', 'ota-validation')
  const embedded = configuredApp()
  vi.stubEnv('EXPO_PUBLIC_OTA_VALIDATION_MARKER', 'update-b')
  expect(JSON.stringify(configuredApp())).toBe(JSON.stringify(embedded))
  expect(embedded.extra?.otaValidationMarker).toBeUndefined()
})
