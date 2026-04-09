import { z } from 'zod';

const booleanQuerySchema = z.preprocess((value) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }

  return value;
}, z.boolean());

const notificationSortFieldSchema = z.enum(['createdAt', 'readAt', 'type', 'title']);

type NotificationSortField = z.infer<typeof notificationSortFieldSchema>;

function resolveSort(
  value: {
    order?: string;
    sortBy?: NotificationSortField;
    sortOrder?: 'asc' | 'desc';
  },
  defaultSortBy: NotificationSortField,
  defaultSortOrder: 'asc' | 'desc',
) {
  if (!value.order) {
    return {
      sortBy: value.sortBy ?? defaultSortBy,
      sortOrder: value.sortOrder ?? defaultSortOrder,
    };
  }

  const normalizedOrder = value.order.trim();
  const sortOrder = normalizedOrder.startsWith('-') ? 'desc' : 'asc';
  const rawSortBy = normalizedOrder.replace(/^-/, '') as NotificationSortField;
  const parsed = notificationSortFieldSchema.safeParse(rawSortBy);

  return {
    sortBy: parsed.success ? parsed.data : (value.sortBy ?? defaultSortBy),
    sortOrder,
  };
}

export const listNotificationsQuerySchema = z
  .object({
    isRead: booleanQuerySchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    order: z.string().trim().min(1).optional(),
    sortBy: notificationSortFieldSchema.optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  })
  .transform((value) => ({
    ...value,
    ...resolveSort(value, 'createdAt', 'desc'),
  }));

export const notificationIdParamSchema = z.object({
  id: z.string().uuid('ID da notificação inválido'),
});

export type ListNotificationsQueryInput = z.infer<typeof listNotificationsQuerySchema>;
export type NotificationIdParams = z.infer<typeof notificationIdParamSchema>;
