import { z } from 'zod';

export const updateSettingSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'Setting key is required')
    .max(50, 'Setting key cannot exceed 50 characters'),
  value: z
    .string()
    .trim()
    .min(1, 'Setting value is required')
    .max(500, 'Setting value cannot exceed 500 characters'),
  description: z
    .string()
    .trim()
    .max(255, 'Description cannot exceed 255 characters')
    .optional()
    .nullable(),
});

export const updateOperatorSchema = z.object({
  operator_name: z
    .string({
      required_error: 'Operator ismi kiritilishi shart',
    })
    .trim()
    .min(1, 'Operator ismi bo‘sh bo‘lishi mumkin emas')
    .max(100, 'Operator ismi 100 belgidan oshmasligi kerak'),
});
