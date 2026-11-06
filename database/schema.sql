-- ============================================================================
-- OPERATOR DAILY REPORT — SQLite Schema (Phase 1)
-- ============================================================================

-- Pragmas are handled at connection initialization:
-- PRAGMA foreign_keys = ON;
-- PRAGMA journal_mode = WAL;
-- PRAGMA busy_timeout = 5000;

-- 1. Categories Table: Predefined categories with stable keys
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    label TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 2. Settings Table: System and user configuration key-values
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 3. Daily Reports Table: One report per operator per calendar day
CREATE TABLE IF NOT EXISTS daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    operator_name TEXT NOT NULL,
    report_date TEXT NOT NULL, -- Format: YYYY-MM-DD (Asia/Tashkent business calendar date)
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'archived')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    CONSTRAINT uq_daily_reports_operator_date UNIQUE (operator_name, report_date)
);

-- 4. Report Entries Table: Category counts per daily report
CREATE TABLE IF NOT EXISTS report_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    report_id INTEGER NOT NULL,
    category_id INTEGER NOT NULL,
    count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    FOREIGN KEY (report_id) REFERENCES daily_reports (id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE RESTRICT,
    CONSTRAINT uq_report_entries_report_category UNIQUE (report_id, category_id)
);

-- Indexes for optimal lookup and reporting performance
CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON daily_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_operator ON daily_reports(operator_name);
CREATE INDEX IF NOT EXISTS idx_report_entries_report_id ON report_entries(report_id);
CREATE INDEX IF NOT EXISTS idx_report_entries_category_id ON report_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_categories_key ON categories(key);
CREATE INDEX IF NOT EXISTS idx_categories_sort_order ON categories(sort_order);
