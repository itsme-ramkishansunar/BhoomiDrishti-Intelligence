#!/usr/bin/env node
import("../backend/domain/bulk-initialization.js")
  .then(({ bulkInitializeProjects }) => {
    const result = bulkInitializeProjects({ onlyMissing: true, actor: "cli-bulk-initializer" });
    console.log(JSON.stringify(result.summary, null, 2));
    if (result.summary.failed > 0) process.exit(1);
    console.log(`Bulk initialization PASSED: ${result.summary.projectCount} project(s), ${result.summary.initialized} initialized, ${result.summary.skipped} already ready.`);
  })
  .catch((error) => {
    console.error(`Bulk initialization FAILED: ${error?.message || error}`);
    process.exit(1);
  });
