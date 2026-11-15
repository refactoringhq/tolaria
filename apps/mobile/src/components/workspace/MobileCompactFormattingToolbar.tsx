import {
	CaretDown,
	Check,
	DotsThree,
	Keyboard as KeyboardIcon,
	ListBullets,
	Plus,
	Table,
	TextH,
} from "phosphor-react-native";
import type { ReactNode } from "react";
import { Keyboard, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileText } from "../../i18n/mobileText";
import { type MobileLayoutProbe, probeProps } from "../../qa/mobileLayoutProbe";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { useMobileKeyboardInset } from "../../ui/useMobileBottomInset";
import type { MobileMarkdownFormatAction } from "../../workspace/mobileMarkdownFormatting";
import { Button } from "../ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Text } from "../ui/text";
import {
	type FormattingCommand,
	formattingCommands,
} from "./mobileFormattingCommands";
import {
	formattingToolbarGroups,
	formattingToolbarTouchSize,
} from "./mobileFormattingToolbarModel";
import {
	mobilePaneFooterFrame,
	mobilePaneFooterRowHeight,
} from "./mobilePaneFooterLayout";

type Props = {
	actions: readonly MobileMarkdownFormatAction[];
	selected: MobileMarkdownFormatAction[];
	inTable: boolean;
	onFormat: (action: MobileMarkdownFormatAction) => void;
	onDismissKeyboard?: () => void;
	layoutProbe?: MobileLayoutProbe;
	metricId?: string;
};

const menus = {
	headings: { icon: TextH, label: "editor.formatting.headings" },
	lists: { icon: ListBullets, label: "editor.formatting.lists" },
	insert: { icon: Plus, label: "editor.formatting.insert" },
	more: { icon: DotsThree, label: "editor.formatting.more" },
	table: { icon: Table, label: "editor.formatting.table" },
} as const;
const commands = new Map(
	formattingCommands.map((command) => [command.action, command]),
);

export function MobileCompactFormattingToolbar(props: Props) {
	const { styles } = useMobileStyles(createThemeStyles);
	const { bottom } = useSafeAreaInsets();
	const { keyboardVisible } = useMobileKeyboardInset();
	const groups = formattingToolbarGroups(props.actions, props.inTable);
	return (
		<View
			style={[styles.container, mobilePaneFooterFrame(bottom)]}
			testID="editor-formatting-toolbar"
			{...metricProps(props)}
		>
			<ToolbarActions
				groups={groups}
				toolbar={props}
				keyboardVisible={keyboardVisible}
			/>
		</View>
	);
}

function ToolbarActions({
	groups,
	toolbar,
	keyboardVisible,
}: {
	groups: ReturnType<typeof formattingToolbarGroups>;
	toolbar: Props;
	keyboardVisible: boolean;
}) {
	return (
		<>
			<ScrollableActions groups={groups} toolbar={toolbar} />
			<FixedActions
				groups={groups}
				toolbar={toolbar}
				keyboardVisible={keyboardVisible}
			/>
		</>
	);
}

function ScrollableActions({
	groups,
	toolbar,
}: {
	groups: ReturnType<typeof formattingToolbarGroups>;
	toolbar: Props;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<ScrollView
			horizontal
			accessibilityLabel={mobileText("editor.formatting.toolbar")}
			keyboardShouldPersistTaps="always"
			showsHorizontalScrollIndicator={false}
			contentContainerStyle={styles.row}
			style={styles.viewport}
			testID="editor-formatting-actions"
		>
			{groups.primary.map((action) => (
				<View
					key={action}
					{...metricProps(toolbar, `action.${action}`)}
					style={styles.action}
				>
					<PrimaryAction
						command={commands.get(action)}
						selected={toolbar.selected.includes(action)}
						onFormat={toolbar.onFormat}
					/>
				</View>
			))}
			{(["headings", "lists", "table"] as const).map((group) =>
				groups[group].length ? (
					<FormattingMenu
						key={group}
						group={group}
						actions={groups[group]}
						toolbar={toolbar}
					/>
				) : null,
			)}
		</ScrollView>
	);
}

function FixedActions({
	groups,
	toolbar,
	keyboardVisible,
}: {
	groups: ReturnType<typeof formattingToolbarGroups>;
	toolbar: Props;
	keyboardVisible: boolean;
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.fixedActions} testID="editor-formatting-fixed-actions">
			{(["insert", "more"] as const).map((group) =>
				groups[group].length ? (
					<FormattingMenu
						key={group}
						group={group}
						actions={groups[group]}
						toolbar={toolbar}
					/>
				) : null,
			)}
			{keyboardVisible && (
				<Button
					accessibilityLabel={mobileText("editor.formatting.hideKeyboard")}
					variant="ghost"
					size="icon"
					style={styles.action}
					testID="editor-hide-keyboard-action"
					onPress={() => (toolbar.onDismissKeyboard ?? Keyboard.dismiss)()}
				>
					<KeyboardIcon size={24} color={mobileColors.textMuted} />
					<CaretDown size={10} color={mobileColors.textMuted} />
				</Button>
			)}
		</View>
	);
}

function PrimaryAction({
	command,
	selected,
	onFormat,
}: {
	command: FormattingCommand | undefined;
	selected: boolean;
	onFormat: Props["onFormat"];
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	if (!command) return null;
	return (
		<Button
			accessibilityLabel={command.label}
			accessibilityState={{ selected }}
			variant="ghost"
			size="icon"
			style={[styles.action, selected && styles.selected]}
			testID={command.testID}
			onPress={() => onFormat(command.action)}
		>
			{command.icon(selected ? mobileColors.primary : mobileColors.textMuted)}
		</Button>
	);
}

function FormattingMenu({
	group,
	actions,
	toolbar,
}: {
	group: keyof typeof menus;
	actions: MobileMarkdownFormatAction[];
	toolbar: Props;
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const menu = menus[group];
	const selected = actions.some((action) => toolbar.selected.includes(action));
	const Icon = menu.icon;
	return (
		<View {...metricProps(toolbar, `group.${group}`)} style={styles.action}>
			<DropdownMenu>
				<DropdownMenuTrigger
					accessibilityLabel={mobileText(menu.label)}
					style={StyleSheet.flatten([
						styles.action,
						selected && styles.selected,
					])}
					testID={`editor-format-menu-${group}`}
				>
					<Icon
						size={24}
						color={selected ? mobileColors.primary : mobileColors.textMuted}
					/>
				</DropdownMenuTrigger>
				<DropdownMenuContent testID={`editor-format-options-${group}`}>
					{actions.map((action) => (
						<FormattingMenuItem
							key={action}
							command={commands.get(action)}
							selected={toolbar.selected.includes(action)}
							onFormat={toolbar.onFormat}
						/>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		</View>
	);
}

function FormattingMenuItem({
	command,
	selected,
	onFormat,
}: {
	command: FormattingCommand | undefined;
	selected: boolean;
	onFormat: Props["onFormat"];
}) {
	const { mobileColors, styles } = useMobileStyles(createThemeStyles);
	if (!command) return null;
	return (
		<DropdownMenuItem
			textValue={command.label}
			accessibilityLabel={command.label}
			accessibilityState={{ selected }}
			testID={command.testID}
			onPress={() => onFormat(command.action)}
		>
			<IconSlot>{command.icon(mobileColors.textMuted)}</IconSlot>
			<Text style={styles.label}>{command.label}</Text>
			<IconSlot>
				{selected ? <Check size={16} color={mobileColors.primary} /> : null}
			</IconSlot>
		</DropdownMenuItem>
	);
}

function IconSlot({ children }: { children: ReactNode }) {
	const { styles } = useMobileStyles(createThemeStyles);
	return <View style={styles.icon}>{children}</View>;
}

function metricProps(props: Props, segment?: string) {
	if (!props.layoutProbe || !props.metricId) return {};
	return probeProps(
		props.layoutProbe,
		segment ? `${props.metricId}.${segment}` : props.metricId,
	);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace } = metrics;
	const styles = StyleSheet.create({
		container: { flexDirection: "row" },
		fixedActions: {
			flexDirection: "row",
			flexShrink: 0,
			alignItems: "center",
			gap: mobileSpace.xs,
		},
		viewport: { flex: 1, minWidth: 0, height: mobilePaneFooterRowHeight },
		row: {
			...mobilePaneFooterFrame(),
			flexDirection: "row",
			gap: mobileSpace.xs,
		},
		action: {
			width: formattingToolbarTouchSize,
			height: formattingToolbarTouchSize,
			minWidth: formattingToolbarTouchSize,
			minHeight: formattingToolbarTouchSize,
			borderRadius: 4,
			alignItems: "center",
			justifyContent: "center",
		},
		selected: { backgroundColor: mobileColors.primarySoft },
		label: {
			color: mobileColors.text,
			fontSize: metrics.size(13),
			flexShrink: 1,
			flexGrow: 1,
		},
		icon: {
			width: 24,
			height: 24,
			alignItems: "center",
			justifyContent: "center",
		},
	});
	return { mobileColors, styles };
}
