'use strict';
(async()=>{
  try {
    const db=await import('../backend/db.js');
    try {
      const { DB_PATH } = await import('../backend/runtime-paths.cjs');
      // The canonical DB module performs the self-healing migration at import time.
      // Verify the repaired tables using the exported database handle through the
      // existing bulk-feature APIs, without touching project data.
      const bulk = await import('../backend/domain/bulk-features.js');
      const status = bulk.getBulkFeatureStatus();
      console.log(`Bulk feature schema verified: ${status.version}`);
      console.log(`Database: ${DB_PATH}`);
      console.log(`Projects: ${status.projectCount}`);
      console.log(`Initialized projects: ${status.initializedProjects}`);
    } finally { db.close(); }
  } catch(error) {
    console.error(`Bulk feature schema repair failed: ${error.message}`);
    process.exit(1);
  }
})();
