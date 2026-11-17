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
	return (
		light.Idiom === dark.Idiom &&
		light.PixelWidth === dark.PixelWidth &&
		light.PixelHeight === dark.PixelHeight &&
		light.Scale === dark.Scale &&
		light.Subtype === dark.Subtype
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
	const iconName = process.argv[2];
	if (!iconName) {
		throw new Error("Usage: check-macos-icon-catalog.mjs <icon-name>");
	}
	const input = [];
	for await (const chunk of process.stdin) input.push(chunk);
	const records = JSON.parse(Buffer.concat(input).toString("utf8"));
	if (!hasDarkIconRendition(records, iconName)) {
		throw new Error(
			`Compiled app icon ${iconName} has no dark icon image rendition`,
		);
	}
}
