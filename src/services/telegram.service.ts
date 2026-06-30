import { isAlertable } from '../lib';

export { isAlertable };

const TELEGRAM_API: string = 'https://api.telegram.org';

// Throttle: max 1 alert per unique (route + error type) per 5 minutes.
const throttleMap: Map<string, number> = new Map();
const THROTTLE_MS: number = 5 * 60 * 1000;

function shouldSend (key: string): boolean {
  const last: number = throttleMap.get(key) ?? 0;
  if (Date.now() - last > THROTTLE_MS) {
    throttleMap.set(key, Date.now());
    return true;
  }

  return false;
}

export interface ErrorContext {
  method: string;
  path: string;
  error: unknown;
}

/**
 * Sends a formatted alert to the configured Telegram chat.
 * Silent no-op when TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID are not set.
 */
export async function sendErrorAlert (ctx: ErrorContext): Promise<void> {
  const token: string | undefined = process.env.TELEGRAM_BOT_TOKEN;
  const chatId: string | undefined = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return;
  }

  const err: unknown = ctx.error;
  const errorType: string =
    err instanceof Error
      ? (err as NodeJS.ErrnoException).code ?? err.name
      : 'UnknownError';

  const throttleKey: string = `${ctx.method}:${ctx.path}:${errorType}`;
  if (!shouldSend(throttleKey)) {
    return;
  }

  const message: string = err instanceof Error ? err.message : String(err);
  const ts: string = new Date().toISOString();

  const text: string = [
    '🔴 *Backend Error*',
    `\`${ctx.method} ${ctx.path}\``,
    `Type: \`${errorType}\``,
    `Message: ${message}`,
    `Time: \`${ts}\``,
  ].join('\n');

  try {
    await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch {
    // Never let Telegram failures propagate into the request lifecycle.
  }
}
