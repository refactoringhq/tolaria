import type { MouseEvent } from "react";
import type { GraphCanvasProps } from "./GraphCanvas";

/** Lists what the canvas would draw and forwards clicks. */
export function GraphCanvasStub(props: GraphCanvasProps) {
	const render = ({
		visible,
		settings,
		selectedNotePath,
		onOpen,
		onBackgroundClick,
	}: GraphCanvasProps) => (
		<div
			data-testid="graph-canvas-stub"
			data-labels={String(settings.showLabels)}
			data-repel={settings.repelForce}
			data-arrows={String(settings.showArrows)}
			data-groups={settings.colorGroups.map((group) => `${group.query}:${group.color}`).join("|")}
			data-selected={selectedNotePath ?? ""}
		>
			{visible.nodes.map((node) => (
				<button
					key={node.id}
					type="button"
					data-testid="graph-node"
					onClick={(event: MouseEvent) => onOpen(node.entry, event)}
				>
					{node.entry.title}
				</button>
			))}
			{visible.edges.map((edge) => (
				<span key={edge.id} data-testid={`graph-edge-${edge.kind}`}>
					{edge.labels.join("+")}
				</span>
			))}
			<button
				type="button"
				data-testid="graph-background"
				onClick={onBackgroundClick}
			>
				background
			</button>
		</div>
	);
	return render(props);
}
