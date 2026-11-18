import { z } from 'zod';

export const geminiSummarySchema = z.object({
  jaTitle: z.string().min(1),
  summary: z.string().min(1),
});

export type GeminiSummary = z.infer<typeof geminiSummarySchema>;

export const geminiApiResponseSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z.object({
          parts: z.array(
            z.object({
              text: z.string(),
            }),
          ),
        }),
      }),
    )
    .min(1),
});
