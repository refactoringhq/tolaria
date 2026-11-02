// @vitest-environment jsdom
import { act, createElement, type ReactNode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("@expo/ui/jetpack-compose", () => {
	const Slot = ({ children }: { children: ReactNode }) =>
		createElement("div", null, children);
	const AlertDialog = Object.assign(Slot, {
		Title: Slot,
		Text: Slot,
		DismissButton: Slot,
		ConfirmButton: Slot,
	});
	const OutlinedTextField = Object.assign(
		({
			value,
			onValueChange,
		}: {
			value: { value: string };
			onValueChange: (next: string) => void;
		}) =>
			createElement("input", {
				"aria-label": "prompt",
				value: value.value,
				onChange: (event: { currentTarget: HTMLInputElement }) =>
					onValueChange(event.currentTarget.value),
			}),
		{ Label: Slot },
	);
	return {
		AlertDialog,
		Button: ({
			children,
			onClick,
		}: {
			children: ReactNode;
			onClick: () => void;
		}) => createElement("button", { type: "button", onClick }, children),
		OutlinedTextField,
		Text: Slot,
		useNativeState: (initial: string) => {
			const [value, set] = useState(initial);
			return useMemo(() => ({ value, set }), [value]);
		},
	};
});
vi.mock("react-native", () => ({ Alert: { alert: vi.fn(), prompt: vi.fn() } }));

import type { ActionContentProps } from "../MobileWorkspaceActionSheet.types";
import { MobileWorkspaceAndroidPrompt } from "./MobileWorkspaceAndroidPrompt.android";

let root: ReturnType<typeof createRoot>;
let host: HTMLDivElement;

beforeEach(() => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
		callback(0);
		return 1;
	});
	host = document.createElement("div");
	root = createRoot(host);
});

afterEach(async () => {
	await act(async () => root.unmount());
	vi.unstubAllGlobals();
});

it("submits a validated value through existing workspace callbacks", async () => {
	const onCreateFolder = vi.fn();
	const props = {
		action: "createFolder",
		folderPath: "",
		folderPaths: [],
		notes: [],
		onClose: vi.fn(),
		onCreateFolder,
		onFolderNameChange: vi.fn(),
	} as unknown as ActionContentProps;
	await act(async () =>
		root.render(createElement(MobileWorkspaceAndroidPrompt, props)),
	);
	const input = host.querySelector("input");
	await act(async () => {
		Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set?.call(input, "Projects");
		input?.dispatchEvent(new Event("input", { bubbles: true }));
	});
	const buttons = host.querySelectorAll("button");
	await act(async () => buttons[1]?.click());
	expect(props.onFolderNameChange).toHaveBeenCalledWith("Projects");
	expect(onCreateFolder).toHaveBeenCalledOnce();
});

it("keeps the native dialog open and shows validation errors", async () => {
	const props = {
		action: "createType",
		typeName: "Project",
		typeDefinitions: { Project: {} },
		notes: [],
		onClose: vi.fn(),
		onCreateType: vi.fn(),
		onTypeNameChange: vi.fn(),
	} as unknown as ActionContentProps;
	await act(async () =>
		root.render(createElement(MobileWorkspaceAndroidPrompt, props)),
	);
	const buttons = host.querySelectorAll("button");
	await act(async () => buttons[1]?.click());
	expect(host.textContent).toContain("An item with this name already exists.");
	expect(props.onCreateType).not.toHaveBeenCalled();
});
