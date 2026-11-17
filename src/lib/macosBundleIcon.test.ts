import { relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";
import circleCiConfig from "../../.circleci/config.yml?raw";
import {
	hasDarkIconRendition,
	isCliEntryPoint,
} from "../../scripts/check-macos-icon-catalog.mjs";
import iconConfig from "../../src-tauri/icons/Tolaria.icon/icon.json";
import tauriConfig from "../../src-tauri/tauri.conf.json";

describe("macOS bundled app icon", () => {
	it("recognizes the CLI when Node receives a relative script path", () => {
		const scriptPath = resolve(
			process.cwd(),
			"scripts/check-macos-icon-catalog.mjs",
		);
		expect(
			isCliEntryPoint(
				relative(process.cwd(), scriptPath),
				pathToFileURL(scriptPath).href,
			),
		).toBe(true);
	});

	it("requires matching light and dark app icon renditions", () => {
		const light = {
			AssetType: "Icon Image",
			Name: "Tolaria",
			Idiom: "universal",
			PixelWidth: 1024,
			PixelHeight: 1024,
			Scale: 1,
			Subtype: 0,
		};
		const dark = {
			...light,
			Appearances: [{ Appearance: "luminosity", Value: "dark" }],
		};
		const undersizedLight = { ...light, PixelWidth: 512, PixelHeight: 512 };
		const undersizedDark = {
			...undersizedLight,
			Appearances: [{ Appearance: "luminosity", Value: "dark" }],
		};
		expect(hasDarkIconRendition([light, dark], "Tolaria")).toBe(true);
		expect(
			hasDarkIconRendition([undersizedLight, undersizedDark], "Tolaria"),
		).toBe(false);
		expect(
			hasDarkIconRendition([light, { ...dark, Idiom: "iphone" }], "Tolaria"),
		).toBe(false);
		expect(
			hasDarkIconRendition([light, { ...dark, PixelWidth: 512 }], "Tolaria"),
		).toBe(false);
		expect(
			hasDarkIconRendition([light, { ...dark, PixelHeight: 512 }], "Tolaria"),
		).toBe(false);
		expect(
			hasDarkIconRendition([light, { ...dark, Idiom: "mac" }], "Tolaria"),
		).toBe(false);
		expect(
			hasDarkIconRendition([light, { ...dark, Name: "OtherIcon" }], "Tolaria"),
		).toBe(false);
		expect(
			hasDarkIconRendition(
				[
					light,
					{
						...dark,
						Appearances: [{ Appearance: "luminosity", Value: "light" }],
					},
				],
				"Tolaria",
			),
		).toBe(false);
	});

	it("uses CircleCI's documented Xcode image and checks the compiled icon catalog", () => {
		expect(circleCiConfig).toMatch(
			/macos:\s*\n\s*# CircleCI lists this Xcode image for m4pro\.medium[\s\S]*?xcode:\s+16\.4\.0\s+resource_class:\s+m4pro\.medium/,
		);
		expect(circleCiConfig).toContain(
			'"$assetutil" --info "$app_path/Contents/Assets.car"',
		);
		expect(circleCiConfig).toContain(
			'node scripts/check-macos-icon-catalog.mjs "$icon_name"',
		);
	});

	it("configures light and dark artwork in the appearance-aware icon package", () => {
		const config = tauriConfig as { bundle: { icon: string[] } };
		const iconPath = "icons/Tolaria.icon";
		expect(config.bundle.icon).toContain(iconPath);

		const icon = iconConfig as {
			groups: {
				layers: {
					"image-name-specializations"?: {
						appearance?: string;
						value: string;
					}[];
				}[];
			}[];
		};
		const layers = icon.groups.flatMap((group) => group.layers);
		const variants = layers.flatMap(
			(layer) => layer["image-name-specializations"] ?? [],
		);
		const lightArtwork = variants.find((variant) => !variant.appearance);
		const darkArtwork = variants.find(
			(variant) => variant.appearance === "dark",
		);

		expect(lightArtwork).toBeDefined();
		expect(lightArtwork?.value).toBe("Tolaria-Light.png");
		expect(darkArtwork).toBeDefined();
		expect(darkArtwork?.value).toBe("Tolaria-Dark.png");
	});
});
