import { useState } from "react";
import { Image, StyleSheet } from "react-native";
import { isEmoji } from "../../../../../src/utils/emoji";
import { useMobileColors } from "../../ui/theme/useMobileTheme";
import type {
	MobileFileKind,
	MobileTone,
	MobileTypeDefinitions,
} from "../../workspace/mobileWorkspaceModel";
import { Text } from "../ui/text";
import {
	mobileTypeConfiguredIcon,
	mobileTypeIconCandidates,
} from "./MobileWorkspaceIconNames";
import {
	mobilePhosphorIconElement,
	requiredMobilePhosphorIcon,
} from "./MobileWorkspaceIconResolver";
import { noteTypeColor } from "./mobileWorkspaceTone";

export function MobileTypeIcon({
	size,
	tone,
	type,
	typeDefinitions,
	fileKind,
}: {
	fileKind?: MobileFileKind;
	size: number;
	tone: MobileTone;
	type: string;
	typeDefinitions: MobileTypeDefinitions | null | undefined;
}) {
	const colors = useMobileColors();
	const color = noteTypeColor(tone, colors);

	if (fileKind === "binary") {
		return <FileDashedIcon color={color} size={size} />;
	}

	if (fileKind === "text") {
		return <FileTextIcon color={color} size={size} />;
	}

	for (const icon of mobileTypeIconCandidates(
		type,
		mobileTypeConfiguredIcon(type, typeDefinitions),
	)) {
		const iconElement = mobilePhosphorIconElement(icon, { color, size });
		if (iconElement) return iconElement;
	}

	return <FileTextIcon color={color} size={size} />;
}

export function MobileNoteIcon({
	color,
	icon,
	size,
	testID,
}: {
	color: string;
	icon: string | null | undefined;
	size: number;
	testID?: string;
}) {
	const trimmedIcon = icon?.trim();
	if (!trimmedIcon) return null;

	if (isEmoji(trimmedIcon)) {
		return (
			<Text
				numberOfLines={1}
				style={[styles.noteIconText, { fontSize: size, lineHeight: size + 2 }]}
				testID={testID}
			>
				{trimmedIcon}
			</Text>
		);
	}

	if (isRemoteIcon(trimmedIcon))
		return (
			<MobileRemoteNoteIcon src={trimmedIcon} size={size} testID={testID} />
		);

	return mobileNoteIconElement(trimmedIcon, { color, size, testID });
}

function MobileRemoteNoteIcon({
	src,
	size,
	testID,
}: {
	src: string;
	size: number;
	testID?: string;
}) {
	const [failed, setFailed] = useState(false);
	if (failed) return null;

	return (
		<Image
			accessible={false}
			onError={() => setFailed(true)}
			resizeMode="cover"
			source={{ uri: src }}
			style={[styles.noteIconImage, { width: size, height: size }]}
			testID={testID}
		/>
	);
}

function mobileNoteIconElement(
	icon: string,
	props: {
		color: string;
		size: number;
		testID?: string;
	},
) {
	return mobilePhosphorIconElement(icon, props);
}

function isRemoteIcon(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

const FileTextIcon = requiredMobilePhosphorIcon("filetext");
const FileDashedIcon = requiredMobilePhosphorIcon("filedashed");

const styles = StyleSheet.create({
	noteIconImage: {
		borderRadius: 2,
		flexShrink: 0,
	},
	noteIconText: {
		flexShrink: 0,
		minWidth: 0,
	},
});
