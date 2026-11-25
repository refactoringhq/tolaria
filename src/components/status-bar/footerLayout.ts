import type { CSSProperties } from "react";

/** The status bar row: compact on the desktop, around 44 px targets with a finger (TOL-419). */
export interface StatusBarFooterLayoutOptions {
	stacked: boolean;
	touchInput: boolean;
}

const STACKED_FOOTER_LAYOUT: CSSProperties = {
	height: "auto",
	flexWrap: "wrap",
	alignItems: "flex-start",
	justifyContent: "flex-start",
	rowGap: 4,
	padding: "4px 8px",
};

const ROW_FOOTER_LAYOUT: CSSProperties = {
	height: 30,
	flexWrap: "nowrap",
	alignItems: "center",
	justifyContent: "space-between",
	rowGap: 0,
	padding: "0 8px",
};

export function statusBarFooterLayout({
	stacked,
	touchInput,
}: StatusBarFooterLayoutOptions): CSSProperties {
	const layout = stacked ? STACKED_FOOTER_LAYOUT : ROW_FOOTER_LAYOUT;
	return touchInput ? { ...layout, height: "auto" } : layout;
}
