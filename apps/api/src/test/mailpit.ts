// Reads delivered mail back out of Mailpit's HTTP API.
export const MAILPIT_SMTP_URL = process.env.TEST_SMTP_URL ?? 'smtp://localhost:1025';
const MAILPIT_API = process.env.TEST_MAILPIT_API ?? 'http://localhost:8025/api/v1';

interface MailpitMessage {
  ID: string;
  Subject: string;
  Text: string;
  HTML: string;
}

/** Waits for the newest message to `to` and returns it with its text and HTML bodies. */
export async function waitForMail(to: string, timeoutMs = 5000): Promise<MailpitMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:"${to}"`)}`);
    const { messages } = (await res.json()) as { messages: { ID: string }[] };
    if (messages.length > 0) {
      const full = await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`);
      return (await full.json()) as MailpitMessage;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`no mail to ${to} within ${timeoutMs}ms`);
}
