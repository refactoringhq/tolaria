import { SymbolView } from "expo-symbols";
import type { ColorValue } from "react-native";
import type { ChromeSymbolName } from "./chromeSymbolDefinitions";
import { chromeSymbolDefinitions } from "./chromeSymbolDefinitions";

export function ChromeSymbol({
	color,
	name,
	size,
	weight = "regular",
}: {
	color: ColorValue;
	name: ChromeSymbolName;
	size: number;
	weight?: "regular" | "bold" | "semibold" | "medium";
}) {
	return (
		<SymbolView
			name={chromeSymbolDefinitions[name]}
			size={size}
			tintColor={color}
			weight={weight}
		/>
	);
}
