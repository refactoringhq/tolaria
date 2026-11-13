import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { relative } from "node:path";

// Luca's exact false-positive approval, call_355180105f3041c2888d7259418acb80.
// Reports stay visible; changed bytes and expired approvals fail closed.
const legacyExpiresAt = Date.parse("2026-10-21T21:59:00Z");
const wryApprovalStartsAt = Date.parse("2026-11-13T16:37:00Z");
const wryApprovalExpiresAt = Date.parse("2026-11-16T16:37:00Z");
const legacyApprovals = [
	{
		path: "src/components/editorDependencyCompatibility.test.ts",
		lines: [27],
		rule: "security/detect-object-injection",
		sha256: "b14dbf4b01398d00951919ba37390fdf2b87da42093a6a0422d11705b9ca43c0",
	},
	{
		path: "src/utils/systemMetadata.ts",
		lines: [75],
		rule: "security/detect-object-injection",
		sha256: "9f701f6e1d819887096e9c2c0d07f963e433c05e2743d4da92ead05899dbba5b",
	},
	{
		path: "apps/mobile/scripts/test-ios-panel-gestures.mjs",
		lines: [18],
		rule: "codacy.tools-configs.typescript.react.security.react-insecure-request.react-insecure-request",
		sha256: "9c7e3c082656acdc111dbe011a1ac466211e4543473032b591648c39a96bde29",
	},
	{
		path: "apps/mobile/src/workspace/git/expoGitFileSystem.test.ts",
		lines: [21, 22, 23, 25, 31, 32, 33, 36, 42],
		rule: "codacy.tools-configs.javascript_pathtraversal_rule-non-literal-fs-filename",
		sha256: "9ac8729e7d5c61b3dfc0d9f8adef79d0e82bb6e27b4b85db39f14bfa9de2b3c3",
	},
	{
		path: "apps/mobile/src/workspace/mobileMarkdownListHtml.ts",
		lines: [104],
		rule: "codacy.tools-configs.javascript.browser.security.raw-html-join.raw-html-join",
		sha256: "ae1de0717a97369777cd34154d2a325da1e5053a52534be9bf27327539aac008",
	},
	// R2BlobStore fetch: endpoint is validated operator config, not user input (decision: Karn, 2026-10-23)
	{
		path: "apps/server/src/store.ts",
		lines: [93, 106, 121, 135],
		rule: "codacy.tools-configs.rules_lgpl_javascript_ssrf_rule-node-ssrf",
		sha256: "b21837f65bb5b4d00f3743634b460d91e60fe5d208ad7552c95ce667e272ad35",
	},
];

// Luca approved these exact inherited findings on 2026-11-13; expires after 72 hours.
const wryApprovals = [
	{
		path: "vendor/wry/src/android/main_pipe.rs",
		lines: [30, 31, 94, 135],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "65d757482028ba36fdcc8c8fe288e771988c7142549abd29e004b0bdebabd8ea",
	},
	{
		path: "vendor/wry/src/android/mod.rs",
		lines: [187],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "ee15a76371a0a809b3b44282f6038ba9bbe7cf341c69b607c6d76f127233ecda",
	},
	{
		path: "vendor/wry/src/webkitgtk/drag_drop.rs",
		lines: [41, 45],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "e3e52b6c32543c7e415244766a4a9da1decb028b50ccaaf3d981f8566acc8ed8",
	},
	{
		path: "vendor/wry/src/webkitgtk/mod.rs",
		lines: [
			79, 98, 157, 214, 217, 229, 230, 328, 460, 561, 829, 882, 884, 1140, 1160,
			1161, 1162, 1222,
		],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "276f4449a1c5e7c7ee8ca67cbde44f8a5605c75fd5529cc597f6ac2d3b41afa5",
	},
	{
		path: "vendor/wry/src/webkitgtk/web_context.rs",
		lines: [250, 251],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "ef43edb59e19e60743c7858be846cac23ce8e7a188f77b12ac7e0a82a907628f",
	},
	{
		path: "vendor/wry/src/webview2/drag_drop.rs",
		lines: [
			54, 60, 69, 70, 167, 170, 178, 193, 207, 209, 215, 220, 233, 235, 238,
			245,
		],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "ec03770d82dbbf47cbc3932a1b709bd8aed5a0914e20b6afdcc6629fed99c7ee",
	},
	{
		path: "vendor/wry/src/webview2/mod.rs",
		lines: [
			42, 72, 74, 76, 115, 152, 213, 222, 229, 250, 267, 326, 389, 429, 433,
			447, 453, 463, 466, 469, 479, 499, 531, 535, 540, 543, 554, 1208, 1309,
			1326, 1345, 1393, 1398, 1407, 1411, 1418, 1424, 1428, 1441, 1464, 1478,
			1494, 1503, 1631, 1673, 1683, 1694, 1720, 1734, 1738, 1749, 1754, 1797,
			1845,
		],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "f8abc032e2f0acdb04d865e5e88d0ec11e2841944e24dc7089cd4b55f140af20",
	},
	{
		path: "vendor/wry/src/webview2/util.rs",
		lines: [26, 31],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "068edfbcda4060a789f9e1f6dea83ba748e560a33c17179aa7839425f52ade39",
	},
	{
		path: "vendor/wry/src/wkwebview/class/document_title_changed_observer.rs",
		lines: [63, 65, 83],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "7e09f34f232f7838ecfa11c0d75d0361d32df91aa9ce9e041915e316f0784af8",
	},
	{
		path: "vendor/wry/src/wkwebview/class/url_scheme_handler.rs",
		lines: [30, 63],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "1cc38a32613b6f281f94aa54e45ac1be0bab78b083990ef09112256e3d263e94",
	},
	{
		path: "vendor/wry/src/wkwebview/class/wry_download_delegate.rs",
		lines: [65],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "d52460df67678eccb4c5d409c9d24a81d5c63ff04eee6a76e5558c9ccd341756",
	},
	{
		path: "vendor/wry/src/wkwebview/class/wry_navigation_delegate.rs",
		lines: [156],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "e858a92f23ddb5d67d117ed5c64c31782a49e3d6234a96c364e0c06ab5e16cb6",
	},
	{
		path: "vendor/wry/src/wkwebview/class/wry_web_view_delegate.rs",
		lines: [90, 93],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "97559a443b53682d98858effed722774b309b7d72aac1aacc573f1d989fae093",
	},
	{
		path: "vendor/wry/src/wkwebview/class/wry_web_view_parent.rs",
		lines: [57, 69],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "c405e3ea1d2e062a43847c6d7c91be6da36026f3230bf47f2661bddc6852012a",
	},
	{
		path: "vendor/wry/src/wkwebview/class/wry_web_view_ui_delegate.rs",
		lines: [43, 78, 280],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "f9bab65e7ff279786b28935725321a1ee6fe8804c5ca3072d042198f6562c497",
	},
	{
		path: "vendor/wry/src/wkwebview/download.rs",
		lines: [23, 38, 53, 94, 109],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "3b67113c3d13a2082992d284a1e995e07c06a9b892b3ed2dae9b7370daa0f6c0",
	},
	{
		path: "vendor/wry/src/wkwebview/drag_drop.rs",
		lines: [39, 40, 47, 57, 63, 84, 85, 92, 102],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "10bf1524a41d586810cae18d318629da3768e69a1b0ab59ad04dfd69840d83c7",
	},
	{
		path: "vendor/wry/src/wkwebview/mod.rs",
		lines: [
			175, 191, 208, 725, 779, 807, 812, 825, 843, 851, 865, 903, 913, 923, 934,
			945, 964, 994, 1018, 1050, 1204, 1230, 1251, 1271, 1297, 1308, 1340, 1349,
			1350, 1359, 1367, 1401,
		],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "686ef932c341c2a5a7317419f7be36af557c4fe262ee7de2f819d01510299cad",
	},
	{
		path: "vendor/wry/src/wkwebview/navigation.rs",
		lines: [22, 56, 92],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "1898665e051edf10124178aa596b02dd121b33e1ccf7bb48b54d859d46e73aae",
	},
	{
		path: "vendor/wry/src/wkwebview/proxy.rs",
		lines: [30],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "f7ee208069b3d4d045540c46b842c71f0fa2bba905b20463e67679471f58ad20",
	},
	{
		path: "vendor/wry/src/wkwebview/synthetic_mouse_events.rs",
		lines: [10, 34],
		rule: "codacy.tools-configs.rust.lang.security.unsafe-usage.unsafe-usage",
		sha256: "dfb97e2256b747a92385a2acd3421b8ec3501b6f977052dd9211007d1c67858f",
	},
];

const approvals = [
	...legacyApprovals.map((approval) => ({
		...approval,
		expiresAt: legacyExpiresAt,
	})),
	...wryApprovals.map((approval) => ({
		...approval,
		startsAt: wryApprovalStartsAt,
		expiresAt: wryApprovalExpiresAt,
	})),
];

export function partitionApprovedReports(failures, root, options = {}) {
	const { now = Date.now(), read = readFileSync, channel } = options;
	const result = { approved: [], blocking: [] };
	for (const failure of failures) {
		const approved =
			channel !== "stable" && matchesApproval(failure, root, read, now);
		result[approved ? "approved" : "blocking"].push(failure);
	}
	return result;
}

function matchesApproval(failure, root, read, now) {
	const approval = findApproval(failure, root);
	if (!isActiveApproval(approval, now)) return false;
	return sourceMatchesApproval(failure.path, approval, read);
}

function findApproval(failure, root) {
	if (!failure.path) return null;
	const path = relative(root, failure.path);
	return approvals.find(
		(row) =>
			row.path === path &&
			row.rule === failure.rule &&
			row.lines.includes(failure.line),
	);
}

function isActiveApproval(approval, now) {
	return Boolean(
		approval && now >= (approval.startsAt ?? 0) && now < approval.expiresAt,
	);
}

function sourceMatchesApproval(path, approval, read) {
	try {
		return (
			createHash("sha256").update(read(path)).digest("hex") === approval.sha256
		);
	} catch {
		return false;
	}
}
