import type { NotificationSender, PushMessage } from './service.js';

const expoTokenPattern = /^(Exponent|Expo)PushToken\[[A-Za-z0-9_-]+\]$/;

export function isExpoPushToken(value: string) {
  return expoTokenPattern.test(value);
}

export class ExpoNotificationSender implements NotificationSender {
  constructor(
    private readonly endpoint: string,
    private readonly accessToken?: string,
  ) {}

  async send(messages: PushMessage[]) {
    if (messages.length === 0) return { invalidTokens: [] };
    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {}),
      },
      body: JSON.stringify(
        messages.map(({ body, data, title, token }) => ({ to: token, title, body, data })),
      ),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('Expo push provider unavailable.');
    const payload = (await response.json()) as {
      data?: Array<{ details?: { error?: string }; status?: string }>;
    };
    const tickets = payload.data ?? [];
    if (
      tickets.some(
        (ticket) => ticket.status === 'error' && ticket.details?.error !== 'DeviceNotRegistered',
      )
    ) {
      throw new Error('Expo push provider returned a retryable ticket error.');
    }
    return {
      invalidTokens: tickets
        .map((ticket, index) =>
          ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered'
            ? messages[index]?.token
            : undefined,
        )
        .filter((token): token is string => Boolean(token)),
    };
  }
}
