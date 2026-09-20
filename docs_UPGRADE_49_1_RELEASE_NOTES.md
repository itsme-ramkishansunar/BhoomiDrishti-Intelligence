# UPGRADE 49.1 — Windows Local Launcher Fix

## Purpose
Fix the Windows `npm run start:all` launcher where Node could fail with `spawn EINVAL` when invoking `npm.cmd` directly.

## Change
The local launcher now uses Node child-process shell mode on Windows while preserving direct process spawning on non-Windows platforms.

## Safety
No application intelligence, database schema, AI, prediction, alert, MLOps, replay, or evidence logic was changed. This is an isolated launcher/runtime fix.
