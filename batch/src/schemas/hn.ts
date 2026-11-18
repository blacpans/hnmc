import { z } from 'zod';

export const hnTopStoriesSchema = z.array(z.number().int().positive());

export const hnItemSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1),
  url: z.string().url().optional(),
  score: z.number().int().nonnegative().optional(),
  type: z.string().optional(),
});

export type HnItem = z.infer<typeof hnItemSchema>;
