import { Host, Snackbar, SnackbarHost, useMaterialColors, type SnackbarHostRef } from "@expo/ui/jetpack-compose";
import { useEffect, useRef } from "react";
import type { MobileNativeNoticeSurfaceProps } from "./MobileNativeNoticeSurface";

export function MobileNativeNoticeSurface({ actionLabel, message, onAction, onDismiss }: MobileNativeNoticeSurfaceProps) {
	const colors = useMaterialColors();
	const host = useRef<SnackbarHostRef>(null);
	const action = useRef(onAction);
	const dismiss = useRef(onDismiss);
	useEffect(() => {
		action.current = onAction;
		dismiss.current = onDismiss;
	}, [onAction, onDismiss]);
	useEffect(() => {
		void host.current?.showSnackbar({
			message,
			actionLabel,
			withDismissAction: true,
			duration: actionLabel ? "long" : "short",
		}).then((result) => {
			if (result === "actionPerformed") action.current?.();
			else dismiss.current();
		});
	}, [actionLabel, message]);
	return (
		<Host
			matchContents
			style={{ position: "absolute", left: 12, right: 12, bottom: 12 }}
		>
			<SnackbarHost ref={host}>
				<Snackbar
					containerColor={colors.inverseSurface}
					contentColor={colors.inverseOnSurface}
					actionContentColor={colors.inversePrimary}
				/>
			</SnackbarHost>
		</Host>
	);
}
