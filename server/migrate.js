// Run: node server/migrate.js
// Requires DATABASE_URL in server/.env
// Get it from: Supabase → Settings → Database → Connection String → URI

require('dotenv/config');
const { Client } = require('pg');

const DATABASE_URL = process.env['DATABASE_URL'];
if (!DATABASE_URL) {
  console.error('\nMissing DATABASE_URL in server/.env');
  console.error('Get it from: Supabase dashboard → Settings → Database → Connection String → URI\n');
  process.exit(1);
}

const migrations = [
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS photo_gallery jsonb`,
  `ALTER TABLE posts ADD COLUMN IF NOT EXISTS video_url text`,
  `NOTIFY pgrst, 'reload schema'`,
];

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('Connected to database.\n');
  for (const sql of migrations) {
    process.stdout.write(`  → ${sql} ... `);
    await client.query(sql);
    console.log('ok');
  }
  await client.end();
  console.log('\nMigrations complete.\n');
}

run().catch(err => { console.error('\nMigration failed:', err.message); process.exit(1); });
