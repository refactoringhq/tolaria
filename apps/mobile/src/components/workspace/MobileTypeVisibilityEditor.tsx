import { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { pluralizeType } from "../../../../../src/shared/typeLabels";
import { mobileText } from "../../i18n/mobileText";
import type { MobileMetrics } from "../../ui/mobileMetrics";
import type { MobileColors } from "../../ui/theme/mobilePalette";
import { useMobileStyles } from "../../ui/theme/useMobileTheme";
import type { MobileTypeDefinitions } from "../../workspace/mobileWorkspaceModel";
import { Button } from "../ui/button";
import { ChromeSymbol } from "../ui/ChromeSymbol";
import { Text } from "../ui/text";
import { MobileTypeIcon } from "./MobileWorkspaceIcons";

type MobileTypeVisibilityEditorProps = {
	typeDefinitions?: MobileTypeDefinitions;
	onToggleTypeVisibility: (typeName: string) => void;
};

export function MobileTypeVisibilityEditor({
	onToggleTypeVisibility,
	typeDefinitions,
}: MobileTypeVisibilityEditorProps) {
	const { styles } = useMobileStyles(createThemeStyles);
	const typeEntries = useMemo(
		() => sortedTypeDefinitionEntries(typeDefinitions),
		[typeDefinitions],
	);

	return (
		<ScrollView
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<View
				style={styles.visibilitySection}
				testID="workspace-type-visibility-list"
			>
				{typeEntries.length === 0 ? <EmptyTypeVisibilityState /> : null}
				{typeEntries.map(([typeName, definition]) => (
					<TypeVisibilityRow
						definition={definition}
						key={typeName}
						onToggle={onToggleTypeVisibility}
						typeDefinitions={typeDefinitions}
						typeName={typeName}
					/>
				))}
			</View>
		</ScrollView>
	);
}

function TypeVisibilityRow({
	definition,
	onToggle,
	typeDefinitions,
	typeName,
}: {
	definition: MobileTypeDefinitions[string];
	onToggle: MobileTypeVisibilityEditorProps["onToggleTypeVisibility"];
	typeDefinitions: MobileTypeDefinitions | undefined;
	typeName: string;
}) {
	const { styles, mobileColors } = useMobileStyles(createThemeStyles);
	const visible = definition.visible !== false;
	const label = typeVisibilityLabel(typeName, definition);

	return (
		<Button
			accessibilityLabel={toggleTypeVisibilityLabel(label)}
			accessibilityRole="switch"
			accessibilityState={{ checked: visible }}
			aria-checked={visible}
			variant="ghost"
			style={styles.visibilityRow}
			testID={`workspace-type-visibility-${slugifyTypeVisibilityId(typeName)}`}
			onPress={() => onToggle(typeName)}
		>
			<TypeVisibilityLabel
				definition={definition}
				label={label}
				typeDefinitions={typeDefinitions}
				typeName={typeName}
			/>
			<ChromeSymbol
				name="check"
				color={visible ? mobileColors.primary : mobileColors.textFaint}
				size={16}
				weight={visible ? "bold" : "regular"}
			/>
		</Button>
	);
}

function TypeVisibilityLabel({
	definition,
	label,
	typeDefinitions,
	typeName,
}: {
	definition: MobileTypeDefinitions[string];
	label: string;
	typeDefinitions: MobileTypeDefinitions | undefined;
	typeName: string;
}) {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<>
			<MobileTypeIcon
				size={15}
				tone={definition.tone ?? "gray"}
				type={typeName}
				typeDefinitions={typeDefinitions}
			/>
			<View style={styles.visibilityText}>
				<Text numberOfLines={1} style={styles.visibilityLabel}>
					{label}
				</Text>
				<Text style={styles.visibilityDescription}>
					{mobileText("sidebar.section.showInSidebar")}
				</Text>
			</View>
		</>
	);
}

function EmptyTypeVisibilityState() {
	const { styles } = useMobileStyles(createThemeStyles);
	return (
		<View style={styles.emptyState}>
			<Text style={styles.emptyText}>{mobileText("command.noMatches")}</Text>
		</View>
	);
}

function sortedTypeDefinitionEntries(
	typeDefinitions: MobileTypeDefinitions | undefined,
) {
	return Object.entries(typeDefinitions ?? {}).sort(
		compareTypeDefinitionEntries,
	);
}

function compareTypeDefinitionEntries(
	left: [string, MobileTypeDefinitions[string]],
	right: [string, MobileTypeDefinitions[string]],
) {
	const leftOrder = optionalOrder(left[1].order);
	const rightOrder = optionalOrder(right[1].order);
	if (leftOrder !== rightOrder) return leftOrder < rightOrder ? -1 : 1;

	return typeVisibilityLabel(left[0], left[1]).localeCompare(
		typeVisibilityLabel(right[0], right[1]),
	);
}

function optionalOrder(order: number | null | undefined) {
	return order ?? Number.POSITIVE_INFINITY;
}

function typeVisibilityLabel(
	typeName: string,
	definition: MobileTypeDefinitions[string],
) {
	return definition.label ?? pluralizeType(typeName.trim());
}

function toggleTypeVisibilityLabel(label: string) {
	return mobileText("sidebar.section.toggle").replace("{label}", label);
}

function slugifyTypeVisibilityId(typeName: string) {
	return (
		typeName
			.trim()
			.toLowerCase()
			.replace(/[^a-z0-9]+/gu, "-")
			.replace(/^-|-$/g, "") || "type"
	);
}

function createThemeStyles(mobileColors: MobileColors, metrics: MobileMetrics) {
	const { space: mobileSpace, type: mobileType } = metrics;
	const styles = StyleSheet.create({
		content: {
			gap: mobileSpace.md,
			padding: mobileSpace.md,
		},
		emptyState: {
			alignItems: "center",
			justifyContent: "center",
			minHeight: 96,
		},
		emptyText: {
			color: mobileColors.textMuted,
			fontSize: mobileType.body,
		},
		visibilityDescription: {
			color: mobileColors.textMuted,
			fontSize: mobileType.caption,
			lineHeight: metrics.size(16),
		},
		visibilityLabel: {
			color: mobileColors.text,
			fontSize: mobileType.body,
			fontWeight: "500",
		},
		visibilityRow: {
			alignItems: "center",
			borderRadius: 6,
			flexDirection: "row",
			gap: mobileSpace.sm,
			padding: mobileSpace.sm,
			height: 52,
			justifyContent: "flex-start",
		},
		visibilitySection: {
			borderColor: mobileColors.border,
			borderTopWidth: StyleSheet.hairlineWidth,
			gap: mobileSpace.xs,
			paddingTop: mobileSpace.md,
		},
		visibilityText: {
			flex: 1,
			gap: metrics.size(2),
			minWidth: 0,
		},
	});
	return { mobileColors, styles };
}
