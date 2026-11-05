import type { ReactNode } from "react";

export type MobileNativeNoticeSurfaceProps = {
	message: string;
	actionLabel?: string;
	onAction?: () => void;
	onDismiss: () => void;
	children: ReactNode;
};

export function MobileNativeNoticeSurface({ children }: MobileNativeNoticeSurfaceProps) {
	return children;
}
