export const WORKER_MESSAGES = {
  ENV_INVALID: 'Worker環境変数のバリデーションに失敗したよ',
  DISPATCH_START: (owner: string, repo: string, workflowId: string) =>
    `GitHub Actions ワークフローを起動するよ: ${owner}/${repo} (${workflowId})`,
  DISPATCH_SUCCESS: 'ワークフローの起動リクエストが成功したよ！',
  DISPATCH_FAILED: (status: number, body: string) =>
    `GitHub Actions 起動リクエストが失敗したよ (HTTP ${status}): ${body}`,
  ERROR_EMBED_TITLE: '🚨 Cloudflare Cron Trigger でエラーが発生したよ！',
  ERROR_EMBED_DESCRIPTION: 'GitHub Actions の起動に失敗したため、設定やトークン期限を確認してね。',
  MODAL_TITLE: 'ひとことを添えて公開',
  MODAL_INPUT_LABEL: 'ひとことコメント（空欄のまま公開もOK）',
  MODAL_INPUT_PLACEHOLDER: 'この記事おもしろい！など感想を書いてね',
  PUBLISH_SUCCESS: (contentId: string, comment: string) =>
    comment
      ? `✅ 記事を公開したよ！ (ID: \`${contentId}\`)\n💬 **ひとこと**: ${comment}`
      : `✅ 記事をコメントなしで公開したよ！ (ID: \`${contentId}\`)`,
  PUBLISH_FAILED: (contentId: string, detail: string) =>
    `❌ 記事の公開に失敗したよ (ID: \`${contentId}\`)\n\`\`\`\n${detail.slice(0, 1200)}\n\`\`\``,
  UNKNOWN_INTERACTION: '未対応のアクションだよ',
} as const;
