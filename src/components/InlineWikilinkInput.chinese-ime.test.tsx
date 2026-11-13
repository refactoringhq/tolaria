import {
	act,
	fireEvent,
	render,
	screen,
	waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { VaultEntry } from "../types";
import { WikilinkChatInput } from "./WikilinkChatInput";

function ChineseImeComposer({
	onSend,
}: {
	onSend: (text: string, references: never[]) => void;
}) {
	const [value, setValue] = useState("");
	return (
		<WikilinkChatInput
			entries={[] as VaultEntry[]}
			value={value}
			onChange={setValue}
			onSend={onSend}
			placeholder="Ask Tolaria"
		/>
	);
}

function setEditorText(editor: HTMLElement, text: string) {
	editor.textContent = text;
	const selection = window.getSelection();
	if (!selection) return;
	const range = document.createRange();
	range.selectNodeContents(editor);
	range.collapse(false);
	selection.removeAllRanges();
	selection.addRange(range);
}

describe("Chinese IME input in the AI composer", () => {
	it("commits candidates and keeps candidate Enter separate from send Enter", async () => {
		const onSend = vi.fn();
		render(<ChineseImeComposer onSend={onSend} />);
		const editor = screen.getByTestId("agent-input");

		editor.focus();
		fireEvent.compositionStart(editor);
		setEditorText(editor, "nihao");
		fireEvent.input(editor);

		const candidateEnter = new KeyboardEvent("keydown", {
			bubbles: true,
			key: "Enter",
			keyCode: 229,
			which: 229,
		});
		editor.dispatchEvent(candidateEnter);
		expect(onSend).not.toHaveBeenCalled();

		fireEvent.compositionEnd(editor);
		await act(async () => Promise.resolve());
		setEditorText(editor, "你好");
		const commitEvent = new Event("beforeinput", {
			bubbles: true,
			cancelable: true,
		});
		Object.defineProperties(commitEvent, {
			data: { value: "好" },
			inputType: { value: "insertText" },
			isComposing: { value: false },
		});
		fireEvent(editor, commitEvent);
		fireEvent.input(editor);

		await waitFor(() =>
			expect(screen.getByTestId("agent-input").textContent).toBe("你好"),
		);
		expect(commitEvent.defaultPrevented).toBe(false);
		expect(onSend).not.toHaveBeenCalled();

		fireEvent.keyDown(screen.getByTestId("agent-input"), {
			key: "Enter",
			keyCode: 13,
		});
		expect(onSend).toHaveBeenCalledWith("你好", []);
	});
});
