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
		const { relationshipStyles: styles } = createPropertyPanelStyles(
			mobilePalettes.light,
			metrics,
		);
		expect(styles.remove.minWidth).toBe(44);
		expect(styles.remove.minHeight).toBe(44);
		expect(styles.openTarget.minHeight).toBe(44);
		expect(styles.row.minHeight).toBeGreaterThanOrEqual(44);
		expect(styles.row.paddingVertical).toBe(
			metrics.relationship.rowPaddingVertical,
		);
		expect(styles.text.fontSize).toBe(metrics.relationship.textFontSize);
		expect(styles.text.fontWeight).toBe(metrics.relationship.textFontWeight);
		expect(styles.row.borderRadius).toBe(metrics.relationship.rowRadius);
		expect(styles.remove.alignItems).toBe("center");
		expect(styles.row.alignSelf).toBe("flex-start");
		expect("flex" in styles.openTarget).toBe(false);
		expect(styles.row.paddingRight).toBe(0);
		expect(styles.background.top).toBe(2);
		expect(styles.background.bottom).toBe(2);
	},
);

it("never shrinks a larger minimum row height back to the touch minimum", () => {
	const metrics = mobileMetrics[1.2];
	const enlarged = {
		...metrics,
		property: { ...metrics.property, rowMinHeight: 80 },
	};
	const { relationshipStyles: styles } = createPropertyPanelStyles(
		mobilePalettes.dark,
		enlarged,
	);
	expect(styles.row.minHeight).toBe(80);
});
