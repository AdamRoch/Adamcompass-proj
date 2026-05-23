import type { NotificationProvider } from './index.js';

export class TelegramDirectProvider implements NotificationProvider {
  constructor(
    private readonly opts: { botToken?: string; chatId?: string; baseUrl?: string },
  ) {}

  async send(args: {
    subject: string;
    body_markdown: string;
  }): Promise<{ id: string; status: 'sent' | 'failed'; error?: string }> {
    const id = crypto.randomUUID();
    if (!this.opts.botToken || !this.opts.chatId) {
      return { id, status: 'failed', error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID missing' };
    }
    const url =
      (this.opts.baseUrl ?? 'https://api.telegram.org') +
      `/bot${this.opts.botToken}/sendMessage`;
    // We use MarkdownV2 for predictable rendering. Telegram requires every reserved char in
    // text segments to be backslash-escaped. The subject is treated as plain text (escaped in
    // full); the body is expected to already be MarkdownV2-safe — producers (digest, stall
    // alerts, build-run notifications) must escape interpolated values via escapeMarkdownV2()
    // before they hit this provider.
    const text = args.subject
      ? `*${escapeMarkdownV2(args.subject)}*\n\n${args.body_markdown}`
      : args.body_markdown;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: this.opts.chatId,
          text,
          parse_mode: 'MarkdownV2',
          disable_web_page_preview: false,
        }),
      });
      if (!res.ok) {
        const body = await res.text();
        return { id, status: 'failed', error: `${res.status}: ${body.slice(0, 200)}` };
      }
      return { id, status: 'sent' };
    } catch (e) {
      return { id, status: 'failed', error: String(e) };
    }
  }
}

// Telegram MarkdownV2 spec: these characters MUST be escaped with a leading backslash anywhere
// they appear in plain-text contexts. Producers that build MarkdownV2 messages should pass any
// dynamic/interpolated string through this helper before embedding it.
// Reference: https://core.telegram.org/bots/api#markdownv2-style
const MARKDOWN_V2_SPECIAL = /[_*\[\]()~`>#+\-=|{}.!\\]/g;
export function escapeMarkdownV2(s: string): string {
  return s.replace(MARKDOWN_V2_SPECIAL, '\\$&');
}

// For URLs inside `[text](url)` MarkdownV2 only requires escaping `)` and `\`.
export function escapeMarkdownV2Url(s: string): string {
  return s.replace(/[\\)]/g, '\\$&');
}
