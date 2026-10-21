require('dotenv').config();
const fs = require('fs');
const path = require('path');
const connectDB = require('../config/db');
const Document = require('../models/Document');
const { getStorageDir } = require('../middleware/uploadValidator');

// Only removes the three exact sample records created by seed.js.
// Dry-run by default; pass --confirm to delete these documents and their stored files.
const DEMO_TITLES = [
  'Executive Compensation & Bonus Schedule 2026',
  'Enterprise Vendor Master Services Agreement',
  'TrustVault Core Security Architecture Blueprint'
];

async function main() {
  await connectDB();
  const docs = await Document.find({ title: { $in: DEMO_TITLES } }).select('_id title storageKey');
  if (!docs.length) {
    console.log('[cleanupDemoDocuments] No matching seeded sample documents found.');
    process.exit(0);
  }

  console.log(`[cleanupDemoDocuments] ${process.argv.includes('--confirm') ? 'Deleting' : 'Dry run — would delete'} ${docs.length} exact-match sample document(s):`);
  for (const doc of docs) console.log(`- ${doc.title} (${doc._id})`);

  if (!process.argv.includes('--confirm')) {
    console.log('\nNo data changed. Run with --confirm to delete only the exact titles listed above.');
    process.exit(0);
  }

  const storageDir = getStorageDir();
  for (const doc of docs) {
    if (doc.storageKey) {
      const filePath = path.resolve(storageDir, path.basename(doc.storageKey));
      if (filePath.startsWith(path.resolve(storageDir) + path.sep) && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    await Document.deleteOne({ _id: doc._id });
  }

  console.log(`[cleanupDemoDocuments] Deleted ${docs.length} sample document(s). Audit history was left intact.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('[cleanupDemoDocuments] Failed:', error.message);
  process.exit(1);
});
