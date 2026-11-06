import { type EditorBridge, useBridgeState } from "@10play/tentap-editor";
import { useEffect, useRef } from "react";
import { ScrollView, StyleSheet } from "react-native";
import { useMobileAnalytics } from "../../analytics/useMobileAnalytics";
import { MobileButton } from "../../ui/MobileButton";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import type { MobileSlashEditorBridge } from "./MobileWysiwygSlashBridge";
import type {
	MobileSlashAction,
	MobileSlashState,
} from "./MobileWysiwygSlashCommands";
import { formattingCommands } from "./mobileFormattingCommands";

export function MobileWysiwygSlashMenu({ editor }: { editor: EditorBridge }) {
	const bridgeState = useBridgeState(editor) as {
		mobileSlash?: MobileSlashState | null;
		isFocused?: boolean;
	};
	const menu = activeSlashMenu({
		focused: bridgeState.isFocused === true,
		menu: bridgeState.mobileSlash ?? null,
	});
	const analytics = useMobileAnalytics();
	const visible = Boolean(menu);
	useEffect(() => {
		if (visible)
			analytics.capture({ name: "mobile_editor_tool_opened", tool: "slash" });
	}, [analytics, visible]);
	const scroll = useRef<ScrollView>(null);
	const { styles, mobileColors, rowHeight } = useMobileStyles(createStyles);
	useEffect(() => {
		scroll.current?.scrollTo({
			y: Math.max(0, (menu?.index ?? 0) - 2) * rowHeight,
			animated: false,
		});
	}, [menu?.index, rowHeight]);
	if (!menu) return null;
	const bridge = editor as EditorBridge & MobileSlashEditorBridge;
	return (
		<ScrollView
			ref={scroll}
			style={styles.menu}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="always"
			testID="editor-slash-menu"
		>
			{menu.commands.map(({ action, label }, index) => (
				<MobileButton
					key={action}
					label={label}
					variant="ghost"
					accessibilityState={{ selected: index === menu.index }}
					icon={slashIcon(action, mobileColors.textMuted)}
					onPress={() => bridge.runMobileSlash(action)}
					testID={`editor-slash-${action}`}
					style={[styles.row, index === menu.index && styles.selected]}
				/>
			))}
		</ScrollView>
	);
}

function activeSlashMenu(state: {
	focused: boolean;
	menu: MobileSlashState | null;
}) {
	if (!state.focused || !state.menu) return null;
	return state.menu.commands.length ? state.menu : null;
}

function slashIcon(action: MobileSlashAction, color: string) {
	return (
		formattingCommands
			.find((command) => command.action === action)
			?.icon(color) ?? <ChromeSymbol name="text" size={18} color={color} />
	);
}

function createStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const rowHeight = Math.max(44, metrics.size(36));
	return {
		mobileColors,
		rowHeight,
		styles: StyleSheet.create({
			menu: {
				flexGrow: 0,
				maxHeight: rowHeight * 4,
				borderTopWidth: 1,
				borderColor: mobileColors.border,
				backgroundColor: mobileColors.popover,
			},
			content: { padding: metrics.size(4) },
			row: {
				height: rowHeight,
				justifyContent: "flex-start",
				paddingHorizontal: metrics.size(12),
			},
			selected: { backgroundColor: mobileColors.selected },
		}),
	};
}
