// Cross-platform removal of test artifacts from dist/ (Windows has no `find`).
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "dist");

function stripTests(dir) {
	if (!fs.existsSync(dir)) return;
	for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			stripTests(full);
		} else if (/\.test\./.test(entry.name)) {
			fs.rmSync(full, { force: true });
		}
	}
	if (fs.readdirSync(dir).length === 0) fs.rmSync(dir, { recursive: true, force: true });
}

stripTests(root);
