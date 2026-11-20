import { z } from 'zod';

const modalComponentItemSchema = z.object({
  custom_id: z.string().optional(),
  value: z.string().optional(),
});

const modalActionRowSchema = z.object({
  components: z.array(modalComponentItemSchema).optional(),
});

export const discordInteractionSchema = z.object({
  type: z.number().int(),
  application_id: z.string().min(1),
  token: z.string().min(1),
  data: z
    .object({
      custom_id: z.string().optional(),
      components: z.array(modalActionRowSchema).optional(),
    })
    .optional(),
});

export type DiscordInteraction = z.infer<typeof discordInteractionSchema>;
