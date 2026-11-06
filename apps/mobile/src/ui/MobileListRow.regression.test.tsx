import { render } from "@testing-library/react-native";
import { describe, expect, it } from "vitest";
import { MobileListRow } from "./MobileListRow";

/**
 * Regression test for TOL-329: Mobile styling and spacing missing app-wide
 * 
 * TOL-315 (fe9b657c) changed Pressable from static styles to style functions:
 *   style={({ pressed }) => [...]}
 * 
 * This caused systematic padding loss. The fix reverts to static styles:
 *   style={staticStyle}
 * 
 * This test verifies that MobileListRow applies padding from base styles.
 */
describe("MobileListRow padding regression (TOL-329)", () => {
	it("applies base padding to Pressable when not selected", () => {
		const { getByRole } = render(
			<MobileListRow
				title="Test Note"
				subtitle="Test subtitle"
				selected={false}
			/>,
		);

		const pressable = getByRole("button");
		
		// The Pressable should have a style prop
		expect(pressable.props.style).toBeDefined();
		
		// When style is static (working), it's an object or number
		// When style is a function (broken TOL-315), it's a function
		const style = pressable.props.style;
		expect(typeof style).not.toBe("function");
		
		// Flatten style to extract padding values
		// React Native test renderer provides styles as objects/arrays
		const flatStyle = Array.isArray(style)
			? Object.assign({}, ...style.filter(Boolean))
			: style;
		
		// Verify padding is present with expected desktop parity values
		// desktopNoteItemParity.padding = {bottom: 14, left: 16, right: 16, top: 14}
		// After scaling (1.2x): {bottom: 16.8, left: 19.2, right: 19.2, top: 16.8}
		expect(flatStyle.paddingTop).toBeGreaterThan(10);
		expect(flatStyle.paddingBottom).toBeGreaterThan(10);
		expect(flatStyle.paddingLeft).toBeGreaterThan(10);
		expect(flatStyle.paddingRight).toBeGreaterThan(10);
	});

	it("applies baseSelected padding to Pressable when selected", () => {
		const { getByRole } = render(
			<MobileListRow
				title="Test Note"
				subtitle="Test subtitle"
				selected={true}
			/>,
		);

		const pressable = getByRole("button");
		const style = pressable.props.style;
		
		// Style must not be a function
		expect(typeof style).not.toBe("function");
		
		const flatStyle = Array.isArray(style)
			? Object.assign({}, ...style.filter(Boolean))
			: style;
		
		// Selected state should also have padding
		expect(flatStyle.paddingTop).toBeGreaterThan(10);
		expect(flatStyle.paddingBottom).toBeGreaterThan(10);
		expect(flatStyle.paddingLeft).toBeGreaterThan(10);
		expect(flatStyle.paddingRight).toBeGreaterThan(10);
	});

	it("does not use style function pattern that caused TOL-329", () => {
		const { getByRole } = render(
			<MobileListRow
				title="Test Note"
				subtitle="Test subtitle"
				selected={false}
			/>,
		);

		const pressable = getByRole("button");
		
		// The broken pattern from TOL-315 was:
		//   style={({ pressed }) => [...]}
		// This would make style a function, not an object
		expect(typeof pressable.props.style).not.toBe("function");
		
		// If style were a function, this would be the failure mode:
		// React Native might not call it, resulting in no styles applied
	});
});
