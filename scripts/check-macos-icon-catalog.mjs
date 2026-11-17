import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function isCliEntryPoint(argvPath, moduleUrl) {
	return (
		argvPath !== undefined && resolve(argvPath) === fileURLToPath(moduleUrl)
	);
}

function isAppIconRendition(record, iconName) {
	return (
		record.Name === iconName &&
		record.AssetType === "Icon Image" &&
		record.Idiom === "universal" &&
		record.PixelWidth === 1024 &&
		record.PixelHeight === 1024
	);
}

function hasAppearance(record, value) {
	return record.Appearances?.some(
		(appearance) =>
			appearance.Appearance === "luminosity" && appearance.Value === value,
	);
}

function isLightRendition(record) {
	return !record.Appearances?.some(
		(appearance) => appearance.Appearance === "luminosity",
	);
}

function matchesSameRendition(light, dark) {
	return ["Idiom", "PixelWidth", "PixelHeight", "Scale", "Subtype"].every(
		(key) => light[key] === dark[key],
	);
}

export function hasDarkIconRendition(records, iconName) {
	if (!Array.isArray(records)) return false;

	const iconRenditions = records.filter((record) =>
		isAppIconRendition(record, iconName),
	);
	const lightRenditions = iconRenditions.filter(isLightRendition);

	return iconRenditions.some(
		(dark) =>
			hasAppearance(dark, "dark") &&
			lightRenditions.some((light) => matchesSameRendition(light, dark)),
	);
}

if (isCliEntryPoint(process.argv[1], import.meta.url)) {
	const [, , iconName, infoPath] = process.argv;
	if (!iconName || !infoPath) {
		throw new Error(
			"Usage: check-macos-icon-catalog.mjs <icon-name> <assetutil-info.json>",
		);
	}
	const records = JSON.parse(await readFile(infoPath, "utf8"));
	if (!hasDarkIconRendition(records, iconName)) {
		throw new Error(
			`Compiled app icon ${iconName} has no dark icon image rendition`,
		);
	}
}
