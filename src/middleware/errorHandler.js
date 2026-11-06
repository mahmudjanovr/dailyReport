import { ZodError } from 'zod';
import { AppError } from '../utils/errors.js';
import { config } from '../config/env.js';

export function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // 1. Zod Validation Errors
  if (err instanceof ZodError) {
    const formattedErrors = err.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
        details: formattedErrors,
      },
    });
  }

  // 2. Custom AppError instances
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    });
  }

  // 3. SQLite Constraint Violations from better-sqlite3
  if (err && typeof err.code === 'string' && err.code.startsWith('SQLITE_CONSTRAINT')) {
    let statusCode = 400;
    let message = 'Database constraint violation';
    const code = err.code;

    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      statusCode = 409;
      message = 'Duplicate entry conflict with existing records';
    } else if (err.code === 'SQLITE_CONSTRAINT_CHECK') {
      statusCode = 400;
      message = 'Check constraint failed: value violates business rule (e.g., non-negative count)';
    } else if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      statusCode = 400;
      message = 'Referenced entity does not exist';
    }

    return res.status(statusCode).json({
      success: false,
      error: {
        code,
        message,
        details: config.NODE_ENV === 'development' ? err.message : null,
      },
    });
  }

  // 4. Bad JSON payload syntax error
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_JSON',
        message: 'Malformed JSON payload provided in request body',
      },
    });
  }

  // 5. Unhandled / Unexpected server errors
  if (config.NODE_ENV !== 'test') {
    console.error('💥 Unhandled error occurred:', err);
  }

  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: config.NODE_ENV === 'production'
        ? 'An unexpected error occurred on the server'
        : err.message,
      stack: config.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
}
