import MenuView from "@expo/ui/community/menu";
import { GlassView } from "expo-glass-effect";
import {
	CaretDown,
	DotsThree,
	Keyboard as KeyboardIcon,
	ListBullets,
	Plus,
	Table,
	TextH,
} from "phosphor-react-native";
import { Keyboard, ScrollView, StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { type MobileLayoutProbe, probeProps } from "../../qa/mobileLayoutProbe";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { useMobileKeyboardInset } from "../../ui/useMobileBottomInset";

import type { MobileMarkdownFormatAction } from "../../workspace/mobileMarkdownFormatting";
import { Button } from "../ui/button";
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
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const { bottom, keyboardVisible } = useMobileKeyboardInset();
	const groups = formattingToolbarGroups(props.actions, props.inTable);
	return (
		<View
			style={[styles.footer, mobilePaneFooterFrame(bottom)]}
			testID="editor-formatting-toolbar"
			{...metricProps(props)}
		>
			<View style={styles.glassFrame} testID="editor-formatting-glass">
				<GlassView
					glassEffectStyle="regular"
					isInteractive
					pointerEvents="none"
					style={styles.glass}
					testID="editor-formatting-glass-surface"
				/>
				<View style={styles.container}>
					<ScrollView
						horizontal
						accessibilityLabel={mobileText("editor.formatting.toolbar")}
						keyboardShouldPersistTaps="always"
						showsHorizontalScrollIndicator={false}
						contentContainerStyle={styles.row}
						style={styles.viewport}
						testID="editor-formatting-actions"
					>
						<PrimaryActions actions={groups.primary} toolbar={props} />
						<FormattingMenuGroups
							groups={groups}
							names={["headings", "lists", "table"]}
							toolbar={props}
						/>
					</ScrollView>
					<View
						style={styles.fixedActions}
						testID="editor-formatting-fixed-actions"
					>
						<FormattingMenuGroups
							groups={groups}
							names={["insert", "more"]}
							toolbar={props}
						/>
						{keyboardVisible && (
							<Button
								accessibilityLabel={mobileText(
									"editor.formatting.hideKeyboard",
								)}
								variant="ghost"
								size="icon"
								style={styles.action}
								testID="editor-hide-keyboard-action"
								onPress={() => (props.onDismissKeyboard ?? Keyboard.dismiss)()}
							>
								<KeyboardIcon size={24} color={mobileColors.textMuted} />
								<CaretDown size={10} color={mobileColors.textMuted} />
							</Button>
						)}
					</View>
				</View>
			</View>
		</View>
	);
}

function PrimaryActions({
	actions,
	toolbar,
}: {
	actions: MobileMarkdownFormatAction[];
	toolbar: Props;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return actions.map((action) => (
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
	));
}

function FormattingMenuGroups({
	groups,
	names,
	toolbar,
}: {
	groups: ReturnType<typeof formattingToolbarGroups>;
	names: readonly (keyof typeof menus)[];
	toolbar: Props;
}) {
	return names.map((group) =>
		groups[group].length ? (
			<FormattingMenu
				key={group}
				group={group}
				actions={groups[group]}
				toolbar={toolbar}
			/>
		) : null,
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
			<MenuView
				actions={actions.flatMap((action) => {
					const command = commands.get(action);
					return command
						? [
								{
									id: command.testID,
									title: command.label,
									state: toolbar.selected.includes(action)
										? ("on" as const)
										: ("off" as const),
								},
							]
						: [];
				})}
				onPressAction={({ nativeEvent }) => {
					const command = [...commands.values()].find(
						(candidate) => candidate.testID === nativeEvent.event,
					);
					if (command && actions.includes(command.action))
						toolbar.onFormat(command.action);
				}}
				testID={`editor-format-menu-${group}`}
			>
				<Button
					accessibilityLabel={mobileText(menu.label)}
					style={StyleSheet.flatten([
						styles.action,
						selected && styles.selected,
					])}
					testID={`editor-format-menu-${group}`}
					variant="ghost"
					size="icon"
				>
					<Icon
						size={24}
						color={selected ? mobileColors.primary : mobileColors.textMuted}
					/>
				</Button>
			</MenuView>
		</View>
	);
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
		footer: { justifyContent: "center" },
		glassFrame: {
			alignSelf: "stretch",
			height: mobilePaneFooterRowHeight,
			marginHorizontal: mobileSpace.sm,
			position: "relative",
			borderRadius: 24,
			overflow: "hidden",
		},
		glass: {
			position: "absolute",
			top: 0,
			right: 0,
			bottom: 0,
			left: 0,
			borderRadius: 24,
			overflow: "hidden",
		},
		container: { flexDirection: "row", height: mobilePaneFooterRowHeight },
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
	});
	return { mobileColors, styles };
}
