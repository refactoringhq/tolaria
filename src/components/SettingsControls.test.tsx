import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SettingsRow, SettingsSwitchRow } from "./SettingsControls";

const translatedLabel = "Donaudampfschifffahrtsgesellschaftskapitän";

describe("settings row translated labels", () => {
	it("allows long words in labels and descriptions to wrap", () => {
		render(
			<>
				<SettingsRow label={translatedLabel} description={translatedLabel}>
					<button type="button">Default</button>
				</SettingsRow>
				<SettingsSwitchRow
					label={translatedLabel}
					description={translatedLabel}
					checked={false}
					onChange={() => {}}
				/>
			</>,
		);

		const matchingText = screen.getAllByText(translatedLabel);
		expect(matchingText).toHaveLength(4);
		for (const text of matchingText) {
			expect(text).toHaveClass("break-words");
		}
	});
});
