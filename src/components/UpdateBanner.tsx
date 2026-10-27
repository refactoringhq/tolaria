import {
	Download,
	ArrowSquareOut as ExternalLink,
	ArrowsClockwise as RefreshCw,
	X,
} from "@phosphor-icons/react";
import { type CSSProperties, useEffect, useState } from "react";
import {
	CONTRIBUTION_ANALYTICS_EVENT,
	TOLARIA_DISCORD_INVITE_URL,
	TOLARIA_IOS_DOWNLOAD_URL,
} from "../constants/feedback";
import type { UpdateActions, UpdateStatus } from "../hooks/useUpdater";
import { restartApp } from "../hooks/useUpdater";
import { type AppLocale, translate } from "../lib/i18n";
import { trackEvent } from "../lib/telemetry";
import { openExternalUrl } from "../utils/url";
import { Button } from "./ui/button";

const COMMUNITY_BANNER_DISMISSED_KEY = "tolaria.community-banner.dismissed";

interface UpdateBannerProps {
	status: UpdateStatus;
	actions: UpdateActions;
	locale?: AppLocale;
}

type VisibleUpdateStatus = Exclude<UpdateStatus, { state: "idle" }>;

function isUpdateBannerVisible(
	status: UpdateStatus,
): status is VisibleUpdateStatus {
	return status.state !== "idle";
}

function readCommunityBannerDismissed(): boolean {
	try {
		return (
			window.localStorage.getItem(COMMUNITY_BANNER_DISMISSED_KEY) === "true"
		);
	} catch {
		return false;
	}
}

const bannerStyle = {
	display: "flex",
	alignItems: "center",
	gap: 10,
	padding: "6px 12px",
	background: "var(--accent-blue)",
	borderBottom: "none",
	fontSize: 13,
	color: "var(--text-inverse)",
	flexShrink: 0,
} satisfies CSSProperties;

const iconStyle = {
	color: "var(--text-inverse)",
	flexShrink: 0,
} satisfies CSSProperties;

const primaryActionStyle = {
	marginLeft: "auto",
	padding: "3px 10px",
	background: "var(--text-inverse)",
	color: "var(--accent-blue)",
	fontSize: 12,
	fontWeight: 500,
} satisfies CSSProperties;

const dismissButtonStyle = {
	color: "var(--text-inverse)",
	display: "flex",
	padding: 2,
} satisfies CSSProperties;

const progressTrackStyle = {
	flex: 1,
	maxWidth: 200,
	height: 4,
	background: "color-mix(in srgb, var(--text-inverse) 30%, transparent)",
	borderRadius: 2,
	overflow: "hidden",
} satisfies CSSProperties;

const progressTextStyle = {
	fontSize: 11,
	color: "color-mix(in srgb, var(--text-inverse) 85%, transparent)",
} satisfies CSSProperties;

const readyIconStyle = {
	color: "var(--accent-green)",
	flexShrink: 0,
} satisfies CSSProperties;

function renderAvailableContent(
	status: Extract<VisibleUpdateStatus, { state: "available" }>,
	actions: UpdateActions,
	locale: AppLocale,
) {
	return (
		<>
			<Download size={14} style={iconStyle} />
			<span>
				<strong>Tolaria {status.displayVersion}</strong>{" "}
				{translate(locale, "update.available")}
			</span>
			<Button
				type="button"
				variant="link"
				size="xs"
				data-testid="update-release-notes"
				onClick={actions.openReleaseNotes}
				style={{ color: "var(--text-inverse)", padding: 0, height: "auto" }}
			>
				{translate(locale, "update.releaseNotes")} <ExternalLink size={11} />
			</Button>
			<Button
				type="button"
				size="xs"
				data-testid="update-now-btn"
				onClick={actions.startDownload}
				style={primaryActionStyle}
			>
				{translate(locale, "update.updateNow")}
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-xs"
				data-testid="update-dismiss"
				onClick={actions.dismiss}
				style={dismissButtonStyle}
				aria-label={translate(locale, "update.dismiss")}
			>
				<X size={14} />
			</Button>
		</>
	);
}

function renderCheckingContent(locale: AppLocale) {
	return (
		<>
			<RefreshCw
				size={14}
				style={{ ...iconStyle, animation: "spin 1s linear infinite" }}
			/>
			<span>{translate(locale, "update.checking")}</span>
		</>
	);
}

function renderDownloadingContent(
	status: Extract<VisibleUpdateStatus, { state: "downloading" }>,
	locale: AppLocale,
) {
	return (
		<>
			<RefreshCw
				size={14}
				style={{ ...iconStyle, animation: "spin 1s linear infinite" }}
			/>
			<span>
				{translate(locale, "update.downloading", {
					version: status.displayVersion,
				})}
			</span>
			<div style={progressTrackStyle}>
				<div
					data-testid="update-progress"
					style={{
						width: `${Math.round(status.progress * 100)}%`,
						height: "100%",
						background: "var(--text-inverse)",
						borderRadius: 2,
						transition: "width 0.2s ease",
					}}
				/>
			</div>
			<span style={progressTextStyle}>
				{Math.round(status.progress * 100)}%
			</span>
		</>
	);
}

function renderReadyContent(
	status: Extract<VisibleUpdateStatus, { state: "ready" }>,
	locale: AppLocale,
) {
	return (
		<>
			<RefreshCw size={14} style={readyIconStyle} />
			<span>
				<strong>Tolaria {status.displayVersion}</strong>{" "}
				{translate(locale, "update.readyRestart")}
			</span>
			<Button
				type="button"
				size="xs"
				data-testid="update-restart-btn"
				onClick={restartApp}
				style={{
					...primaryActionStyle,
					background: "var(--accent-green)",
					color: "var(--text-inverse)",
				}}
			>
				{translate(locale, "update.restartNow")}
			</Button>
		</>
	);
}

function renderBannerContent(
	status: VisibleUpdateStatus,
	actions: UpdateActions,
	locale: AppLocale,
) {
	switch (status.state) {
		case "checking":
			return renderCheckingContent(locale);
		case "available":
			return renderAvailableContent(status, actions, locale);
		case "downloading":
			return renderDownloadingContent(status, locale);
		case "ready":
			return renderReadyContent(status, locale);
		case "error":
			return (
				<>
					<span>
						{translate(
							locale,
							status.kind === "check"
								? "update.error.check"
								: "update.error.download",
						)}
					</span>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						data-testid="update-dismiss"
						onClick={actions.dismiss}
						style={dismissButtonStyle}
						aria-label={translate(locale, "update.dismiss")}
					>
						<X size={14} />
					</Button>
				</>
			);
	}
}

export function UpdateBanner({
	status,
	actions,
	locale = "en",
}: UpdateBannerProps) {
	const [communityDismissed, setCommunityDismissed] = useState(
		readCommunityBannerDismissed,
	);
	const updateVisible = isUpdateBannerVisible(status);
	useEffect(() => {
		const appShell = document.querySelector<HTMLElement>(".app-shell");
		const bottomOffset = communityDismissed
			? updateVisible
				? "80px"
				: "2.75rem"
			: updateVisible
				? "124px"
				: "80px";
		appShell?.style.setProperty(
			"--ai-workspace-floating-button-bottom",
			bottomOffset,
		);
	}, [communityDismissed, updateVisible]);

	return (
		<div
			data-testid="bottom-banner-stack"
			style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}
		>
			{updateVisible && (
				<div data-testid="update-banner" style={bannerStyle}>
					{renderBannerContent(status, actions, locale)}
				</div>
			)}
			{!communityDismissed && (
				<div
					data-testid="community-banner"
					style={{
						...bannerStyle,
						background: "var(--accent-green)",
						color: "#fff",
						flexWrap: "wrap",
					}}
				>
					<span>{translate(locale, "communityBanner.invite")}</span>
					<Button
						type="button"
						variant="link"
						size="xs"
						data-testid="community-banner-ios"
						onClick={() => {
							trackEvent(CONTRIBUTION_ANALYTICS_EVENT, {
								action: "ios_download",
								surface: "bottom_banner",
							});
							void openExternalUrl(TOLARIA_IOS_DOWNLOAD_URL);
						}}
						style={{
							...primaryActionStyle,
							marginLeft: "auto",
							background: "#fff",
							color: "#176B3A",
						}}
					>
						{translate(locale, "communityBanner.ios")}
					</Button>
					<Button
						type="button"
						variant="link"
						size="xs"
						onClick={() => {
							trackEvent(CONTRIBUTION_ANALYTICS_EVENT, {
								action: "discord",
								surface: "bottom_banner",
							});
							void openExternalUrl(TOLARIA_DISCORD_INVITE_URL);
						}}
						style={{
							...primaryActionStyle,
							background: "#fff",
							color: "#176B3A",
						}}
					>
						{translate(locale, "communityBanner.joinCommunity")}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="icon-xs"
						data-testid="community-banner-dismiss"
						onClick={() => {
							try {
								window.localStorage.setItem(
									COMMUNITY_BANNER_DISMISSED_KEY,
									"true",
								);
							} catch {
								// Keep the banner dismissed for this session if storage is unavailable.
							}
							setCommunityDismissed(true);
						}}
						style={dismissButtonStyle}
						aria-label={translate(locale, "communityBanner.dismiss")}
					>
						<X size={14} />
					</Button>
				</div>
			)}
		</div>
	);
}
