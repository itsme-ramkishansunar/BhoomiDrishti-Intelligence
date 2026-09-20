# Upgrade 50.1 — New Project Write Fix

Fixes a manual new-project persistence defect in U50 where the `projects` INSERT statement used 38 SQL placeholders for 37 project columns/parameters. The patch also separates manual-save errors from file-import errors and removes a duplicated file chooser control.

Adds an isolated runtime smoke test covering new-project INSERT alignment, persistence, and automatic server-side risk calculation, and includes that test in `validate:all`.
