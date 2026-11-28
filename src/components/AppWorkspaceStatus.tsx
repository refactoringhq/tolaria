import type { ComponentProps } from 'react'
import { DesktopAddRemoteDialog } from './DesktopAddRemoteDialog'
import { GitSetupDialog } from './GitRequiredModal'
import { RenameDetectedBanner } from './RenameDetectedBanner'
import { StatusBar } from './StatusBar'
import { UpdateBanner } from './UpdateBanner'

type StatusBarProps = ComponentProps<typeof StatusBar>
type UpdateBannerProps = ComponentProps<typeof UpdateBanner>

interface AppWorkspaceStatusProps {
  desktopSidebar: boolean
  primaryDesktopWindow: boolean
  statusBar: StatusBarProps
  vaultReloading: boolean
  vaultContentLoading: boolean
  settingsLoaded: boolean
  updaterAvailable: boolean
  update: UpdateBannerProps
  rename: ComponentProps<typeof RenameDetectedBanner>
  gitFeaturesEnabled: boolean
  addRemote: ComponentProps<typeof DesktopAddRemoteDialog>
  gitSetup: ComponentProps<typeof GitSetupDialog>
}

function WorkspaceBanners({ updaterAvailable, update, rename }: Pick<
  AppWorkspaceStatusProps, 'updaterAvailable' | 'update' | 'rename'
>) {
  return (
    <div data-testid="app-bottom-banner-stack" style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
      {updaterAvailable && <UpdateBanner {...update} />}
      <RenameDetectedBanner {...rename} />
    </div>
  )
}

function WorkspaceStatusBar({ desktopSidebar, settingsLoaded, statusBar, vaultReloading, vaultContentLoading }: Pick<
  AppWorkspaceStatusProps, 'desktopSidebar' | 'settingsLoaded' | 'statusBar' | 'vaultReloading' | 'vaultContentLoading'
>) {
  if (desktopSidebar) return null
  return (
    <StatusBar
      {...statusBar}
      isVaultReloading={vaultReloading || vaultContentLoading}
      onToggleThemeMode={settingsLoaded ? statusBar.onToggleThemeMode : undefined}
    />
  )
}

function WorkspaceGitDialogs({ primaryDesktopWindow, gitFeaturesEnabled, addRemote, gitSetup }: Pick<
  AppWorkspaceStatusProps, 'primaryDesktopWindow' | 'gitFeaturesEnabled' | 'addRemote' | 'gitSetup'
>) {
  return (
    <>
      {primaryDesktopWindow && (
        <DesktopAddRemoteDialog
          {...addRemote}
          key={addRemote.vaultPath}
          isGitVault={gitFeaturesEnabled && addRemote.isGitVault}
        />
      )}
      <GitSetupDialog {...gitSetup} open={gitFeaturesEnabled && gitSetup.open} />
    </>
  )
}

export function AppWorkspaceStatus(props: AppWorkspaceStatusProps) {
  return (
    <>
      <WorkspaceBanners updaterAvailable={props.updaterAvailable} update={props.update} rename={props.rename} />
      <WorkspaceStatusBar
        desktopSidebar={props.desktopSidebar}
        statusBar={props.statusBar}
        settingsLoaded={props.settingsLoaded}
        vaultReloading={props.vaultReloading}
        vaultContentLoading={props.vaultContentLoading}
      />
      <WorkspaceGitDialogs
        primaryDesktopWindow={props.primaryDesktopWindow}
        gitFeaturesEnabled={props.gitFeaturesEnabled}
        addRemote={props.addRemote}
        gitSetup={props.gitSetup}
      />
    </>
  )
}
