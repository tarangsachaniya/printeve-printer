// Server-only: reads SLACK_WEBHOOK_URL (not NEXT_PUBLIC_) and posts to Slack.
// Called only from app/api/log-error/route.ts — this app's lib/api.ts is client-only,
// so it always reports via a browser fetch to that route rather than calling this directly.

const APP_NAME = "printvana-printer";
const DEDUP_WINDOW_MS = 60_000;
const MAX_PER_MINUTE = 30;

const recentAlerts = new Map<string, number>();
let minuteWindowStart = Date.now();
let minuteCount = 0;
let warnedMissingWebhook = false;

export interface ClientErrorReport {
  message: string;
  stack?: string;
  digest?: string;
  path?: string;
  status?: number;
}

/** Fire-and-forget: never throws. */
export function reportClientError(input: ClientErrorReport): void {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    if (!warnedMissingWebhook) {
      warnedMissingWebhook = true;
      console.warn("SLACK_WEBHOOK_URL not set — Slack error alerts are disabled");
    }
    return;
  }

  const dedupKey = `${input.path ?? "-"}:${input.message}`;
  if (!shouldSend(dedupKey)) return;

  void postToSlack(webhookUrl, buildPayload(input));
}

function shouldSend(key: string): boolean {
  const now = Date.now();
  if (now - minuteWindowStart >= 60_000) {
    minuteWindowStart = now;
    minuteCount = 0;
  }
  if (minuteCount >= MAX_PER_MINUTE) return false;

  const lastSent = recentAlerts.get(key);
  if (lastSent && now - lastSent < DEDUP_WINDOW_MS) return false;

  recentAlerts.set(key, now);
  minuteCount++;
  if (recentAlerts.size > 500) {
    for (const [k, ts] of recentAlerts) {
      if (now - ts > DEDUP_WINDOW_MS) recentAlerts.delete(k);
    }
  }
  return true;
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…[truncated]` : text;
}

function buildPayload(input: ClientErrorReport) {
  const isServerError = input.status == null || input.status >= 500;
  const emoji = isServerError ? "🔴" : "🟠";
  const env = process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";
  const titleText = `${emoji} ${APP_NAME}${input.status ? ` — ${input.status}` : ""}`;

  const fields = [
    { type: "mrkdwn", text: `*App:*\n${APP_NAME}` },
    { type: "mrkdwn", text: `*Env:*\n${env}` },
    { type: "mrkdwn", text: `*Path:*\n${input.path ?? "—"}` },
  ];

  const blocks: unknown[] = [
    { type: "header", text: { type: "plain_text", text: truncate(titleText, 150) } },
    { type: "section", fields },
    { type: "section", text: { type: "mrkdwn", text: `*Error:*\n${truncate(input.message, 500)}` } },
  ];
  if (input.stack) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `\`\`\`${truncate(input.stack, 2500)}\`\`\`` } });
  }
  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: new Date().toISOString() }] });

  return { text: `${titleText} — ${truncate(input.message, 200)}`, blocks };
}

async function postToSlack(webhookUrl: string, payload: unknown): Promise<void> {
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error("Slack alert send failed", res.status);
  } catch (err) {
    console.error("Slack alert send threw", err);
  }
}
