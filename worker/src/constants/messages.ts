export const WORKER_MESSAGES = {
  ENV_INVALID: 'Worker環境変数のバリデーションに失敗したよ',
  DISPATCH_START: (owner: string, repo: string, workflowId: string) =>
    `GitHub Actions ワークフローを起動するよ: ${owner}/${repo} (${workflowId})`,
  DISPATCH_SUCCESS: 'ワークフローの起動リクエストが成功したよ！',
  DISPATCH_FAILED: (status: number, body: string) =>
    `GitHub Actions 起動リクエストが失敗したよ (HTTP ${status}): ${body}`,
  ERROR_EMBED_TITLE: '🚨 Cloudflare Cron Trigger でエラーが発生したよ！',
  ERROR_EMBED_DESCRIPTION: 'GitHub Actions の起動に失敗したため、設定やトークン期限を確認してね。',
} as const;
