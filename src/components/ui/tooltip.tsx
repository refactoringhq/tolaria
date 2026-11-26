"use client";

import { Tooltip as TooltipPrimitive } from "radix-ui";
import * as React from "react";

import { subscribeTooltipInput, tooltipMayOpen } from "@/lib/tooltipTouchGate";
import { cn } from "@/lib/utils";

function TooltipProvider({
	delayDuration = 0,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
	return (
		<TooltipPrimitive.Provider
			data-slot="tooltip-provider"
			delayDuration={delayDuration}
			{...props}
		/>
	);
}

/**
 * A tap never opens a tooltip (TOL-419): only a mouse, a trackpad or keyboard focus do. Decided
 * once per opening, so it also covers tooltips their owner opens itself.
 */
function useTouchSafeOpen(requested: boolean): boolean {
	const [opening, setOpening] = React.useState({
		requested: false,
		allowed: false,
	});
	if (opening.requested !== requested) {
		setOpening({ requested, allowed: requested && tooltipMayOpen() });
	}
	React.useEffect(
		() =>
			subscribeTooltipInput(() => {
				setOpening({
					requested,
					allowed: requested && tooltipMayOpen(),
				});
			}),
		[requested],
	);
	return requested && opening.allowed;
}

function Tooltip({
	open,
	defaultOpen = false,
	onOpenChange,
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
	const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);
	const handleOpenChange = React.useCallback(
		(next: boolean) => {
			if (next && !tooltipMayOpen()) return;
			setUncontrolledOpen(next);
			onOpenChange?.(next);
		},
		[onOpenChange],
	);
	const shown = useTouchSafeOpen(open ?? uncontrolledOpen);
	return (
		<TooltipPrimitive.Root
			data-slot="tooltip"
			open={shown}
			onOpenChange={handleOpenChange}
			{...props}
		/>
	);
}

function TooltipTrigger({
	...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
	return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />;
}

const TooltipContent = React.forwardRef<
	React.ElementRef<typeof TooltipPrimitive.Content>,
	React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(function TooltipContent(
	{
		className,
		sideOffset = 0,
		collisionPadding = 8,
		children,
		style,
		...props
	},
	forwardedRef,
) {
	return (
		<TooltipPrimitive.Portal>
			<TooltipPrimitive.Content
				ref={forwardedRef}
				data-slot="tooltip-content"
				sideOffset={sideOffset}
				collisionPadding={collisionPadding}
				className="z-[1400] origin-(--radix-tooltip-content-transform-origin)"
				// Keep content wrapper unzoomed for correct positioning
				style={{ zoom: 1 }}
				{...props}
			>
				<div
					className={cn(
						"bg-foreground text-background w-fit max-w-[min(calc(var(--radix-tooltip-content-available-width,22rem)/var(--tolaria-overlay-zoom-factor,1)),22rem)] rounded-md px-3 py-1.5 text-xs text-balance",
						className,
					)}
					// Apply zoom to inner content for correct visual size
					style={{ zoom: "var(--tolaria-overlay-zoom-factor, 1)", ...style }}
				>
					{children}
				</div>
				<TooltipPrimitive.Arrow
					className="bg-foreground fill-foreground z-50 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]"
					style={{
						width: "calc(0.625rem * var(--tolaria-overlay-zoom-factor, 1))",
						height: "calc(0.625rem * var(--tolaria-overlay-zoom-factor, 1))",
					}}
				/>
			</TooltipPrimitive.Content>
		</TooltipPrimitive.Portal>
	);
});

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };
