import { Alert, type AlertButton, Platform, Share } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { writeMobileClipboardText } from "../../workspace/mobileClipboard";

type LinkKind = "external" | "wikilink";
type LinkEvent = "mobile_note_link_copied" | "mobile_note_link_shared";

export function showMobileEditorLinkMenu(
	href: string,
	kind: LinkKind,
	onOpen: () => void,
	capture: (name: LinkEvent, kind: LinkKind) => void,
) {
	const buttons: AlertButton[] = [
		{
			text:
				kind === "external"
					? mobileText("mobile.status.open")
					: mobileText("collab.connect.submit"),
			onPress: onOpen,
		},
		{
			text: mobileText("filePreview.copyDeepLink"),
			onPress: () => {
				void writeMobileClipboardText(href)
					.then(() => capture("mobile_note_link_copied", kind))
					.catch(() => undefined);
			},
		},
	];
	if (kind === "external") buttons.push(shareButton(href, capture));
	if (Platform.OS === "ios") buttons.push(cancelButton());
	Alert.alert(href, undefined, buttons, { cancelable: true });
}

function shareButton(
	href: string,
	capture: (name: LinkEvent, kind: LinkKind) => void,
): AlertButton {
	return {
		text: mobileText("sharing.share.button"),
		onPress: () => {
			void Share.share({ message: href, url: href })
				.then(() => capture("mobile_note_link_shared", "external"))
				.catch(() => undefined);
		},
	};
}

function cancelButton(): AlertButton {
	return { text: mobileText("common.cancel"), style: "cancel" };
}
