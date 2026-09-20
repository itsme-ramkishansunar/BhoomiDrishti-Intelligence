'use strict';
(async()=>{
  try {
    // Loading the canonical DB module applies and repairs idempotent migrations first.
    const db=await import('../backend/db.js');
    try {
      const { bulkInitializeFeatures } = await import('../backend/domain/bulk-features.js');
      const result=bulkInitializeFeatures({onlyMissing:true,force:false});
      console.log(JSON.stringify(result.summary,null,2));
      process.exit(result.summary.failed?1:0);
    } finally { db.close(); }
  } catch(error){ console.error(`Bulk feature initialization failed: ${error.message}`); process.exit(1); }
})();
