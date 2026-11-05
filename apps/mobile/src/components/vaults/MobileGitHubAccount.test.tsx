// @vitest-environment jsdom
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { MobileGitHubAccount } from "./MobileGitHubAccount";

const browser = vi.hoisted(() => ({ openBrowserAsync: vi.fn(() => Promise.resolve({ type: "opened" })) }));
vi.mock("expo-web-browser", () => browser);
vi.mock("react-native", () => ({ View: "div" }));
vi.mock("phosphor-react-native", () => ({ ArrowSquareOut: () => null, GithubLogo: () => null, SignOut: () => null }));
vi.mock("../../i18n/mobileText", () => ({ mobileText: (key: string) => key }));
vi.mock("../../ui/MobileButton", () => ({
	MobileButton: ({ label, onPress }: { label: string; onPress: () => void }) =>
		createElement("button", { onClick: onPress, type: "button" }, label),
}));
vi.mock("../../ui/theme/useMobileTheme", () => ({
	useMobileColors: () => ({ text: "#111", textMuted: "#666" }),
	useMobileStyles: () => ({ styles: { section: {}, label: {}, detail: {}, error: {}, row: {} } }),
}));
vi.mock("../../ui/theme/useMobileChromeColors", () => ({ useMobileChromeColors: () => ({ text: "#111" }) }));
vi.mock("./MobileDeviceCode", () => ({ MobileDeviceCode: () => null }));
vi.mock("./MobileGitHubRepositories", () => ({ MobileGitHubRepositories: () => null }));
vi.mock("../ui/text", () => ({ Text: "span" }));
vi.mock("../ui/mobileNativeDialogs", () => ({ showNativeConfirmation: vi.fn() }));

const account = {
	busy: false,
	code: { user_code: "AB12" },
	configured: true,
	error: null,
	session: null,
	signIn: vi.fn(),
	cancelSignIn: vi.fn(),
} as never;

afterEach(() => browser.openBrowserAsync.mockClear());

it("opens GitHub device authorization inside the in-app browser", async () => {
	const host = document.createElement("div");
	const root = createRoot(host);
	await act(async () => root.render(createElement(MobileGitHubAccount, { account, disabled: false, clone: vi.fn() })));
	await act(async () => {
		[...host.querySelectorAll("button")]
			.find((button) => button.textContent === "mobile.vaults.openGitHub")
			?.click();
	});
	expect(browser.openBrowserAsync).toHaveBeenCalledWith("https://github.com/login/device");
	await act(async () => root.unmount());
});
