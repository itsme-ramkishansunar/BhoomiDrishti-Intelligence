# BHOOMIDHRISHTI Upgrade 50.2 — New-Project Smoke Cleanup

## Purpose
Surgical test-harness fix following Windows `EPERM` cleanup failure in `smoke:new-project-write`.

## Change
The smoke test now closes the SQLite database before removing its temporary test directory. This preserves the actual new-project write assertions while preventing Windows file-lock cleanup errors.

## Preserved
- New-project INSERT alignment
- Persisted retrieval
- Automatic risk calculation
- Lifecycle automation
- Predictive graphics
- AI, evidence, actions, alerts, MLOps and replay
- Production ML governance gates

## Verification
- `node --check scripts/smoke-new-project-write.cjs` PASS
- `node scripts/smoke-new-project-write.cjs` PASS

This checkpoint does not promote or claim validated production ML without authoritative historical outcome data.
