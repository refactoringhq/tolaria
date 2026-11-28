import { describe, expect, it } from "vitest";
import {
	alsoOnPlatforms,
	detectDesktopPlatform,
	formatPlatformList,
} from "./hero-platform";

const cases = [
	{
		name: "Linux",
		userAgent:
			"Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
		platform: "Linux",
		expected: ["macOS", "Windows"],
	},
	{
		name: "Windows",
		userAgent:
			"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36",
		platform: "Windows",
		expected: ["macOS", "Linux"],
	},
	{
		name: "macOS",
		userAgent:
			"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15",
		platform: "macOS",
		expected: ["Windows", "Linux"],
	},
	{
		name: "iPhone",
		userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)",
		platform: null,
		expected: ["macOS", "Windows", "Linux"],
	},
	{
		name: "iPad",
		userAgent: "Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)",
		platform: null,
		expected: ["macOS", "Windows", "Linux"],
	},
	{
		name: "Android",
		userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9)",
		platform: null,
		expected: ["macOS", "Windows", "Linux"],
	},
	{
		name: "unknown",
		userAgent: "Mozilla/5.0 (X11; FreeBSD amd64)",
		platform: null,
		expected: ["macOS", "Windows", "Linux"],
	},
] as const;

describe("landing hero platform copy", () => {
	it.each(cases)(
		"shows only platforms other than the detected platform on $name",
		({ userAgent, platform: expectedPlatform, expected }) => {
			const platform = detectDesktopPlatform(userAgent);
			const alsoOn = alsoOnPlatforms(platform);

			expect(platform).toBe(expectedPlatform);
			expect(platform ? `Download for ${platform}` : "Get Tolaria").toBe(
				expectedPlatform ? `Download for ${expectedPlatform}` : "Get Tolaria",
			);
			expect(alsoOn).toEqual(expected);
			expect(alsoOn).not.toContain(platform);
			expect(alsoOn).toHaveLength(expected.length);
			const expectedLabels = expected.map((name) =>
				name === "macOS" ? name : `${name} (early support)`,
			);
			const expectedLine =
				expectedLabels.length < 3
					? expectedLabels.join(" and ")
					: `${expectedLabels.slice(0, -1).join(", ")}, and ${expectedLabels.at(-1)}`;
			expect(formatPlatformList(alsoOn)).toBe(expectedLine);
		},
	);
});
