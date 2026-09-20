import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { Settings } from '../types'
import { SettingsPanel } from './SettingsPanel'

const settings: Settings = {
  auto_pull_interval_minutes: null,
  git_enabled: null,
  git_path: null,
  git_provider: null,
  git_wsl_distro: null,
  autogit_enabled: null,
  autogit_use_ai_commit_messages: null,
  autogit_idle_threshold_seconds: null,
  autogit_inactive_threshold_seconds: null,
  auto_advance_inbox_after_organize: null,
  telemetry_consent: null,
  crash_reporting_enabled: null,
  analytics_enabled: null,
  anonymous_id: null,
  release_channel: null,
  automatic_update_checks_enabled: null,
  theme_mode: null,
  ui_language: null,
  date_display_format: null,
  default_ai_agent: null,
  hide_gitignored_files: null,
  all_notes_show_pdfs: null,
  all_notes_show_images: null,
  all_notes_show_unsupported: null,
}

describe('SettingsPanel persisted updates', () => {
  it('keeps the mounted panel controls when persisted settings arrive', () => {
    const view = render(
      <SettingsPanel open={true} settings={settings} onSave={vi.fn()} onClose={vi.fn()} />
    )
    const initialControl = within(screen.getByTestId('settings-all-notes-show-images')).getByRole('switch')
    const scrollArea = screen.getByTestId('settings-scroll-area')
    scrollArea.scrollTop = 420

    view.rerender(
      <SettingsPanel
        open={true}
        settings={{ ...settings, all_notes_show_images: true }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    )

    expect(within(screen.getByTestId('settings-all-notes-show-images')).getByRole('switch')).toBe(initialControl)
    expect(screen.getByTestId('settings-scroll-area')).toBe(scrollArea)
    expect(scrollArea.scrollTop).toBe(420)
  })
})
