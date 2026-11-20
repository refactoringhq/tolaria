import { vi } from "vitest";
import { GraphCanvasStub } from "./GraphCanvasStub";

/** Test doubles for graph collection tests: the Tauri bridge, telemetry, and a canvas stub (no WebGL in JSDOM). */
export const invoke = vi.fn();
export const trackEvent = vi.fn();
export const tauriModule = { invoke };
export const telemetryModule = { trackEvent };
export const canvasModule = { default: GraphCanvasStub };
