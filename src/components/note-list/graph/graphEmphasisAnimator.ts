import type Graph from "graphology";
import type { Attributes } from "graphology-types";
import type { EmphasisTarget } from "./graphEmphasis";

export const EMPHASIS_DURATION_MS = 200;

export function easeOutCubic(progress: number): number {
	return 1 - (1 - Math.min(1, Math.max(0, progress))) ** 3;
}

/** A node's emphasis values: opacity and hover accent. */
interface NodeEmphasis {
	fade: number;
	accent: number;
}

const RESTING_NODE: NodeEmphasis = { fade: 1, accent: 0 };

function lerp(from: number, to: number, amount: number): number {
	return from + (to - from) * amount;
}

interface Snapshot {
	nodes: Map<string, NodeEmphasis>;
	edges: Map<string, number>;
}

function nodeEmphasis(attributes: Attributes): NodeEmphasis {
	const { fade, accent } = attributes;
	return {
		fade: typeof fade === "number" ? fade : RESTING_NODE.fade,
		accent: typeof accent === "number" ? accent : RESTING_NODE.accent,
	};
}

function snapshot(graph: Graph): Snapshot {
	const nodes = new Map<string, NodeEmphasis>();
	graph.forEachNode((node, attributes) =>
		nodes.set(node, nodeEmphasis(attributes)),
	);
	const edges = new Map<string, number>();
	graph.forEachEdge((edge, attributes) =>
		edges.set(edge, nodeEmphasis(attributes).fade),
	);
	return { nodes, edges };
}

/** Above this many links, edges switch at the start and end of a transition instead of every frame. */
export const EDGE_ANIMATION_LIMIT = 1000;

/** One transition: the graph, where its emphasis started, and where it is going. */
interface EmphasisTransition {
	graph: Graph;
	from: Snapshot;
	target: EmphasisTarget;
}

/** How far through a transition a frame is (0 = start, 1 = target), and whether it is the first frame. */
interface TransitionFrame {
	amount: number;
	first: boolean;
}

function writeNodes(
	{ graph, from, target }: EmphasisTransition,
	{ amount }: TransitionFrame,
) {
	graph.forEachNode((node, attributes) => {
		const start = from.nodes.get(node) ?? RESTING_NODE;
		graph.mergeNodeAttributes(node, {
			...attributes,
			fade: lerp(start.fade, target.nodeFade(node), amount),
			accent: lerp(start.accent, target.nodeAccent(node), amount),
		});
	});
}

function writeEdges(
	{ graph, from, target }: EmphasisTransition,
	{ amount }: TransitionFrame,
) {
	graph.updateEachEdgeAttributes(
		(edge, attributes, source, end) => {
			return {
				...attributes,
				fade: lerp(
					from.edges.get(edge) ?? 1,
					target.edgeFade(source, end),
					amount,
				),
			};
		},
		{ attributes: ["fade"] },
	);
}

/**
 * Writes the emphasis `amount` (0 = where it started, 1 = the target) of the way through a transition.
 * On big graphs re-processing every link each frame drops frames, so links jump straight to the target
 * on the first frame (the dim side is already faint) while the notes ease.
 */
function writeEmphasis(transition: EmphasisTransition, frame: TransitionFrame) {
	writeNodes(transition, frame);
	if (transition.graph.size <= EDGE_ANIMATION_LIMIT)
		writeEdges(transition, frame);
	else if (frame.first) writeEdges(transition, { amount: 1, first: true });
}

export interface FrameScheduler {
	request: (callback: () => void) => number;
	cancel: (handle: number) => void;
	now: () => number;
}

const browserFrames: FrameScheduler = {
	request: (callback) => requestAnimationFrame(callback),
	cancel: (handle) => cancelAnimationFrame(handle),
	now: () => performance.now(),
};

/**
 * Eases node and edge emphasis toward a new target. A retarget mid-way starts from wherever the graph is,
 * so sliding from one node to the next never flickers. `instant` (reduced motion) jumps straight there.
 */
export class EmphasisAnimator {
	private frame: number | null = null;
	private readonly graph: Graph;
	private readonly frames: FrameScheduler;

	constructor(graph: Graph, frames: FrameScheduler = browserFrames) {
		this.graph = graph;
		this.frames = frames;
	}

	animateTo(target: EmphasisTarget, instant: boolean) {
		this.stop();
		const transition = {
			graph: this.graph,
			from: snapshot(this.graph),
			target,
		};
		if (instant) {
			writeEmphasis(transition, { amount: 1, first: true });
			return;
		}
		const started = this.frames.now();
		let first = true;
		// The frame timestamp's clock differs between engines, so progress always reads the scheduler's own clock.
		const step = () => {
			const progress = (this.frames.now() - started) / EMPHASIS_DURATION_MS;
			writeEmphasis(transition, { amount: easeOutCubic(progress), first });
			first = false;
			this.frame = progress < 1 ? this.frames.request(step) : null;
		};
		this.frame = this.frames.request(step);
	}

	stop() {
		if (this.frame !== null) this.frames.cancel(this.frame);
		this.frame = null;
	}
}
