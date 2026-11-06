import { app } from './app.js';
import { config } from './config/env.js';
import { getDb, closeDb } from './config/database.js';
import { initializeDatabase } from '../database/init.js';

let server = null;

async function startServer() {
  try {
    // 1. Ensure database is initialized with tables, schema, and seed data
    console.log('🔄 Checking database initialization...');
    const db = getDb();
    const initResult = initializeDatabase(db);
    console.log(`✅ SQLite Database ready. Tables: ${initResult.tables.join(', ')}`);

    // 2. Start HTTP listener
    server = app.listen(config.PORT, () => {
      console.log('====================================================');
      console.log(`🚀 Operator Daily Report v1.0 is running!`);
      console.log(`📡 URL: http://localhost:${config.PORT}`);
      console.log(`🏥 Health Check: http://localhost:${config.PORT}/api/health`);
      console.log(`👤 Default Operator: ${config.DEFAULT_OPERATOR_NAME}`);
      console.log(`🕒 Business Timezone: ${config.BUSINESS_TIMEZONE}`);
      console.log(`📂 DB Storage: ${config.dbAbsolutePath}`);
      console.log(`⚙️  Environment: ${config.NODE_ENV}`);
      console.log('====================================================');
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`💥 Port ${config.PORT} is already in use. Please select a different port or terminate the existing process.`);
      } else {
        console.error('💥 Server error:', err);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('💥 Fatal error during server startup:', error);
    closeDb();
    process.exit(1);
  }
}

// Graceful shutdown handling
function handleShutdown(signal) {
  console.log(`\n🛑 Received ${signal}. Initiating graceful shutdown...`);
  if (server) {
    server.close(() => {
      console.log('🔒 HTTP server closed.');
      closeDb();
      console.log('💾 SQLite database closed.');
      console.log('👋 Bye!');
      process.exit(0);
    });

    // Force close if graceful shutdown hangs
    setTimeout(() => {
      console.error('⚠️ Forcefully terminating after timeout');
      process.exit(1);
    }, 5000).unref();
  } else {
    closeDb();
    process.exit(0);
  }
}

process.on('SIGINT', () => handleShutdown('SIGINT'));
process.on('SIGTERM', () => handleShutdown('SIGTERM'));

startServer();
