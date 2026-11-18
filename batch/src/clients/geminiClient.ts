import { err, ok, type Result, type ResultAsync } from 'neverthrow';

import { CONFIG } from '@/constants/config';
import { MESSAGES } from '@/constants/messages';
import {
  geminiApiResponseSchema,
  type GeminiSummary,
  geminiSummarySchema,
} from '@/schemas/gemini';
import { fetchJsonWithSchema } from '@/utils/http';

function buildSummaryPrompt(enTitle: string, metaDescription: string): string {
  const descriptionText = metaDescription || MESSAGES.NO_META_DESCRIPTION;
  return [
    'あなたは優秀なITエンジニア向けニュースキュレーターです。',
    '以下のHacker Newsの記事情報をもとに、日本のエンジニアが興味を持つような自然な「日本語タイトル」と「3行要約」を作成してください。',
    '',
    `【英語タイトル】\n${enTitle}`,
    '',
    `【記事の概要（メタデータ）】\n${descriptionText}`,
  ].join('\n');
}

function parseSummaryText(rawText: string): Result<GeminiSummary, Error> {
  try {
    const parsedJson: unknown = JSON.parse(rawText);
    const validated = geminiSummarySchema.safeParse(parsedJson);
    if (!validated.success) {
      return err(new Error(`Gemini出力のスキーマ検証に失敗: ${validated.error.message}`));
    }

    return ok(validated.data);
  } catch (error) {
    return err(error instanceof Error ? error : new Error(String(error)));
  }
}

/**
 * Gemini API (Structured Outputs) を利用して日本語タイトルと3行要約を生成する
 */
export function generateJaSummary(
  apiKey: string,
  model: string,
  enTitle: string,
  metaDescription: string,
): ResultAsync<GeminiSummary, Error> {
  const url = `${CONFIG.GEMINI_API_BASE}/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: [{ parts: [{ text: buildSummaryPrompt(enTitle, metaDescription) }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          jaTitle: {
            type: 'STRING',
            description: 'エンジニア向けにわかりやすく翻訳した日本語タイトル',
          },
          summary: {
            type: 'STRING',
            description: '「・」から始まる3行の箇条書き要約（改行区切り）',
          },
        },
        required: ['jaTitle', 'summary'],
      },
    },
  };

  return fetchJsonWithSchema(url, geminiApiResponseSchema, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).andThen((data) => {
    const rawText = data.candidates[0]?.content.parts[0]?.text;
    if (!rawText) {
      return err(new Error('Gemini APIからの応答テキストが空だったよ'));
    }

    return parseSummaryText(rawText);
  });
}
