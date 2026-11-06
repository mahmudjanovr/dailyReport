import path from 'node:path';
import dotenv from 'dotenv';
import { z } from 'zod';

// Load environment variables from .env file
dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .default('3000')
    .transform((val) => {
      const parsed = Number.parseInt(val, 10);
      if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
        throw new Error(`Invalid PORT value: ${val}`);
      }
      return parsed;
    }),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  DB_PATH: z
    .string()
    .default('storage/data/operator_daily_report.sqlite'),
  REPORTS_DIR: z
    .string()
    .default('storage/reports'),
  DEFAULT_OPERATOR_NAME: z
    .string()
    .trim()
    .min(1, 'Operator name cannot be empty')
    .default('Rahmatillo'),
  BUSINESS_TIMEZONE: z
    .string()
    .default('Asia/Tashkent')
    .refine((tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, { message: 'Invalid IANA time zone identifier' })
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error('❌ Environment configuration validation error:');
  for (const issue of parsedEnv.error.issues) {
    console.error(` - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const rootDir = process.cwd();

export const config = {
  ...parsedEnv.data,
  rootDir,
  dbAbsolutePath: path.isAbsolute(parsedEnv.data.DB_PATH)
    ? parsedEnv.data.DB_PATH
    : path.resolve(rootDir, parsedEnv.data.DB_PATH),
  reportsAbsolutePath: path.isAbsolute(parsedEnv.data.REPORTS_DIR)
    ? parsedEnv.data.REPORTS_DIR
    : path.resolve(rootDir, parsedEnv.data.REPORTS_DIR),
};

export default config;
