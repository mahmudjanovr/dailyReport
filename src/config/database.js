import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { config } from './env.js';

let dbInstance = null;

/**
 * Creates and configures a SQLite database connection with safe pragmas.
 *
 * @param {string} [customPath] - Path to the database file or ':memory:'
 * @param {object} [options={}] - better-sqlite3 options
 * @returns {Database.Database}
 */
export function createDbConnection(customPath = null, options = {}) {
  const dbPath = customPath || config.dbAbsolutePath;

  // If using a file path, ensure the parent directory exists
  if (dbPath !== ':memory:') {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(dbPath, {
    verbose: config.NODE_ENV === 'development' ? null : null, // keep clean unless debugging
    ...options,
  });

  // Enable critical SQLite PRAGMAs
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  // WAL mode is only valid for persistent disk databases
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
  }

  return db;
}

/**
 * Returns the singleton database instance for the application.
 * Initializes the connection if not already open.
 *
 * @returns {Database.Database}
 */
export function getDb() {
  if (!dbInstance || !dbInstance.open) {
    dbInstance = createDbConnection();
  }
  return dbInstance;
}

/**
 * Closes the active database connection gracefully.
 */
export function closeDb() {
  if (dbInstance && dbInstance.open) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Verifies database health and returns table metadata.
 *
 * @param {Database.Database} [db=getDb()]
 * @returns {{ connected: boolean, path: string, tables: string[], inMemory: boolean }}
 */
export function getDbHealth(db = getDb()) {
  try {
    const isConnected = Boolean(db && db.open);
    if (!isConnected) {
      return { connected: false, error: 'Database is closed' };
    }

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
      .all()
      .map((row) => row.name);

    return {
      connected: true,
      path: db.name,
      inMemory: db.memory,
      tables,
    };
  } catch (error) {
    return {
      connected: false,
      error: error.message,
    };
  }
}
