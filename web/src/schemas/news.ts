import { z } from 'zod';

export const newsItemSchema = z.object({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  publishedAt: z.string().optional(),
  revisedAt: z.string().optional(),
  hnId: z.string().min(1),
  title: z.string().min(1),
  jaTitle: z.string().min(1),
  aiSummary: z.string().min(1),
  url: z.string().url(),
  score: z.number().int().nonnegative(),
  comment: z.string().optional(),
});

export type NewsItem = z.infer<typeof newsItemSchema>;

export const microCmsNewsListSchema = z.object({
  contents: z.array(newsItemSchema),
  totalCount: z.number().int().nonnegative(),
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
});
