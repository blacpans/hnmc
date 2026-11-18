import { z } from 'zod';

export const microCmsListCheckSchema = z.object({
  totalCount: z.number().int().nonnegative(),
});

export const microCmsCreateResponseSchema = z.object({
  id: z.string().min(1),
});

export type MicroCmsDraftPayload = {
  hnId: string;
  title: string;
  jaTitle: string;
  aiSummary: string;
  url: string;
  score: number;
  comment: string;
};
