export type DesktopPlatform = "macOS" | "Windows" | "Linux";

export function detectDesktopPlatform(
	userAgent: string,
): DesktopPlatform | null {
	if (/iPhone|iPad|Android/i.test(userAgent)) return null;
	if (/Windows/i.test(userAgent)) return "Windows";
	if (/Linux/i.test(userAgent)) return "Linux";
	if (/Macintosh|Mac OS X/i.test(userAgent)) return "macOS";
	return null;
}

export function alsoOnPlatforms(
	platform: DesktopPlatform | null,
): DesktopPlatform[] {
	return (["macOS", "Windows", "Linux"] as const).filter(
		(name) => name !== platform,
	);
}

export function formatPlatformList(platforms: DesktopPlatform[]): string {
	const labels = platforms.map((platform) =>
		platform === "macOS" ? platform : `${platform} (early support)`,
	);
	if (labels.length < 3) return labels.join(" and ");
	return `${labels.slice(0, -1).join(", ")}, and ${labels.at(-1)}`;
}
