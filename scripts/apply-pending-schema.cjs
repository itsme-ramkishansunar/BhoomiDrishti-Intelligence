'use strict';
(async()=>{
  try {
    const db=await import('../backend/db.js');
    const version=await import('../backend/domain/bulk-features.js').then(m=>m.BULK_FEATURE_REGISTRY_VERSION);
    console.log(`Schema initialized/verified for ${version}.`);
    db.close();
  } catch(e) { console.error(`Pending schema application failed: ${e.message}`); process.exit(1); }
})();
