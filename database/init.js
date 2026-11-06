import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { config } from '../src/config/env.js';
import { getDb, createDbConnection } from '../src/config/database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const INITIAL_CATEGORIES = [
  { key: 'ko_tarmadi', label: 'Ko‘tarmadi', sort_order: 1 },
  { key: 'rad_etish', label: 'Rad etish', sort_order: 2 },
  { key: 'xizmat_doirasidan_tashqarida', label: 'Xizmat doirasidan tashqarida', sort_order: 3 },
  { key: 'ochirilgan', label: 'O‘chirilgan', sort_order: 4 },
  { key: 'bolasi_kichkina', label: 'Bolasi kichkina', sort_order: 5 },
  { key: '11_yosh', label: '11 yosh', sort_order: 6 },
  { key: 'maslahatlashay', label: 'Maslahatlashay', sort_order: 7 },
  { key: 'keladi', label: 'Keladi', sort_order: 8 },
  { key: 'farzandi_yoq', label: 'Farzandi yo‘q', sort_order: 9 },
  { key: 'notogri_raqam', label: 'Noto‘g‘ri raqam', sort_order: 10 },
  { key: 'raqam_egasi_boshqa', label: 'Raqam egasi boshqa', sort_order: 11 },
];

export const INITIAL_SETTINGS = [
  {
    key: 'default_operator_name',
    value: config.DEFAULT_OPERATOR_NAME,
    description: 'Default operator for daily reports',
  },
  {
    key: 'timezone',
    value: config.BUSINESS_TIMEZONE,
    description: 'Business-day timezone identifier',
  },
  {
    key: 'app_name',
    value: 'Operator Daily Report',
    description: 'Application display name',
  },
  {
    key: 'schema_version',
    value: '1',
    description: 'Database schema migration version',
  },
];

/**
 * Initializes the database schema and idempotently seeds initial categories and settings.
 *
 * @param {import('better-sqlite3').Database} [db=getDb()]
 * @returns {{ initialized: boolean, tables: string[], categoriesCount: number, settingsCount: number }}
 */
export function initializeDatabase(db = getDb()) {
  try {
    const schemaPath = path.resolve(__dirname, 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema file not found at: ${schemaPath}`);
    }

    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    db.pragma('busy_timeout = 10000');

    // Execute schema in a migration-safe transaction
    db.transaction(() => {
      // Execute table and index creation statements
      db.exec(schemaSql);

      // Seed categories idempotently
      const categoryStmt = db.prepare(`
        INSERT INTO categories (key, label, sort_order, is_active)
        VALUES (@key, @label, @sort_order, 1)
        ON CONFLICT(key) DO UPDATE SET
          label = excluded.label,
          sort_order = excluded.sort_order,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      `);

      for (const cat of INITIAL_CATEGORIES) {
        categoryStmt.run(cat);
      }

      // Seed settings idempotently
      const settingStmt = db.prepare(`
        INSERT INTO settings (key, value, description)
        VALUES (@key, @value, @description)
        ON CONFLICT(key) DO NOTHING
      `);

      for (const setting of INITIAL_SETTINGS) {
        settingStmt.run(setting);
      }
    })();

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
      .all()
      .map((row) => row.name);

    const categoriesCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    const settingsCount = db.prepare('SELECT COUNT(*) as count FROM settings').get().count;

    return {
      initialized: true,
      tables,
      categoriesCount,
      settingsCount,
    };
  } catch (error) {
    console.error('❌ Failed to initialize database:', error);
    throw error;
  }
}

// Run CLI migration when executed directly
const isDirectExecution =
  process.argv[1] &&
  (path.resolve(process.argv[1]) === path.resolve(__filename) ||
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href);

if (isDirectExecution) {
  console.log('🔄 Initializing SQLite database...');
  try {
    const result = initializeDatabase();
    console.log('✅ Database initialization successful!');
    console.log(`📁 Database Path: ${config.dbAbsolutePath}`);
    console.log(`📋 Tables: ${result.tables.join(', ')}`);
    console.log(`🏷️  Categories seeded: ${result.categoriesCount}`);
    console.log(`⚙️  Settings configured: ${result.settingsCount}`);
    process.exit(0);
  } catch (err) {
    console.error('💥 Database initialization failed:', err);
    process.exit(1);
  }
}
