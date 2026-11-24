import { z } from 'zod';

/** NIS must always be stored as string to preserve leading zeroes */
export const nisSchema = z
  .string()
  .trim()
  .min(4, 'NIS minimal 4 karakter.')
  .max(30, 'NIS maksimal 30 karakter.')
  .regex(/^[0-9A-Za-z-]+$/, 'NIS hanya boleh berisi angka, huruf, atau tanda hubung.');

/** NIY/NIP must always be stored as string to preserve leading zeroes */
export const niyNipSchema = z
  .string()
  .trim()
  .min(4, 'NIY/NIP minimal 4 karakter.')
  .max(30, 'NIY/NIP maksimal 30 karakter.')
  .regex(/^[0-9A-Za-z.\- ]+$/, 'NIY/NIP mengandung karakter yang tidak diizinkan.');

export const timeHHMMSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Format jam harus HH:mm (contoh: 07:00).');

export const dateYYYYMMDDSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD.');

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90, 'Latitude tidak valid.').max(90, 'Latitude tidak valid.'),
  longitude: z.number().min(-180, 'Longitude tidak valid.').max(180, 'Longitude tidak valid.'),
  accuracyMeters: z.number().min(0).max(5000).nullable().optional(),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(120).optional(),
  cursor: z.string().trim().optional(),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export function formatZodErrors(error: z.ZodError): Record<string, string[]> {
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_form';
    if (!fieldErrors[key]) {
      fieldErrors[key] = [];
    }
    fieldErrors[key].push(issue.message);
  }
  return fieldErrors;
}
