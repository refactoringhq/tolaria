import { expect, it, vi } from "vitest";
import { mobileMetrics } from "../../ui/mobileMetrics";
import { mobilePalettes } from "../../ui/theme/mobilePalette";
import { createPropertyPanelStyles } from "./MobilePropertiesPanel.styles";

vi.mock("react-native", () => ({
	StyleSheet: { create: (styles: unknown) => styles, hairlineWidth: 0.5 },
}));

it.each([1, 1.2] as const)(
	"keeps real relationship touch targets at scale %s without enlarging the type styling",
	(scale) => {
		const metrics = mobileMetrics[scale];
		const { relationshipStyles: styles, referenceStyles } =
			createPropertyPanelStyles(mobilePalettes.light, metrics);
		expect(styles.remove.width + 24).toBeGreaterThanOrEqual(44);
		expect(styles.remove.height + 24).toBeGreaterThanOrEqual(44);
		expect(styles.row.minHeight + 30).toBeGreaterThanOrEqual(44);
		expect(styles.row.minHeight).toBeLessThan(44);
		expect(styles.row.paddingVertical).toBe(
			metrics.relationship.rowPaddingVertical,
		);
		expect(styles.text.fontSize).toBe(metrics.relationship.textFontSize);
		expect(styles.text.fontWeight).toBe(metrics.relationship.textFontWeight);
		expect(styles.row.borderRadius).toBe(referenceStyles.row.borderRadius);
		expect(styles.remove.alignItems).toBe("center");
		expect(styles.row.width).toBe("100%");
		expect(styles.openTarget.flex).toBe(1);
		expect(styles.row.paddingHorizontal).toBe(
			metrics.relationship.rowPaddingHorizontal,
		);
		expect(styles.background.top).toBe(0);
		expect(styles.background.bottom).toBe(0);
	},
);

it.each([1, 1.2] as const)(
	"matches Backlinks chip geometry at scale %s",
	(scale) => {
		const metrics = mobileMetrics[scale];
		const { relationshipStyles, referenceStyles } = createPropertyPanelStyles(
			mobilePalettes.light,
			metrics,
		);
		for (const key of [
			"minHeight",
			"minWidth",
			"gap",
			"borderRadius",
			"paddingHorizontal",
			"paddingVertical",
			"width",
		] as const) {
			expect(relationshipStyles.row[key]).toBe(referenceStyles.row[key]);
		}
		expect(relationshipStyles.text.fontSize).toBe(
			referenceStyles.text.fontSize,
		);
		expect(relationshipStyles.text.fontWeight).toBe(
			referenceStyles.text.fontWeight,
		);
	},
);

it("keeps relationship rows aligned with Backlinks when property rows grow", () => {
	const metrics = mobileMetrics[1.2];
	const enlarged = {
		...metrics,
		property: { ...metrics.property, rowMinHeight: 80 },
	};
	const { relationshipStyles: styles, referenceStyles } =
		createPropertyPanelStyles(mobilePalettes.dark, enlarged);
	expect(styles.row.minHeight).toBe(referenceStyles.row.minHeight);
});
