import { parseInteractionEnv, parseWorkerEnv } from '@/schemas/env';
import { dispatchWorkflow, notifyDispatchError } from '@/services/dispatchService';
import { handleDiscordInteraction } from '@/services/interactionService';

export default {
  async fetch(request: Request, rawEnv: unknown, ctx: ExecutionContext): Promise<Response> {
    const envResult = parseInteractionEnv(rawEnv);
    if (envResult.isErr()) {
      console.error(envResult.error.message);
      return new Response('Worker configuration error', { status: 500 });
    }

    return handleDiscordInteraction(request, envResult.value, ctx);
  },

  async scheduled(_controller: ScheduledController, rawEnv: unknown, _ctx: ExecutionContext): Promise<void> {
    const envResult = parseWorkerEnv(rawEnv);
    if (envResult.isErr()) {
      console.error(envResult.error.message);
      return;
    }

    const env = envResult.value;
    const dispatchResult = await dispatchWorkflow(env);
    if (dispatchResult.isErr()) {
      console.error(dispatchResult.error.message);
      if (env.DISCORD_WEBHOOK_URL) {
        const notifyResult = await notifyDispatchError(env.DISCORD_WEBHOOK_URL, dispatchResult.error.message);
        if (notifyResult.isErr()) {
          console.error(notifyResult.error.message);
        }
      }
      throw dispatchResult.error;
    }
  },
};
