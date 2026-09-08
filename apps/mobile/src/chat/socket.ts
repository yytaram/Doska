import { io } from 'socket.io-client';

import { getApiBaseUrl } from '../api/client';

export function createChatSocket(accessToken: string) {
  return io(getApiBaseUrl(), {
    auth: { token: accessToken },
    reconnection: true,
    transports: ['websocket', 'polling'],
  });
}
