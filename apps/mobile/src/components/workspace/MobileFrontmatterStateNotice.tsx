import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { mobileText } from "../../i18n/mobileText";
import { MobileButton } from "../../ui/MobileButton";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import { mobileRadius } from "../../ui/tokens";
import type { MobileFrontmatterState } from "../../workspace/mobileFrontmatterState";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";

type MobileFrontmatterStateNoticeProps = {
	onFixInvalidFrontmatter?: () => void;
	onInitializeProperties: () => void;
	state: MobileFrontmatterState;
};

export function MobileFrontmatterStateNotice({
	onFixInvalidFrontmatter,
	onInitializeProperties,
	state,
}: MobileFrontmatterStateNoticeProps) {
	const { mobileColors } = useMobileStyles(createThemeStyles);
	if (state === "invalid") {
		return (
			<NoticeFrame tone="danger" testID="properties-invalid-frontmatter">
				<ChromeSymbol name="warning" color={mobileColors.danger} size={24} />
				<NoticeText label={mobileText("inspector.empty.invalidProperties")} />
				{onFixInvalidFrontmatter ? (
					<MobileButton
						icon={
							<ChromeSymbol name="edit" color={mobileColors.text} size={14} />
						}
						label={mobileText("inspector.empty.fixInEditor")}
						onPress={onFixInvalidFrontmatter}
					/>
				) : null}
			</NoticeFrame>
		);
	}

	if (state === "empty" || state === "none") {
		return (
			<NoticeFrame testID="properties-initialize-frontmatter">
				<ChromeSymbol name="sparkle" color={mobileColors.textMuted} size={24} />
				<NoticeText label={mobileText("inspector.empty.noProperties")} />
				<MobileButton
					label={mobileText("inspector.empty.initializeProperties")}
					onPress={onInitializeProperties}
				/>
			</NoticeFrame>
		);
	}

	return null;
}

function NoticeFrame({
	children,
	testID,
	tone = "default",
}: {
	children: ReactNode;
	testID: string;
	tone?: "danger" | "default";
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<View
			style={[styles.frame, tone === "danger" ? styles.dangerFrame : null]}
			testID={testID}
		>
			{children}
		</View>
	);
}

function NoticeText({ label }: { label: string }) {
	const { styles } = useMobileStyles(createThemeStyles);
	return <Text style={styles.text}>{label}</Text>;
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace, type: mobileType } = metrics;
	const styles = StyleSheet.create({
		dangerFrame: {
			backgroundColor: mobileColors.dangerSoft,
			borderColor: mobileColors.danger,
		},
		frame: {
			alignItems: "center",
			borderColor: mobileColors.border,
			borderRadius: mobileRadius.lg,
			borderStyle: "dashed",
			borderWidth: StyleSheet.hairlineWidth,
			gap: mobileSpace.md,
			paddingHorizontal: mobileSpace.lg,
			paddingVertical: mobileSpace.xl,
		},
		text: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
			lineHeight: metrics.size(18),
			textAlign: "center",
		},
	});
	return { mobileColors, styles };
}
