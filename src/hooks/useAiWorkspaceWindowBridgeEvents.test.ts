import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAiWorkspaceWindowBridgeEvents } from "./useAiWorkspaceWindowBridgeEvents";

type Listener = (event: { payload?: unknown }) => void;

const listeners = new Map<string, Listener>();
const listen = vi.fn(async (eventName: string, listener: Listener) => {
	listeners.set(eventName, listener);
	return vi.fn();
});

vi.mock("../mock-tauri", () => ({ isTauri: () => true }));
vi.mock("@tauri-apps/api/event", () => ({ listen }));

describe("useAiWorkspaceWindowBridgeEvents", () => {
	beforeEach(() => {
		listeners.clear();
		listen.mockClear();
	});

	it("keeps native listeners mounted while calling the latest handlers", async () => {
		const firstHandler = vi.fn();
		const latestHandler = vi.fn();
		const { rerender } = renderHook(
			({ onVaultChanged }: { onVaultChanged: () => void }) =>
				useAiWorkspaceWindowBridgeEvents({
					onFileCreated: vi.fn(),
					onFileModified: vi.fn(),
					onOpenNote: vi.fn(),
					onVaultChanged,
				}),
			{ initialProps: { onVaultChanged: firstHandler } },
		);

		await waitFor(() => expect(listen).toHaveBeenCalledTimes(4));
		rerender({ onVaultChanged: latestHandler });
		await Promise.resolve();

		listeners.get("tolaria:ai-workspace-vault-changed")?.({});

		expect(listen).toHaveBeenCalledTimes(4);
		expect(firstHandler).not.toHaveBeenCalled();
		expect(latestHandler).toHaveBeenCalledOnce();
	});
});
