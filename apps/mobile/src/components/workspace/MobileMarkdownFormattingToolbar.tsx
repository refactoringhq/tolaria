import { StyleSheet, View } from "react-native";
import { ScrollView } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { mobileText } from "../../i18n/mobileText";
import { type MobileLayoutProbe, probeProps } from "../../qa/mobileLayoutProbe";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { useMobileDeviceLayout } from "../../ui/useMobileDeviceLayout";
import type { MobileMarkdownFormatAction } from "../../workspace/mobileMarkdownFormatting";
import { Button } from "../ui/button";
import { MobileCompactFormattingToolbar } from "./MobileCompactFormattingToolbar";
import { formattingCommands } from "./mobileFormattingCommands";
import { formattingToolbarTouchSize } from "./mobileFormattingToolbarModel";
import {
	mobilePaneFooterFrame,
	mobilePaneFooterRowHeight,
} from "./mobilePaneFooterLayout";

const nativeOnlyFormattingActions = new Set<MobileMarkdownFormatAction>([
	"tableAddColumnAfter",
	"tableAddRowAfter",
	"tableDeleteColumn",
	"tableDeleteRow",
]);

const sourceMarkdownFormattingActions = formattingCommands
	.map((command) => command.action)
	.filter((action) => !nativeOnlyFormattingActions.has(action));

type FormattingToolbarProps = {
	actions?: readonly MobileMarkdownFormatAction[];
	layoutProbe?: MobileLayoutProbe;
	metricId?: string;
	onFormat: (action: MobileMarkdownFormatAction) => void;
	onDismissKeyboard?: () => void;
	selected?: readonly MobileMarkdownFormatAction[];
	inTable?: boolean;
};

export function MobileMarkdownFormattingToolbar(props: FormattingToolbarProps) {
	const phone = useMobileDeviceLayout() === "phone";
	if (phone)
		return (
			<MobileCompactFormattingToolbar
				{...props}
				actions={props.actions ?? sourceMarkdownFormattingActions}
				selected={[...(props.selected ?? [])]}
				inTable={props.inTable ?? false}
			/>
		);
	return <WideFormattingToolbar {...props} />;
}

function WideFormattingToolbar({
	actions,
	layoutProbe,
	metricId,
	onFormat,
	selected = [],
	inTable = false,
}: FormattingToolbarProps) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const { bottom } = useSafeAreaInsets();
	const visibleActions = new Set(
		(actions ?? sourceMarkdownFormattingActions).filter(
			(action) => inTable || !nativeOnlyFormattingActions.has(action),
		),
	);

	return (
		<ScrollView
			accessibilityLabel={mobileText("editor.formatting.toolbar")}
			alwaysBounceHorizontal={false}
			contentContainerStyle={[
				styles.toolbarContent,
				mobilePaneFooterFrame(bottom),
			]}
			horizontal
			keyboardShouldPersistTaps="always"
			{...formattingProbeProps(layoutProbe, metricId)}
			showsHorizontalScrollIndicator={false}
			style={[
				styles.toolbarViewport,
				{ height: mobilePaneFooterRowHeight + bottom },
			]}
			testID="editor-formatting-toolbar"
		>
			{formattingCommands
				.filter((command) => visibleActions.has(command.action))
				.map((command) => (
					<View
						key={command.action}
						{...formattingProbeProps(
							layoutProbe,
							metricId,
							`action.${command.action}`,
						)}
						style={styles.actionProbe}
					>
						<Button
							accessibilityLabel={command.label}
							accessibilityState={{
								selected: selected.includes(command.action),
							}}
							variant="ghost"
							size="icon"
							style={[
								styles.actionProbe,
								selected.includes(command.action) && styles.selected,
							]}
							testID={command.testID}
							onPress={() => onFormat(command.action)}
						>
							{command.icon(
								selected.includes(command.action)
									? mobileColors.primary
									: mobileColors.textMuted,
							)}
						</Button>
					</View>
				))}
		</ScrollView>
	);
}

function formattingProbeProps(
	layoutProbe: MobileLayoutProbe | undefined,
	metricId: string | undefined,
	segment?: string,
) {
	if (!layoutProbe || !metricId) return {};
	return probeProps(layoutProbe, segment ? `${metricId}.${segment}` : metricId);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace } = metrics;
	const styles = StyleSheet.create({
		actionProbe: {
			height: formattingToolbarTouchSize,
			minHeight: formattingToolbarTouchSize,
			width: formattingToolbarTouchSize,
			minWidth: formattingToolbarTouchSize,
			alignItems: "center",
			justifyContent: "center",
			borderRadius: 4,
		},
		selected: { backgroundColor: mobileColors.primarySoft },
		toolbarContent: {
			flexDirection: "row",
			gap: mobileSpace.xs,
		},
		toolbarViewport: {
			flexGrow: 0,
		},
	});
	return { mobileColors, styles };
}
