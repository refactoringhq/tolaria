import type { ReactNode } from "react";
import { View } from "react-native";
import { MobileDeepLinkNotice } from "../components/vaults/MobileDeepLinkNotice";
import { MobileVaultDisplayContext } from "../workspace/MobileVaultContext";

type Props = {
	incomingNotice: string | null;
	rootUri?: string | null;
	source: string;
	workspace: ReactNode;
};

export function MobileWorkspaceLayout({
	incomingNotice,
	rootUri,
	source,
	workspace,
}: Props) {
	return (
		<MobileVaultDisplayContext.Provider value={{ source, rootUri }}>
			<View style={{ flex: 1 }}>
				{workspace}
				{incomingNotice && <MobileDeepLinkNotice message={incomingNotice} />}
			</View>
		</MobileVaultDisplayContext.Provider>
	);
}
