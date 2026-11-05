import { expect, it } from "vitest";
import { mobileSearchResultsScrollProps } from "./mobileSearchResultsScrollProps";

it("dismisses the keyboard when the quick-open results are dragged", () => {
	const props = mobileSearchResultsScrollProps();

	expect(props.keyboardDismissMode).toBe("on-drag");
});
