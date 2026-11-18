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

function postDiscordPayload(webhookUrl: string, payload: unknown): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    (async () => {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Discord Webhook送信エラー (${res.status}): ${text}`);
      }
    })(),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );
}

/**
 * 下書き入稿完了の通知をmicroCMS編集画面の直リンク付きでDiscordへ送信する
 */
export function sendDraftNotification(
  webhookUrl: string,
  params: DraftNotificationParams,
): ResultAsync<void, Error> {
  const editUrl = `https://${params.serviceDomain}.microcms.io/apis/${CONFIG.MICROCMS_ENDPOINT}/${params.contentId}`;
  const payload = {
    embeds: [
      {
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
      },
    ],
  };

  return postDiscordPayload(webhookUrl, payload);
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

  return postDiscordPayload(webhookUrl, payload);
}
