import { z } from 'zod';
import { isValidDateString } from '../utils/date.js';

export const reportEntrySchema = z.object({
  category_id: z.number().int().positive('Category ID must be a positive integer'),
  count: z
    .number({
      required_error: 'Miqdor kiritilishi shart (Count is required)',
      invalid_type_error: 'Miqdor butun son bo‘lishi kerak (Count must be an integer)',
    })
    .int('Miqdor butun son bo‘lishi kerak (Count must be an integer)')
    .min(0, 'Miqdor noldan kichik bo‘lishi mumkin emas (Count cannot be negative)'),
  notes: z.string().trim().max(500, 'Izoh 500 belgidan oshmasligi kerak').optional().nullable(),
});

export const saveSingleEntrySchema = z.object({
  report_id: z.number().int().positive('Report ID must be a positive integer'),
  category_id: z.number().int().positive('Category ID must be a positive integer'),
  count: z
    .number({
      required_error: 'Miqdor kiritilishi shart',
      invalid_type_error: 'Miqdor butun son bo‘lishi kerak',
    })
    .int('Miqdor butun son bo‘lishi kerak')
    .min(0, 'Miqdor manfiy bo‘lishi mumkin emas'),
  notes: z.string().trim().max(500).optional().nullable(),
});

export const createReportSchema = z.object({
  operator_name: z
    .string()
    .trim()
    .min(1, 'Operator ismi kiritilishi shart')
    .max(100, 'Operator ismi 100 belgidan oshmasligi kerak')
    .default('Rahmatillo'),
  report_date: z
    .string({
      required_error: 'Hisobot sanasi kiritilishi shart',
    })
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Sana YYYY-MM-DD formatida bo‘lishi kerak')
    .refine(isValidDateString, 'Sana to‘g‘ri kalendar sanasi bo‘lishi kerak (valid calendar date)'),
  status: z.enum(['draft', 'submitted', 'archived']).default('draft'),
  notes: z
    .string()
    .trim()
    .max(1000, 'Hisobot izohi 1000 belgidan oshmasligi kerak')
    .optional()
    .nullable(),
  entries: z
    .array(reportEntrySchema)
    .optional(),
});

export const updateReportSchema = createReportSchema.partial();

export const historyQuerySchema = z.object({
  from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'from sanasi YYYY-MM-DD bo‘lishi kerak')
    .refine(isValidDateString, 'from sanasi noto‘g‘ri')
    .optional(),
  to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'to sanasi YYYY-MM-DD bo‘lishi kerak')
    .refine(isValidDateString, 'to sanasi noto‘g‘ri')
    .optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50).optional(),
  offset: z.coerce.number().int().min(0).default(0).optional(),
});
