export interface AccessTokenPayload {
  sid: string;
  sub: string;
  ver: number;
}

export interface AuthAccount {
  authVersion: number;
  email: string;
  id: string;
  sessionId: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: AccessTokenPayload;
    user: AccessTokenPayload;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    authAccount: AuthAccount | null;
  }
}
