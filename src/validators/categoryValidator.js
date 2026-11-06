import { z } from 'zod';

export const createCategorySchema = z.object({
  label: z
    .string({
      required_error: 'Toifa nomi kiritilishi shart (Category label is required)',
      invalid_type_error: 'Toifa nomi matn bo‘lishi kerak (Category label must be a string)',
    })
    .trim()
    .min(1, 'Toifa nomi bo‘sh bo‘lishi mumkin emas (Category label cannot be empty)')
    .max(100, 'Toifa nomi 100 belgidan oshmasligi kerak (Category label cannot exceed 100 characters)'),
  key: z
    .string()
    .trim()
    .min(1, 'Toifa kodi bo‘sh bo‘lishi mumkin emas')
    .max(100, 'Toifa kodi 100 belgidan oshmasligi kerak')
    .optional(),
});
