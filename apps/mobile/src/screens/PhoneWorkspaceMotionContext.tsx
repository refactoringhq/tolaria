import { createContext } from "react";
import type { SharedValue } from "react-native-reanimated";

export type PhoneWorkspaceMotion = {
	isListActive: boolean;
	listPageOrigin: number;
	probeEnabled: boolean;
	railOffset: SharedValue<number>;
};

export const PhoneWorkspaceMotionContext =
	createContext<PhoneWorkspaceMotion | null>(null);
