import { type ResultAsync } from 'neverthrow';

import { WORKER_MESSAGES } from '@/constants/messages';
import { type DiscordInteraction, discordInteractionSchema } from '@/schemas/discord';
import { type InteractionEnv } from '@/schemas/env';
import { publishArticleWithComment } from '@/services/microCmsPublishService';
import { verifyDiscordSignature } from '@/utils/discordVerify';

const DISCORD_API_BASE = 'https://discord.com/api/v10';
const INTERACTION_TYPE_PING = 1;
const INTERACTION_TYPE_COMPONENT = 3;
const INTERACTION_TYPE_MODAL_SUBMIT = 5;
const MODAL_PREFIX = 'publish_modal:';
const SUBMIT_PREFIX = 'publish_submit:';
const COMMENT_INPUT_ID = 'comment_input';

export type InteractionDeps = {
  verifySignature: typeof verifyDiscordSignature;
  publishArticle: (
    env: InteractionEnv,
    contentId: string,
    comment: string,
  ) => ResultAsync<void, Error>;
  fetchFn: typeof fetch;
};

export const defaultInteractionDeps: InteractionDeps = {
  verifySignature: verifyDiscordSignature,
  publishArticle: (env, contentId, comment) => publishArticleWithComment(env, contentId, comment),
  fetchFn: fetch,
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function buildModalResponse(contentId: string): Response {
  return jsonResponse({
    type: 9,
    data: {
      custom_id: `${SUBMIT_PREFIX}${contentId}`,
      title: WORKER_MESSAGES.MODAL_TITLE,
      components: [
        {
          type: 1,
          components: [
            {
              type: 4,
              custom_id: COMMENT_INPUT_ID,
              label: WORKER_MESSAGES.MODAL_INPUT_LABEL,
              style: 2,
              required: false,
              placeholder: WORKER_MESSAGES.MODAL_INPUT_PLACEHOLDER,
              max_length: 1000,
            },
          ],
        },
      ],
    },
  });
}

function extractModalComment(interaction: DiscordInteraction): string {
  const rows = interaction.data?.components ?? [];
  for (const row of rows) {
    const input = row.components?.find((item) => item.custom_id === COMMENT_INPUT_ID);
    if (input?.value !== undefined) {
      return input.value.trim();
    }
  }

  return '';
}

async function sendFollowupMessage(
  applicationId: string,
  interactionToken: string,
  content: string,
  fetchFn: typeof fetch,
): Promise<void> {
  const url = `${DISCORD_API_BASE}/webhooks/${applicationId}/${interactionToken}`;
  const res = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    console.error(`Discord Followup送信エラー (${res.status}): ${await res.text()}`);
  }
}

async function executeAsyncPublish(
  env: InteractionEnv,
  interaction: DiscordInteraction,
  contentId: string,
  comment: string,
  deps: InteractionDeps,
): Promise<void> {
  const result = await deps.publishArticle(env, contentId, comment);
  const message = result.isOk()
    ? WORKER_MESSAGES.PUBLISH_SUCCESS(contentId, comment)
    : WORKER_MESSAGES.PUBLISH_FAILED(contentId, result.error.message);

  await sendFollowupMessage(interaction.application_id, interaction.token, message, deps.fetchFn);
}

/**
 * Discord Interactions HTTP リクエストを検証・処理し、レスポンスを返す
 */
export async function handleDiscordInteraction(
  request: Request,
  env: InteractionEnv,
  ctx: Pick<ExecutionContext, 'waitUntil'>,
  deps: InteractionDeps = defaultInteractionDeps,
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  const rawBody = await request.text();

  if (!signature || !timestamp) {
    return new Response('Missing signature headers', { status: 401 });
  }

  const isValid = await deps.verifySignature({
    publicKey: env.DISCORD_PUBLIC_KEY,
    signature,
    timestamp,
    body: rawBody,
  });

  if (!isValid) {
    return new Response('Invalid request signature', { status: 401 });
  }

  const parsed = discordInteractionSchema.safeParse(JSON.parse(rawBody));
  if (!parsed.success) {
    return new Response('Invalid interaction payload', { status: 400 });
  }

  const interaction = parsed.data;
  if (interaction.type === INTERACTION_TYPE_PING) {
    return jsonResponse({ type: 1 });
  }

  const customId = interaction.data?.custom_id ?? '';
  if (interaction.type === INTERACTION_TYPE_COMPONENT && customId.startsWith(MODAL_PREFIX)) {
    const contentId = customId.slice(MODAL_PREFIX.length);
    return buildModalResponse(contentId);
  }

  if (interaction.type === INTERACTION_TYPE_MODAL_SUBMIT && customId.startsWith(SUBMIT_PREFIX)) {
    const contentId = customId.slice(SUBMIT_PREFIX.length);
    const comment = extractModalComment(interaction);
    ctx.waitUntil(executeAsyncPublish(env, interaction, contentId, comment, deps));
    return jsonResponse({ type: 5 });
  }

  return jsonResponse({ type: 4, data: { content: WORKER_MESSAGES.UNKNOWN_INTERACTION, flags: 64 } });
}
