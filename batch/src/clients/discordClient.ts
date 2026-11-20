import { ResultAsync } from 'neverthrow';

import { CONFIG } from '@/constants/config';
import { MESSAGES } from '@/constants/messages';

export type DraftNotificationParams = {
  serviceDomain: string;
  contentId: string;
  hnId: string;
  jaTitle: string;
  originalTitle: string;
  aiSummary: string;
  articleUrl: string;
  score: number;
};

export type DiscordBotConfig = {
  botToken: string;
  channelId: string;
};

const DISCORD_API_BASE = 'https://discord.com/api/v10';

function postDiscordRequest(url: string, payload: unknown, botToken?: string): ResultAsync<void, Error> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (botToken) {
    headers.Authorization = `Bot ${botToken}`;
  }

  return ResultAsync.fromPromise(
    (async () => {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(CONFIG.API_FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Discord送信エラー (${res.status}): ${text}`);
      }
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
}

function buildDraftEmbed(params: DraftNotificationParams, editUrl: string) {
  return {
    title: `${MESSAGES.DISCORD_EMBED_TITLE_PREFIX}\n${params.jaTitle}`,
    url: editUrl,
    color: 0xff6600,
    fields: [
      { name: MESSAGES.DISCORD_FIELD_ORIGINAL_TITLE, value: params.originalTitle },
      { name: MESSAGES.DISCORD_FIELD_SUMMARY, value: params.aiSummary },
      { name: MESSAGES.DISCORD_FIELD_SCORE, value: `${params.score} pts`, inline: true },
      {
        name: MESSAGES.DISCORD_FIELD_EDIT_LINK,
        value: `[${MESSAGES.DISCORD_EDIT_LINK_LABEL}](${editUrl})`,
        inline: true,
      },
      { name: MESSAGES.DISCORD_FIELD_ORIGINAL_LINK, value: params.articleUrl },
    ],
  };
}

/**
 * 下書き入稿完了の通知をDiscordへ送信する（Bot設定時はボタン付き、未設定時はWebhook送信）
 */
export function sendDraftNotification(
  webhookUrl: string,
  params: DraftNotificationParams,
  botConfig?: DiscordBotConfig,
): ResultAsync<void, Error> {
  const editUrl = `https://${params.serviceDomain}.microcms.io/apis/${CONFIG.MICROCMS_ENDPOINT}/${params.contentId}`;
  const embed = buildDraftEmbed(params, editUrl);

  if (botConfig) {
    const botUrl = `${DISCORD_API_BASE}/channels/${botConfig.channelId}/messages`;
    const botPayload = {
      embeds: [embed],
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              style: 1,
              label: MESSAGES.DISCORD_BUTTON_PUBLISH_LABEL,
              custom_id: `publish_modal:${params.contentId}`,
            },
            {
              type: 2,
              style: 5,
              label: MESSAGES.DISCORD_BUTTON_OPEN_CMS_LABEL,
              url: editUrl,
            },
          ],
        },
      ],
    };
    return postDiscordRequest(botUrl, botPayload, botConfig.botToken);
  }

  return postDiscordRequest(webhookUrl, { embeds: [embed] });
}

/**
 * バッチ全体や記事処理で致命的なエラーが発生した際にDiscordへアラートを送信する
 */
export function sendErrorNotification(webhookUrl: string, detail: string): ResultAsync<void, Error> {
  const payload = {
    embeds: [
      {
        title: MESSAGES.FATAL_ERROR_TITLE,
        description: `${MESSAGES.FATAL_ERROR_DESCRIPTION}\n\`\`\`\n${detail.slice(0, 1500)}\n\`\`\``,
        color: 0xef4444,
      },
    ],
  };

  return postDiscordRequest(webhookUrl, payload);
}
