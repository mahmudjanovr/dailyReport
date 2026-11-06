# Operator Daily Report — Full Build 1.0

A complete, production-ready personal reporting web application built for operator **Rahmatillo**, providing rapid numerical daily call logging across eight predefined categories, automatic SQLite persistence, historical report archives, and on-demand professional PDF report generation.

---

## 🌟 Key Features

1. **Dashboard (Bugungi hisobot)**:
   - Personalized welcome message: *"Xayrli ish kuni, Rahmatillo!"*
   - Current calendar date and live clock in `Asia/Tashkent` (UTC+5).
   - Real-time total count summary recalculated and verified server-side.
   - 8 category counter cards with `-1` and `+1` increment/decrement buttons, direct numerical input, quick addition pills (`+1`, `+5`, `+10`), and category percentage shares.
   - Atomic debounced autosave with optimistic UI updates and instant rollback on server error.
   - Optional notes/izoh field included in reports and PDFs.
   - One-click PDF generation button.

2. **Exactly Eleven Predefined Categories**:
   - `ko_tarmadi` — **Ko‘tarmadi**
   - `rad_etish` — **Rad etish**
   - `xizmat_doirasidan_tashqarida` — **Xizmat doirasidan tashqarida**
   - `ochirilgan` — **O‘chirilgan**
   - `bolasi_kichkina` — **Bolasi kichkina**
   - `11_yosh` — **11 yosh**
   - `maslahatlashay` — **Maslahatlashay**
   - `keladi` — **Keladi**
   - `farzandi_yoq` — **Farzandi yo‘q**
   - `notogri_raqam` — **Noto‘g‘ri raqam**
   - `raqam_egasi_boshqa` — **Raqam egasi boshqa**

3. **Report History (Tarix)**:
   - Historical daily report archives.
   - Filter by date range (`Boshlanish sanasi` and `Tugash sanasi`) and keyword search.
   - Detailed modal view displaying full category breakdown and notes for any historical date.
   - One-click historical PDF report generation and download directly from database records.

4. **Professional PDF Generation (PDFKit)**:
   - Standard A4 portrait business-document layout.
   - Full Unicode support for Uzbek characters (`O‘`, `G‘`, etc.) with cross-platform system font discovery (Windows/Linux) and Helvetica fallback.
   - Operator name, report date, generation timestamp in `Asia/Tashkent`.
   - Comprehensive summary table showing all 11 categories, counts, and calculated percentages.
   - Bold total row, notes box, operator and supervisor signature lines.
   - Filename format: `Rahmatillo_YYYY-MM-DD.pdf`.

5. **Settings & Category Visibility (Sozlamalar)**:
   - Change active operator name (persisted in SQLite `settings` table).
   - Category visibility switches (hide/show categories on the dashboard without deleting historical records).
   - System diagnostics and real-time metrics (database size, total reports, calls logged, uptime).

6. **Backup and Restore**:
   - Safe online SQLite backup export (`GET /api/backup/download`).
   - SQLite 3 header and table schema validation prior to restoration.
   - Pre-restore safety backup creation with automatic rollback protection.

7. **UI/UX Design**:
   - Clean, minimalist aesthetic with neutral backgrounds, crisp typography, and refined spacing.
   - Light & Dark mode support with `localStorage` persistence.
   - 100% in Uzbek (`O'zbekcha`).
   - Responsive on Windows desktop and mobile devices.

---

## 🛠️ Technology Stack

- **Runtime**: Node.js (v24+ / native ES Modules)
- **Framework**: Express 5 (`^5.3.0`)
- **Database**: SQLite via `better-sqlite3` (`^13.0.3`) with WAL mode (`storage/data/operator_daily_report.sqlite`)
- **Validation**: Zod (`^4.6.7`)
- **PDF Engine**: PDFKit (`^0.20.2`)
- **Configuration**: Dotenv (`^18.0.9`)
- **Frontend**: Semantic HTML5, CSS3 with CSS variables, Vanilla JavaScript (ES Modules)
- **Testing**: Node.js native test runner (`node --test`)

---

## 📁 Project Structure

```
dailyReport/
├── .env                              # Environment variables
├── .env.example                      # Template configuration
├── .gitignore                        # Git exclusion rules
├── package.json                      # Project manifest, dependencies, npm scripts
├── README.md                         # Documentation
│
├── database/
│   ├── schema.sql                    # SQLite DDL schema with indexes and constraints
│   └── init.js                       # Idempotent DB initialization and seeding runner
│
├── storage/
│   ├── data/
│   │   ├── operator_daily_report.sqlite     # Persistent SQLite database file
│   │   ├── operator_daily_report.sqlite-wal # Write-Ahead Log
│   │   └── operator_daily_report.sqlite-shm # Shared memory
│   └── reports/                      # Directory for generated PDF reports
│
├── src/
│   ├── app.js                        # Express 5 application setup
│   ├── server.js                     # HTTP server listener and graceful shutdown
│   │
│   ├── config/
│   │   ├── env.js                    # Validated environment configuration (Zod)
│   │   └── database.js               # better-sqlite3 singleton with WAL mode
│   │
│   ├── middleware/
│   │   ├── errorHandler.js           # Centralized error handler
│   │   ├── notFoundHandler.js        # 404 handler
│   │   └── requestLogger.js          # Request logger with timing
│   │
│   ├── routes/
│   │   ├── index.js                  # Master API router mounted at /api
│   │   ├── healthRoutes.js           # GET /api/health
│   │   ├── categoryRoutes.js         # GET /api/categories, PATCH /:id/toggle
│   │   ├── settingsRoutes.js         # GET /api/settings, PATCH /operator, GET /diagnostics
│   │   ├── reportRoutes.js           # GET/POST /api/reports, /entry, /history, /:id/pdf
│   │   └── backupRoutes.js           # GET /api/backup/download, POST /api/backup/restore
│   │
│   ├── services/
│   │   ├── categoryService.js        # Categories management and visibility toggle
│   │   ├── settingsService.js        # Settings and system diagnostics
│   │   ├── reportService.js          # Atomic daily report persistence and history query
│   │   ├── pdfService.js             # PDFKit business document generation
│   │   └── backupService.js          # SQLite online backup export and safe restore
│   │
│   ├── utils/
│   │   ├── date.js                   # Asia/Tashkent business-date utilities
│   │   ├── fontLoader.js             # Unicode font discovery for PDF rendering
│   │   └── errors.js                 # AppError, ValidationError, NotFoundError
│   │
│   └── validators/
│       ├── reportValidator.js        # Zod validation for daily reports & entry counts
│       └── settingsValidator.js      # Zod validation for settings and operator name
│
├── public/
│   ├── index.html                    # Single-page application interface
│   ├── css/
│   │   └── style.css                 # Responsive CSS3 styling (light & dark theme)
│   └── js/
│       ├── api.js                    # Fetch wrapper with error handling
│       ├── state.js                  # Centralized reactive state store
│       ├── dashboard.js              # Counter controls & debounced autosave
│       ├── history.js                # History listing, filter, modal, PDF trigger
│       ├── settings.js               # Operator update, category toggles, backup/restore
│       └── app.js                    # Master bootstrap, tab switching, clock & theme
│
└── tests/
    ├── database.test.js              # Schema, constraints, CASCADE, CHECK rules
    ├── health.test.js                # GET /api/health verification
    ├── validators.test.js            # Zod schemas & boundary conditions
    ├── api.test.js                   # Static serving, 404 handler, core endpoints
    ├── pdf.test.js                   # PDF generation, Unicode text, A4 layout
    ├── backup.test.js                # SQLite export, validation, safe restore
    ├── reports.test.js               # Today report, autosave entry, history search
    └── settings.test.js              # Operator update, category toggles, diagnostics
```

---

## 🗄️ Database Architecture

The SQLite database enforces foreign keys (`PRAGMA foreign_keys = ON`) and Write-Ahead Logging (`WAL` mode).

### Tables

1. **`categories`**
   - Stores the 8 predefined categories with stable string keys and Uzbek labels.
   - Columns: `id`, `key` (UNIQUE), `label`, `sort_order`, `is_active` (CHECK 0/1), `created_at`, `updated_at`.

2. **`settings`**
   - Key-value configuration table.
   - Keys: `default_operator_name` (`Rahmatillo`), `timezone` (`Asia/Tashkent`), `app_name`, `schema_version`.

3. **`daily_reports`**
   - Header table: one report per operator per calendar day.
   - Columns: `id`, `operator_name`, `report_date`, `status` (`draft`/`submitted`/`archived`), `notes`, `created_at`, `updated_at`.
   - Constraint: `UNIQUE(operator_name, report_date)`.

4. **`report_entries`**
   - Line-item counts per category for each report.
   - Columns: `id`, `report_id` (FK -> `daily_reports.id` ON DELETE CASCADE), `category_id` (FK -> `categories.id` ON DELETE RESTRICT), `count` (INTEGER CHECK `count >= 0`), `notes`, `created_at`, `updated_at`.
   - Constraint: `UNIQUE(report_id, category_id)`.

---

## 🔌 API Endpoints Summary

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | System health check (database, tables, Tashkent time) |
| `GET` | `/api/categories` | Active categories (`?all=true` includes inactive) |
| `PATCH` | `/api/categories/:id/toggle` | Toggle category visibility |
| `GET` | `/api/reports/today` | Today's report (creates automatically if missing) |
| `GET` | `/api/reports/today/pdf` | Download today's report PDF |
| `POST` | `/api/reports/entry` | Fast atomic autosave of a single category count |
| `POST` | `/api/reports` | Bulk create or update report |
| `GET` | `/api/reports/history` | List historical reports (with `from`, `to`, `search`) |
| `GET` | `/api/reports/:id` | Full report details by ID |
| `GET` | `/api/reports/:id/pdf` | Download historical report PDF |
| `DELETE` | `/api/reports/:id` | Delete report |
| `GET` | `/api/settings` | Retrieve all settings |
| `PATCH` | `/api/settings/operator` | Update operator name |
| `GET` | `/api/settings/diagnostics` | Database size, reports count, uptime |
| `GET` | `/api/backup/download` | Export online SQLite database backup |
| `POST` | `/api/backup/restore` | Restore database from uploaded SQLite buffer |

---

## 🚀 Quick Start Guide

### 1. Install Dependencies
```bash
npm install
```

### 2. Initialize Database
Initializes tables and seeds the 8 categories idempotently:
```bash
npm run db:init
```

### 3. Run Automated Tests
Runs all 42 tests across 8 test suites:
```bash
npm test
```

### 4. Start Development Server
```bash
npm run dev
```

### 5. Start Production Server
```bash
npm start
```

Open in browser:
- Application UI: [http://localhost:3000](http://localhost:3000)
- Health Check: [http://localhost:3000/api/health](http://localhost:3000/api/health)
