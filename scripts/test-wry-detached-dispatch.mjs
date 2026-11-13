import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(
	"vendor/wry/src/wkwebview/synthetic_mouse_events.rs",
	"utf8",
);
const templateMatch = source.match(/r#"\(\(\) => \{\{([\s\S]*?)\}\}\)\(\)"#,/);
assert.ok(templateMatch, "Wry mouse event JavaScript template is present");

const template = `(() => {${templateMatch[1]}})()`;
const substitutions = new Map([
	["event_name", "mouseup"],
	["button", "3"],
	["buttons", "0"],
	["detail", "1"],
	["ctrl_key", "false"],
	["meta_key", "false"],
	["shift_key", "false"],
	["alt_key", "false"],
	["x", "10"],
	["y", "20"],
]);
const script = template
	.replaceAll("{{", "{")
	.replaceAll("}}", "}")
	.replace(
		/\{(event_name|button|buttons|detail|ctrl_key|meta_key|shift_key|alt_key|x|y)\}/g,
		(_, name) => substitutions.get(name),
	);

const navigation = [];
class MouseEvent {
	constructor(type, options) {
		this.type = type;
		this.defaultPrevented = false;
		Object.assign(this, options);
	}
}
const context = {
	document: { elementFromPoint: () => null },
	MouseEvent,
	window: {
		screenX: 0,
		screenY: 0,
		history: {
			back: () => navigation.push("back"),
			forward: () => navigation.push("forward"),
		},
	},
};

assert.doesNotThrow(
	() => vm.runInNewContext(script, context),
	"a detached mouse target must not throw",
);
assert.deepEqual(
	navigation,
	[],
	"a detached mouse target must not trigger navigation",
);
console.log(
	"PASS: detached Wry mouse target is ignored without throwing or navigating",
);
