const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');
const MIGRATIONS_DIR = path.join(__dirname, '..', 'data', 'migrations');

function loadDb() {
  const raw = fs.readFileSync(DB_PATH, 'utf-8');
  return JSON.parse(raw);
}

function saveDb(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

function run() {
  // Create db.json if it doesn't exist
  if (!fs.existsSync(DB_PATH)) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    fs.writeFileSync(DB_PATH, '[]', 'utf-8');
    console.log('[migrator] Created new database at', DB_PATH);
  }

  let data = loadDb();

  // Handle legacy format: bare array → structured object
  if (Array.isArray(data)) {
    data = { _meta: { version: 0 }, books: data };
  }
  if (!data._meta) data._meta = { version: 0 };
  if (!data.books) data.books = [];

  const currentVersion = data._meta.version;

  // Load all migration files sorted by version
  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.js'))
    .sort();

  let applied = 0;
  for (const file of files) {
    const migration = require(path.join(MIGRATIONS_DIR, file));
    if (migration.version > currentVersion) {
      console.log(`[migrator] Applying migration ${file} (v${migration.version})`);
      data = migration.up(data);
      data._meta.version = migration.version;
      applied++;
    }
  }

  saveDb(data);
  if (applied > 0) {
    console.log(`[migrator] ${applied} migration(s) applied. Now at v${data._meta.version}`);
  } else {
    console.log(`[migrator] Database up to date (v${data._meta.version})`);
  }
}

module.exports = { run };
