import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const source = await readFile(
	new URL(
		"../vendor/wry/src/wkwebview/synthetic_mouse_events.rs",
		import.meta.url,
	),
	"utf8",
);
const templateMatch = source.match(/r#"\(\(\) => \{\{([\s\S]*?)\}\}\)\(\)"#,/);
assert.ok(templateMatch, "Wry mouse event JavaScript template is present");

const template = `(() => {${templateMatch[1]}})()`;
const script = template
	.replaceAll("{{", "{")
	.replaceAll("}}", "}")
	.replace(
		/\{(event_name|button|buttons|detail|ctrl_key|meta_key|shift_key|alt_key|x|y)\}/g,
		(_, name) =>
			({
				event_name: "mouseup",
				button: "3",
				buttons: "0",
				detail: "1",
				ctrl_key: "false",
				meta_key: "false",
				shift_key: "false",
				alt_key: "false",
				x: "10",
				y: "20",
			})[name],
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
