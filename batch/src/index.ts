import { loadEnvConfig } from '@/schemas/env';
import { runSyncBatch } from '@/services/syncService';

async function main(): Promise<void> {
  const envResult = loadEnvConfig(process.env);
  if (envResult.isErr()) {
    console.error(envResult.error.message);
    process.exit(1);
  }

  const batchResult = await runSyncBatch(envResult.value);
  if (batchResult.isErr()) {
    console.error(batchResult.error.message);
    process.exit(1);
  }

  const { createdCount, skippedCount, failedCount } = batchResult.value;
  console.log(`結果: 新規=${createdCount}件, スキップ=${skippedCount}件, 失敗=${failedCount}件`);

  if (failedCount > 0 && createdCount === 0) {
    process.exit(1);
  }
}

main();
