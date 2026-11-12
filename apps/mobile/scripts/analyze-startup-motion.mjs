export function analyzeStartup(events, expectedBuildId, analyzeFirstListFrame) {
	const markers = startupMarkers(events);
	const presentations = startupPresentationCounts(events, markers.prepared);
	const firstFrame = analyzeFirstListFrame(events);
	const metrics = {
		...markers,
		...presentations,
		firstFrame,
	};
	const passed = startupPassed(metrics, expectedBuildId);

	return {
		passed,
		previewAt: eventTime(markers.preview),
		previewHasChrome: markers.previewHasChrome,
		preparedAt: eventTime(markers.prepared),
		preparationDelayMs: markers.preparationDelayMs,
		listMountsBeforePreparation: presentations.mountsBeforePreparation,
		previewPanelsBeforePreparation:
			presentations.previewPanelsBeforePreparation,
		listPresentationsBeforePreparation:
			presentations.presentationsBeforePreparation,
		totalListPresentations: presentations.totalListPresentations,
		listRendersBeforePreparation: presentations.listRendersBeforePreparation,
		firstListFrameAt: eventTime(metrics.listFrame),
		controlsWithinFirstFrame: firstFrame.controlsWithinFirstFrame,
		buildId: eventBuildId(markers.preview),
	};
}

function eventTime(event) {
	return event ? event.at : null;
}

function eventBuildId(event) {
	return event ? event.buildId : null;
}

function startupMarkers(events) {
	const preview = findEvent(events, [
		"startup-preview-consumed",
		"startup-preview-panel-mounted",
	]);
	const prepared = findEvent(events, ["native-workspace-prepared"]);
	return {
		preview,
		prepared,
		listFrame: findEvent(events, ["first-list-frame"]),
		preparationDelayMs: elapsed(preview, prepared),
		previewHasChrome: hasPreviewChrome(preview),
	};
}

function hasPreviewChrome(preview) {
	return preview?.hasHamburger === true && preview?.hasCreateAction === true;
}

function startupPresentationCounts(events, prepared) {
	const mounts = matchingEvents(events, "phone-note-list-mount");
	const previewPanels = matchingEvents(events, "startup-preview-panel-mounted");
	const mountsBeforePreparation = before(prepared, mounts).length;
	const previewPanelsBeforePreparation = before(prepared, previewPanels).length;
	return {
		mountsBeforePreparation,
		previewPanelsBeforePreparation,
		presentationsBeforePreparation:
			mountsBeforePreparation + previewPanelsBeforePreparation,
		totalListPresentations: mounts.length + previewPanels.length,
		listRendersBeforePreparation: before(
			prepared,
			matchingEvents(events, "phone-note-list-render"),
		).length,
	};
}

export function analyzeFirstListFrame(events) {
	const list = findEvent(events, ["first-list-frame"]);
	const controls = matchingEvents(events, "chrome-layout");
	const hamburger = controls.find((event) => event.control === "hamburger");
	const fab = findEvent(events, ["fab-layout"]);
	const controlLayoutDelayMs =
		list && hamburger && fab
			? round(Math.max(hamburger.at, fab.at) - list.at)
			: null;
	return {
		controlsLaidOut: controlLayoutDelayMs !== null,
		controlsWithinFirstFrame:
			controlLayoutDelayMs !== null && controlLayoutDelayMs <= 1000 / 60,
		controlLayoutDelayMs,
		listFrame: list ?? null,
		controls: [...controls, ...(fab ? [fab] : [])].map(
			({ control, height, width, x, y }) => ({ control, height, width, x, y }),
		),
	};
}

function startupPassed(metrics, expectedBuildId) {
	return (
		hasSingleStartupPresentation(metrics) &&
		hasUsableStartupFrame(metrics, expectedBuildId)
	);
}

function hasSingleStartupPresentation(metrics) {
	return (
		metrics.presentationsBeforePreparation === 1 &&
		metrics.totalListPresentations === 1
	);
}

function hasUsableStartupFrame(metrics, expectedBuildId) {
	return Boolean(
		expectedBuildId &&
			metrics.preview &&
			metrics.prepared &&
			metrics.listFrame &&
			metrics.listFrame.at < metrics.prepared.at &&
			metrics.previewHasChrome &&
			metrics.firstFrame.controlsWithinFirstFrame &&
			metrics.preparationDelayMs > 0,
	);
}

function findEvent(events, names) {
	return events.find((event) => names.includes(event.event));
}

function matchingEvents(events, name) {
	return events.filter((event) => event.event === name);
}

function before(reference, events) {
	return events.filter((event) => reference && event.at < reference.at);
}

function elapsed(start, end) {
	return start && end ? round(end.at - start.at) : null;
}

function round(value) {
	return Math.round(value * 100) / 100;
}
