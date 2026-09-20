const fs = require("node:fs");
const path = require("node:path");

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const app = read("src/App.jsx");
const css = read("src/index.css");
const vite = read("vite.config.js");
const checks = [
  ["global command palette", app.includes("function CommandPalette") && app.includes("Ctrl K")],
  ["project quick navigation", app.includes("openProject(match.id)")],
  ["workspace context bar", app.includes("bd-workspace-bar")],
  ["executive project snapshot", app.includes("bd-executive-snapshot")],
  ["alert summary", app.includes("bd-alert-summary")],
  ["reduced motion", css.includes("prefers-reduced-motion")],
  ["chart/vendor code splitting", vite.includes("manualChunks") && vite.includes("charts")],
  ["backend untouched by U61 contract", !app.includes("/api/") || app.includes("/api/projects")],
];
let failed = 0;
for (const [label, ok] of checks) {
  if (ok) console.log(`PASS U61: ${label}`);
  else { console.error(`FAIL U61: ${label}`); failed++; }
}
if (failed) process.exit(1);
console.log("U61 operational workspace smoke PASSED");
