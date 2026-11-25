import { DiscordLogo } from "@phosphor-icons/react";
import { type CSSProperties, useEffect, useState } from "react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import {
	CONTRIBUTION_ANALYTICS_EVENT,
	TOLARIA_DISCORD_INVITE_URL,
} from "../constants/feedback";
import type { McpStatus } from "../hooks/useMcpStatus";
import { useTouchInput } from "../hooks/useTouchInput";
import { type AppLocale, translate } from "../lib/i18n";
import { trackEvent } from "../lib/telemetry";
import type { ThemeMode } from "../lib/themeMode";
import type { GitRemoteStatus, SyncStatus } from "../types";
import type { GitRepositoryOption } from "../utils/gitRepositories";
import { openExternalUrl } from "../utils/url";
import { SharingStatusButton } from "./sharing/SharingStatusButton";
import {
	StatusBarPrimarySection,
	StatusBarSecondarySection,
} from "./status-bar/StatusBarSections";
import { isRemoteBrowserShell } from "./status-bar/syncPillState";
import type { VaultOption } from "./status-bar/types";
import { WebSyncPill } from "./status-bar/WebSyncPill";

export type { VaultOption } from "./status-bar/types";

const COMPACT_STATUS_BAR_MAX_WIDTH = 1000;
const STATUS_BAR_STACKING_Z_INDEX = 30;

const STACKED_FOOTER_LAYOUT: CSSProperties = {
	height: "auto",
	flexWrap: "wrap",
	alignItems: "flex-start",
	justifyContent: "flex-start",
	rowGap: 4,
	padding: "4px 8px",
};

const ROW_FOOTER_LAYOUT: CSSProperties = {
	height: 30,
	flexWrap: "nowrap",
	alignItems: "center",
	justifyContent: "space-between",
	rowGap: 0,
	padding: "0 8px",
};

function getWindowWidth() {
	return typeof window === "undefined"
		? Number.POSITIVE_INFINITY
		: window.innerWidth;
}

function getStatusBarLayout(windowWidth: number) {
	const compact = windowWidth <= COMPACT_STATUS_BAR_MAX_WIDTH;

	return {
		compact,
		stacked: false,
	};
}

function useStatusBarTicker() {
	const [, setTick] = useState(0);

	useEffect(() => {
		const id = setInterval(() => setTick((tick) => tick + 1), 30_000);
		return () => clearInterval(id);
	}, []);
}

function useStatusBarLayout() {
	const [windowWidth, setWindowWidth] = useState(() => getWindowWidth());

	useEffect(() => {
		if (typeof window === "undefined") return;

		const handleResize = () => setWindowWidth(getWindowWidth());

		window.addEventListener("resize", handleResize);
		return () => window.removeEventListener("resize", handleResize);
	}, []);

	return getStatusBarLayout(windowWidth);
}

interface StatusBarProps {
	noteCount: number;
	modifiedCount?: number;
	vaultPath: string;
	defaultWorkspacePath?: string | null;
	vaults: VaultOption[];
	multiWorkspaceEnabled?: boolean;
	onSwitchVault: (path: string) => void;
	onSetDefaultWorkspace?: (path: string) => void;
	onOpenSettings?: () => void;
	onOpenVaultSettings?: () => void;
	onOpenLocalFolder?: () => void;
	onCreateEmptyVault?: () => void;
	onCloneVault?: () => void;
	onCloneGettingStarted?: () => void;
	onClickPending?: () => void;
	onClickPulse?: () => void;
	onCommitPush?: () => void;
	commitActionPending?: boolean;
	gitFeaturesEnabled?: boolean;
	onInitializeGit?: () => void;
	isOffline?: boolean;
	isVaultReloading?: boolean;
	isGitVault?: boolean;
	syncStatus?: SyncStatus;
	lastSyncTime?: number | null;
	conflictCount?: number;
	remoteStatus?: GitRemoteStatus | null;
	repositories?: GitRepositoryOption[];
	selectedRepositoryPath?: string;
	onRepositoryChange?: (path: string) => void;
	onTriggerSync?: () => void;
	onPullAndPush?: () => void;
	onOpenConflictResolver?: () => void;
	zoomLevel?: number;
	themeMode?: ThemeMode;
	onZoomReset?: () => void;
	onToggleThemeMode?: () => void;
	onOpenFeedback?: () => void;
	onOpenDocs?: () => void;
	buildNumber?: string;
	onCheckForUpdates?: () => void;
	onRemoveVault?: (path: string) => void;
	onReorderVaults?: (orderedPaths: string[]) => void;
	onUpdateWorkspaceIdentity?: (
		path: string,
		patch: Partial<VaultOption>,
	) => void;
	aiFeaturesEnabled?: boolean;
	mcpStatus?: McpStatus;
	onInstallMcp?: () => void;
	locale?: AppLocale;
}

interface StatusBarFooterProps extends StatusBarProps {
	compact: boolean;
	stacked: boolean;
	/** The web build: one sync pill stands in for the git controls. */
	webSync: boolean;
	/** A finger drives the web build: the bar grows around its 44 px targets (TOL-419). */
	touchInput: boolean;
}

function webSyncPill({
	webSync,
	isOffline,
	isVaultReloading,
	locale = "en",
}: StatusBarFooterProps) {
	if (!webSync) return undefined;
	return (
		<WebSyncPill
			isOffline={isOffline === true}
			isReloading={isVaultReloading === true}
			locale={locale}
		/>
	);
}

function StatusBarPrimaryFromFooter(options: StatusBarFooterProps) {
	return (
		<StatusBarPrimarySection
			{...options}
			modifiedCount={options.modifiedCount ?? 0}
			syncStatus={options.syncStatus ?? "idle"}
			lastSyncTime={options.lastSyncTime ?? null}
			conflictCount={options.conflictCount ?? 0}
			mcpStatus={
				options.aiFeaturesEnabled === false ? undefined : options.mcpStatus
			}
			syncPill={webSyncPill(options)}
		/>
	);
}

function StatusBarDiscordButton({ locale }: { locale: AppLocale }) {
	return (
		<ActionTooltip
			copy={{ label: translate(locale, "feedback.community.title") }}
			side="top"
			align="end"
		>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				className="text-muted-foreground hover:bg-[var(--hover)] hover:text-foreground"
				onClick={() => {
					trackEvent(CONTRIBUTION_ANALYTICS_EVENT, {
						action: "discord",
						surface: "status_bar",
					});
					void openExternalUrl(TOLARIA_DISCORD_INVITE_URL);
				}}
				aria-label={translate(locale, "feedback.community.title")}
				data-testid="status-discord"
			>
				<DiscordLogo size={14} weight="regular" />
			</Button>
		</ActionTooltip>
	);
}

function StatusBarSecondaryFromFooter(options: StatusBarFooterProps) {
	const {
		noteCount,
		zoomLevel = 100,
		themeMode = "light",
		onZoomReset,
		onToggleThemeMode,
		onOpenFeedback,
		onOpenDocs,
		onOpenSettings,
		locale = "en",
		compact,
		stacked,
		webSync,
	} = options;
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				justifyContent: "flex-end",
				gap: 4,
				width: stacked ? "100%" : "auto",
			}}
		>
			{webSync && <SharingStatusButton locale={locale} />}
			<StatusBarSecondarySection
				noteCount={noteCount}
				zoomLevel={zoomLevel}
				themeMode={themeMode}
				onZoomReset={onZoomReset}
				onToggleThemeMode={onToggleThemeMode}
				onOpenFeedback={onOpenFeedback}
				onOpenDocs={onOpenDocs}
				onOpenSettings={onOpenSettings}
				locale={locale}
				stacked={stacked}
				compact={compact}
			/>
			<StatusBarDiscordButton locale={locale} />
		</div>
	);
}

function footerLayout({
	stacked,
	touchInput,
}: Pick<StatusBarFooterProps, "stacked" | "touchInput">): CSSProperties {
	const layout = stacked ? STACKED_FOOTER_LAYOUT : ROW_FOOTER_LAYOUT;
	return touchInput ? { ...layout, height: "auto" } : layout;
}

function StatusBarFooter(props: StatusBarFooterProps) {
	return (
		<footer
			data-testid="status-bar"
			style={{
				...footerLayout(props),
				minHeight: 30,
				flexShrink: 0,
				display: "flex",
				columnGap: props.compact ? 8 : 12,
				background: "var(--sidebar)",
				borderTop: "1px solid var(--border)",
				fontSize: 12,
				color: "var(--muted-foreground)",
				position: "relative",
				zIndex: STATUS_BAR_STACKING_Z_INDEX,
			}}
		>
			<StatusBarPrimaryFromFooter {...props} />
			<StatusBarSecondaryFromFooter {...props} />
		</footer>
	);
}

export function StatusBar(props: StatusBarProps) {
	useStatusBarTicker();
	const { compact, stacked } = useStatusBarLayout();
	const [webSync] = useState(isRemoteBrowserShell);
	const touchInput = useTouchInput();

	return (
		<TooltipProvider>
			<StatusBarFooter
				{...props}
				compact={compact}
				stacked={stacked}
				webSync={webSync}
				touchInput={touchInput}
			/>
		</TooltipProvider>
	);
}
